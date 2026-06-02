# AuditTrailPoc.Api

A small .NET 9 minimal-API proof of concept for a **change-tracker audit log** with
**restore-from-snapshot**. It demonstrates an EF Core `SaveChangesInterceptor` that walks the
change tracker on every save, diffs each mutated entity, and writes an immutable before/after
JSON snapshot into an audit table - so every create, update, and delete answers *who* changed
*what*, *when*, and *from what value to what value*. Because the full prior snapshot is kept, a
deleted record can be restored.

## Run

```bash
cd backend
dotnet run
```

The API listens on **http://localhost:5080** and allows CORS from **http://localhost:4200**.
On startup it creates and seeds a SQLite database (`audittrail.db`) with three sample accidents.
No SQL Server, no Docker, no migrations - a single `dotnet run`.

To attribute audit entries to a specific actor, send an `X-Demo-User` header (defaults to
`demo.admin@local`):

```bash
curl -X POST http://localhost:5080/api/accidents \
  -H "Content-Type: application/json" -H "X-Demo-User: alice@demo" \
  -d '{"title":"Gas leak","severity":"Low","location":"Boiler Room","status":"Open"}'
```

## How the audit mechanism works

`Auditing/AuditSaveChangesInterceptor.cs` is the core. On `SavingChanges` / `SavingChangesAsync` it:

- walks `ChangeTracker.Entries()` for `Added` / `Modified` / `Deleted` entities (excluding the
  audit table itself);
- infers the action - `Added` → Insert, `Modified` → Update, `Deleted` → Delete - with a
  **soft-delete override**: a `Modified` entity whose `IsActive` flips `true → false` is recorded
  as **Delete**, not Update;
- serializes the relevant snapshot side(s) with `System.Text.Json`, excluding the primary key
  (Insert → NewData only, Delete → OldData only, Update → both);
- skips no-op updates where OldData equals NewData;
- resolves the actor from a scoped current-user service and the table name from EF metadata;
- adds the generated audit rows to the same transaction so they persist atomically.

## Endpoints (base path `/api`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/accidents?pageIndex&pageSize` | List active accidents, newest first (paged envelope). |
| `POST` | `/api/accidents` | Create an accident (auto-generates `ACC-0001` style reference code). Body: `{ title, severity, location, status }`. |
| `PUT` | `/api/accidents/{id}` | Update an accident. Body: `{ title, severity, location, status }`. |
| `DELETE` | `/api/accidents/{id}` | Soft-delete (sets `IsActive = false`). Returns 204. |
| `GET` | `/api/audit-trail?tableName&actionType&module&createdBy&createdDate&pageIndex&pageSize&sortKey&sortDirection` | List audit entries, newest first, with per-field filters. |
| `POST` | `/api/audit-trail/{id}/restore` | Restore an accident from the entry's `OldData` snapshot and log a **Restore** entry. 404 if the entry is missing; 409 if a live accident already owns that reference code. |

All responses are camelCase JSON. List endpoints return
`{ result, pageIndex, pageSize, totalRecords }`.

## Tests

A xUnit test suite lives in `../backend.Tests` (unit tests for the audit interceptor plus
`WebApplicationFactory` integration tests for the endpoints). All tests use isolated
in-memory SQLite databases, so they never touch `audittrail.db` or a running dev instance.
Run them from the repo root via the solution:

```bash
dotnet test AuditTrail.sln
```

## Notes

- The audit table is **append-only** - the app never updates or deletes audit rows.
- In production the audit store would ideally live in a separate database/schema so application
  deletes cannot touch history. This POC collapses to a single SQLite file for simplicity.
- Authentication is stubbed (current-user service + `X-Demo-User` header). A real target wires
  this to its own auth layer.
