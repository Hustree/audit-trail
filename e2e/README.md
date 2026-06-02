# End-to-end tests (Playwright)

Drives the real app through the full audit flow: **create → edit → delete → restore**, asserting that the audit trail records every step.

## Run

```bash
npm install
npx playwright install chromium

# Option A: let Playwright boot the backend + frontend for you
npm test

# Option B: point at an already-running stack (any port)
E2E_BASE_URL=http://localhost:4300 npm test
```

By default Playwright starts the backend on `:5080` and the Angular app on `:4200` (see `playwright.config.ts`) and reuses them if they are already running. Set `E2E_BASE_URL` to skip that and test a stack you started yourself.

## What it covers

- `a CRUD lifecycle is fully audited and a delete can be restored` — creates an accident, edits its severity, deletes it, confirms the Insert / Update / Delete entries appear in the audit trail, restores it, and confirms it is live again.
- `the audit tab loads and shows the seeded entries` — smoke test for the audit view.
