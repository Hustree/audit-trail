# Audit Trail POC — Frontend

Angular 21 (standalone components) single-page app demonstrating an
audit-log accountability layer over a simple CRUD entity.

## What's inside

- **Accidents** (`/accidents`, default) — CRUD page. List, create, edit (inline form),
  and soft-delete records.
- **Audit Trail** (`/audit-trail`) — the showcase. Filterable, paginated log of every
  mutation with a **field-by-field old-vs-new JSON diff** (changed keys highlighted,
  unchanged dimmed, empty snapshots shown as `N/A`), collapsible JSON cells, a
  **Restore** action on Delete rows, and **CSV export** of the filtered set.

## Prerequisites

This frontend talks to a .NET API at **`http://localhost:5080/api`**
(see `src/environments/environment.ts`). The API is built separately. The UI will
load and render without it, but data calls will show an error banner until the API
is running on port **5080**.

## Run

```bash
npm install     # install dependencies
npm start       # ng serve — opens http://localhost:4200
```

## Build

```bash
npm run build   # ng build — outputs to dist/frontend
```

## Tests

Unit tests run headlessly (Angular 21 `@angular/build:unit-test` builder on
vitest + jsdom — no browser required, CI-safe).

```bash
npm run test:ci   # ng test --watch=false — runs all specs once and exits
```

Coverage: the audit-trail field-by-field diff (`getHighlightedJson` — changed /
unchanged keys, `N/A` for empty snapshots, Insert/Delete cases), the
`AccidentService` and `AuditTrailService` HTTP contracts (verbs, URLs, query
params via `HttpTestingController`), and an app smoke test.

## API endpoints used

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/accidents` | List accidents (paged) |
| POST | `/api/accidents` | Create |
| PUT | `/api/accidents/{id}` | Update |
| DELETE | `/api/accidents/{id}` | Soft-delete |
| GET | `/api/audit-trail` | List audit entries (filterable) |
| POST | `/api/audit-trail/{id}/restore` | Restore a deleted record |

## Notes

- Export is **CSV only** via `file-saver` (xlsx was not added; CSV satisfies the POC).
- The Accidents form is an **inline card** (toggled on the page), not a modal dialog.
- The JSON diff renderer (`getHighlightedJson` in
  `src/app/pages/audit-trail/audit-trail.component.ts`) ports the source comparison
  logic: it compares each key's value across the old and new snapshots and tags
  differing keys with `.changed-old` / `.changed-new`.
