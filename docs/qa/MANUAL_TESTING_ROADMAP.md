# MSprout Manual Testing Roadmap

## 1. Purpose

Ordered live/manual qualification of the implemented Tasks 1–18 MVP. This is maintenance/QA, not Task 19, feature approval, deployment authorization, or evidence that a human pilot has occurred. The planning run does not execute these cases. Execute one phase per run, preserve earlier evidence, and stop at its reviewed checkpoint.

## 2. Authority

[AGENTS.md](../../AGENTS.md) remains operational authority, including its source hierarchy, remediation, validation, Git safety and finalization rules. The approved [design](../superpowers/specs/2026-08-20-ministry-sprout-design.md) and [implementation roadmap](../superpowers/plans/2026-08-20-ministry-sprout-implementation-roadmap.md) define product scope. [MSPROUT_SYSTEM_HANDOFF.md](MSPROUT_SYSTEM_HANDOFF.md) is the current technical/runtime reference. This file governs manual-test sequencing and completion evidence; [manual knowledge](../../knowledge/MANUAL_TESTING.md) holds the running checkpoint. [Codebase Memory knowledge](../../knowledge/CODEBASE_MEMORY.md) describes an advisory source-analysis tool, never a replacement authority.

## 3. Current Baseline

Planning baseline, 2026-09-30 Asia/Taipei:

- Branch `feat/mvp-foundation`; HEAD `df7cf6118f5f119253154ce015803fd143bb1a6c` (`fix: qualify runtime and document system handoff`); upstream `origin/feat/mvp-foundation`; clean, unstaged, 0/0 at reconnaissance. `origin/main` is `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f`. Reverify before execution; do not assume this baseline is still current.
- Tasks 1–18 complete/committed/pushed; see [status](../../knowledge/ROADMAP_STATUS.md). There is no implementation Task 19. MT-19 below is a QA phase only.
- Prior qualification at that HEAD: 211 backend tests/1,308 assertions; 132 frontend tests/34 files; 68 browser scenarios on four emulated targets; 22 actual HTTP checks; required contract/build/lint/format/dependency/secret gates passed. OWASP baseline: 108 rules/323 targets/~99.9% parsing/zero findings, plus 128-rule/12-target final delta. These are historical evidence, not gates rerun by this planning task.
- The handoff's 55-row matrix has 40 PASS/0 FAIL/12 BLOCKED/3 NOT RUN. Most browser flows model API replies. Positive live application/platform/Owner/Teacher/offline-to-server integration is unqualified; actual Web Push, physical devices, deployed backup/rollback and hosted CI need evidence.
- Last verified development fixture: one verified tenantless `test@example.com`; zero churches/applications/platform administrators. Its existing credentials remain private local fixture knowledge; do not reseed, overwrite, or publish them. SQLite starter data is preserved, not active authority.
- Last handoff observed Laravel `127.0.0.1:8000`, Vite `127.0.0.1:5173`, worker and scheduler running. Planning reconnaissance saw PostgreSQL and Mailpit individually healthy; it did not requalify host application processes or query development records.
- Prerequisites absent at handoff: real Turnstile site/secret/hostname, human-designated private platform recovery mailbox, VAPID and readiness token; physical Android/iOS and approved HTTPS/device access. Public `/register` is disabled. Do not invent signup or relax CAPTCHA action/hostname matching.

## 4. Testing Principles

Use live evidence when an integration is under test. Record human interaction, direct runtime, live browser, modeled browser automation, automated tests, source inspection and historical documentation separately. Existing automated PASS never satisfies a new live case by itself. No bypass of authentication, MFA, RLS, CSRF, CAPTCHA, audit or offline authority; no hand-set assurance flags or fabricated signed lease.

Preserve development data, APP_KEY, database credentials, existing browser profiles and unsynchronized work. Use named disposable data for adversarial/time/retention cases. Configuration changes must be explicit, limited to the authorized environment, recorded by key names only, and reverted safely; never mutate production-like settings invisibly. Record expected versus actual and reproducible failure steps. Every confirmed defect needs severity, source-grounded root cause, remediation status and regression evidence if fixed. Every blocked case names its exact missing prerequisite and human/external owner.

All case tables below are plans: **initial evidence/result = NOT_RUN/NOT_RUN**. Outcomes belong in run records, not edits that turn plans into claimed results.

## 5. Test Environment

Use [handoff sections 6–12](MSPROUT_SYSTEM_HANDOFF.md) and [testing environment](../../knowledge/TESTING_ENVIRONMENT.md) for exact process setup. Compose has only `postgres` (PostgreSQL 18, loopback 5432, persistent volume) and `mailpit` (SMTP 1025, UI/API 8025); it has no Laravel/Vite/Redis/worker/scheduler child. From `apps/api`, separate terminals run `php artisan serve --host=127.0.0.1 --port=8000`, `php artisan queue:work --sleep=3 --tries=3 --timeout=120`, and `php artisan schedule:work`. Root starts `pnpm --dir apps/web dev --host 127.0.0.1 --port 5173 --strictPort`. Reuse running services. Production preview 4173 has a separate storage origin and no API proxy; it cannot establish a live backend journey.

Windows needs documented process-scoped Node 24/pnpm 10 and PHP 8.3/PDO PostgreSQL/GD/ZIP, plus existing trusted temporary CA setup when needed. Confirm tools rather than installing/reconfiguring the host. No PCNTL in native Windows. Keep test DB and test runtime role distinct from development/migration; backend suites run serially. Apply only reviewed pending migrations, never `migrate:fresh` development.

Targets: installed desktop Chrome/Edge, Chrome Android, Safari iOS Home Screen and iPad; desktop keyboard and screen-reader checks. Emulated Pixel 7/iPhone 13/iPad and WebKit provide supplementary browser-engine evidence only. Physical install/push/background/storage checks require actual hardware, OS/browser versions and trusted HTTPS. Obtain real Turnstile with exact origin hostname and `church_application` action, mail ownership/SMTP, VAPID, readiness token and approved provider accounts privately. Provider/device prerequisites block their cases rather than authorizing security changes.

Shutdown: Ctrl+C only processes started by the run; identify exact PID/command for detached helpers. `docker compose stop` preserves volumes. Never `down -v`, bulk-kill Node/PHP, delete SQLite, or clear profiles with pending work.

## 6. Identity / Role Matrix

Aliases resolve to actual IDs privately during execution. Never record credentials, TOTP material, invitation URLs, PINs or recovery codes in Git.

| Alias | Creation mechanism / live or disposable | Role / verification / MFA | Tenant / provider interaction |
|---|---|---|---|
| AP | Preserve existing `test@example.com`; live development | Applicant; verified; no tenant/MFA at baseline | None until approved; Mailpit for reset |
| PA | Human-designated mailbox; official `platform:bootstrap-admin --handle=sage.dev --email=<private-recovery-email>` once | Separate platform guard; pending then password/TOTP/recovery acknowledgement | No church membership; human mailbox/TOTP required; never arbitrary singleton |
| OA | AP submits real CAPTCHA; PA approves | Primary Owner; verified; enroll/confirm MFA through supported flow | Church A; notification email |
| OB | Separately approved synthetic verified applicant created by authorized fixture process, then live application/approval | Second Owner; verified/current MFA | Church B; real CAPTCHA/email; absent initially |
| T1 / T2 | OA invitation, recipient accepts through signed mail | Teachers; verified via acceptance; MFA optional | A; T1 assigned M1, T2 M1+M2; Mailpit |
| XT | OB invites separate synthetic Teacher | Cross-tenant active Teacher; verified | B only; Mailpit |
| UT | OA invites with M1, accepts, then OA sets empty assignments through supported PUT | Active verified unassigned Teacher | A; Mailpit; cannot self-assign |
| IV | OA creates invitation, recipient has not accepted | No active membership yet | A invitation only; Mailpit |
| RV / RV-O | Separate OA-invited Teacher accepted then revoked; RV is MT-09 variant, RV-O is separately created for MT-11 pending-work test | Verified identity; active before each revocation, then inactive/revoked | A; preserve encrypted pending work; Mailpit; never reuse revoked RV as a fresh active profile |
| OP-A / OP-B | Add profiles as T1/T2 online with genuine bootstrap; select separate devices where required | PIN-protected local profiles; server actor assurance required for sync | A; same shared browser with isolated encryption; no provider for PIN |
| G | Signed-out fresh disposable browser context | Guest/unauthenticated; no assurance | No tenant; separate from attendance guest records |
| MD1 / MD2 | T1 on two disposable browser/device contexts; unique genuine device authorization | Same actor for replay/concurrency; also use T2 for mismatch denial | A/M1; email only for initial login |
| DA | Synthetic applicant/expired invitation/unverified account via reviewed fixture procedure | Test-only assurance varies explicitly per case | Isolated test DB for destructive setup; local Mailpit |

There is no complete live seeder or public signup. Before creating additional applicants, agree the minimal development-only creation procedure with the operator; use normal application/approval/invitation afterward. Existing `tests/Support/ChurchScenario.php` and factories are **isolated test DB only**, never a shortcut to live PA/Owner onboarding. Synthetic setup is prerequisite data preparation, not a passing onboarding test.

## 7. Test Data Plan

Use run namespace `MTQA-<UTC start date>-<sequence>` once; retain an alias→UUID map in the private run record, reuse it instead of recreating records on retry. Read before create. Do not collide with the existing fixture or alter real church data.

