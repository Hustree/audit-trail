namespace AuditTrailPoc.Api.Domain;

/// <summary>
/// One immutable row per mutation: who changed what, when, and from what value to what value.
/// Entries are append-only and are never updated or deleted by the application.
/// </summary>
public class AuditTrail
{
    public int Id { get; set; }
    public string TableName { get; set; } = string.Empty;
    public string ReferenceCode { get; set; } = string.Empty;

    /// <summary>Full JSON snapshot before the change ("{}" for an insert).</summary>
    public string OldData { get; set; } = "{}";

    /// <summary>Full JSON snapshot after the change ("{}" for a delete).</summary>
    public string NewData { get; set; } = "{}";

    /// <summary>Action type, persisted as a string for readability.</summary>
    public string ActionType { get; set; } = string.Empty;

    /// <summary>The audited entity type name (e.g. "Accident").</summary>
    public string Module { get; set; } = string.Empty;

    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedDate { get; set; }
}
