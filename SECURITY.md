# Security Policy

This is a reference / demo project, not a production service. Still, if you find a
security issue (in the code or in a pattern the project encourages others to copy),
please report it.

## Reporting

- Open a [GitHub security advisory](../../security/advisories/new), or
- Email the maintainer (see the commit history / profile).

Please do not open a public issue for a sensitive vulnerability before it has been
addressed.

## Scope notes

This project intentionally stubs authentication and stores audit data in a local
SQLite file for demo simplicity. Before using the audit pattern in production,
review the hardening notes in `ARCHITECTURE.md` (separate append-only store,
real authentication, sensitive-field redaction, retention).