| Dataset | Deterministic contents / use |
|---|---|
| A / B | `MTQA A` in Asia/Manila, `MTQA B` in America/Los_Angeles; two approved synthetic churches; one Owner each |
| M1 / M2 / MB | A: `MTQA Juniors`, `MTQA Seniors`; B: `MTQA Other`; record versions/UUIDs; include archived disposable ministry |
| S1–S4 / SB | Synthetic `QA Alpha`, `QA Beta`, `QA Gamma`, `QA Delta`; external refs MTQA-S1…S4; M1=S1,S2; M2=S3,S4; B=SB. S1=null/unspecified, S2=2020-05-14/male, S3=2019-11-30/female, S4=2020-02-29/unspecified; SB=2020-06-15/unspecified. Birthday-today variant uses a fixed birth year and run-start church month/day, created through OA only. These labels never represent children |
| Assignment states | T1=M1; T2=M1+M2; UT=none; RV initially M1 then revoked. Restore T1 scope after non-destructive scope tests; keep RV revoked |
| D1–D4 | Fix four ISO attendance dates relative to run-start local date and write them once in private manifest; D1 complete, D2 partial, D3 concurrent, D4 guest/correction. Do not move completed dates on restart |
| Conflict/revision | MD1/MD2 start from same acknowledged M1/D3 version; S1 contradictory Present/Absent, S2 independent edit; separate second conflict; OA resolution and repeated correction retain originals |
| Guests | Synthetic `QA Visitor One/Two`; capture only display name/optional gender; separate promote/link/merge cases, preserve lineage |
| Spreadsheet files | Use downloaded current template; UTF-8 CSV and single-visible-sheet XLSX with S5/S6, distinct MTQA refs; exact duplicate S1; invalid date, Unicode, formula prefix, malformed ZIP, hidden/extra sheet, macro/external-link and size/row/expanded-size boundary variants. Generate only inert fixtures in ignored runner output; never execute embedded content |
| Timezone cases | Device Asia/Taipei versus church Asia/Manila and B America/Los_Angeles; church/device midnight, 08:00 birthday dispatch, leap/non-leap Feb 29 and DST transition. Simulated clock changes only in disposable contexts; label them, do not alter shared host/server time |

Reusable data remains until all dependent phases pass. Sync/import replay cases reuse their defined event/commit keys and bodies; application decisions replay against the application ID with no invented key. A repeated Teacher invitation creates a fresh invitation/mail and revokes older pending invitations; consumed acceptance returns 410. Mismatch cases change one supported field or deliberately test unknown-field rejection. Archive through supported UI/API when safe; never erase canonical audit/revision/provenance. Expiry/retention/fault/constraint injection runs only in a separately named disposable database/origin with explicit target verification. Never export unsynced payloads as recovery or evidence.

## 8. Evidence Classification

| Value | Meaning |
|---|---|
| HUMAN_MANUAL | A named human operated the stated flow/device; private operator attribution and observations exist |
| DIRECT_RUNTIME | Actual HTTP/SQL/CLI/services operated against stated runtime; no mocked integration |
| LIVE_BROWSER | Browser operated the actual UI against actual API/provider/database, with interception disabled for integration under test; state whether human or agent controlled |
| BROWSER_AUTOMATION | Scripted browser interaction; record real versus intercepted endpoints explicitly; modeled replies never prove live server integration |
| AUTOMATED_TEST | Actual passing/failing Pest/Vitest/etc. invocation at recorded commit and environment |
| CODE_INSPECTION | Source/config/help reviewed; does not prove runtime behavior |
| DOCUMENTATION | Historical/report evidence, with source commit/date and applicability |
| BLOCKED | Execution cannot proceed; prerequisite, owner and next action recorded |
| NOT_RUN | No execution evidence yet |

Case table evidence abbreviations: **L** = LIVE_BROWSER plus DIRECT_RUNTIME persistence/status evidence; **R** = DIRECT_RUNTIME; **H** = HUMAN_MANUAL with runtime evidence; **I** = CODE_INSPECTION supplemental to runtime proof. No abbreviation is itself a recorded evidence value. Use allowed full values in results. Negative browser requests use real sessions and normal CSRF except the deliberately omitted-CSRF case. Do not save HAR/raw cookies, token-bearing URLs, unrestricted SQL rows, mail bodies or screenshots exposing secrets/PII. Capture sanitized counts/statuses/opaque aliases/correlation IDs; keep disposable runner screenshots/traces ignored.

## 9. Result Classification

| Value | Strict meaning |
|---|---|
| PASS | All case steps meet the expected result, with required evidence at the recorded candidate; no unresolved contradiction |
| FAIL | Observed behavior violates the approved expected result; defect record exists |
| BLOCKED | Exact prerequisite prevents valid execution; absence of evidence is not PASS or FAIL |
| NOT_RUN | Planned, not executed; never infer a result from adjacent cases |

## 10. Execution, Progression and Records

Execute MT-00…MT-22 in order. MT-00 may diagnose prerequisites for later phases without executing their journeys. Do not silently skip a blocked predecessor. A human may explicitly accept a bounded non-critical prerequisite gap and authorize independent later cases; record dependency impact and keep affected cases BLOCKED. Security/data-integrity dependencies cannot be waived. Preflight and identity/data preparation must pass before tenant journeys. Qualification fixes follow AGENTS.md TDD, focused proof, applicable comprehensive gates, review and knowledge synchronization; fixes do not authorize a later feature.

Use one run record per phase under `docs/qa/manual-runs/<run-id>/MT-xx.md`, created when execution begins, not by this planning task. Format: candidate HEAD; UTC and church-local window; environment/database/origin/browser/device/provider; fixture aliases; preflight; case ID; expected; actual; result; evidence type/location; sanitized correlation/counts; defect/blocker ID; reproduction; cleanup; phase outcome; reviewer and next action. List every phase case even if NOT_RUN. Private identity map/contacts and sensitive artifacts stay outside Git; disposable runner output goes in an owner-private `%TEMP%\msprout-manual-<run-id>` directory or existing ignored `apps/web/test-results`, not alongside tracked Markdown. Update `knowledge/MANUAL_TESTING.md` after each run. Historical evidence is append-only; a rerun references the superseded outcome rather than erasing it.

Manual progression complements, never weakens, AGENTS.md:

- **RED:** confirmed defect. Tenant disclosure, bypass, audit corruption, sync loss/duplication or encryption/profile leakage requires immediate stop of dependent writes, safe containment and remediation. Ordinary functional defects (including workaround, misleading error or accessibility defects) are also RED under AGENTS.md, even if low severity. Do not relabel confirmed bugs YELLOW to obtain GREEN.
- **YELLOW:** unconfirmed functional/UX suspicion, unverified edge case, prerequisite/provider/environment blocker, material unresolved requirement. Diagnose safely; record exact missing prerequisite; escalate only after deterministic remedies are exhausted. No automatic commit/push with unresolved YELLOW.
- **GREEN:** all phase-required cases PASS with required live evidence, no unresolved RED/YELLOW/BLOCKING/SHOULD FIX, preserved data/work, reviewed evidence and synchronized knowledge. Formal human acceptance of a non-critical blocked provider/device item allows only an explicitly bounded development decision; it never changes that case to PASS or satisfies real-pilot GREEN.

Severity: critical security/privacy/data loss; high broken auth/audit/sync or core workflow; medium functional/accessibility/error defect; low cosmetic. Record impact, affected boundary, reproducibility, root cause (or explicitly unknown), regression and owner. Stop conditions and GREEN below inherit this stricter rule.

Every phase uses these additional exact steps: (1) read its prerequisites and verify aliases/versions/counts; (2) run rows in listed order, separate disposable variant data from reusable baseline; (3) compare response/UI with persistence/audit/local-work counts appropriate to the row; (4) record actual evidence before declaring a result; (5) perform the stated cleanup and review all rows/defects. No production faults, destructive SQL or time manipulation without separately authorized isolated targets. Body/header/status details come from the current [OpenAPI contract](../../contracts/openapi.yaml) and route/source, not invented payloads; contract discrepancies are defects, not permission to weaken expectations. Tenant requests use validated `X-Church-Id` and normal cookie/CSRF transport. Signed links remain private and are consumed by the supported fragment/setup flow.

## 11. Ordered Phases

### PHASE MT-00 — Environment preflight

**Objective:** establish a safe, reproducible runtime before mutation. **Prerequisites:** repository and local Docker access; private configuration access; handoff startup procedure. **Identities/data:** operator/AP; existing database/profile counts only. **Routes:** `/api/health`, `/health/live`, `/health/ready`, `/auth/session`, `/`. **Evidence required:** R and I, timestamps and service/count summaries.

| Case ID | Exact steps | Expected result / evidence |
|---|---|---|
| MT-ENV-001 | Read branch, HEAD, upstream, staged/unstaged diff, ahead/behind and remote main; compare checkpoint | Understood preserved state; no unexplained divergence; R |
| MT-ENV-002 | `docker compose ps`; check postgres and mailpit independently and ports/volume | Both healthy, loopback ports, existing volume retained; R |
| MT-ENV-003 | `pg_isready`; authorized read-only query current DB/version and role flags | PostgreSQL 18 authoritative; runtime non-owner/no superuser/create/bypass; R |
| MT-ENV-004 | `php artisan migrate:status --database=pgsql_migration`; inspect all protected tables' RLS and grants | Reviewed migrations present; enabled/forced RLS; append-only runtime evidence grants; R |
| MT-ENV-005 | Verify test/development/migration database and runtime-role names differ without printing credentials; inspect active DB driver | Safe test separation; PostgreSQL runtime, preserved inactive SQLite; R/I |
| MT-ENV-006 | Identify Laravel, Vite, worker and scheduler process commands/ports; reuse or start exact missing processes | All four identified; healthy API alone does not count worker/scheduler; R |
| MT-ENV-007 | Read scheduler heartbeat check and queue aggregate lag/failure counts; Mailpit info health | Scheduler current, worker ready, local mail capture available; R |
| MT-ENV-008 | GET public health and protected readiness without token, then with privately supplied token if available | Minimal public status/correlation; protected denial without token; positive dependency readiness or explicit BLOCKED; R |
| MT-ENV-009 | Inspect key presence/origin/session/stateful/CSP configuration without values; request session using supported same-origin transport | Consistent 5173→8000 origin, origin-only Referer, host-only cookies, debug false; missing providers recorded; R/I |
| MT-ENV-010 | Inspect existing service-worker version/cache names/profile pending counts without clearing; inventory identity counts/aliases | No API cache; existing work preserved; AP/PA/church counts reconciled privately; R |

