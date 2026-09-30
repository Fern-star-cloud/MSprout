# Manual Testing Knowledge

## Purpose

Concise running qualification state. The roadmap is the plan; the system handoff is the reference; this file records what actually ran and what is next. Planning does not constitute a manual campaign.

## Authority and Related Files

- [AGENTS.md](../AGENTS.md): operational authority, unchanged by this layer.
- [System handoff](../docs/qa/MSPROUT_SYSTEM_HANDOFF.md): implemented system, historical evidence and runtime reference.
- [Manual roadmap](../docs/qa/MANUAL_TESTING_ROADMAP.md): ordered MT-00…MT-22 cases, identity/data preparation, evidence and exit rules.
- [Codebase Memory](CODEBASE_MEMORY.md): advisory graph integration and verification/reload status.

## Current Manual-Test Checkpoint

MT-00 run `MTQA-20260930-01` against `a0a2a47706b75a442846b6c7a39971ed22bbf5ae`, `feat/mvp-foundation` / `origin/feat/mvp-foundation`, initially clean/0/0 with authenticated remote/main agreement. Tasks 1–18 complete; no Task 19. The two documentation/tooling commits after `df7cf61` explain the older planning baseline. Full [run record](../docs/qa/manual-runs/MTQA-20260930-01/MT-00.md) contains expected/actual/result/evidence/commands/blockers for every stable case ID.

**MT-00 PASS: 10 PASS / 0 FAIL / 0 BLOCKED / 0 NOT_RUN.** Initial8/0/2/0 blocked receipt retained; same-chat continuation closed MT-ENV-010 with corrected exact-origin HUMAN_MANUAL evidence and MT-ENV-008 with actual authenticated readiness. MT-01–MT-22 and their remaining201 cases remain NOT_RUN. Handoff's earlier55-row matrix stays historical. This verified result is recorded before finalization; resolve the task commit through report history and verify remote/worktree synchronization rather than assuming a self-referential SHA.

## Environment Knowledge

MT-00 actual runtime: documented process-scoped Node24.19.0/pnpm10.34.5/PHP8.3.33/PDO PostgreSQL/GD/ZIP. PostgreSQL18.6 authoritative; restricted non-owner runtime/no role memberships; all20 migrations applied/all25 protected tables forced RLS; canonical evidence append-only/legacy audits read-only. Test DB/role separate; migration/live share target with distinct roles. Docker/original volume and application processes retained; queue healthy/empty and heartbeat current. Preview4173 remains separate/no API proxy. SQLite and APP_KEY/DB configuration preserved; only ignored READINESS_TOKEN changed in authorized continuation, with actual readiness200 and no-token401 proof.

## Runtime Start/Stop Knowledge

Use handoff sections 6–12. Reuse healthy Docker children and identify exact host processes first. Separate Laravel serve/queue:work/schedule:work and Vite terminals are required. Stop only run-owned processes; Compose stop retains volume. No development migrate:fresh/reseed/volume removal/SQLite deletion/browser purge with pending work.

## Development/Test Identities

Last verified development has one verified tenantless applicant `test@example.com`; no church/application/platform admin. Credentials stay in private local fixture context. Do not reseed/copy again. Additional identities are a plan, not existing accounts. Human must designate platform recovery mailbox and handle TOTP/recovery material. Use official bootstrap; do not occupy singleton with arbitrary QA address. Roadmap aliases AP/PA/OA/OB/T1/T2/UT/IV/RV/XT/OP-A/OP-B/G/MD1/MD2 resolve privately at execution. Test factories/scenarios are isolated test DB only.

## Synthetic Test Data

Nothing new created in development by planning. Roadmap section 7 defines named A/B churches, ministries, synthetic student/reference aliases, assignment states, fixed four dates, conflicts/revisions/guests and inert spreadsheet variants. Read before create, record actual UUID mapping privately, reuse safe fixtures, preserve immutable evidence and unsynced ciphertext.

## Completed Manual Phases

MT-00 only, all ten PASS after continuation closure. [MTQA-20260930-01](../docs/qa/manual-runs/MTQA-20260930-01/MT-00.md) retains original blocked/intermediate receipts. Final proof uses direct runtime plus corrected operator HUMAN_MANUAL browser-storage evidence; no historical/modeled test promoted to live PASS.

