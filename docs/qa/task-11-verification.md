# Task 11 Verification — Protected Offline Teacher Profiles

Verified 2026-09-28 against clean synchronized checkpoint `9131617ac349704c12c3c5dcd1be10f37e8fb221`, then finalized under `feat: add protected offline teacher profiles`.

## Acceptance evidence

- Dexie stores profiles, encrypted blobs, attendance-draft placeholders, outbox-event placeholders, server cursors, conflicts, and metadata with every primary key scoped by local profile.
- Each profile receives a random 256-bit data key. A 6–12 digit local PIN derives a wrapping key with PBKDF2-HMAC-SHA-256, a random 16-byte salt, and 600,000 iterations; wrapping and payload encryption use AES-256-GCM, fresh 12-byte IVs, and authenticated profile/schema/purpose context.
- Only the selected profile key remains in memory. Explicit locking, five-minute inactivity, backgrounding, and profile switching clear it. Failed PIN attempts persist increasing delays; protected reset requires online authentication.
- Roster, assigned ministries, and the signed authorization record are encrypted separately. Profile purge removes only that profile's tables. Lease expiry or reauthentication state blocks cached roster access, and actor/church/device mismatches reject bootstrap data before persistence.
- The root PWA screen is a shared-device profile picker with PIN unlock, online profile creation, offline status guidance, profile switching, and local purge. Online switching clears the server session; offline switching records that reauthentication is required before synchronization.
- `GET /api/offline/bootstrap` requires a verified active Teacher or MFA-confirmed Owner session, trusted tenant context, and rate limiting. It returns only active assigned ministries, minimal roster fields, next birthday month/day, turning age, a server cursor, and a signed 14-day device lease. Full birthdates, guardian data, credentials, and raw audit data are absent.
- Lease issuance/renewal uses the existing forced-RLS authorization table and is atomic with canonical audit evidence. Assignment and membership revocation continue to invalidate authorizations and push subscriptions.
- OpenAPI and generated TypeScript are synchronized. Task 12 attendance behavior was not implemented.

## Results

- Focused Task 11 frontend: **11 tests in 3 files passed**; direct-routing regression: **12 tests passed**.
- Focused Task 11 backend: **4 tests / 33 assertions passed**.
- Aggregate frontend: **88 tests in 21 files passed**; typecheck, lint, production build, and OpenAPI generated-type drift passed.
- Aggregate backend after audit-atomicity remediation: **164 tests / 917 assertions passed**.
- Playwright Chrome PWA regression: **3 tests passed**.
- Frozen pnpm install, Pint, Composer strict validation, repository structure, and `git diff --check`: passed.
- Composer and pnpm audits: no known vulnerabilities.
- Gitleaks: no leaks across repository history or the reviewed application/contract/knowledge inputs.
- Semgrep `p/owasp-top-ten`: zero findings from 103 rules over 270 application files (about 99.9% parsed), plus zero findings from 98 rules over the final Task 11 change set.

## Review and environment classification

The complete final review found and remediated one BLOCKING issue: request-level exception rendering could allow a lease row to commit when required audit persistence failed. Lease issuance now opens an explicit nested database transaction, and regression coverage proves rollback. No BLOCKING or SHOULD FIX item remains.

The run used the bundled Node 24.19.0 runtime, temporary pnpm 10.34.5 launcher, temporary PHP 8.3.33 runtime/configuration, installed stable Chrome, and existing local PostgreSQL 18 container. Dependency and scanner network calls used process-scoped trusted CA configuration with TLS verification enabled. A stalled disposable Semgrep RPC scan was replaced by the OSS engine over an explicit tracked-plus-new source list; repository and host configuration were unchanged.