**Cleanup/preservation:** do not seed/reset/rotate keys; stop only newly started services if ending run. **Blocks progression:** wrong authority DB, unsafe role/RLS, stale schema, unexplained Git/data/profile state, unavailable essential services. **Exit/GREEN:** all ten rows PASS; readiness/provider gaps explicitly resolved or human-authorized bounded independent progression, never a full preflight GREEN with missing required proof.

### PHASE MT-01 — Applicant authentication

**Objective:** real church session lifecycle. **Prerequisites:** MT-00; preserved AP credentials; Mailpit for recovery variants, disposable DA. **Identities/data:** AP/G/DA; no church data. **Routes:** `/account/login`, `/account/forgot-password`, `/account/reset-password`, `/account/verify-email`, `/sanctum/csrf-cookie`, `/login`, `/logout`, `/auth/session`, `/forgot-password`, `/reset-password`, `/email/verification-notification`. **Evidence required:** L; R security/correlation summaries.

| Case ID | Exact steps | Expected result / evidence |
|---|---|---|
| MT-AUTH-001 | Get CSRF, enter AP's existing credentials, read `/auth/session` | Actual login/session success; verified applicant; no tenant authority; L |
| MT-AUTH-002 | In fresh context submit wrong password and absent synthetic identity | Safe validation, no enumeration, no authenticated session; L |
| MT-AUTH-003 | Repeat invalid identity attempts until configured login threshold, then wait retry interval | Real 429/backoff; accurate message; no unlimited attempts; L/R |
| MT-AUTH-004 | Logout then read session/current application and revisit protected URL | Session invalid, 401/redirect; no private cached response; L |
| MT-AUTH-005 | Preserve disposable old session, revoke/logout it, retry protected request | Stale cookie cannot authenticate; R |
| MT-AUTH-006 | Inspect AP verification; DA unverified requests own application and verifies through received link | Verified gate enforced; legitimate email flow only; L |
| MT-AUTH-007 | Request reset for disposable DA via Mailpit, complete once, replay/expire link, try old/new passwords | Mail possession required, token one-time/expiry, old password rejected; L |
| MT-AUTH-008 | Send login/logout write without CSRF using otherwise valid disposable context | 419 or documented CSRF denial; no session mutation; R |
| MT-AUTH-009 | Provide valid then malformed correlation UUID; inspect login/denial security evidence by safe projections | Valid UUID propagated, invalid replaced, actor attribution/redaction intact; R |
| MT-AUTH-010 | Refresh/back/deep-link login; trigger offline and controlled server failure in disposable context | Stable session/navigation, accurate safe errors; no secrets/history/referrer leak; L |

**Cleanup:** restore AP signed-out/unchanged credentials; password changes only DA. **Blocks:** bypass, security evidence failure, misleading core errors, reset/session defect. **Exit/GREEN:** all ten real cases PASS with verified email/recovery proof; unsupported public signup recorded as commissioning gap, not implemented here.

### PHASE MT-02 — Church application

**Objective:** genuine CAPTCHA-backed submission/status. **Prerequisites:** MT-01; real configured Turnstile for chosen origin; additional verified synthetic applicant creation approved. **Identities/data:** AP→A, DA for reject/reapply/duplicate variants and B applicant. **Routes:** `/account/application`, GET `/api/church-applications/current`, POST `/api/church-applications`. **Evidence required:** L and R counts; widget load alone is insufficient.

| Case ID | Exact steps | Expected result / evidence |
|---|---|---|
| MT-APP-001 | Load widget with real site key; complete challenge and submit A/Asia/Manila | Real hostname/action validation; one pending application, no church yet; L/R |
| MT-APP-002 | Omit each required field independently in disposable submissions | Field-specific 422; no extra application; L |
| MT-APP-003 | Test church_name 160/161, city 120/121, address 240/241 characters on fresh eligible DA | At-limit supported; over-limit denied; no partial record; L/R |
| MT-APP-004 | Use Unicode and surrounding whitespace; try control/markup characters | Canonical safe normalization; disallowed content rejected; L |
| MT-APP-005 | Submit valid IANA timezone then invented zone | Valid persisted; invalid 422; no device timezone substitution; L/R |
| MT-APP-006 | Repeat exact submission with fresh valid CAPTCHA and double-click while pending; check own-current | Single active application; 409 duplicate with valid CAPTCHA (used token fails verification first), no tenant side effect; L/R |
| MT-APP-007 | Read current as AP, different applicant and G | Only own current; no application identifiers/PII leak; R |
| MT-APP-008 | After MT-04 rejection fixture is available, retry DA reapplication; before then record dependency | Current lifecycle enforced; safely supported reapplication only; no erased rejection evidence; L/R |
| MT-APP-009 | Missing/expired/reused/incorrect-action/incorrect-host token; provider unavailable in isolated configuration | Fail closed; no pending application created; R |
| MT-APP-010 | Inspect production CSP/widget network; refresh/back during pending state | Only required Turnstile origin allowed; status stable; secret/query fragments absent from Referer/history; L/I |

**Cleanup:** retain primary pending A/B; invalid variants create nothing; no deletion of existing AP. **Blocks:** CAPTCHA bypass, duplicate tenant/application, ownership disclosure. **Exit/GREEN:** all ten PASS; MT-APP-008 is an explicit deferred check executed in MT-04 before its exit, not forgotten or premarked PASS. MT-02 provisional completion may advance only to that named dependency, with final GREEN withheld until it passes.

### PHASE MT-03 — Platform bootstrap and security

**Objective:** official isolated administrator ceremony. **Prerequisites:** MT-02 primary pending application; human-designated private recovery mailbox and human TOTP/recovery handling; no unexplained existing PA. **Identities/data:** PA/AP/G; invalid/expiry setup only disposable platform database. **Routes:** `/account/platform-setup`, `/account/platform-login`, `/platform/csrf-token`, `/platform/setup/{platformAdmin}`, `/platform/setup/{platformAdmin}/confirm`, `/platform/login`, `/platform/two-factor-challenge`, `/platform/me`, `/platform/logout`. **Evidence required:** H/L/R without secret screenshots.

| Case ID | Exact steps | Expected result / evidence |
|---|---|---|
| MT-PLAT-001 | Check singleton count; authorized operator runs official bootstrap once with chosen mailbox | One pending `sage.dev`, queued signed invitation, duplicate command safely refuses; H/R |
| MT-PLAT-002 | Process queue, open invitation privately, choose password in supported setup | Mail ownership/setup validation; no active password-only access; H/L |
| MT-PLAT-003 | Enroll authenticator, confirm TOTP, save recovery privately and acknowledge | Active setup only after mandatory confirmation/acknowledgement; H |
| MT-PLAT-004 | On disposable clone try wrong signature, expired invitation and consumed invitation | Denial with no administrator activation/change; R |
| MT-PLAT-005 | Login correct password then wrong/correct TOTP; read platform me | Mandatory current-session challenge; no assurance from password alone; H/L |
| MT-PLAT-006 | Test AP cookie at platform route, PA cookie at church child-data route; inspect cookie names/paths | Guards/cookies/CSRF isolated; PA gains no church membership/data; R/L |
| MT-PLAT-007 | Logout PA; retry stale platform session and refresh/back/deep link | No protected platform details after logout; L/R |
| MT-PLAT-008 | Repeat wrong platform login/TOTP/setup to their bounded limits in disposable context | Throttled real requests; no token/material disclosure; R |
| MT-PLAT-009 | Use one recovery code privately where supported, then replay it and reconfirm TOTP | Single-use recovery/current assurance behavior matches source; no logged recovery secret; H/R |

**Cleanup:** retain legitimately commissioned PA; never overwrite its singleton or test expiry by altering live identity. **Blocks:** unavailable human mailbox/TOTP, guard/MFA/recovery bypass. **Exit/GREEN:** all nine PASS, private human evidence for ceremony; arbitrary factory/admin flags cannot substitute.

### PHASE MT-04 — Application review

**Objective:** approval/rejection atomicity against real persistence. **Prerequisites:** MT-03, A/B pending plus disposable rejection applicant. **Identities/data:** PA/AP/DA; baseline church/Owner/queue counts. **Routes:** `/account/platform-applications`, `/platform/applications`, `/platform/applications/{id}`, `/platform/applications/{id}/approve`, `/platform/applications/{id}/reject`, `/platform/audit-events`. **Evidence required:** L/R transactional counts/correlation/mail status.

| Case ID | Exact steps | Expected result / evidence |
|---|---|---|
| MT-REVIEW-001 | List pending as PA, open A detail; try church cookie and malformed UUID | Authorized bounded review; unauthorized denied, safe invalid path; L/R |
| MT-REVIEW-002 | Approve A with empty body; read AP current and aggregate counts | Exactly one church/active Owner, approved status, audit and queued notification; L/R |
| MT-REVIEW-003 | Repeat same approve/application ID and parallel double-click from two PA tabs | Stable replay, single church/Owner/audit/mail side effect; R |
| MT-REVIEW-004 | Submit conflicting reject after approval and nonempty approve body | 409 conflicting decision/422 unexpected fields; original approved state preserved; R |
| MT-REVIEW-005 | Reject DA using category duplicate/ineligible/incomplete/other and reason 1–500; test empty/unknown/501 chars | Valid rejection only; no church; safe validation and bounded evidence; L/R |
| MT-REVIEW-006 | Process queue; observe AP/DA notification and retry delivery safely | Correct status recipients, no duplicate decision effects or leaked data; R |
| MT-REVIEW-007 | Inject required audit/queue failure only in disposable clone; retry decision | Entire decision transaction rolls back; no orphan church/Owner; R |
| MT-REVIEW-008 | Execute deferred MT-APP-008 using rejected DA; approve B through same real lifecycle | Reapplication behavior proven; B isolated one-Owner fixture prepared; L/R |

