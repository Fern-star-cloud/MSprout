# Task 18 verification

Verified 2026-09-30 on `feat/mvp-foundation`, starting from the clean synchronized Task 17 checkpoint `a989dd904551a26f6f7548ee0c88128f13c6933d`.

## Qualified boundary

- Added whole-MVP browser scenarios for church onboarding/approval/MFA/setup, two shared-device Teacher profiles, four-date offline attendance across closure/reopen, bounded outage retry and exactly-once convergence, conflict resolution/revision-effective reporting, safe import, birthday privacy, and cross-tenant denial.
- Expanded PWA qualification with a real service-worker update, offline API NetworkOnly proof, keyboard/reduced-motion checks, and serious/critical axe checks. Added storage-quota failure proof.
- Remediated the qualification-discovered offline-security defect: a correct PIN may read encrypted cached work while its signed lease remains unexpired after restart/profile switch, but synchronization remains blocked until the same actor signs in and refreshes authorization online. Authorization failure and lease expiry still purge or deny cached authority as designed.
- Added an explicit authenticated authorization-refresh action, focused regression coverage, and a named keyboard-focusable import preview region.
- Remediated newly published dependency advisories by moving the lockfile to Laravel 13.34.0 and Flysystem 3.36.0 plus compatible transitive releases. No product scope or API contract changed.
- Added the browser matrix, pilot runbook/evidence, encrypted restore evidence, twelve-criterion checklist, and go/no-go decision. No post-MVP feature was started.

## Focused and integrated proof

- Offline profile/security focus passed **20 tests** across profile-store, device-profile UI, and sync-client coverage after final-review remediation. The exact cached-read/reauthorization-sync split and authorization-denial invalidation boundary are covered.
- The definitive browser matrix passed **60/60 tests**: 15 each on desktop Chrome, Pixel 7 Chrome emulation, iPhone 13 WebKit emulation, and iPad (7th generation) WebKit emulation.
- Four distinct attendance dates produced **12 encrypted events**. After closure/reopen, the outbox remained 12; two deliberate worker `503` responses preserved it; the third attempt accepted 12 unique events; outbox became zero; reload produced no duplicate.
- Aggregate verification passed **131 frontend tests in 34 files**, frontend typecheck and production PWA build, and **208 backend tests / 1,299 assertions**. The complete backend suite passed again after the Composer lock remediation.
- Frontend lint, OpenAPI drift, Pint, Composer strict validation, frozen pnpm install, repository structure, and whitespace validation passed.

## Security, recovery, and operations

- Composer and pnpm audits report no known vulnerabilities after remediation.
- Full Semgrep `p/owasp-top-ten` reran because the Task 17 baseline was invalidated: **108 rules over 322 application targets**, approximately **99.9% parsed**, **zero findings**. The eight-target increase from Task 17's 314-target baseline matches the eight new E2E/support files.
- The final-review authorization-denial correction was then rescanned with **76 applicable OWASP rules over both changed production files**, 100% parsed, with zero findings; this focused delta preserves the comprehensive baseline under the repository invalidation policy.
- Final Gitleaks covered Git history and the complete tracked/new non-ignored source snapshot, excluding ignored credentials, dependencies, caches, runtime data, and build output.
- The encrypted PostgreSQL restore drill matched counts and deterministic checksums for churches, memberships, students, finalized attendance, revisions, audit events, and sync receipts. The isolated database and every temporary backup artifact were destroyed; the runtime role remained non-superuser and unable to bypass RLS.
- The dependency-refreshed API image built and ran as `www-data`, loaded GD/PCNTL/PDO PostgreSQL/ZIP, honored an injected port, and served minimal liveness. Route/config caching, schedule inspection, heartbeat write/check, and empty database queue-worker startup passed.

## Definitive review

The final integrated scope/security/release review queued one SHOULD FIX item: an explicit bootstrap refresh denied with `401/403` did not yet reuse the established authorization-invalidation behavior. The correction now atomically removes cached roster/ministry/authorization projections, retains encrypted drafts/outbox work, leaves synchronization blocked, and has focused regression/security proof. No BLOCKING or SHOULD FIX item remains. The review confirmed Task 18-only scope; preservation of Tasks 1–17; no API caching; exact tenant/actor/profile boundaries; unexpired cached reads without synchronization authority; fail-closed lease expiry/revocation/authorization failure; idempotent retry; immutable conflict/revision evidence; safe import and reporting; notification privacy; append-only audit; encrypted restore handling; no secrets/PII/debug or runner artifacts; and no post-MVP work.

Release decision: **GO** for the approved MVP boundary and controlled one-church pilot procedure. See `browser-matrix.md`, `pilot-runbook.md`, and `release-checklist.md`.
