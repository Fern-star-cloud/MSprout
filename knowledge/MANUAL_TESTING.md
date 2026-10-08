# Manual Testing Knowledge

## Shared workspace finding — automated fix evidence, 2026-10-08

The missing church-context finding across Review, Reports, Birthdays, Ministries, Students and Import now has a shared authenticated boundary and [automated regression/security/browser evidence](../docs/qa/shared-workspace-context-verification.md). Single-membership navigation/refresh inherits context; multi-membership users explicitly choose an authorized church; revoked/expired context gates child loaders. Live migration/rollout and a new human manual retest are NOT RUN. Historical manual cases, counts, blockers and attribution remain unchanged.

The user's approved MTQA A / Approved application status, confirmed Owner MFA and reachable Teacher management are preserved as human-reported observations. The original local QA edits and untracked MT-02/second-attempt evidence were recovered from verified stash `9b89c9fc47931b76af19bb9c7dd2699a1f806196` after fast-forward reconciliation and remain outside this fix's commit. Unrelated UI findings are excluded; no synthetic application decision or live data was altered.

## Current manual QA policy — 2026-10-07

By explicit user decision, MT-00 through MT-22 are optional, risk-based references for exploration, bug reproduction, correction and fix validation. Sequential completion of all 211 cases is not required for development, merging, deployment or release. Incomplete, BLOCKED, NOT_RUN or deferred cases do not automatically block those activities. Applicable automated tests, security controls, authorization boundaries, CI requirements, deployment safeguards and unresolved release-critical defects remain release criteria. Confirmed bugs require severity-based triage, correction in an authorized scope and focused regression validation. Deferred tests remain accurately BLOCKED or NOT_RUN; never represent them as PASS.

Preserve existing results, evidence and known blockers. Phase exit rules describe proof needed to claim a phase passed, not unconditional release prerequisites. See [AGENTS.md](../AGENTS.md) section 16 and the [manual roadmap](../docs/qa/MANUAL_TESTING_ROADMAP.md). Older dated qualification, progression, next-action and no-finalization receipts below describe their historical run scopes; they do not reinstate mandatory sequential qualification.

Current evidence checkpoint: Tasks 1–18 are complete; MT-00 and MT-01 passed and remain preserved. MT-02 is partial: the latest cleanup receipt records 2 PASS / 0 FAIL / 3 BLOCKED / 5 NOT_RUN. MT-APP-003 has five passing subchecks; City121 denial remains BLOCKED with its payload/reproduction uncertainty. MT-APP-004 remains BLOCKED on fresh-fixture authorization; AUTO-MTAPP004 was proposed, not created or designated. Response correlation ID and click count for the combined at-limit acceptance remain unconfirmed. Known blockers and older counts remain in the retained run history; no results are promoted by this policy change.

The earlier request to prepare MT-APP-004 is deferred. This governance run authorizes no manual case, fixture preparation or product fix: do not rerun completed cases or start MT-03 or another phase. Preserve all four existing pending church applications, PostgreSQL/SQLite, APP_KEY, credentials, browser/offline storage, drafts, conflicts, outbox events, cursors, unsynced work and prior evidence. No synthetic user, application submission, record deletion, database reset or storage clearing is authorized. Authentication, CAPTCHA, MFA, RLS, CSRF and other protections remain intact. These are preservation requirements, not a new runtime census or browser inspection.

## Observed issue O-QA-20261007-01 — Pending review horizontal overflow

The user reports that a long synthetic church name causes horizontal page overflow on the Pending review screen. Evidence classification: HUMAN_MANUAL observation supplied in the governance request; no independent reproduction was performed in this run. Status: observed issue requiring reproduction and severity assessment, not a confirmed root cause. Severity, affected viewport/browser range, accessibility/core-workflow impact and root cause are unassessed. No CSS, layout or input-validation cause is asserted and no fix or regression PASS is claimed.

A separately scoped investigation should use the preserved pending application and existing evidence, record viewport/browser and expected versus actual layout, assess severity and release impact, and add a focused regression before correcting a confirmed defect. Do not create an applicant, resubmit, delete a pending application or clear storage to reproduce it. This observation alone is not evidence of a release-critical defect; any such impact discovered later remains a release blocker.