**Cleanup:** retain A/B and immutable decisions; rejection variants isolated. **Blocks:** duplicate side effects, partial transaction, decision/tenant leak. **Exit/GREEN:** all eight plus deferred MT-APP-008 PASS; resolve provisional MT-02 checkpoint.

### PHASE MT-05 — Owner authentication and workspace

**Objective:** real Owner assurance and navigation. **Prerequisites:** MT-04; OA/OB actual membership and human MFA. **Identities/data:** OA/OB/AP-like tenantless DA; workspace aliases. **Routes:** `/account/login`, `/account/mfa`, `/account/dashboard`, `/api/me`, `/auth/session`, `/user/confirm-password`, Fortify two-factor endpoints. **Evidence required:** H/L/R.

| Case ID | Exact steps | Expected result / evidence |
|---|---|---|
| MT-OWNER-001 | Login newly approved OA; enroll/confirm MFA after recent password confirmation | Owner cannot enter protected operations before required MFA; H/L |
| MT-OWNER-002 | New session: password then wrong/correct TOTP; request `/api/me` with A | Current-session assurance enforced; correct actor/church/role only; H/R |
| MT-OWNER-003 | Load dashboard and each ministry/student/teacher/import/audit/report link, select A once | Correct context or explicit selection; no misleading forbidden/stale-tenant navigation; L |
| MT-OWNER-004 | Refresh/back/deep-link those pages; open second tab; logout and retry | Context/session behavior reproducible; no stale protected disclosure; L |
| MT-OWNER-005 | Use tenantless DA with A header; OA with B header/invalid UUID | Denial; no authority from client-selected UUID; R |
| MT-OWNER-006 | Wait recent-auth timeout or use disposable aged session; perform high-risk action and reconfirm | Reauthentication required, successful supported confirmation restores bounded access; H/L |
| MT-OWNER-007 | Compare Owner versus Teacher navigation after MT-09 acceptance; inspect DOM and direct requests | Role visibility accurate; server still denies Teacher Owner operations; L/R |

**Cleanup:** preserve OA MFA and A/B context; optional Teacher comparison is deferred only to MT-09, which must close it. **Blocks:** assurance bypass, context leak/core navigation defect. **Exit/GREEN:** seven PASS; bounded dependency record for MT-OWNER-007, final GREEN only when MT-09 closes it.

### PHASE MT-06 — Ministry management

**Objective:** versioned tenant-scoped lifecycle. **Prerequisites:** MT-05 primary Owner checks. **Identities/data:** OA/OB; M1/M2/MB and disposable archive ministry. **Routes:** `/account/ministries`, `/api/ministries`, `/api/ministries/{id}`, `/api/ministries/{id}/{status}`. **Evidence required:** L/R versions/audit.

| Case ID | Exact steps | Expected result / evidence |
|---|---|---|
| MT-MIN-001 | OA creates M1/M2 once; OB creates MB; read each list | Correct church-only ministries and version; L/R |
| MT-MIN-002 | Read version; PUT name-only update, repeat, then add unsupported version field | Each accepted update increments server version under lock; extra field 422, no invented optimistic-lock contract; R |
| MT-MIN-003 | Blank/over-limit/Unicode name variants against documented constraints | Safe normalization/validation; no invalid record; L |
| MT-MIN-004 | Archive disposable ministry with empty body, inspect active list, restore with empty body | Archive/restore/server version/audit consistent; no data loss; L/R |
| MT-MIN-005 | Request invalid/missing UUID and A actor→MB detail/update/archive | Safe denial/no cross-tenant existence/content disclosure; R |
| MT-MIN-006 | Once T1 exists, read assigned/unassigned ministries and attempt create/update | Assignment-limited reads; Owner-only writes; R |

**Cleanup:** retain M1/M2/MB active; archive variants restored. **Blocks:** lost/version-overwritten data, scope leak. **Exit/GREEN:** six PASS; MT-MIN-006 explicitly closed during MT-09 before its exit.

### PHASE MT-07 — Student roster

**Objective:** canonical roster/enrollment and boundaries. **Prerequisites:** MT-06 Owner dataset; live Teacher read variants depend on MT-09. **Identities/data:** OA/OB/T1; S1–S4/SB, disposable duplicate/archive student. **Routes:** `/account/students`, `/api/students`, `/api/students/{id}`, `/api/students/{id}/{status}`, `/api/students/{id}/enrollments`. **Evidence required:** L/R safe counts/versions.

| Case ID | Exact steps | Expected result / evidence |
|---|---|---|
| MT-ROSTER-001 | Create S1–S4 and SB once, select exact ministry enrollments | Server-derived display/age, tenant-safe enrollments; L/R |
| MT-ROSTER-002 | Whitespace/Unicode/preferred/middle/suffix variants and invalid controls | Canonical normalization matches source; unsafe/over-limit denied; L |
| MT-ROSTER-003 | Null, valid, future, impossible and Feb-29 birthdate; supported/unknown gender | Date-only validation; no timezone shift; supported avatar without upload; L/R |
| MT-ROSTER-004 | PUT ministry_ids enrollment; wrong-tenant ministry and unsupported version-field variants | Atomic accepted update/server version increments; foreign mapping/extra field denied; R |
| MT-ROSTER-005 | Archive/restore disposable student; check roster and version | Active roster accurate; previous attendance/evidence retained; L/R |
| MT-ROSTER-006 | Try duplicate external reference/name combinations; inspect documented duplicate outcome | No silent merge/update or unexplained duplicate; R |
| MT-ROSTER-007 | T1 reads M1 roster/detail and attempts write/import; UT reads roster | Assigned read only; Teacher write/UT unauthorized roster denied; R |
| MT-ROSTER-008 | OA requests SB via list/filter/detail/update/enroll/archive with B identifiers | Denial/empty scope as contract; no cross-tenant disclosure; R |

**Cleanup:** baseline enrollment restored; preserve originals/audit; no destructive cleanup. **Blocks:** privacy, normalization/integrity defects. **Exit/GREEN:** eight PASS; MT-ROSTER-007 is a named MT-09 dependency, closed there.

### PHASE MT-08 — Spreadsheet import

**Objective:** actual parser/upload/preview/commit safety. **Prerequisites:** MT-07 Owner baseline; current template/inert fixtures. **Identities/data:** OA/OB; S5/S6 import and S1 duplicate; variants from section 7. **Routes:** `/account/imports`, `/api/imports/template`, `/api/imports/students/preview`, `/api/imports/{batch}`, `/api/imports/{batch}/commit`. **Evidence required:** L/R student/enrollment/audit counts; keyboard observations.

| Case ID | Exact steps | Expected result / evidence |
|---|---|---|
| MT-IMPORT-001 | Download template via normal authenticated transport; inspect headers/bytes | Correct CSV/XLSX-supported template; no session/referrer problem; L/R |
| MT-IMPORT-002 | Upload valid UTF-8 CSV; preview/map M1; compare student counts before/after preview | Preview only; normalized rows, no students yet; L/R |
| MT-IMPORT-003 | Upload valid single-visible-sheet XLSX with Unicode; map M2 | Actual parser preview matches canonical normalization; L/R |
| MT-IMPORT-004 | Commit selected valid CSV rows with one key; replay identical commit concurrently | Atomic single create/enrollment/audit; stable replay; R |
| MT-IMPORT-005 | Commit XLSX rows; include existing S1 and repeated external refs | Duplicates reported/excluded; existing student untouched; L/R |
| MT-IMPORT-006 | Upload malformed/truncated workbook and renamed non-workbook | Safe rejection before persistence; no raw parser trace; R |
| MT-IMPORT-007 | Upload inert formula cells/CSV =,+,-,@ prefixes; macro/external-link/embedded variants | Rejected without evaluating executable content; R |
| MT-IMPORT-008 | Upload hidden and extra unsupported sheet variants | Reject hidden/unsupported structure; R |
| MT-IMPORT-009 | Exercise 5-MiB input, 500-row limits and over-limit; bounded expansion/ratio variant | Documented boundaries enforced before expensive parse; no uncontrolled expansion; R |
| MT-IMPORT-010 | Preview ambiguous numeric/bad dates, blank required cells, Unicode/whitespace rows | Precise row validation; valid rows canonical; no date guessing; L |
| MT-IMPORT-011 | Map to B ministry or stale/archived M1; commit mismatched batch/key | Denial/revalidation; no foreign/stale enrollment; R |
| MT-IMPORT-012 | Disposable clone: inject failure midway through commit or required audit | Complete rollback of students/enrollments/result receipt/audit; R |
| MT-IMPORT-013 | Keyboard-only upload, preview scroll, checkbox selection/mapping/commit; refresh batch | Accessible focus/error feedback; preserved preview context, no accidental commit; L |

**Cleanup:** retain valid imported synthetic rows; rejected files ignored; no workbook/raw row data in Git/evidence. **Blocks:** unsafe parsing, partial commit, duplicate overwrite, inaccessible core flow. **Exit/GREEN:** thirteen PASS using actual backend upload/parser.

### PHASE MT-09 — Teacher invitation/membership

