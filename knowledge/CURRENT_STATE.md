# Current State

Verified: 2026-09-28. This is the primary development handoff.

## Git state

- Branch: `feat/mvp-foundation`
- Task 8 work is currently uncommitted on top of base `97dbfc169e540dacab2212317d9088ea43659236`; do not stage or commit without explicit user authorization.
- Last verified implementation/product milestone: `32fad0a1735c0e2a677832252f72197252c8cd05` — `feat: add immutable audit and security logging`.
- The knowledge system is committed separately after that implementation milestone; its documentation commit does not replace the product-milestone identifier above.
- At the end of the approved two-commit handoff, the working tree is expected to be clean. Always run `git status`, `git rev-parse HEAD`, and a recent `git log` when starting work; this document deliberately does not treat a stored literal HEAD as authoritative for the live checkout.
- Repository remotes are currently `origin = https://github.com/Fern-star-cloud/MSprout.git` and `upstream = https://github.com/Frierend/ministry-sprout.git`. This conflicts with the roadmap preflight's original one-remote/origin expectation; do not change remotes without explicit user direction.

## Roadmap position

- Tasks 1–6: **COMPLETE / COMMITTED**.
- Task 7: **COMPLETE / COMMITTED** at `32fad0a1735c0e2a677832252f72197252c8cd05`.
- Task 8: **VALIDATED / UNCOMMITTED**; all recorded implementation and security gates passed on 2026-09-28. Awaiting explicit commit approval.
- Tasks 9–18: **NOT STARTED**.
- Preserve the committed Tasks 1–7 foundation. Do not begin Task 9.

See [ROADMAP_STATUS.md](ROADMAP_STATUS.md) for every task and commit.

## Committed Task 7 state

The Task 7 milestone implements and validates:

- Canonical `audit_events` and `security_events` migrations, models, writers, classification/metadata allowlists, runtime-role append-only grants, and forced RLS.
- Forward-only migration of legacy `membership_audits` and `platform_application_audits` into canonical audit events while retaining and freezing the legacy evidence tables.
- Request and queued-job correlation context, response headers, audit correlation, and sanitized error logging.
- Recursive log redaction and logging-channel processors.
- Application-decision and membership actions routed through the canonical writer so required audit persistence shares the action transaction.
- Authentication, password, and MFA audit middleware; separate security events; mirrored platform audit events; and best-effort denied-request telemetry.
- Scoped paginated audit API viewers for Owners, Teachers, and `sage.dev`, plus React views and synchronized OpenAPI/generated types.
- Focused integrity, migration, rollback, correlation, viewer, redaction, component, and contract tests.
- Generic denial telemetry attributes authenticated actors, safely permits a null anonymous actor, and suppresses a generic duplicate only after authentication middleware has persisted its more specific security event.

The generic `access.denied` implementation is in `CorrelationId` through `RecordDeniedAttempt`. An unauthenticated `/api/me` request returns 401 with one canonical security event using the same correlation ID and a null actor. Authentication middleware sets a request marker only after its specific event persists; the outer fallback therefore avoids duplicates while retaining best-effort retry after telemetry failure.

Final validation on 2026-09-27:

- Focused backend Task 7: **37 tests / 197 assertions passed**.
- Focused frontend audit: **7 tests in 2 files passed**.
- Full `pnpm run verify`: **65 frontend tests in 14 files**, typecheck/build, and **132 backend tests / 710 assertions passed**.
- Frontend lint and OpenAPI generated-type drift check passed.
- Pint, Composer validation/audit, pnpm audit, repository structure, Gitleaks, Semgrep, and `git diff --check` passed.
- Gitleaks found no leaks. Semgrep ran 103 OWASP rules on 169 targets with zero findings.

See [the Task 7 verification report](../docs/qa/task-7-verification.md) for acceptance evidence, exact commands, and results.

## Task 8 worktree state

The approved Task 8 implementation is in the working tree and remains uncommitted. It adds ministry, student, and enrollment management, birthdate normalization, Owner and assignment-limited Teacher roster behavior, default SVG avatars, and Task 7 audit integration. It does not include Task 9 import work.

Validation performed on 2026-09-28:

- Focused Task 8 backend: **13 tests / 83 assertions passed**.
- Full backend suite: **145 tests / 793 assertions passed**.
- Focused frontend Task 8 avatar test passed; full frontend suite: **66 tests in 15 files passed**. Typecheck, lint, production build, and OpenAPI generated-type drift check passed.
- Pint and Composer validation passed. Composer and pnpm dependency audits reported no known vulnerabilities.
- Gitleaks reported no findings on application source, tests, migrations, routes, frontend source, and contracts.
- `git diff --check` and repository structure check passed.
- Semgrep `p/owasp-top-ten` completed successfully with **0 findings**: the full-app scan ran 103 rules on 195 tracked files (99.9% of lines parsed), and a supplemental explicit-target scan ran 98 rules on all 15 new Task 8 source/test files (100% parsed). Both used the cached Semgrep Docker image and the repository-approved configuration.

Tasks 1–7 remain complete and committed. Task 9 remains untouched.

Task 8 final review fixes preserve existing enrollments when an Owner updates unrelated student fields without supplying `ministry_ids`, including enrollments whose ministry was later archived. Explicit enrollment replacements still validate the requested active, same-church ministries. Feature coverage now verifies this behavior, Teacher denial for students enrolled only outside assigned ministries, and tenant-scoped ministry archive/restore.

## Final validation changes

- Added focused failing regressions for authenticated denial attribution and duplicate generic/auth denial evidence.
- `RecordDeniedAttempt` now reports whether the security row persisted.
- `AuditAuthentication` marks the request only after its specific denial event persists.
- `CorrelationId` skips a marked duplicate and otherwise attributes the church or platform actor from the authenticated guard.
- Applied Pint's repository formatting to the existing Task 7 PHP files and reran focused and full suites.

## Next work

1. Review the validated Task 8 diff and wait for explicit commit approval; keep all changes unstaged and uncommitted until then.
2. Preserve the committed Tasks 1–7 foundation and do not start Task 9.

## Known environment and repository issues

- The default Windows `node` is 22.22.3, below the approved Node 24 baseline. A Codex-bundled Node 24.19.0 exists, but the currently resolved fallback `pnpm` attempts a module-directory reinstall and aborts without a TTY. The existing temporary pnpm 10.34.5 launcher works with the current dependencies. Do not install or purge packages merely to resolve this without user authorization.
- No PHP executable is on the default PATH. An existing temporary Windows PHP 8.3.33 runtime works, with `pdo_pgsql` enabled by a temporary scan-directory config. See [TESTING_ENVIRONMENT.md](TESTING_ENVIRONMENT.md).
- The two-remote configuration conflicts with the approved roadmap's original repository preflight and is unresolved.
