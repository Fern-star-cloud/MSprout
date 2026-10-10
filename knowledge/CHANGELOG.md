# Development Changelog

## 2026-10-10 — UI-07 discoverable synchronization and recovery

Add dedicated Sync & device navigation with independent connection/account/unlock/upload/download/review states, truthful unknown/incomplete/interrupted guidance and explicit same-profile recovery. Preserve accepted work, original keys/events/receipts/cursors and review; navigation/status/unlock create no attendance or transfer. Focused61/frontend451/backend270+1917 and all96 unique browser outcomes PASS with applicable/security gates; no open review finding. Eight original QA/environment bodies remain preserved. Stop before UI-08. [Verification](../docs/qa/ui-07-sync-recovery-verification.md).

## 2026-10-10 — UI-06 guided encrypted device preparation

Replace raw Church ID setup with verified workspace and authorized ministry scope, matching local PINs, and durable encrypted readiness before explicit Attendance entry. Preserve interrupted/uncertain profiles and all existing/concurrent work. Focused102/frontend420/backend270+1917 and all120 unique browser outcomes pass with applicable/security gates; no open review finding. Eight original QA/environment bodies remain preserved. Stop before UI-07. [Verification](../docs/qa/ui-06-device-preparation-verification.md).

## 2026-10-10 — UI-05 separate Platform shell and session lifecycle

Add verified online Platform navigation, Applications landing, session-aware Account and discoverable sign-out across desktop/tablet/phone. Clear protected data and stale completions on route/assurance/offline/logout changes; preserve church/device boundaries and safe interrupted setup. Focused69/frontend380/backend268+1903/browser120 and applicable/security gates pass; final review has no open findings. Eight original QA/environment bodies remain preserved; stop before UI-06. [Verification](../docs/qa/ui-05-platform-shell-verification.md).

## 2026-10-10 — UI-04 church Account, assurance and application

Add session-aware Account, explicit assurance/recovery paths, safe deliberate returns, truthful application states and reconciled uncertain submissions. Preserve non-secret inputs, invitation identity restrictions, real Turnstile verification and server validation; discard stale authentication completions and secrets. Final frontend357/backend268+1903, all104 browser outcomes and applicable/security gates pass; review queue closed. Preserve eight original QA/environment bodies and stop before UI-05. [Verification](../docs/qa/ui-04-account-application-verification.md).

## 2026-10-10 — UI-03 safe profiles and locked-state privacy

Add generic locked labels, authenticated status visibility, accessible PIN delay/error feedback, truthful recovery guidance and explicit typed removal confirmation. Enforce preservation and concurrent-write safety in storage; retain every uncertain draft/outbox/conflict and isolate other profiles/churches. All172 browser outcomes have green evidence, focused93 plus storage46 and aggregate307/backend268+1903 pass, required/security gates pass, review queue closed. Preserve eight original QA/environment bodies and stop before UI-04. [UI-03 verification](../docs/qa/ui-03-profile-management-verification.md).

## 2026-10-09 — UI-02 explicit routes and role-aware navigation

Add an explicit compatible route registry, verified Owner/Teacher Home and grouped navigation, desktop sidebar, accessible tablet drawer and compact phone bars. Make Account/Sync/device preparation discoverable through existing capabilities while retaining independent offline Attendance. Preserve guarded workspace transitions, native modified links and existing APIs/data. Frontend285/backend268+1903, all152 browser case outcomes and applicable/security gates are green; final review findings are closed and eight original QA bodies preserved. Stop before UI-03. [Evidence and limits](../docs/qa/ui-02-navigation-verification.md).

## 2026-10-09 — UI-01 harmonized accessible foundations

Apply the approved navy/blue/emerald tokens and shared presentation primitives. Give AuthForm unique field/error relationships, safe focused summaries and pending-submit protection while preserving secrets/transport. Keep Absent and generic status neutral. Frontend246/backend268+1903, all132 browser case outcomes after isolated fixture corrections, and required/security gates pass; no remaining review finding. Preserve all existing human work/data, retain production assets, and stop before UI-02. [Evidence and qualification limits](../docs/qa/ui-01-foundations-verification.md).

## 2026-10-08 — Human synchronization recovery evidence

Record the human's single successful original-profile recovery after `7b86aaa`: bootstrap and pull HTTP 200, three prior versions downloaded, terminal cursor `3` with `has_more: false` and complete UI with no observed push/new draft/logout. Documentation-only update attributes the report, preserves historical evidence and limits PASS to this recovery. No repeat synchronization, profile/PIN/storage/attendance/fixture mutation or broader manual-phase/UX task. [Human receipt and limits](../docs/qa/profile-sync-recovery-verification.md#human_manual-live-recovery-pass--2026-10-08).

