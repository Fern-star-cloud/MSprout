# UI-13 — Birthdays, Notifications & Activity verification

Qualified on 2026-10-11 under AGENTS.md and the approved harmonized roadmap/Pack 10. Scope ends at UI-13; UI-14–UI-16 remain unstarted.

## Checkpoint and preservation

Entry branch/tracking/live feature was `feat/mvp-foundation` at UI-12 `5a2a959961416cf17d8236da0dc4042a02958f47`, ahead/behind0/0 and staging empty. Local/live main `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f` is unchanged. UI-01–UI-12 GREEN and all eight original QA/environment file bodies were hash-verified against the preceding receipt and retained in an ignored checkpoint. Additive UI-13 knowledge sections are staged separately from human QA deltas; the original bodies remain byte-exact beneath those sections. No real accounts, student records, profiles or push subscriptions were operated.

## Implemented behavior and boundaries

- Birthdays uses only the existing today endpoint with no date/period query. Verified actor, active church membership, Owner MFA or Teacher assignment context precedes protected reads. The server church-local date/timezone/count remains authoritative even when the device clock differs. Only supported name, turning age and ministry labels are retained; full birthdates and additional PII are omitted. Loading, empty, error and actual offline states are distinct.
- Refresh, session/scope/assignment invalidation and connectivity changes clear prior names and invalidate late responses. Online authorization denial never decrypts cached names. Actual offline projection requires the matching actor/church and an unlocked current encrypted lease, with a post-read current-authorization check. Cached source/freshness limits are explicit; unknown age is unavailable rather than invented zero. Church-calendar rollover triggers a fresh read without relabeling old names.
- Notification controls distinguish browser permission, existing subscription and backend registration. Browser presence alone is not registration. Verified setup precedes deliberate permission activation; current identity/assignment/assurance is checked again before writes. Existing subscriptions/device identity are reused and repeated actions are coalesced. Exact server receipts confirm registration; uncertain outcomes offer the existing safe upsert retry. Permission revocation and stale church/session completions cannot retain success.
- Explicit turn-off confirms scoped backend revocation and browser unsubscribe separately. Confirmed backend revocation remains visible when unsubscribe is uncertain, with a precise retry and no false off claim. Browser permission remains independent. Bounded service-worker discovery, denied/unsupported/iOS install guidance and unavailable configuration feedback remain truthful; no unsupported registration-status read or delivery guarantee is invented.
- Authorized Activity uses the existing bounded audit endpoint. Owners see permitted church audit; Teachers see only their own supported submission/sync actions. UI retains generic action/result/time/correlation projections, omits actor/target/free-form metadata and clears invalidated results. Broader activity feeds and detail reads remain deferred. Platform audit behavior is preserved; system health and review queues stay separate.
- Shared navy/blue/emerald foundations, semantic lists, statuses/errors, real keyboard navigation and responsive wrapping support phone/tablet/desktop. Post-native focus reveal keeps notification results above fixed phone navigation. Birthday and activity reads leave every row in all seven encrypted stores unchanged, including pending attendance.

No production PHP, API/contract, schema, permission, schedule/job, notification transport, dependency, cryptographic format, offline writer or synchronization change. Existing RLS, tenant/assignment enforcement, CSRF/cookies, MFA, count-only worker payload and immutable audit remain intact. One minimal existing import-test correction waits for the exact required React-effect focus target; it changes no import behavior or assertion strength.

## Actual qualification

| Gate | Actual result |
|---|---|
| Focused frontend | 106 tests /11 files PASS; blocking import-focus fixture proof27/1 PASS separately |
| Frontend aggregate | Current638 tests /67 files PASS, one worker without competing browser/scanner/backend load |
| Focused backend | 22 tests /108 assertions PASS |
| Backend aggregate | 290 tests /2090 assertions PASS, serial guarded isolated PostgreSQL database |
| Browser/accessibility | 76/76 unique current-build outcomes PASS,19 per Chrome desktop/mobile and WebKit phone/tablet; no retries/skips |
| Types / lint / production build | PASS; latest runtime correction built; later test-only focus change reran types/lint and leaves production build inputs unchanged |
| Contracts / structure | Actual api:check and complete read-only structure script PASS; generated client restored byte-for-byte |
| Pint / Composer validation / audits | PASS; strict Composer validation and Composer/pnpm audits report no known advisories |
| OWASP | 98 rules /85 scanned targets from all85 changed/directly relevant inputs; zero findings/errors; exclusions/parse coverage reviewed |
| Secrets / whitespace / preservation | Complete tracked/new-source and64-commit history scans PASS; final documentation-source scan and exact eight-body checks precede staging |

