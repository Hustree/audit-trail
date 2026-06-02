namespace AuditTrailPoc.Api.Auditing;

/// <summary>
/// Per-request switch that lets a single code path opt one <c>SaveChanges</c> out of automatic
/// audit generation. Used by the restore flow: re-activating a soft-deleted row is a normal
/// modify (and would otherwise be logged as an Update), but the restore endpoint logs its own
/// explicit <c>Restore</c> entry instead, so the re-activation save is suppressed to avoid a
/// redundant second row.
/// </summary>
public sealed class AuditState
{
    public bool Suppressed { get; set; }
}