## 2026-10-08 — Attendance-free synchronization recovery

Add a discoverable Profiles recovery action that refreshes existing authorization and awaits complete synchronization without creating attendance. Preserve incomplete-download cursor, skip empty push, coalesce safe retries and enforce original-unlock/lease guards. Final focused56/backend15, full frontend235/backend268, Chrome8 and required/security gates pass. Human Profile1/storage/PIN/three accepted events and fixtures remain untouched; live pull verification is NOT RUN. [Review and exact human steps](../docs/qa/profile-sync-recovery-verification.md).

## 2026-10-08 — Existing login session response correction

Replace the authenticated JSON church-login root redirect with409/already_authenticated and fixed session-check guidance; keep identity switching explicit and redirects rejected. Classify unknown online failures neutrally, synchronize the API contract/client and preserve all security/offline policies. Isolated cookie/browser proof, full frontend224/backend268+1903, Chrome10 and required/security gates pass; human data and accepted attendance remain untouched. [Verification and exact safe steps](../docs/qa/existing-login-session-verification.md).

## 2026-10-08 — Accepted upload / unauthenticated pull correction

Fix sync GET requests inheriting document no-referrer and missing Sanctum first-party session recognition. Preserve origin-only privacy, cache/redirect safeguards and all authorization/encryption policies. Persist incomplete pull state, distinguish it from empty uploads and keep failure counts truthful. Human three accepted events remain untouched; real cookie/browser isolated regressions prove the defect without logout. Full frontend222/backend265+1,871, Chrome8 and required gates pass; no live retry or full human sync claim. [Verification and preservation-safe steps](../docs/qa/sync-pull-authentication-verification.md).

## 2026-10-08 — Online session recovery characterization

Reproduce online profile-selection logout after recent sign-in and subsequent Review 401; preserve the approved shared-device safeguard. Add real cookie/CSRF/expiry tests and desktop/mobile recovery tests proving three encrypted pending events remain with zero sync requests. No production policy change. Full frontend 220/backend 264+1,847 and required gates pass; generic account landing and hidden reauthentication guidance documented for later UX. Human Profile 1/queued work remain untouched. [Evidence and safe retest](../docs/qa/online-profile-session-recovery-verification.md).

## 2026-10-08 — Offline profile lifecycle and background-lock verification

Human controlled retest confirms ten seconds of foreground attendance availability and a `background` lock on tab switching; the established immediate key-purge policy is preserved. Cancel obsolete PIN/sign-out completions, bind authorization/timers/cryptographic results to their unlock instance, rearm committed lease renewals, and mask Local PIN. Profile 1 and queued work remain intact. Focused 55, frontend 220, backend 261/1,811, Chrome 16 and required gates pass. Disruptive recovery is documented for later UX/onboarding work. [Evidence, security and recovery](../docs/qa/offline-profile-lock-verification.md).

## 2026-10-08 — Teacher invitation identity denial correction

A valid Teacher invitation opened under the Owner session was mislabeled expired/used. Preserve the identity restriction, return 403 for a different/unverified authenticated account, and guide new invitees to reopen the original email in a separate signed-out profile. Signed proofs, expiry, replay, account/password preservation, RLS, MFA and audit atomicity remain intact. Frontend 202/backend 261+1,811 and required gates pass; no live invitation/data operation. [Confirmed state, security and validation](../docs/qa/teacher-invitation-identity-verification.md).

## 2026-10-08 — Shared workspace sidebar lifecycle correction

Replaced full document navigation only between the six church modules and retained the boundary by selected church. Same-church transitions reuse verified state with mandatory background preflight; fresh entry/church switches and incompatible offline authorization remain gated. Focused76/frontend198/backend257+1,764 and13 browser checks pass with required validation and reviewed security coverage. Human observations and historical QA are preserved; no live data or excluded UI changes. [Root cause, evidence and finalization subject](../docs/qa/workspace-navigation-lifecycle-verification.md).

## 2026-10-08 — Workspace activation and Import initialization correction

Coalesced tab activation validates session/membership/MFA in the background without blanking or remounting an unchanged authorized module. Actor, church, role or ministry-assignment changes invalidate its retained state; explicit denial/authentication changes still clear content immediately. Import separates unresolved authorization from forbidden/error. Focused 66, final frontend 188, backend 257/1,764 and eight intercepted browser checks pass with required gates and reviewed security coverage. Human observations, existing data and unrelated QA remain preserved; no subsequent task. [Verification and finalization subject](../docs/qa/workspace-activation-verification.md).