## Preserved historical receipts

## Purpose

Concise running qualification state. The roadmap is the plan; the system handoff is the reference; this file records what actually ran and what is next. Planning does not constitute a manual campaign.

## Authority and Related Files

- [AGENTS.md](../AGENTS.md): operational authority, unchanged by this layer.
- [System handoff](../docs/qa/MSPROUT_SYSTEM_HANDOFF.md): implemented system, historical evidence and runtime reference.
- [Manual roadmap](../docs/qa/MANUAL_TESTING_ROADMAP.md): ordered MT-00…MT-22 cases, identity/data preparation, evidence and exit rules.
- [Codebase Memory](CODEBASE_MEMORY.md): advisory graph integration and verification/reload status.

## Current Manual-Test Checkpoint

MT-01 is committed/pushed at `3dba978b97fff590ec1b814b66b103344843c19a` (`fix: qualify MT-01 applicant authentication`), verified clean/0/0 with remote/main agreement at operator-mode reconnaissance. The original pre-finalization receipts below remain historical. Operator-mode governance/tooling is implemented/validated and the user separately approved finalization under AGENTS.md section 14. GREEN for this bounded change only; no manual phase started. This pre-commit receipt accompanies the single approved `chore: establish autonomous local QA operator mode` commit; verify its SHA/push through Git history/status.

MT-00 run `MTQA-20260930-01` against `a0a2a47706b75a442846b6c7a39971ed22bbf5ae`, `feat/mvp-foundation` / `origin/feat/mvp-foundation`, initially clean/0/0 with authenticated remote/main agreement. Tasks 1–18 complete; no Task 19. The two documentation/tooling commits after `df7cf61` explain the older planning baseline. Full [run record](../docs/qa/manual-runs/MTQA-20260930-01/MT-00.md) contains expected/actual/result/evidence/commands/blockers for every stable case ID.

**MT-00 PASS: 10 PASS / 0 FAIL / 0 BLOCKED / 0 NOT_RUN.** Initial8/0/2/0 blocked receipt retained; continuation closed MT-ENV-010 with corrected exact-origin HUMAN_MANUAL evidence and MT-ENV-008 with actual authenticated readiness. Finalized at `40525fbe5eb9fc0f20b3a2a0e425dab137b2d214` (`docs: complete MT-00 environment preflight`); MT-01 began at this synchronized feature checkpoint with unchanged main `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f`. Current MT-01 completes **10 PASS / 0 FAIL / 0 BLOCKED / 0 NOT_RUN**; MT-02–MT-22 remain untouched. Handoff's earlier55-row matrix stays historical. This receipt records the reviewed result before finalization; resolve the MT-01 commit and actual push synchronization from Git history/status, rather than a self-referential SHA.

## Environment Knowledge

Autonomous operator guidance is in [the protocol](../docs/qa/AUTONOMOUS_LOCAL_OPERATOR.md) and AGENTS.md section 16. A separately authorized phase may use reviewed local probes and explicitly designated new synthetic identities via ignored `/.manual-qa/operator.dpapi`. No operator credential file/identity is initialized in this run. AP/retained MT-01 DA remain private/excluded; PA/MFA/recovery/CAPTCHA remain human. Helper READY does not prove authority, server identity, preservation or a case PASS. Missing authorization/material/uncertain isolation is YELLOW/BLOCKED. Preserve all existing data/evidence/unsynced work; this mode does not authorize MT-02, a new feature or a reset.

MT-00 actual runtime: documented process-scoped Node24.19.0/pnpm10.34.5/PHP8.3.33/PDO PostgreSQL/GD/ZIP. PostgreSQL18.6 authoritative; restricted non-owner runtime/no role memberships; all20 migrations applied/all25 protected tables forced RLS; canonical evidence append-only/legacy audits read-only. Test DB/role separate; migration/live share target with distinct roles. Docker/original volume and application processes retained; queue healthy/empty and heartbeat current. Preview4173 remains separate/no API proxy. SQLite and APP_KEY/DB configuration preserved; only ignored READINESS_TOKEN changed in authorized continuation, with actual readiness200 and no-token401 proof.

## Runtime Start/Stop Knowledge