**Objective:** live acceptance/scope/revocation plus Task 6 ownership guarantees. **Prerequisites:** MT-08; OA recent auth/current MFA; controlled synthetic mailboxes. **Identities/data:** T1/T2/UT/IV/RV/XT and disposable transfer church actors; M1/M2/MB. **Routes:** `/account/teachers`, `/account/teacher-invitation`, `/api/teachers`, `/api/teacher-invitations`, `/api/teacher-invitations/{id}`, `/api/teacher-invitations/accept`, `/api/teachers/{id}/assignments`, `/api/teachers/{id}`, `/api/assigned-ministries`, `/api/ownership-transfer`. **Evidence required:** L/R; H for real high-risk confirmation.

| Case ID | Exact steps | Expected result / evidence |
|---|---|---|
| MT-MEMBER-001 | OA invites T1/T2 with planned assignments; keep IV unaccepted; invite UT/RV with M1; OB invites XT with MB | One invitation and synchronous private-transport mail per command; empty invite assignments rejected; IV has no membership authority; L/R |
| MT-MEMBER-002 | Repeat pending email invitation with changed valid ministry_ids; try active-member email and invented key | Older pending invitation revoked/new mail issued; active-member proof cannot create second membership (accept410); extra-field422; R |
| MT-MEMBER-003 | Open signed link as wrong identity, expired/revoked/modified invitation on disposable fixtures | Safe denial; no membership or token disclosure/history/referrer leak; L/R |
| MT-MEMBER-004 | Accept correct T1/T2/UT/RV/XT invitations; OA sets UT ministry_ids=[]; replay consumed acceptance | Verified role-limited membership once, UT unassigned; consumed proof 410 without repeat membership; L/R |
| MT-MEMBER-005 | Revoke IV; try its link; use RV then revoke membership | No acceptance/active access afterward; device/push authority invalidated; R |
| MT-MEMBER-006 | Change T1 scope M1→M2→M1 using ministry_ids-only/recent-auth flow | Server scope updates/audit; stale assignments denied, no self-assignment or invented version input; L/R |
| MT-MEMBER-007 | UT/Teacher attempts Owner writes, Teacher role escalation and own scope change | Server denial, no Owner privilege escalation; R |
| MT-MEMBER-008 | Directly request real bootstrap before then after scope/revocation using same device identity | Server authorization/device scope invalidated; no revoked bootstrap; local pending-work preservation is separately tested in MT-11/13; R |
| MT-MEMBER-009 | Execute deferred MT-OWNER-007, MT-MIN-006, MT-ROSTER-007 with real roles | All prior role checks PASS; close each dependency explicitly; L/R |
| MT-MEMBER-010 | In disposable transfer church perform official Owner transfer with MFA/recent auth and eligible recipient; retry/conflict concurrently | Exactly one active Owner; atomic role/device/audit changes; no unintended extra Owner; H/R |
| MT-MEMBER-011 | Transfer with wrong password/no MFA/inactive target/cross-tenant target | Denial without partial ownership mutation; R |

**Cleanup:** keep reusable roles/assignments; IV/RV remain revoked; transfer isolation never changes OA unexpectedly. **Blocks:** escalation, wrong identity acceptance, multiple Owners, work loss. **Exit/GREEN:** eleven PASS and all four named deferred predecessor cases closed.

### PHASE MT-10 — PWA/installability/responsive

**Objective:** production shell, safe updates and accessible layouts. **Prerequisites:** MT-09; production build served through an approved same-origin API setup for L cases, separate disposable worker origin for update experiments. **Identities/data:** OA/T1/G; genuine cached profile later reused. **Routes:** `/`, `/profiles`, `/account/**`, manifest and built service-worker assets; `/api/**`. **Evidence required:** L/R; H for actual install in MT-20; automation supplemental.

| Case ID | Exact steps | Expected result / evidence |
|---|---|---|
| MT-PWA-001 | Inspect production manifest/name/icons/start URL/display; install on supported desktop browser | MinistrySprout/Sprout, usable standalone launch and icons; L/R |
| MT-PWA-002 | Inspect registration/activated worker and Cache Storage after login and API requests | Shell/hashed assets only; API NetworkOnly; auth/API responses absent; L/R |
| MT-PWA-003 | Go offline in disposable context, navigate/reload shell/deep links | Offline shell loads; online-only pages communicate limits, no forged API success; L |
| MT-PWA-004 | Load candidate worker, then approved changed shell build on disposable origin; observe update prompt | Version change detected; controlled activation/reload, no stale asset crash; L |
| MT-PWA-005 | Defer to MT-13: with MT-12 pending draft/outbox, load new worker, attempt update, then safely sync and accept | Activation blocked while unsafe work; preserved draft/outbox; safe update afterward; L/R |
| MT-PWA-006 | Compare 320,390,768,1024,1440 widths with same live role; reduced-motion/zoom/forced-colors | No lost controls, overflow traps or unreadable states; responsive navigation/44px actions; L |
| MT-PWA-007 | Keyboard-only all primary pages; screen-reader labels/errors; run axe serious/critical checks | Usable focus/order/forms/scroll; zero serious/critical findings; H/L |
| MT-PWA-008 | Stale worker/old tab with current API, refresh/deep-link/back | Compatible errors/update guidance, no cache of private responses/work loss; L/R |

**Cleanup:** preserve active origin; disposable worker tests never clear reusable profiles. **Blocks:** API caching, unsafe update loss, inaccessible core action. **Exit/GREEN:** eight PASS for development web; MT-PWA-005 explicitly deferred to MT-13 because no real attendance profile exists yet. Provisional progress to MT-11 is allowed solely for this named fixture dependency, final MT-10 GREEN withheld until closure. Physical install remains distinct MT-20.

### PHASE MT-11 — Offline profile provisioning

**Objective:** real signed bootstrap and isolated encrypted cache. **Prerequisites:** MT-10 completed non-deferred cases; T1/T2 signed in with real assignments; OP-A/OP-B created in this phase; separate disposable corruption/expiry origin. **Identities/data:** T1/T2 and freshly OA-invited/accepted RV-O active until MT-OFFLINE-010; M1/M2 roster. **Routes:** `/profiles`, `/`, `/api/offline/bootstrap`, `/account/attendance`; IndexedDB `ministry-sprout-offline`. **Evidence required:** L/R; I crypto implementation corroboration.

| Case ID | Exact steps | Expected result / evidence |
|---|---|---|
| MT-OFFLINE-001 | T1 selects Add profile, chooses valid private 6–12 digit PIN, completes real bootstrap | Genuine actor/church/device-bound 14-day lease and assigned M1 only; L/R |
| MT-OFFLINE-002 | Try too-short/long/non-numeric PIN; add OP-B as T2 | PIN validation; separate profiles/keys/rosters without overwriting OP-A; L |
| MT-OFFLINE-003 | Inspect IndexedDB stores using counts/key namespaces only; compare encrypted versus clear fields | Payloads encrypted, minimal metadata; no full birthdates, credentials, guardian/contact data; R/I |
| MT-OFFLINE-004 | Lock OP-A; wrong PIN repeatedly then correct PIN after delay | No decrypted data, persisted exponential delay; valid unlock only; L/R |
| MT-OFFLINE-005 | Switch A→B→A; read assigned roster offline | One active key; no other actor cache/draft/identifiers displayed; L/R |
| MT-OFFLINE-006 | Explicit lock, background page and five-minute inactivity | Protected view/key cleared; correct PIN required again; L |
| MT-OFFLINE-007 | Close/restart browser offline; correct PIN to unexpired cache | Cache/work readable; sync independently blocked until same-actor online refresh; L/R |
| MT-OFFLINE-008 | Disposable expired authenticated lease; edit only clear expiry; retry read/write | Expired encrypted authority remains fail-closed; no extension via metadata; R/L |
| MT-OFFLINE-009 | Disposable metadata/ciphertext/AAD corruption or actor/device mismatch | Safe denial, no unauthorized bootstrap persistence/decrypt; existing other profile intact; R |
| MT-OFFLINE-010 | Create RV-O real profile and isolated synthetic draft while active; OA revokes RV-O, which requests online refresh | Cached authority purged/locked, pending ciphertext retained/quarantined; R/L |
| MT-OFFLINE-011 | T2 signs in while OP-A active and requests authorization refresh, then T1 refreshes legitimately | Wrong actor rejected before persistence; same actor refresh succeeds; synchronization mismatch is MT-SYNC-013; R/L |

**Cleanup:** retain OP-A/B and valid leases, restore T1/T2 session deliberately; corrupt/expire disposable copies only. **Blocks:** leakage, weak encryption/binding, false lease extension, pending-work loss. **Exit/GREEN:** eleven PASS with actual server leases, never e2e dummy signatures.

### PHASE MT-12 — Offline attendance

**Objective:** atomic durable local work and date semantics. **Prerequisites:** MT-11; OP-A unexpired, M1/S1/S2 and fixed D1–D4. **Identities/data:** T1/T2 profiles; isolated quota/time contexts. **Routes:** `/account/attendance`; server acknowledged attendance later through `/api/sync/push`. **Evidence required:** L/R encrypted draft/outbox counts and UI outcomes.

| Case ID | Exact steps | Expected result / evidence |
|---|---|---|
| MT-ATT-001 | Go offline, choose M1/D1, mark S1 Present and S2 Absent singly | Local saved state/counts; atomic draft+matching outbox mutation; L/R |
| MT-ATT-002 | On D2 bulk mark then change one student; search/filter and recount | Correct regular roster states/counts; no accidental marks outside scope; L/R |
| MT-ATT-003 | Leave S2 unmarked and finalize; then mark it and finalize | Incomplete finalization denied; complete becomes Pending Sync, not acknowledged server success; L |
| MT-ATT-004 | Refresh/close browser with pending work, reopen offline and unlock | Exact draft/marks/finalization/outbox survive; no duplication; L/R |
| MT-ATT-005 | Reopen M1/date twice and double-click mark/finalize; use two local tabs | Stable session identity, safe local versions; no lost work or duplicate creation event; L/R |
| MT-ATT-006 | Compare displayed default with device-local date; choose explicit date | Date-only selection preserved, no unintended UTC shift; L |
| MT-ATT-007 | Disposable contexts near church/device midnight with different IANA zones | Document current device-local attendance default versus church-local birthday date; unresolved requirement classified YELLOW, no silent change; L/R |
| MT-ATT-008 | Disposable storage quota/write failure at mark/finalize; restart and inspect counts | Safe storage error; no partial draft/event, no false saved/finalized confirmation; L/R |
| MT-ATT-009 | Try assigned ministry after lease expiry or scope removal | Protected write denied; encrypted unsynced work retained; R/L |