## 2026-10-08 — Shared authenticated workspace maintenance fix

Review, Reports, Birthdays, Ministries, Students and Import inherit a server-validated church workspace across navigation and refresh, with explicit multi-membership selection and fail-closed session/membership handling. Authenticated discovery, scoped preflight, the API contract and regression/browser proof are synchronized. Historical QA work was preserved through a verified three-commit fast-forward. Tasks 1–18 and unrelated UI findings remain untouched. [Precommit validation receipt](../docs/qa/shared-workspace-context-verification.md); live migration/rollout is NOT RUN.

2026-10-07 — Platform live-runtime continuation: traced both failure correlations to the original Desktop API, found two Windows PHP listeners on port 8000, and stopped only the identity-checked stale listener. Verified custom handler registration in the fixed HTTP boot and added real `artisan serve` regression with pre-boot database selection and protected test isolation. Focused **2 / 26**, full backend **249 / 1,709**, frontend **136 tests** and applicable security gates passed. Authentication code remains unchanged; no live sign-in or account/database mutation was performed. See [evidence](../docs/qa/platform-session-restoration-verification.md). This receipt precedes the reviewed continuation commit/push; no feature or manual phase follows.

2026-10-07 — Platform session restoration fix: reproduced password/TOTP 204 followed by `/platform/me` 500 across fresh database-session requests. Guard-aware metadata keeps platform UUIDs out of the integer church user column while preserving guard/cookie/CSRF/MFA isolation and encryption. Focused 3-case proof and required application/security gates passed; no live account or database mutation occurred. See [verification](../docs/qa/platform-session-restoration-verification.md). This receipt precedes the single authorized `fix: preserve platform database session restoration` commit/push; no new feature or manual phase follows.

2026-10-07 — Pending `sage.dev` recovery fix: operator-only reissue to the stored recovery email; generation-bound one-time links/sessions; five-minute cooldown; captured mail generation/expiry; transactional audit/security/queue evidence; preserved mandatory TOTP/recovery acknowledgement and initial password gate. Focused 21-case proof and full application/security gates passed; narrow source-map-js security patch applied. See [verification](../docs/qa/platform-setup-reissue-verification.md). This entry precedes the single authorized fix commit; no live administrator invitation/activation, deployment or manual phase is claimed.

2026-10-07 — Manual QA governance update: replaced mandatory sequential qualification with optional bug-driven, risk-based MT-00…MT-22 references. Preserved 211 stable cases and historical results/blockers, required release/security gates and all four pending applications. Recorded human-observed Pending review overflow for reproduction/severity assessment; no product fix, manual case or new phase executed. Focused validation is recorded in [TESTING_ENVIRONMENT.md](TESTING_ENVIRONMENT.md). The user separately authorized the reviewed governance-only commit and normal feature-branch push while preserving earlier work unstaged/uncommitted. Resolve the resulting `docs: make manual QA risk-based and non-blocking` commit and actual synchronization through Git; this receipt precedes finalization.

Meaningful completed milestones only. This is a concise index, not a replacement for Git history or QA reports.