Use handoff sections 6–12. Reuse healthy Docker children and identify exact host processes first. Separate Laravel serve/queue:work/schedule:work and Vite terminals are required. Stop only run-owned processes; Compose stop retains volume. No development migrate:fresh/reseed/volume removal/SQLite deletion/browser purge with pending work.

## Development/Test Identities

Current development has two tenantless users: preserved verified AP (`test@example.com`) and the operator-approved synthetic DA, now verified through the received email link in MT-AUTH-006. No church/application/membership/platform admin was created. DA's post-fix normal reset and old/new login checks succeeded; its current compliant password stays private. AP credentials/entire row unchanged, operator signed out. Do not disclose credentials, recreate either account, or reseed/copy again. Other identities remain a plan. Human must designate platform recovery mailbox and handle TOTP/recovery material. Use official bootstrap; do not occupy singleton with arbitrary QA address. Roadmap aliases resolve privately at execution. Test factories/scenarios are isolated test DB only.

## Synthetic Test Data

Nothing new created in development by planning. Roadmap section 7 defines named A/B churches, ministries, synthetic student/reference aliases, assignment states, fixed four dates, conflicts/revisions/guests and inert spreadsheet variants. Read before create, record actual UUID mapping privately, reuse safe fixtures, preserve immutable evidence and unsynced ciphertext.

## Completed Manual Phases

MT-00 and MT-01, each all ten PASS. [MTQA-20260930-01](../docs/qa/manual-runs/MTQA-20260930-01/MT-00.md) and [MTQA-20260930-02](../docs/qa/manual-runs/MTQA-20260930-02/MT-01.md) retain original failures/blocked/intermediate receipts. MT-01 uses actual browser, operator-private HTTP probes and canonical read-only evidence, including legitimate mail verification/reset/replay/natural expiry. No historical/modeled test promoted to live PASS.

## Current Active Phase

**MT-01 completed; stop before MT-02.** Run [MTQA-20260930-02](../docs/qa/manual-runs/MTQA-20260930-02/MT-01.md), candidate40525fbe:10 PASS/0 FAIL/0 BLOCKED/0 NOT_RUN. Explicitly approved isolated read-only fault target and fresh Incognito per-tab offline alternative supplied010 live evidence. F-MT01-04 corrected misleading online5xx advice; current frontend136 tests/34 files and relevant gates PASS. Backend223 tests/1,376 assertions and unaffected applicable gates remain valid. Operator confirms AP signed out and isolated Incognito closed; owned fixture4384 stopped/port5181 absent04:14:39 UTC. Temporary Codex fixture/mail tabs closed; main signed-out login retained. Read-only04:15:33 UTC confirms full AP row/current DA password/expired-token row/SQLite/API environment unchanged, users2/domain counts0. No attributed AP logout event since04:00 was observed; final normal Chrome sign-out is HUMAN_MANUAL evidence, not an invented server receipt. No storage clear or shared-service stop. Final reviewed evidence/knowledge checks precede one authorized GREEN commit/push; no next-phase authorization implied.

## MT-01 Prerequisite Preparation — historical 2026-10-01

Prerequisite-only continuation at synchronized `40525fbe`; no manual phase/case execution or new run record. Operator first reported AP credentials unavailable, then privately retrieved them and confirmed availability. Operator explicitly approved one new unverified tenantless DA (`MTQA MT-01 DA`) and executed the reviewed external `%TEMP%\msprout-manual-mt01-preparation\Prepare-DA.ps1`. The script uses the existing validated `CreateNewUser` action in a transaction through restricted development PostgreSQL; no seeder/factory/public-registration change. It refuses a changed checkpoint, unexpected existing users or address collision; secure local password prompts pass input only through PHP stdin, never arguments/files/chat. Preparation PowerShell/PHP syntax and read-only preflight passed. Operator reported its sanitized success receipt: one user created, AP unchanged, no MT-01 case run. This receipt's AP before/after equality and chosen-password/hash proof are HUMAN_MANUAL/operator-reported, not agent-observed authentication.