**Cleanup:** retain D1/D2 pending work for MT-13; never delete unsynced local records. **Blocks:** lost/non-atomic drafts, false finalization, unauthorized marks. **Exit/GREEN:** nine PASS, date requirement resolved from authority or explicit human direction.

### PHASE MT-13 — Synchronization

**Objective:** exactly-once real database convergence with authority/cursors. **Prerequisites:** MT-12 pending events, genuine authorizations, MD1/MD2 real same-actor contexts, disposable network fault proxy/DB for cursor/retention injection. **Identities/data:** T1/T2/RV/OA; pending D1/D2 and version manifest. **Routes:** POST `/api/sync/push`, GET `/api/sync/pull`, `/api/offline/bootstrap`, `/account/attendance`, `/account/reports`. **Evidence required:** L/R receipts/feed/cursor/audit counts; sanitized request identities only, never raw payload dumps.

| Case ID | Exact steps | Expected result / evidence |
|---|---|---|
| MT-SYNC-001 | Before reconnect, execute pending-work part of deferred MT-PWA-005; reauthenticate T1/refresh OP-A, push/pull D1/D2, then finish safe update | Real server acknowledged attendance once; outbox drains only after valid acknowledgement; deferred worker-update case closed; L/R |
| MT-SYNC-002 | Retry exact event UUID/device/body after acknowledgement | Stored duplicate/accepted result stable, single domain/audit/feed/receipt effect; R |
| MT-SYNC-003 | Let real server commit then drop response using isolated transport; restart client and retry | Retry converges once without deleting unacknowledged local work; L/R |
| MT-SYNC-004 | Same replay identity with one changed field/hash; wrong actor/device | Reject mismatch, preserve original receipt/outcome; security evidence; R |
| MT-SYNC-005 | Pull from initial cursor, force more than one bounded page of synthetic events | Ordered pages; has_more terminates; cursor advances atomically including filtered entries; R/L |
| MT-SYNC-006 | Archive/scope-change synthetic assignment and pull tombstones | Unauthorized projections removed, pending work quarantined rather than discarded; R/L |
| MT-SYNC-007 | Renew lease legitimately; try revoked RV/stale authorization | Bound renewal succeeds, revoked/stale denied and UI cache cleared safely; R/L |
| MT-SYNC-008 | Disposable stale cursor beyond retained feed floor; bootstrap then pull | Full-resync requirement, no skipping missing feed/data; R |
| MT-SYNC-009 | Offline→Wi-Fi→cellular/reconnect repeatedly; two tabs request sync | Coalesced bounded loop, ordered processing, no duplicate/pending loss; L/R |
| MT-SYNC-010 | MD1/MD2 push same-session independent ordered edits from same base | Lock/version behavior preserves accepted data; no unexplained last-write loss; R |
| MT-SYNC-011 | Inject timeout, 429 and 503 at transport without forging successful replies | Bounded backoff/jitter, accurate pending/error status, recover after service returns; L/R |
| MT-SYNC-012 | Batch mixed accepted/conflict/rejected events and pull application write failure in disposable context | Per-event outcomes preserved; failed local pull leaves cursor/projections atomic; no premature outbox deletion; R/L |
| MT-SYNC-013 | T2 session attempts OP-A sync; logout/reauth T1 and refresh | Same-actor enforced on server/client; no wrong-actor attribution; R/L |
| MT-SYNC-014 | Disconnect after pull received but before local commit, then retry | Cursor and local changes commit together; no missing page; R/L |

**Cleanup:** reusable outboxes drained only by valid acknowledgement; retain conflict events for MT-14, rejected ciphertext safely preserved. **Blocks:** duplication/loss, actor mismatch, unsafe cursor advancement. **Exit/GREEN:** fourteen plus deferred MT-PWA-005 PASS against actual PostgreSQL; close provisional MT-10 checkpoint; no modeled success accepted as convergence.

### PHASE MT-14 — Conflicts

**Objective:** preserve contradictions and Owner-only resolution. **Prerequisites:** MT-13; MD1/MD2/T2 capture same acknowledged base for D3; OA current MFA. **Identities/data:** S1 opposite marks, S2 independent mark, second conflict. **Routes:** `/account/conflicts`, `/api/sync-conflicts`, `/api/sync-conflicts/{id}`, `/api/sync-conflicts/{id}/resolve`, sync and reports. **Evidence required:** L/R immutable counts/versions/correlation.

| Case ID | Exact steps | Expected result / evidence |
|---|---|---|
| MT-CONFLICT-001 | Two genuine devices submit Present vs Absent on S1 from same stale base | Needs Owner Review; both values/actor/device/time evidence retained; R/L |
| MT-CONFLICT-002 | Submit independent S2 change and identical replayed S1 value | Independent change merges; identical value dedupes without spurious conflict; R |
| MT-CONFLICT-003 | Submit future and stale base versions via nonprivileged client | Documented conflict/denial; no overwrite of newer state; R |
| MT-CONFLICT-004 | Open two conflicts, resolve one only | Session stays Needs Review until remaining open conflict resolved; L/R |
| MT-CONFLICT-005 | OA reads both sides; T1/T2 list/detail and try resolve | Owner evidence authorized; Teacher only limited permitted status, cannot resolve/see unrelated provenance; R/L |
| MT-CONFLICT-006 | Resolve with choice existing/incoming; missing/501-char then valid 1–500-char reason | Validation then one immutable revision/audit/feed/server version transition; L/R |
| MT-CONFLICT-007 | Replay/parallel resolve and attempt direct runtime evidence mutation in disposable transaction | No double resolution; original conflict evidence protected; R |
| MT-CONFLICT-008 | Inspect original versus effective result, actor/time/correlation and audit UI | Original retained, resolving actor accurate, no raw PII metadata; L/R |

**Cleanup:** retain immutable conflict/revision evidence; complete dependent open conflicts safely. **Blocks:** lost originals, Teacher resolution/privacy leak, non-atomic audit/version. **Exit/GREEN:** eight PASS, known outcomes reconcile with reports.

### PHASE MT-15 — Revisions/corrections

**Objective:** permanent corrections preserve original attendance. **Prerequisites:** MT-14; finalized D1/D3, OA current MFA and documented bounded reasons. **Identities/data:** OA/T1/XT, S1 finalized record. **Routes:** `/account/conflicts`, `/api/attendance-sessions/{session}/records/{record}/corrections`, reports/audit. **Evidence required:** L/R.

| Case ID | Exact steps | Expected result / evidence |
|---|---|---|
| MT-REV-001 | OA POSTs state present/absent different from current plus 1–500-char reason | Appended revision/server version; original value/actor unchanged; R/L |
| MT-REV-002 | Missing/over-limit reason, invalid state, nonfinalized or mismatched session/record | Validation/denial without mutation; R |
| MT-REV-003 | Repeat identical correction concurrently, then correct back with supported state/reason; try extra version field | Same effective state rejected; legitimate differing correction appends lineage; unsupported version field 422; R |
| MT-REV-004 | Teacher/XT/wrong-tenant record tries correction | Owner-only and tenant denial; no foreign record disclosure; R |
| MT-REV-005 | Read correction history, UTC actor/time, audit/correlation and effective reports | Accurate before/after lineage and totals; no overwritten original; L/R |
| MT-REV-006 | Disposable clone fails required audit/revision transaction then retries | Atomic rollback; subsequent legitimate correction succeeds once; R |

**Cleanup:** preserve all revisions; do not undo by deleting original evidence. **Blocks:** mutable original, role leak, arithmetic/transaction defect. **Exit/GREEN:** six PASS.

### PHASE MT-16 — Temporary guests

**Objective:** minimal offline capture and provenance-safe Owner review. **Prerequisites:** MT-15; OP-A lease/D4; separate promote/link/merge guests. **Identities/data:** T1/OA/XT, QA Visitors, existing S1. **Routes:** `/account/attendance`, `/account/conflicts`, `/api/attendance-guests`, `/api/attendance-guests/{id}/promote`, `/link`, `/merge`, sync. **Evidence required:** L/R lineage/counts.

| Case ID | Exact steps | Expected result / evidence |
|---|---|---|
| MT-GUEST-001 | Offline capture display name/optional gender; mark/finalize and reconnect | Minimal encrypted guest event, Present state, correct session/actor/device/time provenance; L/R |
| MT-GUEST-002 | Blank/over-limit/control display name or additional guardian/contact fields | Validation; unsupported sensitive data not stored; R/L |
| MT-GUEST-003 | OA promotes dedicated guest to new synthetic student | Student created once; guest/attendance provenance retained; L/R |
| MT-GUEST-004 | OA links second guest to existing S1, invalid/foreign student variant first | Valid linkage only; no tenant crossing/duplicate attendance loss; R/L |
| MT-GUEST-005 | OA merges duplicate guests and retries same resolution | One effective attendance outcome; both lineage records retained; R/L |
| MT-GUEST-006 | Teacher/XT resolves or reads unrelated guest; replay stale resolution | Server authorization/version denial without leaked provenance; R |
| MT-GUEST-007 | Delayed offline duplicate arrives after Owner resolution; pull updated projection | Idempotent sync, no recreated resolved guest or lost attendance; R/L |

