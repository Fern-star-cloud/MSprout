# Task 7 verification

Date: 2026-09-27. Branch: `feat/mvp-foundation`.
Baseline: `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f` (`feat: add scoped teacher membership management`).

Completed and validated the existing Task 7 working tree without resetting or replacing prior work. No staging, commit, push, remote modification, dependency change, or Task 8 implementation was performed.

## Acceptance evidence

| Criterion | Implementation and evidence |
|---|---|
| Canonical evidence | `AuditEntry`, `AuditWriter`, and `SecurityEventWriter` provide bounded classifications, internal identifiers, trusted correlation, and an explicit non-PII metadata allowlist. Existing application and membership actions now write canonical rows. |
| Append-only storage | Model updates/deletes, quiet mutation paths, runtime SQL UPDATE/DELETE/TRUNCATE, and cross-tenant writes fail. The restricted runtime role has SELECT/INSERT only. Both tables use forced RLS. |
| Legacy preservation | The forward migration locks legacy writers, copies IDs, timestamps, correlation, scope, targets, outcomes, and allowlisted provenance once, retains both legacy tables, removes runtime mutation privileges, and refuses destructive downgrade. Conflicting legacy IDs fail atomically. |
| Correlation | A valid client UUID is reused; invalid/missing values receive a new UUID. The same value reaches responses, safe errors, audit/security rows, queued payloads, and sanitized log context. Request and queue contexts are cleared after completion/failure. |
| Authentication transactions | Audited authentication, password, account, and MFA mutations run inside a database transaction. On response failure or audit exception, database state rolls back and prior session, guard, and queued-cookie state is restored. Password-reset proof and platform setup/login state are covered. |
| Denied access | The outer correlation middleware records canonical `access.denied` for 401/403/419 and `access.rate_limited` for 429 through `RecordDeniedAttempt` and `SecurityEventWriter`. Anonymous requests use a null actor; authenticated church/platform guards retain actor identity. Denied church headers are never trusted as tenant scope. |
| Duplicate prevention | Authentication auditing marks the request only after its specific security event persists. The outer denial fallback skips generic evidence when that marker exists. If specific telemetry fails, the fallback may retry generically while preserving the original HTTP denial. A composed-middleware regression proves one event, not two. |
| Failure isolation | Denial telemetry and logging are best-effort and cannot turn an already-computed 401/403/419/429 into a 500. Required high-risk success audit remains transactional and fails the domain operation if it cannot persist. |
| Redaction and errors | Log keys and nested containers covering credentials, authorization/cookies, child/birth/guardian data, raw request/response bodies, push endpoints, recovery/MFA material, email/name/address/session/header/exception data are redacted. Arbitrary strings, objects, resources, unsafe messages, and traces are suppressed. API responses remain the established safe envelopes. |
| Viewer boundaries | Owners receive only the active church's audit projection; Teachers receive only their own permitted submission/sync actions; `sage.dev` receives only platform events after platform MFA. Pagination is bounded, unknown query parameters fail, and metadata/security rows are never returned. |
| Frontend and contract | Online-only church/own/platform history screens recheck the relevant session and scope. OpenAPI defines closed audit schemas, bounded pages, correlation headers on every response, and generated TypeScript is synchronized. |
| Tasks 1–6 compatibility | Full backend and frontend regressions, PostgreSQL 18 isolation/RLS, authentication/MFA, applications, membership actions, transaction rollback, concurrency, contract, and build gates all pass. |

## Defect corrected during validation

The existing generic denial fallback always used an anonymous actor and had no coordination marker for a specific authentication denial. Two focused tests first failed: an authenticated 403 produced `actor_type=anonymous`, and a composed authentication denial produced two security rows. `RecordDeniedAttempt::record()` now reports persistence success, `AuditAuthentication` marks the request only after the specific event persists, and `CorrelationId` attributes an unsuppressed fallback from the appropriate guard. Both tests then passed and remained green in focused and full suites.

## Commands and results

Commands used the documented local PHP 8.3 runtime, process-local PostgreSQL extension configuration, pnpm 10.34.5 launcher, and PostgreSQL 18 Compose service. Existing database credentials were passed process-locally without printing or persistence. No global runtime or system configuration changed.

| Command/check | Result |
|---|---|
| `php artisan test tests/Feature/Audit tests/Unit/Logging` | Final: **37 tests / 197 assertions passed**. Covers canonical rollback, authentication/MFA/password audit rollback, correlation, anonymous and authenticated denial attribution, duplicate suppression, telemetry failure isolation, append-only protections, forced RLS, legacy migration, scoped viewers, and recursive redaction. |
| New denial regressions, red run | **2 expected failures**: authenticated denial was anonymous; composed auth denial produced two rows. Final rerun: **2 passed / 7 assertions**. |
| `pnpm --dir apps/web test --run src/features/audit` | **7 tests in 2 files passed**. |
| `pnpm run verify` | Exit 0: **65 frontend tests in 14 files**, frontend typecheck and production build, then **132 backend tests / 710 assertions**. |
| `pnpm --dir apps/web lint` | Passed. |
| `pnpm --dir apps/web api:check` | Passed; no OpenAPI/generated-TypeScript drift. |
| `php vendor/bin/pint --test` | Initial check identified formatting-only violations in existing Task 7 PHP. Pint formatted those files; final check passed. Focused and full suites passed afterward. |
| `composer validate --strict` | Passed. |
| `composer audit --no-interaction` | Passed; no security vulnerability advisories. Host certificate interception required a temporary process-local PEM export of trusted Windows roots; TLS verification remained enabled. |
| `pnpm audit --audit-level high` | Passed; no known vulnerabilities. `NODE_USE_SYSTEM_CA=1` retained TLS verification. |
| `bash scripts/verify-structure.sh` | Passed using Git Bash. |
| Gitleaks Docker scan of tracked plus untracked source snapshot | Passed; approximately 1.25 MB scanned, no leaks. Ignored environments, dependencies, runtime data, and build output were excluded. |
| Semgrep `p/owasp-top-ten` Docker scan of the same source snapshot | Passed: **103 rules**, **169 targets**, **0 findings**, approximately 99.9% parsed lines, seven default-pattern exclusions. TLS verification used the temporary trusted-root bundle. |
| `git diff --check` | Passed. LF/CRLF notices from Git are normalization notices, not whitespace errors. |
| Final status/diff/untracked review | No staged files, dependency/lock changes, debug markers, temporary source artifacts, production secrets, or Task 8 files. Generated frontend build output remains ignored. |

## Final state

Task 7 is validated and ready for commit review. The working tree remains intentionally uncommitted and unstaged. Tasks 1–6 remain intact, and Task 8 remains untouched.

The final working tree contains 50 changed paths: 40 Task 7 application/test/contract paths, the repository-root `AGENTS.md` knowledge-routing update, eight knowledge documents, and this verification report. The 32 untracked paths are expected source, tests, migrations, knowledge documents, and this report; no untracked runtime, dependency, secret, or build artifact is present.
