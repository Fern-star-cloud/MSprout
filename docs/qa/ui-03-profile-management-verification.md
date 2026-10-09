# UI-03 — Safe profile management and locked-state privacy

2026-10-10. Explicitly selected UI-03 only under the approved UI-01–UI-16 roadmap and harmonized UI/UX design. Entry: `feat/mvp-foundation`, UI-02 `32b41c29d983fad1da43b5c0c11016c0e1c37bec`, local/tracking/live remote equal at 0/0. `origin/main` and live main remain `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f`. Staging empty. Six tracked modifications and two untracked QA documents matched UI-02's final preservation receipt byte-for-byte. No unexplained entry work.

## Implemented boundary

- Profiles use the approved shared controls, tokens and modal. Before local authorization, labels are generic Profile N; no student, roster, attendance, actor/church/device identifier, cursor, queue count, download or reauthentication metadata is rendered. Protected status also requires the authenticated encrypted offline lease. Lock, profile selection and stale async completions clear/withhold protected presentation. A separate management unlock avoids attendance navigation. Existing Use profile and preparation continuations remain; no UI-06/07/08 redesign.
- PIN errors identify incorrect PIN versus enforced delay, clear the field, connect accessible error/hint/retry feedback and disable both unlock and recovery actions until the persisted deadline. Storage rechecks retry state within serialized transactions after key unwrapping. Local PIN does not authenticate a church account. Existing online profile selection still clears the server session. Background, inactivity, lease expiry and explicit lock remain in force.
- Removal is fail-closed in `LocalProfileStore.purgeProfile`, not just the UI. The operation requires a matching confirmed profile ID and the active key. A preview never authorizes the later mutation: all seven selected-profile stores are read again and compared under the same readwrite transaction as deletion. Exceptions roll the whole mutation back; failed checks preserve every record and the active key.
- Every attendance/create/update, outbox settlement, bootstrap/roster and sync-page source writer shares the profile-table transaction and checks that its profile still exists. An earlier committed write makes removal fail; a write prepared before removal but committed afterward fails without orphaned data or a false save. Dexie observation clears another connection's in-memory key when its profile disappears. IDs and encrypted namespaces isolate other profiles and churches.
- A permitted removal requires explicit review of the selected generic label and consequences, then typing that exact label. The safe initial action is Keep profile, with native modal keyboard containment, Escape cancellation and focus return. Mutation-time failure reports preservation; successful deletion with a later list-read failure remains truthfully reported as deleted.
- Recovery guidance requires the existing PIN and same-teacher online authorization when needed. Church authentication cannot reset or decrypt a local PIN; the old boolean-authentication reset entry point now fails without deletion. No clear-site-data/recreate shortcut is offered. No new API, field/index/schema migration, dependency, cryptographic format, server policy or production asset.

## Conservative removal policy

| Selected-profile state | Result |
|---|---|
| Locked, storage read failure, incomplete/unverified synchronization, partial/corrupt cache, unknown blob/metadata, missing cursor, invalid/expired authorization | Refuse, zero deletion |
| Any attendance draft, any outbox event, any conflict/quarantine record | Refuse, zero deletion |
| Fresh never-prepared profile with correct PIN, no data/cursor, null lease and initial reauthentication state | Eligible for explicit confirmation |
| Prepared profile with correct PIN, valid matching encrypted lease, decryptable known cache only, explicit completed-sync flag, cursor, no drafts/outbox/conflicts/unknown metadata | Eligible for explicit confirmation |
| Any snapshot change before mutation, or storage failure during deletion | Abort/rollback, zero deletion |

An empty outbox is insufficient. Existing retained drafts lack a contract-backed proof that every local detail can safely be discarded and recovered, so apparently finalized drafts also block removal. No new discard receipt/API/schema was invented. The encrypted work and keys remain available for supported future recovery. Safe confirmed removal deletes only the selected local profile/cache/key/lease/cursor and never church-account records or unrelated profiles.

## Verified validation ledger

Initial preservation TDD: 13 expected failures and1 passing isolation case; UI TDD:4 expected failures and7 existing passes. Expired-lease disclosure and current-reauthentication messaging received separate expected failing tests before correction. Final focused profile/crypto/attendance/sync: **93 tests/10 files pass**; additional final storage proof **46/2 pass**, including fresh/expired/reauthenticated states and concurrent retry deadline. Aggregate frontend **307/43 pass** (earlier comprehensive306/43); late isolated UI corrections are covered by focused93, and four subsequent storage-only cases by46. No final aggregate314 run is claimed. Serial guarded PostgreSQL backend: **268 tests/1,903 assertions pass**.

