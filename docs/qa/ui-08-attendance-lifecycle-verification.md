# UI-08 — Explicit Attendance Lifecycle & Temporary Guests

Verified 2026-10-11. UI-08 is implemented and qualified; its reviewed task subject is `feat: add explicit attendance lifecycle and temporary guests`. Final commit/push state resolves through that Git commit and the ignored finalization receipt. UI-09 and later tasks remain unstarted.

## Authority and starting checkpoint

The [approved roadmap](../superpowers/plans/2026-10-09-uiux-implementation-roadmap.md), [harmonized design](../superpowers/specs/2026-10-09-harmonized-uiux-design.md) and archived Packs 01–05 govern this task. Pack 05 supplies the attendance visual/functional reference. Its source board and attendance design sections were inspected. Root AGENTS applies; no nested instructions were found.

At entry, branch `feat/mvp-foundation`, HEAD, tracking ref and live remote matched UI-07 `0724e92d8766a4dcdad048ba80ed2908be182c39`, with ahead/behind 0/0 and staging empty. UI-01–UI-07 GREEN evidence and UI-07 finalization receipt were verified. Local and live `origin/main` remain `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f`. The stale pre-finalization UI-07 roadmap row is updated to its actual commit.

Eight pre-existing QA/environment bodies were copied and SHA-256 checked against the prior preservation receipt. They are `.env.example` under apps/web, the system handoff and shared-workspace verification under docs/qa, CURRENT_STATE, MANUAL_TESTING and TESTING_ENVIRONMENT under knowledge, and MT-02 plus MT-APP-001-SECOND-ATTEMPT-PROCEDURE under the existing MTQA-20261001-01 manual run. Only separate UI-08 sections are added to CURRENT_STATE/TESTING_ENVIRONMENT; removing those sections reproduces the exact entry bytes. Original QA changes are excluded from the task index, retained during clean finalization, and restored afterward. No human profile, attendance record, existing browser storage or manual-QA credential store was operated.

## Implemented behavior

- Ministry/date discovery reads existing work only. Explicit Start uses the existing deterministic session operation; Resume opens existing entries without a new event. Failed/unknown discovery blocks creating over uncertain work. Duplicate actions coalesce, and existing repository atomicity/CAS remains authoritative.
- All, Present, Absent and Unmarked filters have accessible pressed states. Each student exposes textual status and selected marking controls. Full regular-roster counts govern finalization irrespective of search/filter. Filter changes never change attendance.
- The native guest dialog uses only the existing display-name and gender fields. Recoverable write failures preserve valid input; cancellation writes nothing. Profile lock clears plaintext. A successful commit followed by a failed count read closes the form and reports unknown pending work, preventing duplicate guest creation.
- Finalization requires a separate confirmation with ministry/date, regular/guest and marking counts, and the local read-only consequence. Any unmarked regular student blocks it. Cancellation preserves all stores. Existing finalized/review/revised statuses stay read-only.
- Selection, access and mutation generations prevent late reads/saves from restoring plaintext after lock/revocation or overwriting a newer mark. Sync refreshes defer/coalesce around attendance mutations. Existing upload acceptance, receipts, paginated download cursors, `syncNeedsPull`, conflicts and immutable review records retain their original semantics. Local save never implies synchronization completion; unknown counts remain unknown.
- Dates still use the browser's local calendar and persist the selected YYYY-MM-DD value. No church-timezone conversion is introduced. Ordinary sticky actions remain; short/enlarged viewports use document flow when the measured action/navigation area would crowd the viewport. Keyboard marking focus scrolls clear of sticky controls without moving pointer presses before their click completes.

Production changes are limited to AttendanceScreen and its scoped stylesheet. Storage/repository, sync/profile engines, shared UI components, backend, API contracts, schemas, encryption algorithms, lease semantics, event formats and audit history are unchanged. Tests retain their valid preservation/security assertions while using explicit Start/Resume and confirmation.

## Actual validation

| Gate | Verified result |
| --- | --- |
| Focused attendance, storage and navigation | 49 tests / 4 files PASS; new lifecycle suite has 19 cases |
| Complete frontend | 476 tests / 54 files PASS, 167.57 seconds |
| Serial guarded PostgreSQL backend | 270 tests / 1,917 assertions PASS, 163.90 seconds |
| Browser regression qualification | All 156 unique outcomes have passing evidence: 12 current UI cases, 24 current transfer/navigation cases, 120 valid retained regressions |
| Typecheck, ESLint, production PWA build | PASS; existing informational bundle-size warning remains |
| Generated API drift and strict structure | PASS using the actual repository scripts; generated client bytes restored unchanged |
| Pint, strict Composer validation | PASS |
| Composer audit and pnpm high-severity audit | PASS, zero known advisories |
| OWASP initial relevant application scope | 99 rules / 103 targets, zero findings; approximately 99.9% parsed |
| OWASP final changed/directly relevant scope | 76 rules / 23 targets, zero findings/errors, 100% parsed |
| Gitleaks current tracked/new source and history | Zero findings; source refreshed after documentation, history covers 59 commits |
| Source/diff, original-body and local-link review | No open BLOCKING/SHOULD FIX findings; exact original-body checks and whitespace/link checks pass |

