using System.Text.Json;
using AuditTrailPoc.Api.Auditing;
using AuditTrailPoc.Api.Data;
using AuditTrailPoc.Api.Domain;
using AuditTrailPoc.Api.Models;
using AuditTrailPoc.Api.Services;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

const string FrontendCors = "FrontendCors";

builder.Services.AddCors(options =>
{
    // Allow the Angular dev server on any localhost port (it may not always be 4200).
    options.AddPolicy(FrontendCors, policy =>
        policy.SetIsOriginAllowed(origin =>
                  Uri.TryCreate(origin, UriKind.Absolute, out var uri) &&
                  (uri.Host == "localhost" || uri.Host == "127.0.0.1"))
              .AllowAnyHeader()
              .AllowAnyMethod());
});

// camelCase JSON for all minimal-API responses.
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
});

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();
builder.Services.AddScoped<AuditState>();
builder.Services.AddScoped<AuditSaveChangesInterceptor>();

// OpenAPI document + a Scalar UI to explore the API (served at /scalar).
builder.Services.AddOpenApi();

builder.Services.AddDbContext<AppDbContext>((sp, options) =>
{
    options.UseSqlite("Data Source=audittrail.db");
    options.AddInterceptors(sp.GetRequiredService<AuditSaveChangesInterceptor>());
});

var app = builder.Build();

app.UseCors(FrontendCors);

// Interactive API reference at /scalar (OpenAPI JSON at /openapi/v1.json).
app.MapOpenApi();
app.MapScalarApiReference();

// Create and seed the database on startup.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
    SeedData(db);
}

var api = app.MapGroup("/api");

// ---------------------------------------------------------------------------
// Accidents
// ---------------------------------------------------------------------------

api.MapGet("/accidents", async (AppDbContext db, int pageIndex = 1, int pageSize = 10) =>
{
    pageIndex = pageIndex < 1 ? 1 : pageIndex;
    pageSize = pageSize < 1 ? 10 : pageSize;

    var query = db.Accidents.AsNoTracking().Where(a => a.IsActive);
    var total = await query.CountAsync();

    var items = await query
        .OrderByDescending(a => a.Id)
        .Skip((pageIndex - 1) * pageSize)
        .Take(pageSize)
        .ToListAsync();

    return Results.Ok(new PagedResult<Accident>(items, pageIndex, pageSize, total));
});

api.MapPost("/accidents", async (AppDbContext db, ICurrentUser currentUser, AccidentRequest request) =>
{
    var nextNumber = (await db.Accidents.MaxAsync(a => (int?)a.Id) ?? 0) + 1;

    var accident = new Accident
    {
        ReferenceCode = $"ACC-{nextNumber:D4}",
        Title = request.Title ?? string.Empty,
        Severity = request.Severity ?? string.Empty,
        Location = request.Location ?? string.Empty,
        Status = request.Status ?? string.Empty,
        IsActive = true,
        CreatedBy = currentUser.UserId,
        CreatedDate = DateTime.UtcNow
    };

    db.Accidents.Add(accident);
    await db.SaveChangesAsync();

    return Results.Created($"/api/accidents/{accident.Id}", accident);
});

api.MapPut("/accidents/{id:int}", async (AppDbContext db, ICurrentUser currentUser, int id, AccidentRequest request) =>
{
    var accident = await db.Accidents.FirstOrDefaultAsync(a => a.Id == id && a.IsActive);
    if (accident is null)
    {
        return Results.NotFound();
    }

    accident.Title = request.Title ?? accident.Title;
    accident.Severity = request.Severity ?? accident.Severity;
    accident.Location = request.Location ?? accident.Location;
    accident.Status = request.Status ?? accident.Status;
    accident.ModifiedBy = currentUser.UserId;
    accident.ModifiedDate = DateTime.UtcNow;

    await db.SaveChangesAsync();

    return Results.Ok(accident);
});

api.MapDelete("/accidents/{id:int}", async (AppDbContext db, ICurrentUser currentUser, int id) =>
{
    var accident = await db.Accidents.FirstOrDefaultAsync(a => a.Id == id && a.IsActive);
    if (accident is null)
    {
        return Results.NotFound();
    }

    // Soft delete: flip IsActive so the row and its snapshot survive. The interceptor
    // records this as a Delete action via its soft-delete override.
    accident.IsActive = false;
    accident.ModifiedBy = currentUser.UserId;
    accident.ModifiedDate = DateTime.UtcNow;

    await db.SaveChangesAsync();

    return Results.NoContent();
});

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