Subsequent DIRECT_RUNTIME read-only transactions confirm users2; AP verified; DA exists with approved name, unverified/password hash present/no remember token/no MFA; DA sessions0/reset tokens0/memberships0; churches/applications/memberships/platform admins all0. No password, hash, ID map or token output. Mailpit v1.27.7 healthy on loopback1025/8025, info200/messages0; effective Laravel SMTP points to loopback1025 without URL/auth override and its configured transport handshake passed without sending mail during preparation. Exact application origin5173/debugfalse preserved. Existing PostgreSQL volume, SQLite, configuration/APP_KEY/credentials and browser work were not reset, rotated, deleted or cleared.

**All MT-01 prerequisites READY:** completed/synchronized MT-00; operator-confirmed private AP credentials; running/configured Mailpit; agreed procedure and prepared DA. Agreement covers normal verification/reset through supported UI/mail only during a separately authorized MT-01 run. Effective verification/reset expiry is60minutes; wait for real expiry rather than backdating records, changing clocks or weakening configuration. Reset changes only DA through the supported flow; retain its fixture and evidence afterward, no deletion authorized. Do not rerun creation or change AP. Additional fault/time/data injection requires a separately authorized isolated target under roadmap section7. Preparation is not an authentication PASS; all MT-AUTH cases remain NOT_RUN. Stop and use the exact subsequent MT-01 prompt below.

## Known Live Findings

MT-00: public health200/minimal/correlated; readiness401 without token and actual200 ready with privately configured token, all four dependency checks ok. Same-origin CSRF204/anonymous session401 and safe origin/cookies/debugfalse verified; no positive login journey. Actual identity census retained AP1/verified and listed domain counts0. Corrected operator Chrome receipt for127.0.0.1:5173 establishes dev-sw.js running, exact shell-only Workbox cache/no API entry, native IndexedDB10/seven empty stores and no modification. It does not assert unrelated origins/profiles are empty. Overall birthday no-dispatch metrics remain expected with zero churches and outside preflight provider scope.

Historical handoff login/current-status and denial evidence remains historical. Public signup disabled; live positive onboarding/roles/offline-to-server/providers remain unqualified. H01–H03 remain suspicions. No confirmed product defect found during preflight. Missing providers and browser/tool limits are prerequisites, not defects. Stale MCP-pending/manual-NOT_RUN knowledge corrected from verified receipts.

## Confirmed Bugs

No new confirmed product bug from MT-00. Handoff D01–D08 remain remediated in `df7cf61`. MT-01 F-MT01-01 headless HTML-Accept guest/unverified500 corrected to safe401/403 with regression/live proof. F-MT01-02 serialize-javascript advisory corrected by narrow7.1.2 pin and clean audit. F-MT01-03 shared new-password rules aligned with existing12–128 contract; boundary regressions/full backend and live recovery PASS. F-MT01-04 online5xx network advice corrected to safe service-unavailable message; four failing-then-passing regressions/current UI/full frontend/security proof PASS. All four resolved; original failures remain in the report. No public signup or later feature implemented.

## Blockers

No unresolved MT-01 blocker. Resolved F-MT01-03: shared new-password rules aligned with existing12–128 contract; five boundary regressions, focused45/256 and full223/1,376/Pint/OWASP51 rules/11 targets/100% parsed/zero findings PASS. First live reset remains historical pre-fix evidence; later supported reset/replay/expiry/old-new proof completes qualification. No AP rotation or retroactive DA login rejection.