| Date | Milestone | Result | Commit |
|---|---|---|---|
| 2026-08-20 | Task 1 — independent monorepo and quality baseline | React/Laravel workspace, local PostgreSQL/Mailpit, CI/security workflows, initial contract and structure checks | `e351988d0cd309d91a2e555f7d344704ed8366f2` |
| 2026-08-20 | Task 2 — typed API contract | OpenAPI response conventions, generated TypeScript, typed transport, health endpoint and tests | `6642be93019019d8623d7f8fd9225d885d74cbe7` |
| 2026-08-20 | PostgreSQL 18 setup correction | Corrected local PostgreSQL 18 volume/configuration assumptions | `aeb40ad78cf044112109db71e22f0433482ce1ba` |
| 2026-08-20 | Task 3 — tenant schema and RLS | Church/membership schema, trusted tenant context, restricted runtime role, forced RLS and isolation tests | `2807089e6d4f9b1b399770c67cf679d75d030682` |
| 2026-09-21 | Task 4 — church/platform authentication | Fortify/Sanctum church flows, Owner MFA, isolated `sage.dev` guard/setup, frontend authentication flows | `fe52346d5740d5edd1aa95e73c799101a078b246` |
| 2026-09-21 | Task 5 — approval-gated church registration | Applicant lifecycle, CAPTCHA/limits, platform approval/rejection, transactional notification/audit, 30-day cleanup | `763bc93610ca44167a1800bd810edd643358620c` |
| 2026-09-22 | Task 6 — teacher membership management | Invitations, assignments, revocation, ownership transfer, session/device invalidation, UI and verification report | `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f` |
| 2026-09-27 | Task 7 — append-only audit, security, and correlation logging | Canonical immutable evidence, legacy preservation, transactional high-risk/auth auditing, denial telemetry, redaction, scoped viewers, frontend/contract, and complete validation | `32fad0a1735c0e2a677832252f72197252c8cd05` |
| 2026-09-28 | Task 8 — ministries, students, birthdates, avatars | Ministry/student/enrollment domain, canonical normalization, assignment-scoped roster, avatars, contract/UI, and complete validation | `dc3c13c6cd5e4909c644b0abe37d18875cbe248f` |
| 2026-09-28 | Task 9 — safe XLSX/CSV import | Strict workbook inspection, preview/mapping, locked idempotent commit, tenant RLS, audit integration, contract/UI, and complete validation | `fbe338f433c7432cc26c98ad8c2e258cf9502a79` |
| 2026-09-28 | Task 10 — responsive installable PWA shell | Manifest/icons, minimal offline shell precache, NetworkOnly API boundary, safety-gated updates, responsive accessible navigation, and browser coverage | `02090354a185d92be2655695fbfce77bf20bc53c` |
| 2026-09-28 | Task 11 — isolated local profiles, encryption, and offline lease | Profile-scoped encrypted IndexedDB, PIN key wrapping and auto-lock, shared-device picker, minimal assignment-scoped bootstrap, signed audited 14-day leases, and complete validation | `8cc055703198cc85d63f821762732dd542884d35` |
| 2026-09-28 | Task 12 — offline-ready attendance workflow | Tenant/RLS attendance records, assignment-scoped audited finalization, encrypted atomic local drafts/outbox, responsive marking UI, and complete validation | `1b7eb36d8cfeb5de5555f9fe9396df5982b1a123` |
| 2026-09-29 | Task 13 — idempotent attendance synchronization | Tenant/RLS replay receipts and ordered feed/cursors, atomic audited push, assignment-scoped pull/tombstones, bounded encrypted-profile client synchronization, revocation quarantine/purge, and reconnect convergence | `eaddc9d034b7696387bb56ad6aa33bdf2dd63bf2` |
| 2026-09-29 | Task 14 — conflicts, revisions, and temporary guests | Field-aware conflict preservation, append-only Owner resolutions/corrections, minimal provenance-preserving guest lifecycle, role-safe review UI, contract, and complete validation | `11abcc6bc9d3ac6a9e0081863e2168478d471ac3` |
| 2026-09-29 | Task 15 — attendance history, reports, and safe CSV export | Revision-effective finalized totals/history, separate pending/conflict/correction status, Teacher assignment scope, Owner-only audited formula-safe CSV, responsive UI, and complete validation | `1737921911f83695294fe760b68e6421a1a21a2d` |
| 2026-09-29 | Security-validation governance optimization | Risk-based local Semgrep validation with evidence invalidation, mandatory Task 17 hardening baseline, conditional Task 18 release rescan, and unchanged full CI security scanning | `02c825aa7d59f8fb351b83e300f59960b88e0812` |
| 2026-09-29 | Task 16 — privacy-safe birthday notifications | Timezone-local idempotent dispatch, encrypted/revocable Web Push subscriptions, forced-RLS assignment-scoped delivery, generic count-only payloads, authorized online/offline birthday UI, and complete validation | `a444e5fbb47b1c600e8496c36709ec9a3c3d5fa6` |
| 2026-09-30 | Task 17 — production and security hardening | Split health surfaces, bounded forced-RLS-aware retention and device full resync, non-root multi-mode Railway image, hardened Vercel deployment, operational/security runbooks, and a zero-finding comprehensive Semgrep baseline | `a989dd904551a26f6f7548ee0c88128f13c6933d` |
| 2026-09-30 | Task 18 — MVP qualification and one-church pilot | Whole-MVP four-target E2E matrix, offline restart/reauthorization correction, accessibility and failure qualification, encrypted restore drill, operations/security release gates, twelve accepted criteria, and GO decision | `ffee8ebe9e87fe096c52e23f7a0d49da9c1c0202` |

Tasks 1–18 are committed and pushed; the final roadmap evidence is in [the Task 18 verification report](../docs/qa/task-18-verification.md). The approved MVP roadmap ends here. Current handoff state is in [CURRENT_STATE.md](CURRENT_STATE.md).