| Gate | Actual current-run evidence |
|---|---|
| Frontend tests, types, lint, production/PWA build | PASS; frontend-final, focused-final, focused-storage-final, types-storage-final, lint-storage-final, build-corrected logs |
| Backend tests and Pint | PASS; backend.log and pint.log; no backend changes after them |
| OpenAPI drift / structure | PASS; contract.log and read-only Alpine structure execution; generated client bytes restored exactly after documented temporary LF normalization |
| Composer strict validation/audit / pnpm high audit | PASS; no advisories or known vulnerabilities |
| Repository verify aggregate | All four wrapper components executed separately; no redundant backend invocation |
| Whitespace | PASS after implementation and final documentation |
| Gitleaks | Complete tracked/new source plus lock text alias and54-commit history, zero findings; final source refreshed after knowledge |
| OWASP Semgrep | Expanded complete application108 rules/416 targets/zero findings/~99.9% parsed; final affected delta76/15/zero findings/errors/~100% parsed |

Security coverage was explicitly expanded with no-git-ignore and an empty ignore file to include PHP test inputs that the default root ignore otherwise omitted. The earlier358-target pass is superseded by416-target coverage. Five partial parse warnings are unchanged generic Vitest mock lines in ApplicationScreen, AuthScreen, PlatformAuthScreen, ApplicationReviewScreen and SystemHealthScreen tests; no changed/new production input skipped. Ignored credentials, dependencies, runtime data and build output stay excluded. Full security CI scope is unchanged.

## Browser evidence and interruption reconciliation

Full matrix completed **164/172** (four targets,43 cases each), including17/20 new UI-03 cases. Four old-preview failures expected online-sign-in guidance after sync authorization invalidation. Current persisted-profile reauthentication is now reread rather than taken from the captured pre-sync profile; focused failing-then-passing proof and final build/types/lint/OWASP delta cover that correction. Corrected recovery rerun **8/8** passes both accepted-upload scenarios on desktop/phone Chrome and phone/tablet WebKit, retaining origin-only referrers, cookie/wire/idempotency, unchanged accepted-event and encrypted-work assertions.

Three WebKit-phone UI-03 failures close with the unchanged affected rerun **3/3**. The interrupted run records two setup failures lasting approximately2.0/1.8 hours despite90-second test bounds, plus a recovery-completion assertion at5 seconds; the isolated rerun completes successfully without new timeout or assertion changes. The unchanged mobile drawer Escape/focus assertion passes its **1/1** rerun; no UI-02 production change or test weakening. Thus **all172 case outcomes have current green evidence**, with no second complete matrix claimed. All20 UI-03 outcomes pass. Logs and traces for initial failures remain preserved.

UI-03 cases cover rendered root DOM and full accessibility-tree privacy,320/390/768/1024/1440 reflow,32px text,reduced motion/forced colors,real PIN retry and reload,manual lock,key/data preservation,unknown-work refusal,modal focus/cancel/concurrent writes,and exact safe deletion/other-church preservation. The whole matrix also proves existing offline attendance/restart/guest/lock/idempotent transport/tenant/workspace/PWA regressions. Synthetic encrypted fixtures and isolated loopback routes only; no human profiles, attendance, credentials or device storage were operated on. Browser snapshots do not certify physical devices, human screen-reader operation or actual400% browser zoom; A2 production assets remain separately gated.

## Review, preservation and finalization

One complete source/diff review covers14 app source/test paths and their crypto/lease/attendance/sync/dialog interactions. Blocking removal-loss, orphan-write and locked/unauthorized disclosure findings are corrected. Late bootstrap/lock, deletion-versus-refresh messaging and current persisted recovery guidance findings are corrected and reviewed with focused proof. **No BLOCKING or SHOULD FIX findings remain.** The final documentation/staged review confirms UI-03-only scope, no API/schema/dependency/governance change, no weakened valid tests, no runner/scanner artifacts and no UI-04 implementation.

Unchanged backend/contracts/dependencies/audits remain valid after isolated frontend corrections. Final frontend proof/types/lint/build, affected browser runs and changed-input security scan cover the changed guarantees. Documentation-only closure receives whitespace/local-reference and complete-source secret checks; it does not invalidate application results. Existing process-scoped Node24/pnpm10/PHP8.3/WebKit2336 and trusted CA keep TLS enabled; no host runtime installation or permanent configuration.

Knowledge is synchronized with verified evidence before the single reviewed task commit. This report is a pre-finalization receipt; resolve commit/push through subject `feat: protect device profile removal and locked-state privacy` and Git. Clean-at-commit/push state is obtained using the established hash-checked preservation workflow, filtered additive knowledge projection and restoration of the exact original bodies. The six original tracked bodies and two untracked QA documents remain outside the task commit; only additive UI-03 knowledge is committed for CURRENT_STATE/TESTING_ENVIRONMENT. Ignored logs, snapshots, traces and finalization receipts stay under `.git/msprout-ui03-20261010/`. No reset, clean, history rewrite, main push/merge or deployment. **Stop: UI-04–UI-16 remain unstarted.**