- **No unresolved MT-00 blocker. B-MT00-01 resolved:** user authorized safe local resolution; cryptographically random development READINESS_TOKEN configured privately in ignored API environment. Actual authorized readiness200/all dependency checks ok; no-token401 preserved. Original environment bytes/key/DB credentials preserved except this entry, external private backup retained, value never disclosed. Laravel serve auto-reloaded its listener; no global change or security bypass.
- **B-MT00-02 resolved:** corrected read-only Chrome receipt for exact127.0.0.1:5173 and exact cache name `workbox-precache-v2-http://127.0.0.1:5173/ - http://127.0.0.1:5173/`; only /index.html/total1/no API entry. Native IndexedDB10 corresponds to Dexie schema1; all seven stores0. Evidence is HUMAN_MANUAL/operator-reported, not independently inspected screenshots. #34 is confined to the earlier wrong-origin localhost receipt; no build hash/observation timestamp invented. Original wrong-origin/blocked receipts retained in report.
- **B-MT01-01/03 resolved:** operator-private AP normal Chrome and subsequent Codex sign-ins observed as verified account; server success event safely attributed. Codex logout and denial proof passed. Do not copy sessions between browsers or reset AP. These were operator-input handoffs, not product defects or unresolved preflight prerequisites.
- **B-MT01-02 resolved:** absent Laravel/Vite/worker/scheduler processes caused current frontend/API transport outage; exit cause unknown. Existing process-scoped runtimes restored safely without configuration/data/browser reset. Actual frontend/proxy/CSRF/session/readiness/heartbeat and both-browser rendering proof are in the run continuation. Private receipts confirm AP/environment/SQLite unchanged, DA unverified/sessions/reset tokens0; anonymous probe's security delta1 retained. Keep run-owned processes running and preserve their external ownership receipt.
- **B-MT01-04 resolved:** actual operator-run reviewed HTTP probe receipt01:13:00 UTC establishes AP login200/verified, owned logout204, stale session/application401/private-no-store and current-context denial. Credentials/cookies remained local and memory-only. MT-AUTH-005 PASS using HUMAN_MANUAL executed runtime receipt, no synthetic authentication or browser extraction. Final Chrome cleanup confirmed separately; no bulk deletion.
- **B-MT01-05 resolved:** operator DA login observed unverified; real protected gate and legitimate mail verification passed006. DA now verified; preparation must not be rerun.
- **B-MT01-06 resolved:** first DA reset succeeded, observed exact Codex success screen; token0 and attributed canonical reset-success event, AP/files/domains unchanged. Consumed replay with same input was blocked by native min12 validation; it is not a server denial PASS.
- **B-MT01-07 resolved:** operator compliant consumed-link replay rejected with Check the information you entered and try again, independently observed. Read-only02:16:22 UTC confirms DA/AP/files unchanged, token0, one new reset-failure event with valid correlation/empty metadata. Rejection preceded the first link's natural expiry; no replacement token existed at that check.
- **B-MT01-08 resolved:** normal post-fix DA reset success observed in Codex; read-only02:20:52 UTC confirms password changed through reset, token0/two attributed reset-success events/AP-files unchanged.
- **B-MT01-09 resolved:** operator executed the reviewed old/new DA login probe at02:27:58 UTC. Actual sanitized HUMAN_MANUAL receipt PASS: old login422/session401; new login200/session200/verified DA; owned logout204. No credential or cookie disclosure. Read-only02:29:05 and02:36:09 UTC confirm current DA password, unused expiry-token row, AP and files unchanged.
- **B-MT01-10 resolved:** operator submitted retained form after11:22 without reloading; exact safe rejection independently observed. Read-only03:33:52 UTC confirms one password.reset failure at03:32:22 UTC, after03:21:12 expiry, valid correlation/empty metadata, same token/current DA password/AP/files/users2/domains0. No backdating/replacement/reset/configuration change. MT-AUTH-007 PASS.
- **B-MT01-11 resolved:** actual008 operator receipt03:37:59 UTC PASS: missing-CSRF guest login419/session401, valid login200, authenticated logout/login without CSRF419 with session200/unchanged assurance/private-no-store; owned cleanup204. Canonical safe projection confirms DA-attributed denials/valid correlations/empty metadata. No008 repeat needed.
- **B-MT01-12 resolved:** corrected fresh guest009 operator receipt03:43:47 UTC PASS. Exact private response correlation mapping read-only03:44:52 UTC confirms one DA login success/one anonymous-null-actor login failure, empty metadata. AP/current DA password/token/files unchanged. Initial runner failure preserved;008 not repeated.
- **B-MT01-13/14 resolved:** explicit operator approval of separate read-only127.0.0.77:5181 fixture and fresh Chrome Incognito offline-only procedure. Actual current Codex UI500/service-unavailable/Online proof and human Offline/network-error then online401 recovery PASS; no positive auth mock, credential entry, host network change or shared-service fault.
- **B-MT01-15 resolved:** operator AP signed-out/Incognito-closed confirmations; exact owned fixture stopped/port5181 absent, temporary Codex tabs closed, preserved main login anonymous. Final read-only preservation04:15:33 UTC PASS; DA/mail/canonical evidence retained. No browser-storage purge, other-session invalidation or preserved-data deletion.
- Later-phase prerequisites observed: real Vite Turnstile site key/server secret/exact hostname absent; VAPID absent; private PA mailbox/TOTP, approved extra applicant creation, physical devices/HTTPS/provider access still needed. No later-phase case was executed or assigned a result.

