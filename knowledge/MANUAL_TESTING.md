# Manual Testing Knowledge

## Purpose

Concise running qualification state. The roadmap is the plan; the system handoff is the reference; this file records what actually ran and what is next. Planning does not constitute a manual campaign.

## Authority and Related Files

- [AGENTS.md](../AGENTS.md): operational authority, unchanged by this layer.
- [System handoff](../docs/qa/MSPROUT_SYSTEM_HANDOFF.md): implemented system, historical evidence and runtime reference.
- [Manual roadmap](../docs/qa/MANUAL_TESTING_ROADMAP.md): ordered MT-00…MT-22 cases, identity/data preparation, evidence and exit rules.
- [Codebase Memory](CODEBASE_MEMORY.md): advisory graph integration and verification/reload status.

## Current Manual-Test Checkpoint

Baseline `df7cf6118f5f119253154ce015803fd143bb1a6c`, `feat/mvp-foundation`, `origin/feat/mvp-foundation`, initially clean/0/0. Tasks 1–18 complete; no Task 19. This checkpoint records pre-finalization planning validation; resolve the planning/tooling commit through this file's history, then verify actual Git state.

The 23 phases / 211 unique roadmap cases are all **NOT_RUN / NOT_RUN**. Handoff's earlier 55-row matrix remains historical: 40 PASS/0 FAIL/12 BLOCKED/3 NOT RUN, with explicit evidence classes. It is not a completed manual phase.

## Environment Knowledge

Windows; documented process-scoped Node24/pnpm10/PHP8.3/PDO PostgreSQL/GD/ZIP. Development PostgreSQL18 is authoritative; restricted runtime and distinct test role/database. Compose PostgreSQL/Mailpit were healthy during planning reconnaissance. Host API/Vite/worker/scheduler state was not requalified. Handoff's last endpoints were 8000/5173; preview4173 has no API proxy and separate profiles. Never print ignored environment values or change APP_KEY.

## Runtime Start/Stop Knowledge

Use handoff sections 6–12. Reuse healthy Docker children and identify exact host processes first. Separate Laravel serve/queue:work/schedule:work and Vite terminals are required. Stop only run-owned processes; Compose stop retains volume. No development migrate:fresh/reseed/volume removal/SQLite deletion/browser purge with pending work.

## Development/Test Identities

Last verified development has one verified tenantless applicant `test@example.com`; no church/application/platform admin. Credentials stay in private local fixture context. Do not reseed/copy again. Additional identities are a plan, not existing accounts. Human must designate platform recovery mailbox and handle TOTP/recovery material. Use official bootstrap; do not occupy singleton with arbitrary QA address. Roadmap aliases AP/PA/OA/OB/T1/T2/UT/IV/RV/XT/OP-A/OP-B/G/MD1/MD2 resolve privately at execution. Test factories/scenarios are isolated test DB only.

## Synthetic Test Data

Nothing new created in development by planning. Roadmap section 7 defines named A/B churches, ministries, synthetic student/reference aliases, assignment states, fixed four dates, conflicts/revisions/guests and inert spreadsheet variants. Read before create, record actual UUID mapping privately, reuse safe fixtures, preserve immutable evidence and unsynced ciphertext.

## Completed Manual Phases

None under this new roadmap. No historical modeled test is promoted to live PASS.

## Current Active Phase

None. MT-00 is next; the planning chat stops before executing it.

## Known Live Findings

Historical handoff: PostgreSQL-backed applicant login/current status works; tenant/platform/CSRF/invalid-CAPTCHA denials observed. Public signup disabled. Live positive church application/review/Owner/Teacher/offline-to-server/provider/device journeys remain unqualified. H01 live-role mismatch, H02 workspace context and H03 date boundary candidates are suspicions, not confirmed bugs. Planning source inspection corrected the handoff's Teacher-mail description: invitation dispatch is synchronous, re-invitation revokes pending predecessors, and unassigned Teacher fixtures require clearing assignments after acceptance. No live behavior was requalified.

## Confirmed Bugs

No new confirmed product bug from this planning task. Handoff D01–D08 remediated in `df7cf61`; do not reopen without new evidence. Record future failures with severity/root cause/regression and AGENTS.md RED remediation. A safe workaround does not convert a confirmed defect to YELLOW.

## Blockers

Known commissioning prerequisites: real Turnstile keys/hostname/action, private PA mailbox/TOTP ceremony, approved method for extra synthetic applicants (no public registration), real VAPID/subscription permissions, readiness token and physical devices/approved HTTPS/provider access. Record each affected case as BLOCKED only when attempted preflight establishes the missing prerequisite; initial cases remain NOT_RUN.

## Provider/Physical-Device Requirements

Real CAPTCHA must match `church_application` and exact configured hostname; dummy action mismatch must not be bypassed. Mailpit proves local delivery only. Android Chrome/iPhone+iPad Home Screen, actual Web Push, background/OS eviction/network switching and private human pilot sign-off need their own evidence. Emulation/axe/historical backup drill do not satisfy these.

## Manual-Test Decisions

Execute one ordered phase per run. Named fixture-dependent checks in MT-02/05/06/07 close in MT-04/09; MT-10 pending-work update check closes in MT-13 after genuine attendance exists. Final GREEN is withheld until closure. Use separate RV-O for offline revocation rather than reprovisioning the already revoked MT-09 RV actor. No other skip without explicit bounded human direction. Development subset qualification and real-pilot GREEN are separate; blocked items never become PASS. AGENTS.md governs severity/remediation/finalization without modification.

## Evidence Rules

Use roadmap full evidence/result enums and per-phase run record schema. Record candidate/environment/date/aliases/expected/actual/status/correlation/aggregate counts/defect/cleanup. Never commit credentials, recovery material, PINs, raw bodies, full mail, child/guardian data, unrestricted SQL, HAR or secrets in screenshots. Runner output stays ignored. Preserve earlier evidence; reruns supersede by reference.

## Things Not To Repeat

Do not recreate the preserved applicant, reset development, assume SQLite authority, use preview as a live backend, fabricate real identities from mocked e2e fixtures, bypass verification, publish sensitive records, or start another product task. Do not rerun product gates solely for documentation. Do not trust graph completeness or auto-created graph ADR over governance/source.

## Next Manual-Test Action

Restart Codex to load the new scoped MCP entry, verify its tool visibility (see CODEBASE_MEMORY.md), then execute **MT-00 only** using roadmap section 13's exact next-chat prompt. Record actual results and exact prerequisites, update this file, and stop at the reviewed phase checkpoint. No manual campaign was executed here.

## Last Updated

2026-09-30, Asia/Taipei; planning/tooling scope only. Git history identifies finalization; no self-referential commit SHA claim.
