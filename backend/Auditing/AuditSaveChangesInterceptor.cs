using AuditTrailPoc.Api.Data;
using AuditTrailPoc.Api.Domain;
using AuditTrailPoc.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Text.Json;

namespace AuditTrailPoc.Api.Auditing;

/// <summary>
/// The audit trigger mechanism. Instead of hand-writing audit code per field, this walks
/// EF Core's change tracker at save time, classifies each tracked entity, and serializes a
/// full before/after JSON snapshot into an <see cref="AuditTrail"/> row added to the same
/// transaction so it persists atomically with the change it describes.
/// </summary>
public sealed class AuditSaveChangesInterceptor : SaveChangesInterceptor
{
    private readonly ICurrentUser _currentUser;
    private readonly AuditState _auditState;

    public AuditSaveChangesInterceptor(ICurrentUser currentUser, AuditState auditState)
    {
        _currentUser = currentUser;
        _auditState = auditState;
    }

    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result)
    {
        if (eventData.Context is AppDbContext context)
        {
            GenerateAuditEntries(context);
        }

        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        if (eventData.Context is AppDbContext context)
        {
            GenerateAuditEntries(context);
        }

        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    /// <summary>
    /// Walks the change tracker for Added/Modified/Deleted entities (excluding the audit table
    /// itself), infers the action type with a soft-delete override, serializes the relevant
    /// snapshot side(s), and appends an audit row per mutation.
    /// </summary>
    private void GenerateAuditEntries(AppDbContext context)
    {
        // A code path (the restore flow) may opt this save out of automatic auditing because it
        // logs its own explicit entry instead.
        if (_auditState.Suppressed)
        {
            return;
        }

        var actor = _currentUser.UserId;
        var timestamp = DateTime.UtcNow;

        var trackedEntries = context.ChangeTracker.Entries()
            .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted
                        && e.Entity.GetType() != typeof(AuditTrail))
            .ToList();

        var auditRows = new List<AuditTrail>();

        foreach (var entry in trackedEntries)
        {
            var tableName = entry.Metadata.FindAnnotation("Relational:TableName")?.Value?.ToString()
                            ?? entry.Metadata.ClrType.Name;

            // Soft-delete detection: a Modified entity whose IsActive flips true -> false
            // is recorded as a Delete, not an Update.
            var hasIsActive = entry.OriginalValues.Properties.Any(p => p.Name == "IsActive");
            var isSoftDeleted =
                entry.State == EntityState.Modified &&
                hasIsActive &&
                entry.OriginalValues["IsActive"] is bool originalIsActive && originalIsActive &&
                entry.CurrentValues["IsActive"] is bool currentIsActive && !currentIsActive;

            var actionType = isSoftDeleted
                ? ActionType.Delete
                : entry.State switch
                {
                    EntityState.Added => ActionType.Insert,
                    EntityState.Modified => ActionType.Update,
                    EntityState.Deleted => ActionType.Delete,
                    _ => throw new InvalidOperationException("Unexpected entity state.")
                };

            var oldData = "{}";
            var newData = "{}";

            switch (actionType)
            {
                case ActionType.Insert:
                    newData = SerializeValues(entry, entry.CurrentValues);
                    break;
                case ActionType.Delete:
                    oldData = SerializeValues(entry, entry.OriginalValues);
                    break;
                default: // Update
                    oldData = SerializeValues(entry, entry.OriginalValues);
                    newData = SerializeValues(entry, entry.CurrentValues);
                    break;
            }

            // Skip no-op updates where the before/after snapshots are identical.
            if (oldData == newData && !isSoftDeleted)
            {
                continue;
            }

            var referenceCode = ResolveReferenceCode(entry);

            auditRows.Add(new AuditTrail
            {
                TableName = tableName,
                ReferenceCode = referenceCode,
                OldData = oldData,
                NewData = newData,
                ActionType = actionType.ToString(),
                Module = entry.Metadata.ClrType.Name,
                CreatedBy = actor,
                CreatedDate = timestamp
            });
        }

        // Add the generated rows after the walk so they persist in the same transaction
        // without being picked up by the change-tracker enumeration above.
        if (auditRows.Count > 0)
        {
            context.AuditTrails.AddRange(auditRows);
        }
    }

    /// <summary>
    /// Resolves the business key used to trace all entries for one record. Falls back to the
    /// primary key value when no ReferenceCode property is present.
    /// </summary>
    private static string ResolveReferenceCode(EntityEntry entry)
    {
        var refProp = entry.Metadata.FindProperty("ReferenceCode");
        if (refProp != null)
        {
            var values = entry.State == EntityState.Deleted ? entry.OriginalValues : entry.CurrentValues;
            return values[refProp]?.ToString() ?? string.Empty;
        }

        var pk = entry.Metadata.FindPrimaryKey()?.Properties.FirstOrDefault();
        return pk != null ? entry.CurrentValues[pk]?.ToString() ?? string.Empty : string.Empty;
    }

    /// <summary>
    /// Serializes the tracked property values to JSON, excluding the primary key so it never
    /// appears in a snapshot. The field-exclusion set can be extended to drop sensitive fields.
    /// </summary>
    private static string SerializeValues(EntityEntry entry, PropertyValues values)
    {
        var excluded = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var primaryKeyNames = entry.Metadata.FindPrimaryKey()?.Properties.Select(p => p.Name)
                              ?? Enumerable.Empty<string>();
        foreach (var pk in primaryKeyNames)
        {
            excluded.Add(pk);
        }

        var filtered = values.Properties
            .Where(p => !excluded.Contains(p.Name))
            .ToDictionary(
                p => p.Name,
                p => values[p]?.ToString() ?? "null");

        return filtered.Count > 0
            ? JsonSerializer.Serialize(filtered)
            : "{}";
    }
}