**Cleanup:** retain resolved/pending guest lineage and synthetic students; no erase/PII export. **Blocks:** guest data loss, cross-role/tenant access, duplicate attendance. **Exit/GREEN:** seven PASS.

### PHASE MT-17 — Reports / birthdays

**Objective:** correct role/date-filtered effective reports and minimal birthday detail. **Prerequisites:** MT-16; fixed finalized/pending/conflict/revision tally manifest; birthday-today variant through OA, separate timezone/leap clock fixtures. **Identities/data:** OA/T1/UT/XT, S1–S6/SB; no real children. **Routes:** `/account/reports`, `/account/birthdays`, `/account/dashboard`, `/api/attendance-reports`, `/api/attendance-reports/export`, `/api/birthdays/today`. **Evidence required:** L/R; I offline privacy.

| Case ID | Exact steps | Expected result / evidence |
|---|---|---|
| MT-REPORT-001 | OA filters date/ministry and compares private expected Present/Absent totals/rate | Revision-effective finalized totals; pending/conflicts separately shown; L/R |
| MT-REPORT-002 | T1/UT/XT read report with altered ministry/date/church filters | Current assignment/recent-history policy enforced; no unassigned/foreign data; R |
| MT-REPORT-003 | OA downloads UTF-8 CSV; Teacher attempts same | Owner-only audited export; ISO dates, correct counts and no birthdate; R/L |
| MT-REPORT-004 | Export inert formula-prefix synthetic text and Unicode/comma/newline values | Formula-safe quoted CSV, no executable cells; inspect bytes without opening formulas; R |
| MT-BDAY-001 | Set synthetic birthday today via Owner, query as OA/T1/UT | Authorized display/turning age only; Teacher assigned scope; no full birthdate/year; L/R |
| MT-BDAY-002 | At isolated timezone midnight and 08:00 compare church versus device date | Church-local birthday/date rollover; idempotent due dispatch; R |
| MT-BDAY-003 | Disposable leap-day/non-leap/DST fixtures; inspect result | Approved Feb29→Feb28 non-leap behavior, stable date/time boundaries; R |
| MT-BDAY-004 | Offline unlocked valid profile reads birthdays; lock/expire/revoke then retry | Minimal assigned encrypted fallback only; no unauthorized cached detail; L/R/I |
| MT-REPORT-005 | Empty date/ministry/no birthdays; refresh/back filters and next-day rollover | Accurate accessible empty states; no stale totals or prior-day birthday disclosure; L |

**Cleanup:** preserve corrected attendance/expected manifest; timezone/time changes disposable only. **Blocks:** wrong arithmetic, export injection/privacy, wrong date/scope. **Exit/GREEN:** nine PASS; actual external push is MT-20.

### PHASE MT-18 — Audit/security manual checks

**Objective:** validate cross-cutting trust boundaries independently. **Prerequisites:** MT-17 and isolated restricted-runtime SQL target for mutation attempts; approved nonprivileged request contexts. **Identities/data:** OA/T1/XT/AP/PA/G; safe audit/security counts and correlations. **Routes:** `/account/audit`, `/account/platform-audit`, `/api/audit-events`, `/platform/audit-events`, all protected route groups. **Evidence required:** R/L, source review supplemental; no raw body/PII output.

| Case ID | Exact steps | Expected result / evidence |
|---|---|---|
| MT-SEC-001 | Inspect runtime grants; disposable transaction tries UPDATE/DELETE/TRUNCATE canonical and legacy evidence | Append-only canonical/read-only legacy; denied writes, rollback; R |
| MT-SEC-002 | Perform allowed/denied membership/import/sync/review actions; inspect safe evidence projections | Required success evidence atomic; denial best-effort, accurate actor/guard/result; R |
| MT-SEC-003 | Follow valid correlation through response, job, audit/security and sanitized log | Same correlation chain; malformed ID replaced; no raw request/credential/child data; R |
| MT-SEC-004 | Restricted runtime with no context, A context and B record; attempt client church_id ownership override | Forced RLS plus policy, safe denial; no tenant leak/reference crossing; R |
| MT-SEC-005 | Church/platform missing/wrong CSRF and cookie crossover, stale/no MFA high-risk request | Independent server gates deny; no frontend-only authorization; R |
| MT-SEC-006 | Exceed configured limits on auth/application/invite/import/bootstrap/sync/notification/readiness | Rate limiting/accurate safe errors; no unbounded privileged path; R |
| MT-SEC-007 | Audit UI as OA/T1/XT/PA; paginate and manipulate target/filter | Bounded authorized projections; no cross-tenant/platform child evidence; R/L |
| MT-SEC-008 | Inspect sanitized response/log/sample metadata for all negative paths | No PII/raw body/secrets or unrestricted exception, error correlation useful; R/I |
| MT-SEC-009 | Check NetworkOnly/auth cache, signed-fragment removal/origin-only Referer and profile lock using hostile nonprivileged requests | Security controls remain intact; no secret-bearing navigation disclosure; R/L |
| MT-SEC-010 | Review all phase defects/changed trust boundaries against actual source/tests | No unresolved bypass/privacy/integrity issue; graph alone is insufficient; I plus linked R |

**Cleanup:** roll back isolated attempted mutations, preserve evidence and pending ciphertext. **Blocks:** any confirmed security/privacy/data-integrity defect or unknown critical gap. **Exit/GREEN:** ten PASS with actual runtime and reviewed scope.

### PHASE MT-19 — Operations

**Objective:** safe service recovery, retention and backup assurance. **Prerequisites:** MT-18; approved readiness token; separate disposable DB/origin/worker/scheduler for fault/retention cases; operator backup access. **Identities/data:** operator/PA; synthetic mail job, expired records/cursors only isolated. **Routes/commands:** `/health/live`, `/health/ready`, `/platform/system-health`; `operations:scheduler-heartbeat --check`, `birthdays:dispatch-due`, scheduled `PruneOperationalData`/`PurgeRevokedDeviceData`; [deployment](../operations/deployment.md), [backup](../operations/backup-restore.md). **Evidence required:** R/H aggregate/time/checksum summaries.

| Case ID | Exact steps | Expected result / evidence |
|---|---|---|
| MT-OPS-001 | Queue a synthetic application decision/platform setup; observe Mailpit receipt and worker processing | Actual database queue processing and supported mail delivery, safe failure counts/audit/correlation; Teacher invitation is synchronous, not queue proof; R |
| MT-OPS-002 | Restart only designated worker with pending job; verify retry and failure handling | No duplicated domain/notification effect, retry bounded; R |
| MT-OPS-003 | Inspect schedule:list; observe heartbeat ticks and due birthday job | Scheduler actual execution, not merely installed process; R |
| MT-OPS-004 | Stop disposable scheduler past stale threshold; protected health then restart | Stale heartbeat detected, recovery clears degradation; R |
| MT-OPS-005 | Public/protected/platform probes with absent/wrong/correct token and PA assurance | Minimal liveness, protected readiness, sanitized authorized aggregates only; R |
| MT-OPS-006 | Run scheduled retention jobs against isolated cutoff fixtures; count before/after | Operational30d/security+receipt180d/rejectedPII30d/feed90d+cursor bounds; audit retained; R |
| MT-OPS-007 | Isolated revoked push30d/expired authorization180d and active-cursor fixtures | Safe ciphertext purge/device full-resync; active feed/audit preserved; R |
| MT-OPS-008 | Isolated queue outage/database reconnect; observe API safe failure, worker recovery | No false acknowledgement/partial transaction, bounded retries/no raw secrets; R |
| MT-OPS-009 | Follow encrypted backup/isolated restore runbook; compare all required aggregate counts/checksums/RLS | Verified fresh restore without attaching live mail/push; no development reset; H/R |
| MT-OPS-010 | Start/stop only run-owned services using handoff procedure; inspect volume/data/profile counts | Preserved authoritative data/keys/unsynced work; exact process ownership; R |

**Cleanup:** restore run-owned fault services; destroy only verified disposable restore artifacts/DB with authorized runbook procedure; never prune development by backdating it. **Blocks:** unavailable backup/readiness, lost queue/data, unsafe retention or exposure. **Exit/GREEN:** ten PASS; old Task18 restore is DOCUMENTATION, not a fresh drill.

### PHASE MT-20 — Real-provider/device qualification

**Objective:** prove physical/browser/provider integration limits. **Prerequisites:** MT-19; real approved HTTPS origin, Turnstile/mail/VAPID/readiness, physical Android/iPhone/iPad, human permission/device access; no deployment inferred by this plan. **Identities/data:** OA/T1/T2 profiles; synthetic birthday/draft; operator privately controls providers. **Routes:** application, profiles, attendance, birthdays, `/api/push-subscriptions/config`, POST `/api/push-subscriptions`, DELETE `/api/push-subscriptions/{deviceId}`, real installed PWA. **Evidence required:** H plus R/L; record hardware/OS/browser/provider, never keys/endpoints.

