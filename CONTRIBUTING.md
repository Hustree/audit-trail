# Contributing

Thanks for your interest. This is a small reference project, so contributions that keep it focused and readable are the most welcome.

## Ground rules

- Keep the codebase small and easy to read. The value of this repo is that someone can understand the whole audit mechanism in one sitting.
- The headline mechanism lives in `backend/Auditing/AuditSaveChangesInterceptor.cs`. Changes there should stay framework-idiomatic and well commented.
- No client names, no proprietary data, no secrets. This is a public, generic reference.

## Dev setup

```bash
# Backend
cd backend && dotnet run            # http://localhost:5080

# Frontend
cd frontend && npm install && npm start   # http://localhost:4200
```

The SQLite database is created and seeded automatically on backend startup. Delete `backend/audittrail.db` to reset.

## Before opening a PR

- `cd backend && dotnet build` succeeds with no warnings.
- `cd frontend && npm run build` succeeds with no errors.
- Update the README if you changed behavior, endpoints, or the run steps.

## Good first issues

- Add an XLSX exporter next to the CSV one.
- Add a per-record history view (all entries for one `referenceCode`).
- Add "revert an Update" alongside "restore a Delete".
- Port the interceptor pattern to another ORM (Prisma, Django, Sequelize) under an `examples/` folder.

## Reporting bugs

Open an issue with steps to reproduce, what you expected, and what happened.
