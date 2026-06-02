using AuditTrailPoc.Api.Domain;
using FluentAssertions;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace AuditTrailPoc.Tests;

/// <summary>
/// End-to-end endpoint tests driven through a WebApplicationFactory whose DbContext is swapped
/// to an isolated in-memory SQLite, so they never touch the dev audittrail.db (or a running
/// dev instance on port 5080).
/// </summary>
public sealed class AuditTrailEndpointsTests : IClassFixture<AuditTrailApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly AuditTrailApiFactory _factory;

    public AuditTrailEndpointsTests(AuditTrailApiFactory factory) => _factory = factory;

    // Minimal mirrors of the API response shapes (camelCase via web defaults).
    private sealed record AccidentDto(
        int Id, string ReferenceCode, string Title, string Severity,
        string Location, string Status, bool IsActive);

    private sealed record AuditDto(
        int Id, string TableName, string ReferenceCode, string OldData,
        string NewData, string ActionType, string Module, string CreatedBy);

    private sealed record PagedDto<T>(IReadOnlyList<T> Result, int PageIndex, int PageSize, int TotalRecords);

    private static AccidentRequestBody NewBody(string title = "Gas leak") =>
        new(title, "Low", "Boiler Room", "Open");

    private sealed record AccidentRequestBody(string Title, string Severity, string Location, string Status);

    [Fact]
    public async Task Post_accident_succeeds_and_creates_Insert_audit_entry()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/accidents", NewBody("Gas leak A"));
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var created = await response.Content.ReadFromJsonAsync<AccidentDto>(Json);
        created.Should().NotBeNull();
        created!.Title.Should().Be("Gas leak A");

        var audits = await GetAudits(client, referenceCode: created.ReferenceCode);
        audits.Should().Contain(a => a.ActionType == nameof(ActionType.Insert));
    }

    [Fact]
    public async Task Put_accident_creates_Update_audit_entry()
    {
        var client = _factory.CreateClient();

        var created = await CreateAccident(client, "Forklift B");

        var put = await client.PutAsJsonAsync(
            $"/api/accidents/{created.Id}",
            new AccidentRequestBody("Forklift B - updated", "High", "Warehouse", "Investigating"));
        put.StatusCode.Should().Be(HttpStatusCode.OK);

        var audits = await GetAudits(client, referenceCode: created.ReferenceCode);
        audits.Should().Contain(a => a.ActionType == nameof(ActionType.Update));
    }

    [Fact]
    public async Task Delete_accident_softdeletes_and_creates_Delete_entry()
    {
        var client = _factory.CreateClient();

        var created = await CreateAccident(client, "Spill C");

        var delete = await client.DeleteAsync($"/api/accidents/{created.Id}");
        delete.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // No longer in the active list.
        var active = await GetActiveAccidents(client);
        active.Should().NotContain(a => a.Id == created.Id);

        var audits = await GetAudits(client, referenceCode: created.ReferenceCode);
        audits.Should().Contain(a => a.ActionType == nameof(ActionType.Delete));
    }

    [Fact]
    public async Task Restore_reactivates_accident_and_creates_Restore_entry()
    {
        var client = _factory.CreateClient();

        var created = await CreateAccident(client, "Restore D");
        await client.DeleteAsync($"/api/accidents/{created.Id}");

        var deleteEntry = (await GetAudits(client, referenceCode: created.ReferenceCode))
            .First(a => a.ActionType == nameof(ActionType.Delete));

        var restore = await client.PostAsync($"/api/audit-trail/{deleteEntry.Id}/restore", null);
        restore.StatusCode.Should().Be(HttpStatusCode.OK);

        // Active again.
        var active = await GetActiveAccidents(client);
        active.Should().Contain(a => a.ReferenceCode == created.ReferenceCode);

        var audits = await GetAudits(client, referenceCode: created.ReferenceCode);
        audits.Should().Contain(a => a.ActionType == nameof(ActionType.Restore));
    }

    [Fact]
    public async Task Restore_returns_409_when_a_live_record_with_that_reference_already_exists()
    {
        var client = _factory.CreateClient();

        var created = await CreateAccident(client, "Conflict E");
        await client.DeleteAsync($"/api/accidents/{created.Id}");

        var deleteEntry = (await GetAudits(client, referenceCode: created.ReferenceCode))
            .First(a => a.ActionType == nameof(ActionType.Delete));

        // First restore succeeds -> the record is live again.
        var first = await client.PostAsync($"/api/audit-trail/{deleteEntry.Id}/restore", null);
        first.StatusCode.Should().Be(HttpStatusCode.OK);

        // Second restore of the same delete entry conflicts with the now-live record.
        var second = await client.PostAsync($"/api/audit-trail/{deleteEntry.Id}/restore", null);
        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Restore_returns_404_when_audit_entry_id_does_not_exist()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsync("/api/audit-trail/999999/restore", null);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Get_auditTrail_filters_by_actionType_Delete()
    {
        var client = _factory.CreateClient();

        var created = await CreateAccident(client, "Filter F");
        await client.DeleteAsync($"/api/accidents/{created.Id}");

        var page = await client.GetFromJsonAsync<PagedDto<AuditDto>>(
            "/api/audit-trail?actionType=Delete&pageSize=100", Json);

        page.Should().NotBeNull();
        page!.Result.Should().NotBeEmpty();
        page.Result.Should().OnlyContain(a => a.ActionType == nameof(ActionType.Delete));
        page.Result.Should().Contain(a => a.ReferenceCode == created.ReferenceCode);
    }

    // --- helpers ---

    private async Task<AccidentDto> CreateAccident(HttpClient client, string title)
    {
        var response = await client.PostAsJsonAsync("/api/accidents", NewBody(title));
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await response.Content.ReadFromJsonAsync<AccidentDto>(Json);
        created.Should().NotBeNull();
        return created!;
    }

    private async Task<IReadOnlyList<AccidentDto>> GetActiveAccidents(HttpClient client)
    {
        var page = await client.GetFromJsonAsync<PagedDto<AccidentDto>>(
            "/api/accidents?pageSize=100", Json);
        return page!.Result;
    }

    private async Task<IReadOnlyList<AuditDto>> GetAudits(HttpClient client, string referenceCode)
    {
        var page = await client.GetFromJsonAsync<PagedDto<AuditDto>>(
            "/api/audit-trail?pageSize=200", Json);
        return page!.Result.Where(a => a.ReferenceCode == referenceCode).ToList();
    }
}