| Case ID | Exact steps | Expected result / evidence |
|---|---|---|
| MT-DEVICE-001 | Real chosen-origin Turnstile challenge/submit and provider timeout/denial variant | Genuine action/hostname success, provider failure closed; H/R |
| MT-DEVICE-002 | Deliver official setup/reset/invite through approved real mail if pilot requires it | Correct private recipient/link/delivery, no Mailpit→real-provider assumption; H/R |
| MT-DEVICE-003 | Android Chrome install, launch standalone, authenticate, Add profile and offline reload | Real installed PWA/roster durable; correct touch/keyboard/layout; H |
| MT-DEVICE-004 | iPhone and iPad Safari Add to Home Screen, launch/restart offline | Real Home Screen behavior/secure storage, accurate guidance; H |
| MT-DEVICE-005 | Deliberately enable notifications, register real subscription, trigger due synthetic birthday | Actual generic count-only notification; click opens authorized detail; H/R |
| MT-DEVICE-006 | Deny permission, unsupported context, revoke subscription/membership, provider permanent failure | No repeated prompt; in-app fallback; encrypted subscription revoked safely; H/R |
| MT-DEVICE-007 | Background/OS kill/restart with pending work; network Wi-Fi↔cellular↔offline↔online | Work survives where OS retains storage; same-actor refresh/exactly-once convergence; H/R |
| MT-DEVICE-008 | Disposable profile under practical OS storage pressure/eviction; background push with screen locked | Document actual limitation/recovery; no false durability or PII notification claim; H |
| MT-DEVICE-009 | Physical touch/keyboard/screen-reader and orientation/zoom across required devices | Core flows usable; no hidden submit/focus/target issue; H |
| MT-DEVICE-010 | Real two-device stale submissions and controlled provider/API outage recovery | Correct conflicts/no duplication, bounded retries/privacy; H/R |

**Cleanup:** keep devices/pending data; revoke only synthetic subscriptions no longer needed; provider changes approved/recorded/restored. **Blocks:** absent devices/provider permissions/config, data loss/security/accessibility defects. **Exit/GREEN:** ten PASS on required physical targets/providers; formal accepted non-critical exclusions still BLOCKED and limit development decision, never real-pilot GREEN.

### PHASE MT-21 — Cross-cutting exploratory test

**Objective:** deliberate bounded sessions expose integration issues beyond scripted journeys. **Prerequisites:** MT-20 or explicit human bounded authorization for independent development exploration; reusable baseline plus disposable fault/tamper origin. **Identities/data:** OA/T1/T2/XT/G, two tabs/devices, no real records. **Routes:** all implemented UI/API route groups; exact requests recorded safely by alias/status. **Evidence required:** L/R/H where hardware matters; each charter 20 minutes, record actions and assertions even when no defect found.

| Case ID | Exact steps / charter | Expected result / evidence |
|---|---|---|
| MT-EXP-001 | Traverse every navigation, back/forward/refresh/deep link; double-click every write once with synthetic data | Stable workspace/session, no duplicate mutation or lost pending work; L/R |
| MT-EXP-002 | Two users in one browser, profile/session switch and two tabs racing refresh/write | No cross-profile disclosure/wrong actor; server boundary survives UI state; L/R |
| MT-EXP-003 | Concurrent OA scope/archive/revoke and T1 mark/sync; T2 competing finalization | Atomic safe denial/conflict, no accepted lost work; L/R |
| MT-EXP-004 | Device/church midnight/DST, date filters and birthday rollover on disposable clock contexts | Explicit date semantics, no unreviewed timezone mutation; R/L |
| MT-EXP-005 | Malformed URLs/UUIDs, stale versions, extra ownership/role fields, unknown enum, oversized bounded inputs | Safe 4xx without data leak/side effects; no unhandled 500; R/L |
| MT-EXP-006 | Controlled actual 4xx/5xx/429/offline/timeout, switch route/back during requests | Accurate safe UX, correlation, retry/pending preservation; L/R |
| MT-EXP-007 | Restart isolated API/DB connection/queue while traffic pending; reconnect | No false success, bounded recovery, audit/domain/receipt consistency; R |
| MT-EXP-008 | Disposable storage ciphertext/metadata/cursor tampering and worker upgrade during pending work | Fail closed without other profile leakage; update safety and encrypted work preservation; R/L |
| MT-EXP-009 | Nonprivileged hostile client tries tenant/header/device/actor claim substitution on every trust boundary | Server policy/RLS/auth/MFA/schema controls deny, no disclosed foreign data; R |

**Cleanup:** restore baseline services/assignments through supported paths; preserve defects/evidence. **Blocks:** any reproduced confirmed defect; suspected critical gap unresolved. **Exit/GREEN:** nine charters completed with reproducible outcomes and closed remediation queue; timeboxing never excuses known defects.

### PHASE MT-22 — Final release qualification

**Objective:** reviewed scoped readiness decision, distinct from historical Task18 GO. **Prerequisites:** all phase records/dependencies; human acceptance/sign-off where required; actual candidate; approved pilot runbook. **Identities/data:** reviewer/operator/OA; aggregates only. **Routes:** final smoke health/auth/workspace/offline/sync; [release checklist](release-checklist.md), [pilot runbook](pilot-runbook.md). **Evidence required:** R/H and current linked run reports; historical DOCUMENTATION identified explicitly.

| Case ID | Exact steps | Expected result / evidence |
|---|---|---|
| MT-RELEASE-001 | Reconcile every stable ID, deferred case, fixture/defect/blocker and evidence link | All required live cases PASS; no unexplained NOT_RUN/FAIL; totals reproducible; R |
| MT-RELEASE-002 | Review all confirmed defects/security gaps and accepted blocked prerequisites | Zero open blocking confirmed defects or unknown critical gap; low defects still resolved under AGENTS; accepted blocks rationale/scope/human owner recorded; H/I |
| MT-RELEASE-003 | Run applicable final automated regression gates from AGENTS/testing environment serially for backend | Current candidate backend/frontend/type/lint/build/Pint/contract/structure/validation/audits green; exact commands/results recorded; R |
| MT-RELEASE-004 | Secret scan tracked/new inputs; establish still-valid OWASP baseline or full rescan on invalidation; review scanner exclusions/parsing | Zero legitimate findings; comprehensive baseline commit/coverage justified; full CI scan unchanged; R/I |
| MT-RELEASE-005 | Verify fresh backup/restore, queue/scheduler/protected readiness, provider/physical checks and CI result | Actual operations/hosted evidence; historical drill/emulation not substituted; R/H |
| MT-RELEASE-006 | Four attendance days with two Teachers/shared profiles per pilot runbook; Owner compares manual counts and signs privately | Human controlled-pilot evidence, reconciled totals/no duplication/loss; H/R |
| MT-RELEASE-007 | Review complete diff/evidence/knowledge and Git branch/staging/remote/main state | Preserved tasks/data, no Task19/features/secrets/runner junk; authorized exact-path finalization only; R/I |
| MT-RELEASE-008 | Synchronize manual knowledge/handoff/current state and make development versus real-pilot decision | Scope/date/candidate/limitations explicit, human real-pilot prerequisites met before pilot GREEN; H/R |

**Cleanup:** preserve live data, append-only evidence and unsynced profiles; no production deployment/reset implied. **Blocks:** required live phase missing, defects/gate failure, unknown critical gap, unaccepted blocker, no human pilot sign-off. **Exit/GREEN:** eight PASS for real-pilot qualification. **Development GREEN** may only describe an explicitly reviewed completed development subset with human-accepted non-critical provider/device exclusions; affected cases remain BLOCKED. It does not authorize real-pilot GREEN, deployment or automatic finalization while AGENTS.md unresolved YELLOW applies. Release/no-go scope must state that difference plainly.

## 12. Coverage and Plan Review

| Implemented tasks | Required phases |
|---|---|
| 1–3 repo/contract/PostgreSQL/RLS | MT-00, MT-18, MT-22 |
| 4 authentication/platform/MFA | MT-01, MT-03, MT-05, MT-18 |
| 5 applications/review | MT-02, MT-04, MT-20 |
| 6 membership/ownership | MT-09, MT-13, MT-18 |
| 7 audit/security/correlation | Every mutation phase plus MT-18/MT-22 |
| 8–9 ministries/roster/import | MT-06…MT-09 |
| 10 PWA | MT-10, MT-20, MT-21 |
| 11–14 profiles/attendance/sync/conflict/guest | MT-11…MT-16, MT-20…MT-21 |
| 15–16 reports/birthdays/push | MT-17, MT-19…MT-20 |
| 17 operations/security | MT-00, MT-18…MT-20, MT-22 |
| 18 qualification/pilot | All phases, explicit human four-day evidence MT-22 |

Plan review must verify ordered next actions; actual live integrations and negative paths; tenant/role isolation; MFA/CSRF/CAPTCHA/RLS/audit; offline/encryption/sync/concurrency; dates/timezones; responsive/accessibility; operations/provider/devices; identity/data preparation; evidence/exit rules; preservation and human prerequisites. Do not treat plan coverage as execution evidence. Public signup is an existing commissioning/scope gap, not a new case that authorizes implementation. Source/request-limit changes require plan review and new candidate evidence, not invented acceptance behavior.

The planned inventory is **23 phases / 211 unique case IDs**. For role/forms/navigation/import/attendance/reports, repeat applicable live core journeys on desktop Chrome and physical Android/iOS/iPad during MT-20; browser automation across the existing four emulated projects supplements these. Server-negative variants need one real request context per role/tenant boundary, not false physical-device claims. Record any unsupported target as BLOCKED with the exact missing hardware/provider prerequisite.

## 13. Entry Point for the Next Chat

> Read AGENTS.md, docs/qa/MSPROUT_SYSTEM_HANDOFF.md, docs/qa/MANUAL_TESTING_ROADMAP.md, knowledge/MANUAL_TESTING.md and knowledge/CODEBASE_MEMORY.md. Verify Git checkpoint/upstream/status and preserve development PostgreSQL, SQLite and unsynced profiles. Tasks 1–18 are complete; no Task 19 or new feature. Execute MT-00 only, record every case with actual expected/actual/result/evidence and exact blocked prerequisites, then update manual knowledge and stop at the reviewed checkpoint. Follow AGENTS.md remediation and finalization; never bypass CAPTCHA/MFA/CSRF/RLS/audit/leases or reset/reseed development. Verify the scoped Codebase Memory tools after restarting Codex if still pending; graph findings remain advisory. Ask only for genuine unresolved human/external prerequisites, and never claim the full manual campaign or real pilot has passed.
