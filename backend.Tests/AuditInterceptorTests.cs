using AuditTrailPoc.Api.Auditing;
using AuditTrailPoc.Api.Data;
using AuditTrailPoc.Api.Domain;
using AuditTrailPoc.Api.Services;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Xunit;

namespace AuditTrailPoc.Tests;

/// <summary>
/// Direct unit tests for <see cref="AuditSaveChangesInterceptor"/> — the crown jewel.
/// Each test spins up a fresh AppDbContext backed by a dedicated, kept-open in-memory
/// SQLite connection, wired with the real interceptor and a fake current user.
/// </summary>
public sealed class AuditInterceptorTests : IDisposable
{
    private const string Actor = "tester@unit";

    private readonly SqliteConnection _connection;

    public AuditInterceptorTests()
    {
        // An in-memory SQLite DB only lives as long as its connection is open, so we keep one
        // open for the lifetime of the test and hand fresh contexts the same connection.
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        using var db = CreateContext();
        db.Database.EnsureCreated();
    }

    private sealed class FakeCurrentUser : ICurrentUser
    {
        public FakeCurrentUser(string userId) => UserId = userId;
        public string UserId { get; }
    }

    private AppDbContext CreateContext(string actor = Actor)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .AddInterceptors(new AuditSaveChangesInterceptor(new FakeCurrentUser(actor), new AuditState()))
            .Options;

        return new AppDbContext(options);
    }

    private static Accident NewAccident(string code = "ACC-1001") => new()
    {
        ReferenceCode = code,
        Title = "Slip on wet floor",
        Severity = "Low",
        Location = "Lobby",
        Status = "Open",
        IsActive = true,
        CreatedBy = "seed",
        CreatedDate = DateTime.UtcNow
    };

    [Fact]
    public async Task Insert_writes_single_audit_entry_with_new_data_and_pk_excluded()
    {
        await using (var db = CreateContext())
        {
            db.Accidents.Add(NewAccident());
            await db.SaveChangesAsync();
        }

        await using var verify = CreateContext();
        var entries = await verify.AuditTrails.ToListAsync();

        entries.Should().ContainSingle();
        var entry = entries[0];

        entry.ActionType.Should().Be(nameof(ActionType.Insert));
        entry.OldData.Should().Be("{}");
        entry.CreatedBy.Should().Be(Actor);
        entry.Module.Should().Be(nameof(Accident));

        var newData = JsonSerializer.Deserialize<Dictionary<string, string>>(entry.NewData)!;
        newData.Should().ContainKey(nameof(Accident.Title))
            .WhoseValue.Should().Be("Slip on wet floor");
        newData.Should().ContainKey(nameof(Accident.Severity)).WhoseValue.Should().Be("Low");
        // The primary key must never appear in a snapshot.
        newData.Should().NotContainKey(nameof(Accident.Id));
    }

    [Fact]
    public async Task Update_writes_update_entry_with_old_and_new_differing_on_changed_field()
    {
        int id;
        await using (var seed = CreateContext())
        {
            var a = NewAccident();
            seed.Accidents.Add(a);
            await seed.SaveChangesAsync();
            id = a.Id;
        }

        await using (var db = CreateContext())
        {
            var a = await db.Accidents.FirstAsync(x => x.Id == id);
            a.Status = "Investigating";
            await db.SaveChangesAsync();
        }

        await using var verify = CreateContext();
        var update = await verify.AuditTrails
            .SingleAsync(e => e.ActionType == nameof(ActionType.Update));

        var oldData = JsonSerializer.Deserialize<Dictionary<string, string>>(update.OldData)!;
        var newData = JsonSerializer.Deserialize<Dictionary<string, string>>(update.NewData)!;

        oldData[nameof(Accident.Status)].Should().Be("Open");
        newData[nameof(Accident.Status)].Should().Be("Investigating");
        oldData[nameof(Accident.Status)].Should().NotBe(newData[nameof(Accident.Status)]);
        update.CreatedBy.Should().Be(Actor);
    }

    [Fact]
    public async Task SoftDelete_is_recorded_as_Delete_with_full_prior_snapshot()
    {
        int id;
        await using (var seed = CreateContext())
        {
            var a = NewAccident();
            seed.Accidents.Add(a);
            await seed.SaveChangesAsync();
            id = a.Id;
        }

        await using (var db = CreateContext())
        {
            var a = await db.Accidents.FirstAsync(x => x.Id == id);
            a.IsActive = false; // soft delete
            await db.SaveChangesAsync();
        }

        await using var verify = CreateContext();
        var deletes = await verify.AuditTrails
            .Where(e => e.ActionType == nameof(ActionType.Delete))
            .ToListAsync();

        deletes.Should().ContainSingle("a soft delete must be classified as Delete, not Update");
        var delete = deletes[0];

        delete.ActionType.Should().Be(nameof(ActionType.Delete));
        delete.NewData.Should().Be("{}");

        var oldData = JsonSerializer.Deserialize<Dictionary<string, string>>(delete.OldData)!;
        // Full prior snapshot present.
        oldData[nameof(Accident.Title)].Should().Be("Slip on wet floor");
        oldData[nameof(Accident.Severity)].Should().Be("Low");
        oldData[nameof(Accident.Location)].Should().Be("Lobby");
        oldData[nameof(Accident.Status)].Should().Be("Open");
        oldData[nameof(Accident.IsActive)].Should().Be("True");
    }

    [Fact]
    public async Task NoOp_save_writes_no_audit_entry()
    {
        int id;
        await using (var seed = CreateContext())
        {
            var a = NewAccident();
            seed.Accidents.Add(a);
            await seed.SaveChangesAsync();
            id = a.Id;
        }

        int auditCountBefore;
        await using (var count = CreateContext())
        {
            auditCountBefore = await count.AuditTrails.CountAsync();
        }

        await using (var db = CreateContext())
        {
            var a = await db.Accidents.FirstAsync(x => x.Id == id);
            // Assign the same values back — no real change.
            a.Status = a.Status;
            a.Title = a.Title;
            await db.SaveChangesAsync();
        }

        await using var verify = CreateContext();
        var auditCountAfter = await verify.AuditTrails.CountAsync();

        auditCountAfter.Should().Be(auditCountBefore, "a no-op save must not append an audit row");
    }

    [Fact]
    public async Task Actor_on_written_entry_equals_the_current_user()
    {
        const string customActor = "alice@demo";

        await using (var db = CreateContext(customActor))
        {
            db.Accidents.Add(NewAccident("ACC-2002"));
            await db.SaveChangesAsync();
        }

        await using var verify = CreateContext();
        var entry = await verify.AuditTrails.SingleAsync();

        entry.CreatedBy.Should().Be(customActor);
    }

    public void Dispose() => _connection.Dispose();
}
