# Agent Guide

This file orients an AI coding agent (Claude Code, Codex, Cursor, etc.) so it can pick up this
repository and be productive fast. Read it first, then `README.md`, then the one file that matters
most: `backend/Auditing/AuditSaveChangesInterceptor.cs`.

## What this project is

A small, production-shaped reference implementation of a system-wide audit log. Every create,
update, and delete is captured automatically at the ORM boundary (an EF Core
`SaveChangesInterceptor`), rendered as a field-level before/after diff, and any deletion can be
restored from its snapshot. Backend is a .NET 9 minimal API on EF Core + SQLite; frontend is an
Angular standalone app.

## Run it

```bash
make dev            # backend on :5080, frontend on :4200
# or separately:
cd backend && dotnet run          # API  -> http://localhost:5080  (Scalar UI at /scalar)
cd frontend && npm install && npm start   # app -> http://localhost:4200
```

The SQLite database (`backend/audittrail.db`) is gitignored and is created and seeded on first run.
To reset to the seeded demo data, delete it (or run `make clean`) and start the backend again.

## Test it

```bash
dotnet test                                   # backend: xUnit (interceptor + endpoint integration)
cd frontend && npm run test:ci                # frontend: Vitest + jsdom (no browser)
cd e2e && npm install && npx playwright install chromium && npm test   # Playwright end-to-end
```

CI (`.github/workflows/ci.yml`) runs all three on push and PR to `main`.

## Map of the code

| Area | Path |
|---|---|
| **The audit mechanism (start here)** | `backend/Auditing/AuditSaveChangesInterceptor.cs` |
| API endpoints + DI + seed | `backend/Program.cs` |
| Domain entities | `backend/Domain/` (`Accident`, `AuditTrail`, `ActionType`) |
| DbContext | `backend/Data/AppDbContext.cs` |
| Incidents (CRUD) page | `frontend/src/app/pages/accidents/` |
| Audit Trail page (3 views) | `frontend/src/app/pages/audit-trail/` |
| Diff engine + shared UI | `frontend/src/app/shared/` (`diff.util.ts`, `diff-viewer`, theming, toasts, dialogs, tour) |
| Typed API clients | `frontend/src/app/services/` |
| Design system (tokens, themes) | `frontend/src/styles.scss` |

## How it works in one paragraph

On every `SaveChanges`, the interceptor walks EF Core's change tracker, classifies each touched
entity as Insert / Update / Delete (with a soft-delete override: an `IsActive` flip from true to
false is recorded as a `Delete`, not an `Update`), serializes the relevant before/after snapshot
side(s) to JSON (primary key excluded), and appends an `AuditTrail` row inside the same
transaction. The audit table is excluded from its own walk to avoid recursion. The frontend reads
those JSON snapshots and renders a field-level diff (`computeDiff` in `shared/diff.util.ts`).

## Things worth knowing before you change anything

- **Restore** (`POST /api/audit-trail/{id}/restore`) re-activates a soft-deleted row (or recreates
  it from the snapshot) and logs a single explicit `Restore` entry. The re-activation save is opted
  out of automatic auditing via `AuditState` (see `AuditSaveChangesInterceptor`), so it does not
  also log a redundant `Update`.
- **Timestamps**: the API returns naive UTC timestamps (no zone). The frontend normalizes them as
  UTC in `shared/diff.util.ts` (`toDate`). Preserve that when touching date handling.
- **Demo data** is seeded in `SeedData` in `backend/Program.cs`: a week of incident history with one
  record soft-deleted as a duplicate (so it is restorable from the trail). Change the seed there.
- **Frontend conventions**: Angular standalone components, signals, the `@if` / `@for` control-flow
  syntax, no UI library. Styling uses the token layer in `styles.scss`. Tests use Vitest, not Karma.
- **The selling point to preserve**: the audit mechanism is generic. Add a column tomorrow and it is
  audited with no extra code. Do not special-case fields in the interceptor unless asked.

## A good first task

Build and run it, exercise the demo flow (create, edit, delete on Incidents; then Restore from the
Audit Trail), run the three test suites, then summarize the architecture and pick the next item from
the Roadmap in `README.md`. Propose a plan before changing behavior.
