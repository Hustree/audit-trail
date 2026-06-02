# Architecture

This document explains *how the audit trail works* so you can understand the pattern and port it to your own stack. The whole thing is one idea: **capture changes once, at the persistence boundary**, instead of writing audit code in every feature.

- [The core idea](#the-core-idea)
- [Components](#components)
- [The capture mechanism, step by step](#the-capture-mechanism-step-by-step)
- [Action classification](#action-classification)
- [Snapshot shape](#snapshot-shape)
- [Request lifecycle (sequence)](#request-lifecycle-sequence)
- [The restore flow](#the-restore-flow)
- [Data model](#data-model)
- [Design decisions and tradeoffs](#design-decisions-and-tradeoffs)
- [Limitations and production hardening](#limitations-and-production-hardening)
- [Porting it to another ORM](#porting-it-to-another-orm)

## The core idea

Every write an application makes (create, update, delete) flows through one place: the ORM's "save" call. If you intercept that single point, you can record **who changed what, when, and from what value to what value**, for the entire application, without touching any feature code.

In EF Core that interception point is a [`SaveChangesInterceptor`](https://learn.microsoft.com/ef/core/logging-events-diagnostics/interceptors). This project implements exactly one: [`backend/Auditing/AuditSaveChangesInterceptor.cs`](backend/Auditing/AuditSaveChangesInterceptor.cs).

## Components

```
backend/
  Domain/
    Accident.cs        # the audited business entity (soft-deletable via IsActive)
    AuditTrail.cs      # one immutable audit row per change
    ActionType.cs      # Insert | Update | Delete | Restore
  Data/
    AppDbContext.cs    # registers the interceptor; DbSets for both entities
  Auditing/
    AuditSaveChangesInterceptor.cs   # THE mechanism
  Services/
    ICurrentUser.cs / CurrentUser.cs # resolves the actor (X-Demo-User header, stubbed)
  Models/Contracts.cs  # request/response DTOs
  Program.cs           # minimal-API endpoints, DI, seeding, OpenAPI/Scalar
```

The frontend (`frontend/`) is a thin Angular client: a CRUD page for `Accident` and an audit-trail page that renders the before/after diff and the restore action.

## The capture mechanism, step by step

When `SaveChangesAsync` is called, the interceptor runs **before** the changes hit the database (so the original values are still available) and inspects the EF Core change tracker:

1. **Enumerate tracked entries** in state `Added`, `Modified`, or `Deleted`, skipping `AuditTrail` itself (auditing the audit log would recurse).
2. **Classify the action** for each entry (see [Action classification](#action-classification)), including the soft-delete override.
3. **Serialize the snapshot** for the relevant side(s): the *original* values for the "old" side, the *current* values for the "new" side, excluding the primary key.
4. **Skip no-ops:** if old equals new, write nothing.
5. **Stamp metadata:** actor (`CreatedBy`), UTC timestamp (`CreatedDate`), table name (from EF metadata), and module (the entity type name).
6. **Append** an `AuditTrail` row to the same `DbContext`, so it is saved **in the same transaction** as the business change. Either both commit or neither does.

Because the audit row is added to the same change set, there is no second connection, no out-of-band logging, and no way for the business write to succeed while the audit write fails.

## Action classification

| EF entry state | Recorded as | Old data | New data |
|---|---|---|---|
| `Added` | `Insert` | `{}` | current values |
| `Modified` | `Update` | original values | current values |
| `Modified` with `IsActive` true → false | `Delete` (override) | original values | `{}` |
| `Deleted` (hard delete) | `Delete` | original values | `{}` |

The **soft-delete override** is the subtle part: most apps "delete" by flipping an `IsActive`/`IsDeleted` flag, which EF sees as a normal `Modified`. The interceptor detects that specific transition and records it as a `Delete` so the audit log reads truthfully, and so the full prior snapshot is preserved in `OldData` (which is what makes [restore](#the-restore-flow) possible).

## Snapshot shape

Snapshots are JSON objects of `{ propertyName: value }`, with the primary key excluded. For example, editing an accident's severity produces:

```jsonc
// OldData
{ "ReferenceCode": "ACC-0001", "Title": "Slip on wet floor", "Severity": "Low",  "Status": "Open", ... }
// NewData
{ "ReferenceCode": "ACC-0001", "Title": "Slip on wet floor", "Severity": "Critical", "Status": "Open", ... }
```

The UI compares the two objects key by key and highlights only the keys whose values differ (here, `Severity`), rendering an empty `{}` snapshot as "N/A".

## Request lifecycle (sequence)

A typical "edit an accident" request:

```mermaid
sequenceDiagram
    participant UI as Angular UI
    participant API as Minimal API
    participant DB as DbContext
    participant I as AuditInterceptor
    participant SQL as SQLite

    UI->>API: PUT /api/accidents/1 { severity: "Critical" }
    API->>DB: load Accident #1, mutate fields
    API->>DB: SaveChangesAsync()
    DB->>I: SavingChangesAsync (before write)
    I->>I: scan ChangeTracker, classify = Update
    I->>I: serialize old vs new (PK excluded)
    I->>DB: add AuditTrail row (same change set)
    DB->>SQL: BEGIN; UPDATE Accident; INSERT AuditTrail; COMMIT
    API-->>UI: 200 OK (updated accident)
    UI->>API: GET /api/audit-trail
    API-->>UI: entries (newest first) incl. the new Update row
```

## The restore flow

The reference system it was extracted from captured the snapshot but never exposed an undo. This project adds one, because the snapshot already contains everything needed.

`POST /api/audit-trail/{id}/restore`:

1. Load the audit entry; read its `OldData` snapshot and `ReferenceCode`.
2. **Refuse with `409`** if a *live* record already owns that reference code (never clobber newer data).
3. Re-activate the soft-deleted row (or recreate it) from the snapshot.
4. That re-activation is itself a change, so the interceptor audits it; the endpoint also writes an explicit `Restore` entry.

History stays **append-only**: a restore never rewrites the past, it adds to it. You can always see who restored what, and when.

## Data model

`AuditTrail` (one immutable row per change):

| Column | Purpose |
|---|---|
| `Id` | identity key |
| `TableName` | the table that changed |
| `ReferenceCode` | business key of the affected record (traces all entries for one record) |
| `OldData` / `NewData` | JSON snapshots before/after |
| `ActionType` | Insert / Update / Delete / Restore (stored as a string for readability) |
| `Module` | logical module (here, the entity name) |
| `CreatedBy` | the actor |
| `CreatedDate` | UTC timestamp |

`Accident` is the audited entity and carries an `IsActive` flag for soft-delete.

## Design decisions and tradeoffs

- **Interceptor over per-service calls.** The original implementation called a helper in every service method. An interceptor centralizes it: impossible to forget, and new entities are audited for free. Tradeoff: it is "magic" that a reader has to discover, hence this document.
- **Same-transaction writes.** Auditing in the same change set guarantees consistency but means audit volume scales with write volume. For very high throughput you would batch or offload (see below).
- **Action/module stored as strings.** Human-readable in the database and in exports, at the cost of a few bytes.
- **String JSON snapshots.** Simple and portable. The tradeoff is no typed querying inside a snapshot; if you need that, store JSONB (Postgres) and index it.

## Limitations and production hardening

This is a teaching/reference project. Before using the pattern in production:

- **Separate, append-only store.** Keep audit rows in a different schema or database with no application delete path, so audit history cannot be tampered with. (The system this was extracted from used a separate audit database surfaced through a view.)
- **Real authentication.** `CurrentUser` is stubbed via a header; wire it to your real identity.
- **Sensitive-field redaction.** Exclude secrets/PII from snapshots (extend the property filter in the interceptor).
- **Retention.** `OldData`/`NewData` are unbounded text; plan archival for high-volume tables.
- **Permissions.** Gate view / export / restore behind real authorization.

## Porting it to another ORM

The *concept* transfers; the API does not. Find your ORM's equivalent of "do something at save time, with access to original and current values":

| Stack | Hook |
|---|---|
| EF Core (.NET) | `SaveChangesInterceptor` (this repo) |
| Prisma (Node) | client `$extends` query/`$use` middleware |
| TypeORM | `EntitySubscriberInterface` (`beforeUpdate`/`beforeRemove`) |
| Django | `pre_save` / `pre_delete` signals, or model `save()` override |
| Hibernate (Java) | `Interceptor` / event listeners |
| Sequelize | model hooks (`beforeUpdate`, `beforeDestroy`) |

In each case: diff original vs current, classify the action (mind the soft-delete case), serialize a snapshot, and write one audit record in the same transaction.