api.MapGet("/audit-trail", async (
    AppDbContext db,
    string? tableName,
    string? actionType,
    string? module,
    string? createdBy,
    string? createdDate,
    string? sortKey,
    string? sortDirection,
    int pageIndex = 1,
    int pageSize = 10) =>
{
    pageIndex = pageIndex < 1 ? 1 : pageIndex;
    pageSize = pageSize < 1 ? 10 : pageSize;

    var query = db.AuditTrails.AsNoTracking().AsQueryable();

    if (!string.IsNullOrWhiteSpace(tableName))
        query = query.Where(a => a.TableName == tableName);
    if (!string.IsNullOrWhiteSpace(actionType))
        query = query.Where(a => a.ActionType == actionType);
    if (!string.IsNullOrWhiteSpace(module))
        query = query.Where(a => a.Module == module);
    if (!string.IsNullOrWhiteSpace(createdBy))
        query = query.Where(a => a.CreatedBy == createdBy);
    if (!string.IsNullOrWhiteSpace(createdDate) && DateTime.TryParse(createdDate, out var parsedDate))
    {
        var nextDay = parsedDate.Date.AddDays(1);
        query = query.Where(a => a.CreatedDate >= parsedDate.Date && a.CreatedDate < nextDay);
    }

    var total = await query.CountAsync();

    // Newest-first by default; allow opt-in ascending sort on createdDate.
    var descending = !string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase);
    query = (sortKey?.ToLowerInvariant()) switch
    {
        "createddate" or null or "" => descending
            ? query.OrderByDescending(a => a.CreatedDate).ThenByDescending(a => a.Id)
            : query.OrderBy(a => a.CreatedDate).ThenBy(a => a.Id),
        _ => query.OrderByDescending(a => a.CreatedDate).ThenByDescending(a => a.Id)
    };

    var items = await query
        .Skip((pageIndex - 1) * pageSize)
        .Take(pageSize)
        .ToListAsync();

    return Results.Ok(new PagedResult<AuditTrail>(items, pageIndex, pageSize, total));
});

api.MapPost("/audit-trail/{id:int}/restore", async (AppDbContext db, ICurrentUser currentUser, AuditState auditState, int id) =>
{
    var entry = await db.AuditTrails.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id);
    if (entry is null)
    {
        return Results.NotFound(new { message = "Audit entry not found." });
    }

    var snapshot = ParseSnapshot(entry.OldData);
    var referenceCode = entry.ReferenceCode;

    // Refuse to clobber a live record that already owns this reference code.
    var liveExisting = await db.Accidents.FirstOrDefaultAsync(a => a.ReferenceCode == referenceCode && a.IsActive);
    if (liveExisting is not null)
    {
        return Results.Conflict(new { message = $"A live accident with reference code '{referenceCode}' already exists." });
    }

    // Re-activate a soft-deleted row if present, otherwise re-create from the snapshot.
    var inactive = await db.Accidents.FirstOrDefaultAsync(a => a.ReferenceCode == referenceCode && !a.IsActive);
    Accident restored;

    if (inactive is not null)
    {
        inactive.IsActive = true;
        ApplySnapshot(inactive, snapshot);
        inactive.ModifiedBy = currentUser.UserId;
        inactive.ModifiedDate = DateTime.UtcNow;
        restored = inactive;
    }
    else
    {
        restored = new Accident
        {
            ReferenceCode = referenceCode,
            IsActive = true,
            CreatedBy = currentUser.UserId,
            CreatedDate = DateTime.UtcNow
        };
        ApplySnapshot(restored, snapshot);
        db.Accidents.Add(restored);
    }

    // Save the restored record with auditing suppressed: re-activating the row is a normal modify
    // that would log a redundant Update, but the explicit Restore entry below is the one we want.
    auditState.Suppressed = true;
    await db.SaveChangesAsync();
    auditState.Suppressed = false;

    // Append an explicit Restore audit entry.
    db.AuditTrails.Add(new AuditTrail
    {
        TableName = entry.TableName,
        ReferenceCode = referenceCode,
        OldData = "{}",
        NewData = entry.OldData,
        ActionType = ActionType.Restore.ToString(),
        Module = nameof(Accident),
        CreatedBy = currentUser.UserId,
        CreatedDate = DateTime.UtcNow
    });
    await db.SaveChangesAsync();

    return Results.Ok(restored);
});

app.Run();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

static Dictionary<string, string> ParseSnapshot(string json)
{
    if (string.IsNullOrWhiteSpace(json) || json == "{}")
    {
        return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    }

    try
    {
        var raw = JsonSerializer.Deserialize<Dictionary<string, string?>>(json);
        return raw is null
            ? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            : raw.ToDictionary(kv => kv.Key, kv => kv.Value ?? string.Empty, StringComparer.OrdinalIgnoreCase);
    }
    catch (JsonException)
    {
        return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    }
}

