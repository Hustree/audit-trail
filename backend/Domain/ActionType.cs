namespace AuditTrailPoc.Api.Domain;

/// <summary>
/// The kind of mutation an audit entry records.
/// Stored as a string so the audit log stays human-readable.
/// </summary>
public enum ActionType
{
    Insert,
    Update,
    Delete,
    Restore
}