Root verify constituents were executed independently rather than repeating the aggregate wrapper. Documented process-scoped Node 24/pnpm 10/PHP 8.3, trusted CA and WebKit 2336 setup was used. TLS verification, host configuration, scanner enforcement and CI full scope remain unchanged. Backend suites were not concurrent against the shared test database.

Focused TDD observed actual failures before the relevant fixes: implicit draft creation, missing confirmation, authorization interruption, unknown count handling, and a stale Sync refresh replacing a committed mark. Browser failures identified tablet overflow, focus obscured by sticky actions, pointer scrolling interrupting a click, and enlarged WebKit crowding. Current tests prove their corrections. Storage tests cover deterministic duplicate creation, atomic failure rollback, guest persistence, finalization blocking, concurrent mutation, restart and profile isolation; browser tests additionally exercise actual encrypted IndexedDB and WebCrypto.

The 12 current UI cases run in Chrome desktop/mobile and WebKit phone/tablet. They compare all seven stores for view/date/Resume/cancellation operations; assert exactly one encrypted draft/start event after repeated Start; cover five widths (320/390/768/1024/1440), enlarged text, forced colors, reduced motion, Axe, visible keyboard focus, native dialog focus/Escape/return, quota rollback/input recovery and restart. The 24 current transfer/navigation cases include offline lost responses, guests, inactivity/hidden-page locks, restart and attendance-free Sync navigation. Existing profile/device, authorization and cursor/receipt assertions remain.

The initial broad browser run recorded 154 passes and two failures. One was an old-snapshot focus failure; another was a runner trace-file collision caused by reusing an output directory. Both remain recorded and are superseded by actual passing affected cases with independent output directories. Intermediate fixture/focus failures also remain in ignored logs; none is relabeled as a pass. The final per-case ledger has 156 unique outcomes with no skipped/flaky/global-error substitutions.

## Evidence reuse and security review

The full 476-test frontend result follows the asynchronous coordination correction. Later changes only handle pointer/keyboard focus and measured footer layout; current focused tests, typecheck/lint/build, browser UI and scanners prove those changes. They do not change attendance persistence, bootstrap, authorization, shared components, profile or synchronization engines, so the prior aggregate/backend/contracts/dependency gates remain valid under AGENTS effect-based invalidation.

Likewise, 120 successful original browser regressions retain their profile, actor, stored-data, receipt/cursor and authorization guarantees. The 24 fresh transfer/navigation cases cover affected Sync/view scheduling and the 12 fresh UI cases cover final presentation and lifecycle. The ledger identifies the evidence source for each outcome. No repository/profile/sync/backend implementation changed, and the completed aggregate frontend plus focused concurrency proofs cover the attendance coordinator.

The prior comprehensive security baseline remains applicable to unchanged backend, cryptography and infrastructure. This task explicitly reviewed synchronization/access boundaries and scanned relevant server/client auth, tenancy, sync, profile and attendance code. Initial parsing excludes only one unchanged generic mock span in AuthScreen.test.tsx (line 9), reviewed against HEAD; all production inputs parsed. The final changed/directly relevant scan parses completely, with no suppression or relevant-source exclusion. Gitleaks includes tracked/new source and a text alias for the lockfile; ignored credentials, runtime data, dependencies and build output are not copied into the scan. Evidence and runner artifacts stay ignored under `.git/msprout-ui08-20261010/`.

## Final review and qualification limits

The complete task source/diff review checks scope, preserved tests/work, encrypted atomicity, tenant/assignment/actor/device/profile/lease binding, authorization/lock protections, no attendance on view, no recreated accepted events, unchanged contracts and absence of UI-09 work. Identified implementation defects were corrected and verified; the remediation queue has no remaining BLOCKING/SHOULD FIX item. Knowledge records actual results and separates the pre-finalization record from its eventual Git evidence.

Browser engines and emulated viewports are qualified; physical devices, human screen-reader use, actual 400% browser zoom, hosted CI and live human profiles are not claimed. Existing brand-asset and deployment qualification conditions remain as previously recorded. These limits do not replace required automated/accessibility/security gates. Stop after the single authorized UI-08 commit and normal feature-branch push.