static void ApplySnapshot(Accident accident, Dictionary<string, string> snapshot)
{
    if (snapshot.TryGetValue(nameof(Accident.Title), out var title)) accident.Title = title;
    if (snapshot.TryGetValue(nameof(Accident.Severity), out var severity)) accident.Severity = severity;
    if (snapshot.TryGetValue(nameof(Accident.Location), out var location)) accident.Location = location;
    if (snapshot.TryGetValue(nameof(Accident.Status), out var status)) accident.Status = status;
}

static void SeedData(AppDbContext db)
{
    if (db.Accidents.Any())
    {
        return;
    }

    var now = DateTime.UtcNow;
    DateTime At(double daysAgo) => now.AddDays(-daysAgo);

    // Each operation is its own SaveChanges so it maps to exactly one audit row, in order.
    // This walks a believable incident lifecycle (log, triage, escalate, resolve, soft-delete)
    // so the audit trail opens with a real Insert / Update / Delete narrative, not a flat list
    // of inserts. Actor + timestamp on the audit rows are re-stamped afterward (see below).
    Accident Insert(string refCode, string title, string severity, string location, string status, string by, DateTime when)
    {
        var a = new Accident
        {
            ReferenceCode = refCode, Title = title, Severity = severity, Location = location,
            Status = status, IsActive = true, CreatedBy = by, CreatedDate = when
        };
        db.Accidents.Add(a);
        db.SaveChanges();
        return a;
    }

    void Update(Accident a, Action<Accident> mutate, string by, DateTime when)
    {
        mutate(a);
        a.ModifiedBy = by;
        a.ModifiedDate = when;
        db.SaveChanges();
    }

    void SoftDelete(Accident a, string by, DateTime when)
    {
        a.IsActive = false;
        a.ModifiedBy = by;
        a.ModifiedDate = when;
        db.SaveChanges();
    }

    var a1 = Insert("ACC-0001", "Forklift struck racking in Aisle 4", "High", "Warehouse B", "Open", "Jose Dimakita", At(6));
    var a2 = Insert("ACC-0002", "Chemical splash during decanting", "Medium", "Lab 3", "Open", "Jose Dimakita", At(6).AddMinutes(12));
    var a3 = Insert("ACC-0003", "Slip on wet floor near entrance", "Low", "Main Lobby", "Open", "Jennefer Fisher-Bascos", At(5));
    Update(a1, a => a.Status = "Investigating", "Jennefer Fisher-Bascos", At(5).AddMinutes(20));
    var a4 = Insert("ACC-0004", "Electrical fault tripped Server Room breaker", "Critical", "Server Room", "Investigating", "Jane Doe", At(4));
    Update(a2, a => a.Severity = "High", "Joshua Bascos", At(3));
    Update(a1, a => { a.Severity = "Critical"; a.Status = "Resolved"; }, "Jane Doe", At(2));
    SoftDelete(a3, "Jennefer Fisher-Bascos", At(1)); // logged as a duplicate report, stays restorable from the trail
    Insert("ACC-0005", "Near-miss: pallet fell from height", "Medium", "Loading Dock", "Open", "Jose Dimakita", At(0.25));
    Update(a4, a => a.Status = "Resolved", "Joshua Bascos", At(0.08)); // most recent, lands at the top of the trail

    // Re-stamp the generated audit rows with the real actor + time of each action. The
    // interceptor excludes AuditTrail from its own walk, so editing these rows does not recurse.
    var rows = db.AuditTrails.OrderBy(r => r.Id).ToList();
    var meta = new (string By, DateTime When)[]
    {
        ("Jose Dimakita", At(6)),
        ("Jose Dimakita", At(6).AddMinutes(12)),
        ("Jennefer Fisher-Bascos", At(5)),
        ("Jennefer Fisher-Bascos", At(5).AddMinutes(20)),
        ("Jane Doe", At(4)),
        ("Joshua Bascos", At(3)),
        ("Jane Doe", At(2)),
        ("Jennefer Fisher-Bascos", At(1)),
        ("Jose Dimakita", At(0.25)),
        ("Joshua Bascos", At(0.08)),
    };
    for (var i = 0; i < rows.Count && i < meta.Length; i++)
    {
        rows[i].CreatedBy = meta[i].By;
        rows[i].CreatedDate = meta[i].When;
    }
    db.SaveChanges();
}

// Exposed so the test project can drive the app via WebApplicationFactory<Program>.
public partial class Program { }