## Runtime qualification — 2026-09-30

Validated/reviewed maintenance before its single task commit: restored real PostgreSQL-backed login without discarding SQLite work; corrected stateful GET recognition, required CAPTCHA CSP, encrypted lease expiry, test-role/database collision safety, CI bootstrap/order, vulnerable transitive dependencies and platform-bootstrap documentation. Current proof passed 211 backend tests/1,308 assertions, 132 frontend tests, 68 browser scenarios and 22 live HTTP checks, with required validation/security gates green. The canonical [system handoff](../docs/qa/MSPROUT_SYSTEM_HANDOFF.md) records 40 PASS/0 FAIL/12 BLOCKED/3 NOT RUN product-flow rows and distinguishes modeled browser evidence from live integration. Real provider/admin commissioning and physical devices remain unqualified. Resolve the qualification commit through that file's Git history; no later roadmap task was started.

## Manual planning and Codebase Memory — 2026-09-30

Subsequent desktop MCP verification is recorded in CODEBASE_MEMORY.md; the planning-time pending state below is historical.

Planning/tooling maintenance adds the [23-phase/211-case manual roadmap](../docs/qa/MANUAL_TESTING_ROADMAP.md), separate [manual checkpoint](MANUAL_TESTING.md), and [Codebase Memory knowledge](CODEBASE_MEMORY.md). Reviewed official Windows v0.11.0 installation used skip-config; a scoped Codex entry and external cache were verified through actual stdio MCP indexing/list/architecture/symbol/call-path queries. Current desktop-chat tool visibility remains pending restart, as explicitly allowed by the request. Native Blade detection avoids speculative extension config; index-only excludes and ignored graph snapshots preserve source/data boundaries. Source review corrected stale handoff prose about synchronous Teacher invitation mail. No manual phase, product feature, application-runtime change or development data reset occurred. Validation was recorded before finalization; resolve the task commit/push from the new roadmap's Git history and actual remote state.

## MT-00 environment preflight — 2026-10-01

[MTQA-20260930-01](../docs/qa/manual-runs/MTQA-20260930-01/MT-00.md) completes10 PASS/0 FAIL/0 BLOCKED/0 NOT_RUN after preserving initial blocked receipts. Direct PostgreSQL/migrations/RLS/grants/services/health evidence, corrected exact-origin human storage receipt and privately configured readiness200/no-token401 proof establish the bounded preflight. No feature, reset, storage clear, credential disclosure or MT-01 execution. Result recorded before task finalization; Git history identifies the reviewed QA commit.

## MT-01 applicant authentication qualification — 2026-10-01

[MTQA-20260930-02](../docs/qa/manual-runs/MTQA-20260930-02/MT-01.md) completes all ten real MT-AUTH cases with legitimate mail verification/reset/replay/natural expiry, session/CSRF/correlation boundaries and approved isolated offline/server-failure evidence. Corrected headless denial500, new-password contract bounds, misleading5xx advice and a transitive dependency advisory. Current223 backend tests/1,376 assertions and136 frontend tests/34 files plus applicable gates passed. AP unchanged/signed out, approved DA/mail/canonical evidence retained, temporary fault server/window closed; PostgreSQL/SQLite/configuration/browser work preserved. No MT-02 or new feature. Result recorded before finalization; Git history identifies the one reviewed phase commit and actual upstream synchronization.

## Autonomous Local Manual-Test Operator Mode — 2026-10-01

Implemented/validated local governance/tooling; user separately approved finalization under AGENTS.md section 14. GREEN for this bounded change; this milestone is recorded before the single approved `chore: establish autonomous local QA operator mode` commit/normal feature-branch push. Resolve the resulting SHA and synchronization through Git history/status. [Protocol](../docs/qa/AUTONOMOUS_LOCAL_OPERATOR.md) and Windows PowerShell helper provide an ignored owner-only DPAPI credential/config store, generated reusable credentials for explicitly designated new synthetic identities, and fail-closed phase/case/local-origin/preservation checks. Reviewed local probes and permitted browser evidence are authorized only inside a separately requested phase; all human/private-credential/MFA/recovery/CAPTCHA/destructive/external/security-policy/browser-policy boundaries remain. AP/MT-01 DA/PA, application data/configuration and all manual evidence are preserved; no MT-02 or feature work. Focused28-assertion dual-PowerShell/security evidence is in [testing environment](TESTING_ENVIRONMENT.md). No credential file or live identity is initialized; review approval is complete; no next-phase authorization is implied.