## Current Active Phase

**MT-00 complete; stop before MT-01.** MT-01 is next only with a new explicit prompt and its own identity/data prerequisites.

## Known Live Findings

MT-00: public health200/minimal/correlated; readiness401 without token and actual200 ready with privately configured token, all four dependency checks ok. Same-origin CSRF204/anonymous session401 and safe origin/cookies/debugfalse verified; no positive login journey. Actual identity census retained AP1/verified and listed domain counts0. Corrected operator Chrome receipt for127.0.0.1:5173 establishes dev-sw.js running, exact shell-only Workbox cache/no API entry, native IndexedDB10/seven empty stores and no modification. It does not assert unrelated origins/profiles are empty. Overall birthday no-dispatch metrics remain expected with zero churches and outside preflight provider scope.

Historical handoff login/current-status and denial evidence remains historical. Public signup disabled; live positive onboarding/roles/offline-to-server/providers remain unqualified. H01–H03 remain suspicions. No confirmed product defect found during preflight. Missing providers and browser/tool limits are prerequisites, not defects. Stale MCP-pending/manual-NOT_RUN knowledge corrected from verified receipts.

## Confirmed Bugs

No new confirmed product bug from MT-00; no source correction or regression change. Handoff D01–D08 remain remediated in `df7cf61`. Record future failures with severity/root cause/regression and AGENTS.md RED remediation.

## Blockers

- **No unresolved MT-00 blocker. B-MT00-01 resolved:** user authorized safe local resolution; cryptographically random development READINESS_TOKEN configured privately in ignored API environment. Actual authorized readiness200/all dependency checks ok; no-token401 preserved. Original environment bytes/key/DB credentials preserved except this entry, external private backup retained, value never disclosed. Laravel serve auto-reloaded its listener; no global change or security bypass.
- **B-MT00-02 resolved:** corrected read-only Chrome receipt for exact127.0.0.1:5173 and exact cache name `workbox-precache-v2-http://127.0.0.1:5173/ - http://127.0.0.1:5173/`; only /index.html/total1/no API entry. Native IndexedDB10 corresponds to Dexie schema1; all seven stores0. Evidence is HUMAN_MANUAL/operator-reported, not independently inspected screenshots. #34 is confined to the earlier wrong-origin localhost receipt; no build hash/observation timestamp invented. Original wrong-origin/blocked receipts retained in report.
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

Stop after MT-00 validation/review and permitted GREEN finalization. Next authorized run may execute MT-01 only using the prompt below. No full-suite rerun merely for documentation, Codebase Memory restart/reindex or token disclosure is needed. Development readiness secret is already configured privately; do not generate another key or copy it into chat/Git.

**Exact MT-01 prerequisite:** MT-00's ten cases PASS with no unresolved safety/evidence blocker (or separately recorded explicit bounded human progression allowed by roadmap §10, never a security/data-integrity waiver); preserved private AP credentials; running Mailpit; an agreed minimal authorized disposable DA preparation procedure for unverified/reset variants, since no public signup exists. This run grants no progression exception.

**MT-01 prompt entry point, for a subsequent authorized run only:**

> Read AGENTS.md, docs/qa/MSPROUT_SYSTEM_HANDOFF.md, docs/qa/MANUAL_TESTING_ROADMAP.md, knowledge/MANUAL_TESTING.md and knowledge/CODEBASE_MEMORY.md. Verify Git checkpoint/upstream/status and the completed MT-00 evidence; preserve PostgreSQL, SQLite, IndexedDB and unsynced work. Tasks 1–18 are complete; no Task 19 or new feature. Execute PHASE MT-01 — Applicant authentication ONLY, using all stable MT-AUTH case IDs and required live evidence. Confirm private AP credentials, Mailpit and the authorized disposable DA preparation procedure without recreating AP or bypassing signup/authentication/security controls. Record expected/actual/result/evidence/commands/exact blockers, follow AGENTS.md remediation/validation/finalization, update manual knowledge, and stop before MT-02. If MT-00 prerequisites remain unresolved, record the blocker and do not start MT-01.

## Last Updated

2026-10-01, Asia/Taipei; run began2026-09-30, MT-00 only, all ten cases PASS after continuation. Initial YELLOW receipts retained; current result recorded before permitted GREEN finalization. No MT-01 execution.
