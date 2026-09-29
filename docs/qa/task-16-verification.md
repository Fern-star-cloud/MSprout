# Task 16 Verification

Verified 2026-09-29 on `feat/mvp-foundation`, starting from the clean synchronized governance checkpoint `02c825aa7d59f8fb351b83e300f59960b88e0812` with Task 15 complete.

## Implemented boundary

- Added encrypted per-device Web Push registration and revocation with endpoint hashing, permission/success/failure state, trusted push-service host validation, membership-revocation integration, and bounded endpoint-free audit evidence.
- Added an every-minute due-church command for exactly 8:00 AM church-local dispatch. A narrow database function identifies due churches; restricted-runtime tenant transactions, forced RLS, unique dispatch markers, unique church/date/user/device deliveries, and queue uniqueness make scheduler/worker retries idempotent.
- Owners receive church-wide birthday counts. Teachers receive only currently assigned ministry birthdays. The send worker rechecks active membership, current assignment, local date, and subscription state before delivery.
- Push messages contain only `Birthday reminder` plus a count and the authenticated birthday route. The service worker ignores remote title/URL values, validates the count-only body shape, never caches API responses, and opens `/account/birthdays`.
- Added the authenticated Today's Birthdays projection and responsive fallback UI. It returns permitted display names, turning ages, and ministry names without full birthdates or birth years. The offline fallback uses only the existing encrypted, unlocked, assignment-scoped roster under its valid lease and church timezone.
- Added deliberate permission UX with authenticated preflight, remembered denial, unsupported-browser messaging, iPhone/iPad Home Screen guidance, and per-device disable behavior. February 29 birthdays map to February 28 in non-leap years.
- Updated OpenAPI and regenerated TypeScript. Added the Web Push library and VAPID configuration placeholders. No Task 17 operations, deployment, retention, or production-hardening work was introduced.

## TDD and focused proof

- Expected RED was observed before implementation: birthday routes/jobs/models/UI were absent and the focused tests failed for missing behavior.
- Focused backend birthday proof passed **12 tests / 84 assertions**, covering ordinary/leap-year selection, Owner and Teacher scope, revoked assignment suppression, 8:00 AM timezone selection, duplicate scheduler/worker idempotency, encrypted registration/revocation, unsafe endpoint rejection, generic payloads, permanent-failure revocation, pre-send authorization recheck, offline-bootstrap timezone preservation, and forced-RLS isolation.
- Focused frontend birthday, notification, offline, service-worker, and routing proof passed **22 tests in 5 files**, including authenticated preflight before prompting, remembered denial, iOS/unsupported guidance, privacy-safe rendering, encrypted-profile fallback, and generic notification click behavior.

## Comprehensive validation

- Aggregate `pnpm run verify` passed **126 frontend tests in 33 files**, frontend typecheck and production PWA build, and **203 backend tests / 1,232 assertions**. Backend tests ran serially against the shared PostgreSQL test database.
- Stable Chrome Playwright passed **4 tests**, covering offline shell behavior, lost-response synchronization convergence, phone touch targets, and wide-layout keyboard focus/navigation.
- Frontend lint, generated OpenAPI drift, frozen pnpm install, Pint, Composer strict validation, repository structure, and `git diff --check` passed.
- Composer audit and pnpm high-severity audit reported no known vulnerabilities. The Web Push dependency and both lockfiles were verified by frozen install and their applicable build/test/audit gates.
- Gitleaks scanned the complete tracked and new non-ignored source snapshot (about 2.06 MB) and reported no leaks.
- Risk-based Semgrep `p/owasp-top-ten` scanned every changed PHP, TypeScript/TSX, and OpenAPI input: **123 applicable rules over 33 targets**, approximately 100% parsed, zero findings. This scope explicitly covered tenant context, RLS migration, authorization/controllers, recipient selection, queued delivery, outbound endpoint handling, offline projection, permission logic, service worker, and contract. A first direct OneDrive bind-mount attempt was stopped after an environmental I/O stall; the completed scan used the identical source scope in a temporary read-only snapshot. A redundant full-repository scan was not run because Task 15's valid comprehensive baseline remains applicable and Task 17 is required to establish the next full hardening baseline.
- TLS verification remained enabled. Networked dependency/scanner processes used only established process-scoped trusted-root configuration outside the repository; no global trust or machine configuration changed.

## Final review

The definitive review found no remaining BLOCKING or SHOULD FIX item. It confirmed Task 16-only scope; trusted tenant identity and forced RLS; Owner church-wide and Teacher current-assignment scope; revalidation after queued delay; one delivery per church/local-date/user/device; transactionally consistent database-queue dispatch; encrypted endpoint/key storage; membership/user/device tenant-safe foreign keys; safe endpoint allowlisting; count-only push content; no birthdate, endpoint, or key leakage through API, audit, logs, or notifications; lease-gated encrypted offline data; February 29 handling; deliberate non-repeating permission UX; synchronized backend/contract/frontend behavior; preserved attendance, conflict, revision, sync, report, export, and service-worker boundaries; no secrets, runner artifacts, weakened tests, or unexplained files; and no Task 17 implementation.
