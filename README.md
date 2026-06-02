<div align="center">

# 🧾 Audit Trail

### Know **who did what, when**, see the **before/after**, and **undo it**.

A small, production-shaped reference implementation of a system-wide audit log for **.NET + EF Core**, with an **Angular** admin UI. Every create, update, and delete is captured automatically at the persistence layer, rendered as a field-level diff, and any deletion can be **restored** from its snapshot.

[![CI](https://github.com/Hustree/audit-trail/actions/workflows/ci.yml/badge.svg)](https://github.com/Hustree/audit-trail/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![.NET 9](https://img.shields.io/badge/.NET-9.0-512BD4?logo=dotnet&logoColor=white)
![Angular](https://img.shields.io/badge/Angular-standalone-DD0031?logo=angular&logoColor=white)
![EF Core](https://img.shields.io/badge/EF%20Core-SQLite-512BD4)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

</div>

![Editing one field on an incident, then the Audit Trail showing exactly which field changed and its old-to-new values, across three view modes with one-click restore](docs/audit-trail-demo.gif)

> It doesn't just say *something changed.* It tells you **exactly which field**, and **what it went from and to**.

---

## Why this exists

Most apps bolt on audit logging field by field, which is tedious, easy to forget, and drifts out of sync the moment someone adds a column. This project shows the better pattern: **capture changes once, at the ORM boundary**, so every mutation is logged the same way with zero per-feature wiring, and the full before/after snapshot is kept so a record is never truly lost.

It is intentionally small and dependency-light so you can read the whole thing in an afternoon and lift the mechanism into your own stack.

## ✨ Features

- **Automatic capture** of every Insert / Update / Delete via an EF Core `SaveChangesInterceptor`. Add a column tomorrow, it is audited with no extra code.
- **Who / what / when** on every entry: actor, action, entity, table, UTC timestamp.
- **Before/after JSON snapshots**, with the primary key and configurable sensitive fields excluded.
- **Soft-delete awareness:** an `IsActive` flip is recorded as a real `Delete`, not a confusing `Update`.
- **No-op suppression:** saves that change nothing write nothing.
- **Field-level diff UI:** every change renders as a unified change-row (`field · old → new`, with colorblind-safe `+ / − / ~` glyphs), and the classic side-by-side layout is one click away.
- **Three ways to read the log:** Detailed (the full diff), Compact (one scannable line per change), and Timeline (grouped by day on a rail).
- **One-click Restore:** rebuild a deleted record from its snapshot. The restore is itself audited, so history stays append-only.
- **Filter + export:** filter by action, module, actor, and date, and export the view to CSV.
- **Polished admin UI:** light and dark themes, accent and density controls (persisted), styled dialogs and toasts, skeleton loading, and an optional guided tour. Angular standalone with signals, no UI library.

## 🏗️ How it works (the one idea worth stealing)

The entire mechanism is a single interceptor that runs inside the same transaction as your save:

```
┌──────────────┐    HTTP / JSON     ┌─────────────────────────────────────┐
│  Angular UI  │ ─────────────────▶ │  .NET Minimal API                   │
│  CRUD page   │                    │                                     │
│  Audit tab   │ ◀───────────────── │  EF Core DbContext                  │
│  (diff +     │                    │    └── AuditSaveChangesInterceptor   │
│   restore)   │                    │          • walk ChangeTracker        │
└──────────────┘                    │          • classify Insert/Update/   │
                                    │            Delete (soft-delete aware)│
                                    │          • serialize old/new JSON    │
                                    │          • append AuditTrail rows    │
                                    │                  │                   │
                                    │                  ▼                   │
                                    │         SQLite (data + audit)        │
                                    └─────────────────────────────────────┘
```

On every `SaveChanges`, the interceptor walks the change tracker, classifies each touched entity, serializes the relevant snapshot side(s), and appends an `AuditTrail` row, all before the transaction commits. See [`backend/Auditing/AuditSaveChangesInterceptor.cs`](backend/Auditing/AuditSaveChangesInterceptor.cs).

> 📖 **Want the full walkthrough** (action classification, soft-delete handling, the restore flow, a sequence diagram, and how to port the pattern to another ORM)? See [ARCHITECTURE.md](ARCHITECTURE.md).

## 🚀 Quick start

You need the [.NET 9 SDK](https://dotnet.microsoft.com/download) and [Node 20+](https://nodejs.org).

```bash
# 1. Backend  (http://localhost:5080)
cd backend
dotnet run

# 2. Frontend (http://localhost:4200), in a second terminal
cd frontend
npm install
npm start
```

Or run both at once from the repo root:

```bash
make dev
```

Then open **http://localhost:4200**.

### See it in 30 seconds

The app opens on **Audit Trail**, pre-seeded with a week of incident history (logged, escalated, resolved, and one soft-deleted as a duplicate). Then:

1. On **Incidents**, create a record, edit its severity, and delete it.
2. Back on **Audit Trail** you will see your `Insert`, `Update` (only the changed field highlighted), and `Delete` (with the full prior snapshot). Switch between Detailed, Compact, and Timeline.
3. Click **Restore** on a `Delete` row. The record reappears in Incidents, and a new `Restore` entry is logged.

Prefer a hands-off walkthrough? Click **Tour** in the top-right for a guided tour of the screen.

## 🔌 API

Base URL `http://localhost:5080/api`. Pass an optional `X-Demo-User` header to set the actor. An interactive API explorer (Scalar, backed by OpenAPI) is served at **http://localhost:5080/scalar** when the backend is running.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/accidents` | List active records (paged) |
| `POST` | `/accidents` | Create, writes an `Insert` audit entry |
| `PUT` | `/accidents/{id}` | Update, writes an `Update` audit entry |
| `DELETE` | `/accidents/{id}` | Soft-delete, writes a `Delete` audit entry |
| `GET` | `/audit-trail` | List audit entries (filter: `actionType`, `module`, `createdBy`, `createdDate`, paged, sorted) |
| `POST` | `/audit-trail/{id}/restore` | Restore a record from an entry's snapshot, writes a `Restore` entry |

## 🗂️ Project structure

```
audit-trail/
├── backend/                       # .NET 9 minimal API + EF Core (SQLite)
│   ├── Auditing/
│   │   └── AuditSaveChangesInterceptor.cs   ← the audit mechanism
│   ├── Data/AppDbContext.cs
│   ├── Domain/                    # Accident, AuditTrail, ActionType
│   ├── Services/                  # current-user stub
│   ├── Models/Contracts.cs        # request/response DTOs
│   └── Program.cs                 # endpoints + DI + seed
├── frontend/                      # Angular standalone app (signals, no UI library)
│   ├── src/styles.scss            # design system: tokens, light/dark themes, components
│   └── src/app/
│       ├── pages/accidents/       # Incidents CRUD page
│       ├── pages/audit-trail/     # the trail: diff hero + Detailed/Compact/Timeline
│       ├── shared/                # diff engine, theming, toasts, dialogs, guided tour
│       └── services/              # typed API clients
├── backend.Tests/                 # xUnit: interceptor + endpoint integration tests
└── e2e/                           # Playwright end-to-end tests
```

## 🧭 Roadmap / ideas

- [ ] Revert an `Update` (not just restore a `Delete`)
- [ ] Pluggable storage (separate audit DB / schema), the production-grade isolation pattern
- [ ] XLSX export alongside CSV
- [ ] Real auth + per-permission gating for view / export / restore
- [ ] Postgres + SQL Server providers
- [ ] A "history timeline" view per record (all entries by `referenceCode`)

## 🧪 Tests

Three layers, all runnable locally and in CI:

```bash
# Backend: unit tests for the audit interceptor + endpoint integration tests
dotnet test                       # from repo root (AuditTrail.sln)

# Frontend: component + service unit tests (headless, no browser needed)
cd frontend && npm run test:ci

# End-to-end: drives the real UI through create -> edit -> delete -> restore
cd e2e && npm install && npx playwright install chromium && npm test
```

- **Backend** (`backend.Tests/`, xUnit): proves the `SaveChangesInterceptor` classifies Insert/Update/Delete (with the soft-delete override), excludes the primary key, skips no-ops, and that every endpoint writes the right audit entry, including restore's `409`/`404` cases.
- **Frontend** (`frontend/src/**/*.spec.ts`, Vitest): unit-tests the diff engine (`computeDiff` classification, snapshot parsing, value formatting) and the typed API clients.
- **E2E** (`e2e/`, Playwright): runs the full demo flow in a real browser and asserts the audit trail records every step. `npx playwright test` boots both servers automatically; set `E2E_BASE_URL` to test an already-running stack.

## 🤝 Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Good first issues: add the XLSX exporter, add the per-record history view, or port the interceptor pattern to another ORM in a `examples/` folder.

## 📄 License

[MIT](LICENSE) © Joshua Bascos