Browser matrix consists of36 new birthday/notification/activity cases,4 legacy consent/privacy,12 workspace-navigation,20 shared-navigation and4 unchanged Platform Account accessibility regressions. Native proof includes today-only server provenance, Owner/Teacher scope, error/empty/late-expiry states, duplicate-safe registration, explicit revoke, permission denial/unavailable browser, sanitized audit paging, result focus viewport bounds, axe checks,320/390/768/1024/1440 reflow,200% text, visible keyboard focus and exact encrypted-store equality with pending work/actual offline decryption. Screenshots are reviewed and kept ignored.

Backend tests establish real church-local midnight/today-only behavior, unsupported period rejection, Teacher assignment/cross-tenant/MFA boundaries, stable registration upsert, selected-device revocation, redacted audits, count-only scheduling/delivery and immutable scoped audit projections. The actual service-worker push handler is exercised against malicious extra name/date/title/URL fields; only approved count-only notification text and app destination survive. No live provider delivery or real browser subscription is operated.

## Corrections and evidence validity

Initial behavior TDD reported14 expected failures/1 pass. Later age, explicit browser activation, partial unsubscribe feedback and church-change stale receipt tests each failed before their targeted fixes and pass in current focused106. The first browser fixture incorrectly intercepted config GET with a DELETE route; its route now matches the exact selected device. Completed corrected smoke11/12 exposed WebKit phone result focus behind navigation. Current76/76 closes that native defect without removing geometry, privacy, duplicate or preservation assertions. Historical failed/interrupted evidence remains failed.

The aggregate active during the usage interruption recorded multi-hour test durations and a worker-start timeout, plus five failures; all49 affected/omitted tests passed isolated without source changes. An uninterrupted run then passed637/638 with an unchanged import test asserting focus before React's effect. Its27 cases passed isolated. The assertion now waits for the exact same focused alert; focused27 and final aggregate638 pass. This is a blocking fixture correction, not a reduced accessibility expectation or an import feature change.

Current frontend aggregate follows all runtime corrections. Backend290/2090 remains valid after only frontend/presentation/test corrections because no backend input changed. Current runtime type/lint/build, corrected native matrix and final relevant OWASP inputs prove the changed boundaries. The late import-test wait changes no bundled/runtime input, so the existing production build is retained and its types/lint proof refreshed. Root verify's components are evidenced individually. Valid comprehensive security baseline and unchanged full configured CI OWASP coverage remain intact; explicit changed/directly relevant scope reliably covers this task without a redundant application-wide scan.

Complete source/diff/security review covered22 application/test paths and direct auth/tenant/audit/worker/lease interactions, then verification and all six knowledge updates. The remediation queue closes online-denial cache fallback, incomplete-age truthfulness, deliberate permission activation, independent registration/revocation feedback, stale church receipts and native WebKit focus. No BLOCKING or SHOULD FIX findings remain after current proof and final documentation/staging review. No weakened/skipped test, next-task implementation or ignored runner output belongs to the commit.

## Limits and finalization

Native browser UI/crypto/IndexedDB runs use synthetic intercepted APIs; guarded backend suites separately prove real server boundaries. Physical devices, human screen readers,400% browser zoom, live Web Push permission/provider delivery and hosted CI execution are not newly claimed. Optional historical manual QA and deployment qualifications retain their recorded status. Unsupported upcoming feeds, broader Activity/detail APIs, registration-status reads and delivery guarantees remain deferred.

GREEN finalization rechecks exact task-only staging, original bodies, live feature/main, and TLS-enabled normal feature push. Resolve the task commit by reviewed subject `feat: add scoped birthdays notifications and activity` and the ignored finalization receipt; no self-referential commit hash is required in this document. Stop after UI-13.
