namespace AuditTrailPoc.Api.Models;

/// <summary>Create/update payload for an accident.</summary>
public record AccidentRequest(string? Title, string? Severity, string? Location, string? Status);

/// <summary>Paged envelope returned by list endpoints.</summary>
public record PagedResult<T>(IReadOnlyList<T> Result, int PageIndex, int PageSize, int TotalRecords);
