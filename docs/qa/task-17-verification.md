# Task 17 Verification

Verified 2026-09-30 on `feat/mvp-foundation`, starting from the clean synchronized Task 16 checkpoint `a444e5fbb47b1c600e8496c36709ec9a3c3d5fa6`.

## Implemented boundary

- Added minimal public liveness, secret-protected coarse readiness, and an online-only MFA-protected `sage.dev` system-health dashboard. Detailed output is limited to sanitized aggregate API, database, queue lag/failure, scheduler, birthday, synchronization, conflict, and storage signals.
- Added scheduler heartbeat, bounded operational pruning, and revoked-device cleanup. Narrow fixed-search-path database functions retain forced RLS by setting transaction-local church scope, validate cutoff ranges, batch deletion, revoke public execution, and avoid broad runtime delete grants.
- Enforced the approved retention windows: 30 days for operational events and rejected application PII; 180 days for security events and synchronization receipts; and change feed only after every active cursor has passed the row plus 90 days. Canonical tenant/platform audit evidence and frozen legacy audit tables are never deleted.
- Marked expired device cursors for full resynchronization. Incremental pull rejects those devices until authenticated bootstrap advances to the server maximum and clears the flag; encrypted push secrets and revoked authorization records can then be purged without permitting stale incremental state.
- Added Vercel same-origin routing, strict CSP/HSTS/privacy headers, and immutable caching limited to hashed assets. The service-worker NetworkOnly API boundary remains unchanged.
- Added one production Railway image and explicit API, worker, scheduler, and migration modes. All applicable modes run as unprivileged `www-data`; Apache honors the injected `PORT` with 8080 as the image default. The image contains production dependencies and GD, PCNTL, PDO PostgreSQL, and ZIP support.
- Added deployment, environment, bootstrap-removal, secret rotation, backup/restore, rollback, incident response, retention, and threat-model documentation. Updated OpenAPI and regenerated the TypeScript contract for the health surfaces.
- No Task 18 release qualification, restore drill, or one-church pilot work was started.

## TDD and focused proof

- Expected RED was observed before implementation for absent health, heartbeat, retention/full-resync, protected UI, and production deployment behavior.
- Focused backend operations, retention, offline bootstrap, and full-resync proof passed **12 tests / 114 assertions**. Coverage includes liveness/readiness disclosure, token handling, `sage.dev` authorization, forced-RLS aggregate health, fixed retention bounds, multiple deletion batches, audit preservation, active-cursor feed safety, revoked-device purge, and required bootstrap before incremental pull.
- Focused frontend system-health and PWA proof passed **9 tests**, covering protected navigation, sanitized state display, error behavior, strict-CSP-compatible rendering, and preserved service-worker boundaries.

## Comprehensive validation

- Aggregate `pnpm run verify` passed **128 frontend tests in 34 files**, frontend typecheck and production PWA build, and **208 backend tests / 1,299 assertions**. Backend tests ran serially against the shared PostgreSQL test database.
- Stable Chrome Playwright passed **4 tests**, including offline shell, lost-response synchronization convergence, phone touch targets, and wide-layout keyboard navigation.
- Frontend lint, generated OpenAPI drift, frozen pnpm install, Pint, Composer strict validation, repository structure, and `git diff --check` passed.
- Composer audit and pnpm high-severity audit reported no known vulnerabilities. Route caching/clearing and configuration parsing passed. Scheduler inspection showed the minute heartbeat plus the 02:15 operational-prune and 02:45 revoked-device schedules.
- Gitleaks 8.30.0 scanned all Git history and the complete tracked/new non-ignored source snapshot, including final knowledge and QA evidence, with no leaks. Dependencies, runtime state, ignored credentials, caches, and build output were excluded; TLS verification remained enabled.
- The production image built successfully. Image configuration and live process identity were both `www-data`; liveness returned `200 {"status":"ok"}` on the default port and with an injected `PORT=18081`; the native image health check reached `healthy`; and GD, PCNTL, PDO PostgreSQL, and ZIP were loaded.
- The mandatory comprehensive `semgrep scan --config p/owasp-top-ten apps` baseline ran through Semgrep 1.177.0 with **108 applicable rules over 314 application targets**, approximately **99.9% parsed**, and **zero findings**. The scan used a fresh snapshot containing every tracked/new non-ignored file under `apps` and a read-only process-scoped trusted CA bundle; TLS verification remained enabled.
- Five Semgrep partial-parser warnings were reviewed and are limited to Vitest async generic-mock syntax in `ApplicationScreen.test.tsx`, `AuthScreen.test.tsx`, `PlatformAuthScreen.test.tsx`, `ApplicationReviewScreen.test.tsx`, and `SystemHealthScreen.test.tsx`. Semgrep's seven ignored paths are its default backend-test exclusions. Production application source was covered, and Gitleaks separately covered the test files.

## Security remediation and definitive review

The first mandatory comprehensive scan found one BLOCKING Docker hardening issue: the final image did not explicitly select a non-root user. Apache and every applicable service mode were moved to `www-data`, writable runtime paths were narrowed, and the image was moved to unprivileged port 8080. Review then identified a SHOULD FIX deployment issue: hard-coding that port would ignore Railway's injected `PORT`. Apache and the health check were changed to honor the injected value, the image/runtime checks passed again, and the complete comprehensive Semgrep scan was rerun with zero findings.

The definitive scope/security review has no remaining BLOCKING or SHOULD FIX item. It confirmed Task 17-only scope; coarse public/readiness disclosure; separate online-only MFA-protected platform detail; constant-time readiness-token comparison; tenant-safe aggregate queries; fixed-search-path/revoked-public-execute database functions; forced RLS inside retention loops; bounded cutoffs and batching; no audit deletion; cursor-safe feed pruning; explicit full-resync enforcement; non-root service modes; injected-port operation; strict CSP/HSTS/privacy headers; no API response caching; synchronized backend/contract/frontend behavior; no secrets, debug output, runner artifacts, weakened tests, or unexplained files; and preservation of authentication, authorization, tenant isolation, privacy, audit, synchronization, attendance, revision, report/export, notification, and offline invariants.
