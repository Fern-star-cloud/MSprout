# MVP release checklist

Decision date: 2026-09-30. Candidate branch: `feat/mvp-foundation`. Starting checkpoint: Task 17 commit `a989dd904551a26f6f7548ee0c88128f13c6933d`.

## Twelve acceptance criteria

| # | Criterion | Evidence | Result |
|---:|---|---|:---:|
| 1 | An approved church is isolated from every other church. | Browser `tenant-isolation.spec.ts`; backend `PostgresTenantIsolationTest`, attendance/report/import cross-tenant cases, and forced RLS assertions. | PASS |
| 2 | A Teacher can install/open the PWA and download only assigned rosters. | Browser install/offline shell, onboarding, and shared-device scenarios; backend offline authorization and assignment-scoped roster tests. | PASS |
| 3 | Attendance survives refresh, closure, device restart, and temporary server outage. | `offline-attendance-sync.spec.ts` plus four-day `offline-restart-sync.spec.ts`; unexpired cache remains readable after correct PIN while sync waits for authorization refresh. | PASS |
| 4 | Retrying the same event never duplicates attendance. | Browser two-`503` retry and post-reload assertion; backend push replay/idempotency and committed-batch retry tests. | PASS |
| 5 | Contradictory submissions require Owner review and preserve originals. | Browser conflict/revision-effective report scenario; backend conflict, immutable revision, correction, provenance, and append-only tests. | PASS |
| 6 | Shared profiles cannot view one another's cache or submit under the wrong actor. | Two-PIN/two-actor shared-device scenario; profile namespace/encryption tests and sync actor/device validation. | PASS |
| 7 | Revocation and lease expiration behave as specified and are audited. | Backend membership revocation, offline authorization, pull tombstone/full-resync, audit rollback/integrity, and frontend authorization-invalid quarantine/purge tests. | PASS |
| 8 | Owners import valid students without silently overwriting duplicates. | Browser valid-plus-duplicate preview/commit; backend safe workbook, duplicate, idempotent commit, concurrency, audit, and tenant tests. | PASS |
| 9 | Birthdays are correct and push notifications preserve privacy. | Browser in-app/count-only/remembered-denial scenario; backend timezone, leap-day, assignment recheck, encrypted subscription, idempotent delivery, and generic payload tests. | PASS |
| 10 | Reports agree with finalized and revised attendance. | Browser Owner-role report shows the known fixture's revision-effective 1 Present/0 Absent/100% and correction; backend report arithmetic/export tests. | PASS |
| 11 | Required audit events are append-only and contain no prohibited secrets or child PII. | Backend audit integration/integrity/redaction tests; Gitleaks; final source/diff review; privacy-bounded pilot and restore evidence. | PASS |
| 12 | Backup restoration, queue recovery, PWA update, and offline-to-online synchronization succeed. | Encrypted isolated restore with matching counts/checksums; queue worker startup and scheduler heartbeat check; real service-worker update; 12-event retry/convergence. | PASS |

## Release gates

| Gate | Evidence | Result |
|---|---|:---:|
| Focused offline-security regression | Profile store, device profile UI, and sync client: 20 tests passed; cached read, authorization-denial invalidation, and sync-block boundaries are explicit. | PASS |
| Aggregate application regression | 131 frontend tests in 34 files and 208 backend tests / 1,299 assertions passed; frontend typecheck and production PWA build passed. | PASS |
| Browser/device and accessibility | 60/60 Playwright cases passed across four projects; axe reported zero serious/critical issues on qualified surfaces. | PASS |
| Contract, lint, formatting, structure | OpenAPI drift, ESLint, Pint, repository structure, and whitespace checks passed. | PASS |
| Dependencies | Frozen pnpm install passed. Composer audit's two new low-severity advisories were remediated by Laravel 13.34.0 and Flysystem 3.36.0; final Composer and pnpm audits report no known vulnerability. | PASS |
| Static/secret security | Task 17 baseline was invalidated by offline-security and dependency changes, so full Semgrep reran: 108 rules, 322 targets, approximately 99.9% parsed, zero findings. A later authorization-denial correction received a zero-finding 76-rule/two-production-file OWASP delta scan. Final Gitleaks coverage includes history, tracked/new non-ignored source, and the final delta. | PASS |
| Backup and restore | Encrypted dump, isolated restore, seven required domain counts/checksums, restricted role, and artifact destruction verified. | PASS |
| Queue and scheduler | Route/config cache compiled; expected schedules listed; scheduler heartbeat write/check passed; empty database queue worker started and exited cleanly. | PASS |
| Production image | Dependency-refreshed image built, required extensions loaded, image/runtime identity was `www-data`, and injected-port liveness returned the minimal healthy response. | PASS |
| Support and incident readiness | Role-based private support routes are defined in `pilot-runbook.md`; security reporting is private; deployment, incident, rollback, rotation, and restore steps exist under `docs/operations/` and `SECURITY.md`. | PASS |
| Owner count confirmation | Owner-role browser evidence matched the known manual fixture count after revision: 1 Present, 0 Absent, 100%, one correction. | PASS |

## Go/no-go decision

**GO.** The MVP release candidate and controlled one-church qualification pilot meet all twelve approved acceptance criteria. No high/critical finding, unresolved security advisory, BLOCKING item, or SHOULD FIX item remains. This decision authorizes the approved MVP boundary only. Production operators must follow the deployment and private human-contact/signature procedure; it does not authorize post-MVP features or a Task 19.