## Provider/Physical-Device Requirements

Real CAPTCHA must match `church_application` and exact configured hostname; dummy action mismatch must not be bypassed. Mailpit proves local delivery only. Android Chrome/iPhone+iPad Home Screen, actual Web Push, background/OS eviction/network switching and private human pilot sign-off need their own evidence. Emulation/axe/historical backup drill do not satisfy these.

## Manual-Test Decisions

Execute one ordered phase per run. Named fixture-dependent checks in MT-02/05/06/07 close in MT-04/09; MT-10 pending-work update check closes in MT-13 after genuine attendance exists. Final GREEN is withheld until closure. Use separate RV-O for offline revocation rather than reprovisioning the already revoked MT-09 RV actor. No other skip without explicit bounded human direction. Development subset qualification and real-pilot GREEN are separate; blocked items never become PASS. AGENTS.md governs severity/remediation/finalization without modification.

## Evidence Rules

Use roadmap full evidence/result enums and per-phase run record schema. Record candidate/environment/date/aliases/expected/actual/status/correlation/aggregate counts/defect/cleanup. Never commit credentials, recovery material, PINs, raw bodies, full mail, child/guardian data, unrestricted SQL, HAR or secrets in screenshots. Runner output stays ignored. Preserve earlier evidence; reruns supersede by reference.

## Things Not To Repeat

Do not recreate the preserved applicant, reset development, assume SQLite authority, use preview as a live backend, fabricate real identities from mocked e2e fixtures, bypass verification, publish sensitive records, or start another product task. Do not rerun product gates solely for documentation. Do not trust graph completeness or auto-created graph ADR over governance/source.

## Next Manual-Test Action

MT-01 is complete. Stop; MT-02 requires a separate explicit execution request plus real Turnstile configuration for the exact approved origin/action and approval of any additional synthetic applicant preparation. Do not submit an application, recreate AP/DA or bypass CAPTCHA. Resolve the completed MT-01 commit/push from Git and read the authoritative MT-02 prerequisites before future preparation. Preserve all retained fixtures, mail, canonical evidence and unsynced work.

**Exact MT-01 prerequisite:** MT-00's ten cases PASS with no unresolved safety/evidence blocker (or separately recorded explicit bounded human progression allowed by roadmap §10, never a security/data-integrity waiver); preserved private AP credentials; running Mailpit; an agreed minimal authorized disposable DA preparation procedure for unverified/reset variants, since no public signup exists. This run grants no progression exception.

**Historical MT-01 execution prompt used for this completed run (do not rerun automatically):**

> Read AGENTS.md, docs/qa/MSPROUT_SYSTEM_HANDOFF.md, docs/qa/MANUAL_TESTING_ROADMAP.md, knowledge/MANUAL_TESTING.md and knowledge/CODEBASE_MEMORY.md. Verify Git checkpoint/upstream/status and the completed MT-00 evidence; preserve PostgreSQL, SQLite, IndexedDB and unsynced work. Tasks 1–18 are complete; no Task 19 or new feature. Execute PHASE MT-01 — Applicant authentication ONLY, using all stable MT-AUTH case IDs and required live evidence. Confirm private AP credentials, Mailpit and the authorized disposable DA preparation procedure without recreating AP or bypassing signup/authentication/security controls. Record expected/actual/result/evidence/commands/exact blockers, follow AGENTS.md remediation/validation/finalization, update manual knowledge, and stop before MT-02. If MT-00 prerequisites remain unresolved, record the blocker and do not start MT-01.

## Last Updated

2026-10-01, Asia/Taipei; MT-00 and MT-01 each ten PASS, cleanup complete. Applicable product/security evidence retained, final knowledge checks and authorized finalization recorded in the MT-01 run report/Git history. MT-02 untouched.
