# Current State

## Platform live-runtime discrepancy resolved — 2026-10-07

This continuation supersedes the earlier assumption that a restarted worktree server alone established live recovery. Both PHP PID 11208 (retained MT-02 router serving the original Desktop code) and PID 32276 (fixed worktree) listened on `127.0.0.1:8000`. Both reported correlations, including `b548f226-fc1d-451f-8c03-ef06412f4c76`, were found in the Desktop log, not the worktree log. HTTP boot inspection confirms a built-in database handler in Desktop and the custom handler in the worktree, with no cached configuration in either; live schema metadata is `bigint`. The log does not retain exception class/SQLSTATE, so those historical details cannot be recovered. `QueryException` / `22P02` is the isolated reproduction evidence, not a recovered live trace. See [complete evidence](../docs/qa/platform-session-restoration-verification.md#live-runtime-continuation-after-0f956171--2026-10-07).

After checking exact process/router identity, the agent stopped only stale API PID 11208. `netstat` then verified the fixed API as the sole listener. No live administrator, credentials, MFA/recovery material, database records, browser/offline storage, queue/scheduler or manual-phase operation occurred. No live sign-in is claimed. The fixed API remains running; no extra restart is required for this test/document continuation. Future restart must verify the port is vacant first and exactly one correct listener afterward; [safe procedure](../docs/operations/deployment.md#platform-session-persistence-update). Historical PIDs must not be reused as stop targets.

Added real `artisan serve` HTTP regression with pre-boot database selection, real cookie jars/CSRF and protected isolated PostgreSQL for both payload-encryption settings: **2 tests / 26 assertions PASS**. Full backend **249 tests / 1,709 assertions** and frontend **136 tests / 34 files**, typecheck/lint/build, contract drift, Pint, strict Composer validation, both dependency audits, structure, source Gitleaks and explicit OWASP coverage passed. Final review closed the test-launcher isolation finding by excluding shared credential caches and database URLs; its focused/Pint/OWASP reruns passed. That test-only correction changes no production input or other aggregate test, so the broader result remains valid. No BLOCKING or SHOULD FIX item remains; final knowledge/link/secret/whitespace checks precede staging.

Authentication implementation from `0f956171e2923e85e8cc3a8924a7f18e8f3e5527` is unchanged. The continuation uses `codex/platform-session-lifecycle` in the same isolated worktree, tracking `origin/feat/mvp-foundation`; starting HEAD/remote agreement and unchanged main `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f` were verified with TLS enabled. Original Desktop HEAD remains `0416c2f3d0785e82afd497e214fd948bf0015bee`, with the same five modified paths, untracked MT-02 evidence and empty staging preserved. This receipt precedes the single reviewed `test: verify platform authentication in the local HTTP runtime` commit/push. Tasks 1–18 and prior fixes remain intact; stop after this continuation.

## Platform session restoration — 2026-10-07

The human reports that the existing `sage.dev` is now active and password/TOTP succeeds, followed by a `/platform/me` 500. Automated fresh-request PostgreSQL regression confirmed the root cause: route authentication selects the platform guard, whose UUID Laravel then tries to write into the integer church `sessions.user_id` metadata column (SQLSTATE `22P02`). Guard restoration, the controller user type, session rotation and middleware/cookie ordering are correct. The registered database handler now keeps platform metadata null and explicitly resolves church metadata through `web`; standard persistence/encryption and every authorization/MFA check remain intact. No API contract, migration, identity or logging behavior changes. See [verification](../docs/qa/platform-session-restoration-verification.md).

This fix starts at committed/pushed recovery checkpoint `4c9bb157ff43db6b83381b002be56e7995a8a6d3` in the existing isolated worktree, on `codex/platform-session-restoration` tracking `origin/feat/mvp-foundation`. TLS-verified remote reads agreed with that checkpoint and unchanged main `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f`. The original Desktop checkout remains at `0416c2f3d0785e82afd497e214fd948bf0015bee`, with its same five modified paths, untracked MT-02 evidence and empty staging preserved. This receipt precedes the single reviewed commit/push; resolve final evidence through Git subject `fix: preserve platform database session restoration`.

Final focused proof passed **3 tests / 185 assertions**; the initial complete backend gate passed **247 tests / 1,681 assertions**, followed only by isolated test diagnostic/row-existence strengthening and its focused rerun. Full frontend **136 tests / 34 files**, typecheck/lint/build, contract drift, Pint, strict Composer validation, both dependency audits, structure, Gitleaks and comprehensive plus final supplemental OWASP scans passed. No BLOCKING or SHOULD FIX source-review item remains. Final knowledge/document/secret/whitespace closure precedes staging and does not invalidate application gates; detailed limitations and effect-based retention are in the verification report.

The live API listener was identified read-only as serving this isolated checkout. Private APP_KEY, public origin, database and session settings match the Desktop environment without printing values. Restart the API from the fixed checkout on `127.0.0.1:8000`, then retry normal sign-in with the existing active account; [operations steps](../docs/operations/deployment.md#platform-session-persistence-update). No migration for this patch, reissue or storage clearing is needed. No live account/database/browser mutation, service restart, deployment or manual-testing phase was performed. The older pending-setup commissioning receipt below describes its earlier run, not the human's newly reported activation. Tasks 1–18, the previous recovery fix and all manual evidence remain intact. Stop after this bug fix.

## Pending platform setup recovery — 2026-10-07

The authorized bug fix adds `platform:reissue-admin-setup --handle=sage.dev` for an existing eligible pending administrator. Reissue changes only invitation metadata, sends to the stored email and transactionally queues canonical correlated platform/security evidence plus one database mail job. Generation binding revokes older links and unfinished sessions; activation still requires TOTP and recovery acknowledgement. See [verification and deployment limits](../docs/qa/platform-setup-reissue-verification.md) and [operations procedure](../docs/operations/deployment.md#recovering-an-unfinished-platform-setup).

Validated implementation is in the isolated `codex/pending-platform-setup` worktree, starting at `0416c2f3d0785e82afd497e214fd948bf0015bee`, tracking the existing `origin/feat/mvp-foundation`. This receipt precedes the single fix commit/push; resolve final commit evidence through Git using subject `fix: recover stranded pending platform administrator setup`. The original Desktop checkout remains at its original HEAD with its five modified paths, untracked MT-02 evidence and empty staging preserved. No account, live database, mail delivery, service/browser/offline-data operation or manual phase was performed.

Focused recovery proof passed 21 tests / 122 assertions. Final backend regression passed 244 tests / 1,498 assertions; frontend passed 136 tests in 34 files with typecheck/lint/build and contract drift green. Pint, strict Composer validation/audit, frozen pnpm install/audit, structure, initial source Gitleaks and comprehensive plus focused OWASP scans passed. Final source review closed the generation-1 rollout gap and all SHOULD FIX/BLOCKING findings. Documentation-only synchronization does not invalidate those application results; final documentation/secret/whitespace checks precede staging.

Live commissioning is deliberately pending: serve the matching code, apply the additive migration through the existing migration connection and restart the matching queue worker before issuing a new invitation. Do not run the new command against the old running API. Tasks 1–18 and all historical manual results remain intact; no next feature or manual-testing phase is started.

## Current manual QA policy — 2026-10-07

By explicit user decision, MT-00 through MT-22 are optional, risk-based references for exploration, bug reproduction, correction and fix validation. Sequential completion of all 211 cases is not required for development, merging, deployment or release. Incomplete, BLOCKED, NOT_RUN or deferred cases do not automatically block those activities. Applicable automated tests, security controls, authorization boundaries, CI requirements, deployment safeguards and unresolved release-critical defects remain release criteria. Confirmed bugs require severity-based triage, correction in an authorized scope and focused regression validation. Deferred tests remain accurately BLOCKED or NOT_RUN; never represent them as PASS.

Preserve existing results, evidence and known blockers. Phase exit rules describe proof needed to claim a phase passed, not unconditional release prerequisites. See [AGENTS.md](../AGENTS.md) section 16 and the [manual roadmap](../docs/qa/MANUAL_TESTING_ROADMAP.md). Older dated qualification, progression, next-action and no-finalization receipts below describe their historical run scopes; they do not reinstate mandatory sequential qualification.

Current evidence checkpoint: Tasks 1–18 are complete; MT-00 and MT-01 passed and remain preserved. MT-02 is partial: the latest cleanup receipt records 2 PASS / 0 FAIL / 3 BLOCKED / 5 NOT_RUN. MT-APP-003 has five passing subchecks; City121 denial remains BLOCKED with its payload/reproduction uncertainty. MT-APP-004 remains BLOCKED on fresh-fixture authorization; AUTO-MTAPP004 was proposed, not created or designated. Response correlation ID and click count for the combined at-limit acceptance remain unconfirmed. Known blockers and older counts remain in the retained run history; no results are promoted by this policy change.

The earlier request to prepare MT-APP-004 is deferred. This governance run authorizes no manual case, fixture preparation or product fix: do not rerun completed cases or start MT-03 or another phase. Preserve all four existing pending church applications, PostgreSQL/SQLite, APP_KEY, credentials, browser/offline storage, drafts, conflicts, outbox events, cursors, unsynced work and prior evidence. No synthetic user, application submission, record deletion, database reset or storage clearing is authorized. Authentication, CAPTCHA, MFA, RLS, CSRF and other protections remain intact. These are preservation requirements, not a new runtime census or browser inspection.

Observed issue O-QA-20261007-01: long synthetic church name reportedly causes horizontal overflow on Pending review. Reproduction, severity, release impact and root cause remain unassessed; see [manual knowledge](MANUAL_TESTING.md). No product fix or manual execution is part of this update.

Governance update starts at feature HEAD `7ee49722b74003a3dd18899ed5bd7e26f874e66d`, tracking `origin/feat/mvp-foundation` at 0/0; authenticated remote read agrees, `origin/main` remains `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f`. After reviewing the change, the user separately authorized one governance-only commit and normal push to that existing feature tracking branch, explicitly preserving all pre-existing work unstaged and uncommitted. Only the reviewed policy changes are commit inputs; the environment-example edit, earlier MT-02 documentation changes and untracked run records remain outside the commit. This is the specific human authorization for section 14 finalization with preserved unrelated work; no clean-worktree claim is made. Current validation is recorded in [TESTING_ENVIRONMENT.md](TESTING_ENVIRONMENT.md).

Focused consistency, local links, checklist/evidence preservation, repository structure, complete changed-document Gitleaks and whitespace checks passed; final review has no remaining BLOCKING or SHOULD FIX documentation finding. The finalization-only authorization resolves the prior YELLOW condition. GREEN applies to this governance update, with one reviewed `docs: make manual QA risk-based and non-blocking` commit and normal feature-branch push authorized. This receipt precedes finalization; verify its resulting SHA, remote agreement, 0/0 state and preserved unstaged work through Git. No manual phase or product task follows this run.

## Preserved historical receipts

Verified: 2026-10-01 (MT-00 run began 2026-09-30). This is the development checkpoint index. The [canonical system handoff](../docs/qa/MSPROUT_SYSTEM_HANDOFF.md) contains current operation, fixtures, qualification, defects and commissioning limitations.

## Git state

- Branch: `feat/mvp-foundation`.
- MT-01 committed/pushed at `3dba978b97fff590ec1b814b66b103344843c19a` (`fix: qualify MT-01 applicant authentication`); this operator-mode run verified clean starting checkout/tracking 0/0 and TLS-verified remote feature/main agreement. `origin/main` remains `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f`. Earlier pre-finalization wording below is historical.
- The security-validation governance baseline is committed and pushed at `02c825aa7d59f8fb351b83e300f59960b88e0812`.
- Task 17 is committed and pushed at `a989dd904551a26f6f7548ee0c88128f13c6933d`.
- Task 18 is committed and pushed at `ffee8ebe9e87fe096c52e23f7a0d49da9c1c0202` — `test: add mvp release qualification`.
- Runtime-qualification maintenance is committed/pushed at `df7cf6118f5f119253154ce015803fd143bb1a6c` — `fix: qualify runtime and document system handoff`; verified clean/0/0 at planning reconnaissance.
- MT-00 finalized/committed/pushed at `40525fbe5eb9fc0f20b3a2a0e425dab137b2d214` — `docs: complete MT-00 environment preflight`; all ten cases PASS. MT-01 started from this synchronized checkpoint. Its completed evidence/remediation is recorded here before one reviewed automatic commit/push; identify the resulting commit through the MT-01 report's Git history and verify actual upstream/status. Earlier uncommitted/YELLOW snapshots below are historical.
- Repository remotes remain `origin = https://github.com/Fern-star-cloud/MSprout.git` and `upstream = https://github.com/Frierend/ministry-sprout.git`. This differs from the roadmap preflight's original one-remote expectation; do not change remotes without explicit direction.

## Roadmap position

- Tasks 1–17: **COMPLETE / COMMITTED / PUSHED** on `feat/mvp-foundation`.
- Task 18: **COMPLETE / COMMITTED / PUSHED**; the controlled automated one-church qualification rehearsal and all twelve acceptance criteria passed. It was not a human or production pilot.
- The approved MVP roadmap ends at Task 18. Preserve Tasks 1–18; do not invent Task 19 or begin post-MVP development without a new approved scope.

## Manual planning and local tooling

Autonomous Local Manual-Test Operator Mode is implemented, validated and separately approved by the user for finalization under AGENTS.md section 14. GREEN for this bounded governance/tooling change; this receipt is recorded before the single approved `chore: establish autonomous local QA operator mode` commit and normal feature-branch push. Resolve its SHA and synchronization from Git history/status. [Protocol](../docs/qa/AUTONOMOUS_LOCAL_OPERATOR.md) and repository PowerShell helper add an ignored owner-only Windows DPAPI credential store, synthetic-only new identity registration and phase/case/local-origin/preservation preflight. No live identity/session/fixture, credential replacement, product change or manual-phase execution is part of this run. AP/MT-01 DA/PA remain excluded. Actual tooling/security validation is recorded in [TESTING_ENVIRONMENT.md](TESTING_ENVIRONMENT.md); no designated autonomous identity or initialized operator credential file exists. Missing credentials remain a fail-closed future execution prerequisite, not an instruction to create an account. MT-02 requires separate authorization and its existing provider/fixture prerequisites; all phase cases/evidence remain untouched.

Current completed result: **MT-01 all ten PASS/0 FAIL/0 BLOCKED/0 NOT_RUN**; [run report](../docs/qa/manual-runs/MTQA-20260930-02/MT-01.md). Legitimate AP/DA authentication, mail verification/reset/replay/natural expiry, CSRF/stale-session/correlation boundaries and explicitly approved isolated live offline/server-failure proof complete. F-MT01-01–04 corrected; current backend223 tests/1,376 assertions and frontend136 tests/34 files plus applicable gates PASS. Operator confirms AP signed out and isolated Incognito closed; owned fault fixture stopped/5181 absent04:14:39 UTC. Final read-only04:15:33 UTC AP row/current DA password/expired token/SQLite/API environment equality PASS, users2/domain counts0. Main Codex anonymous login retained; private mail and canonical evidence preserved. Shared services remain healthy. Stop before MT-02; real Turnstile/exact-origin/action and further fixture authorization remain future prerequisites. The dated intermediate snapshots below preserve history and do not override this result.

The planning layer defines [23 ordered QA phases](../docs/qa/MANUAL_TESTING_ROADMAP.md). [MT-00 run MTQA-20260930-01](../docs/qa/manual-runs/MTQA-20260930-01/MT-00.md) now **PASS: 10 PASS / 0 FAIL / 0 BLOCKED / 0 NOT_RUN**. Initial8/0/2/0 and intermediate wrong-origin receipt retained. Corrected HUMAN_MANUAL exact127.0.0.1 storage/cache receipt closes MT-ENV-010; native IndexedDB10 matches Dexie schema1. Authorized private READINESS_TOKEN configuration and actual authenticated readiness200/all dependencies ok plus unauthenticated401 close MT-ENV-008. Only that ignored key changed; APP_KEY/DB credentials and all development work retained. No product source/tenant/identity mutation. See [manual state](MANUAL_TESTING.md) for MT-01 prerequisites/prompt. At MT-00 exit, MT-01–MT-22 were NOT_RUN; the subsequent MT-01 operator-input handoff is recorded below. AGENTS.md unchanged.

Codebase Memory v0.11.0 desktop tools were verified in the fresh-session receipt at `a0a2a47`; this run also queried architecture successfully as an advisory aid. External cache/scoped entry/explicit indexing preserved, no reindex/restart. Source/runtime remain authoritative. Provider/device commissioning gaps remain explicit future prerequisites.

MT-01 prerequisite-only continuation2026-10-01: operator confirmed private AP credential availability, approved the minimal DA procedure and locally created one unverified tenantless synthetic DA using validated `CreateNewUser`, no factories/reseed. Read-only verification confirms users2 (AP verified/DA unverified), DA sessions/reset tokens/memberships0 and churches/applications/memberships/platform admins0. Mailpit healthy/info200/messages0 and configured SMTP handshake passed without sending mail. All MT-01 prerequisites READY; stop before any MT-AUTH case. See [manual state](MANUAL_TESTING.md) for evidence distinctions, agreed scope and exact execution prompt. No application code/configuration change, existing-data reset or browser-storage manipulation.

Subsequent explicit MT-01 execution request opened [MTQA-20260930-02](../docs/qa/manual-runs/MTQA-20260930-02/MT-01.md) at40525fbe after actual remote/upstream verification0/0/main unchanged. Prior three knowledge edits are explained/preserved, staging empty. Current YELLOW operator-input handoff:0 PASS/0 FAIL/1 BLOCKED/9 NOT_RUN. B-MT01-01 awaits private live AP password entry/submission; no completed case and no MT-02 work. Read-only preservation receipt: users2/AP verified/DA unverified, existing AP sessions2/DA sessions0/security events26; AP/configuration/SQLite fingerprints kept privately outside Git. Application source/configuration unchanged; known knowledge/phase record remain unstaged/uncommitted, no commit/push.

MT-01 runtime continuation2026-10-01: operator reports Codex connection error and normal Chrome blank root. Direct diagnosis found no frontend/API listeners or corresponding host processes while Docker PostgreSQL/Mailpit remained healthy. Safely restored absent Laravel serve/queue/scheduler and Vite with existing process-scoped tools. Actual frontend/proxy health200, CSRF204/anonymous session401, protected readiness200/all dependency checks ok and heartbeat exit0; Codex root/login and normal Chrome root now render. Configuration/SQLite/full AP row unchanged; DA remains unverified with sessions/reset tokens0, domain counts0. Anonymous denial adds one security event, retained. B-MT01-02 resolved; B-MT01-01 awaits operator-private AP retry after recovery. No confirmed source defect/authentication PASS, storage reset, MT-02 or commit/push. [Same run receipt](../docs/qa/manual-runs/MTQA-20260930-02/MT-01.md) preserves initial handoff and new evidence.

Earlier MT-01 continuation before expiry proof (superseded by current handoff above):001–006 PASS,6/0/1/3.007 reset/replay/post-fix success and actual old/new probe passed; natural expiry was pending. All original detailed receipts remain in the phase report. Chrome AP session still requires eventual supported sign-out without password change or bulk deletion.

MT-01 in-scope uncommitted remediation: headless guest/unverified HTML-denial500 fixed through bootstrap guest redirect configuration and API verified-email middleware, with seven new regression cases. Focused40 tests/220 assertions and full backend218/1,340 PASS. Low serialize-javascript advisory corrected by narrow7.1.1→7.1.2 transitive build dependency override/lock update; frozen install and post-pin audit PASS/no vulnerabilities. Post-pin full frontend132 tests/34 files, typecheck/lint/build/contract PASS; Pint/strict Composer validation/audit/structure PASS. Comprehensive apps Semgrep108 rules/324 targets/~99.9% parsed/zero findings; five existing Vitest mock partial parses reviewed. Initial aggregate frontend timing failure retained, successful maxWorkers=2 component rerun did not weaken tests. Secret/diff/review closure is recorded in the testing environment, not inferred. Nine intended source/test/dependency/knowledge/report paths unstaged, no commit/push while phase incomplete.

Read-only preservation at01:48 UTC: full AP row unchanged, users2/AP and DA verified, DA reset-token count1, churches/applications/memberships/platform admins0. API environment and SQLite SHA-256 equal private baseline after normalizing uppercase/lowercase digest text (initial case-sensitive comparison was false, not a file mutation). Development configuration/key/credentials, database contents outside normal authorized auth infrastructure and browser/unsynced work preserved. No development migration/reseed/reset, direct email-verification mutation or token backdating.

## Security-validation baseline

MT-01 final frontend F-MT01-04 proof supersedes the earlier132-test result: four HTTP5xx message regressions first failed, focused transport/AuthScreen21 tests/two files and full frontend136 tests/34 files PASS; typecheck/lint/build PASS. OWASP scan of34 changed/direct auth transport/caller/test targets found zero findings; five unchanged Vitest mock partial parses reviewed against the comprehensive baseline, no new production/changed-source gap. Gitleaks supplemental source scan zero leaks. Backend223/1,376/Pint/Composer/contract/dependency/structure and full-app OWASP plus password-rule supplement retain validity because message-only changes did not invalidate those guarantees. Final documentation/redaction edits require only focused evidence/reference/whitespace/secret checks. No governance, migration, public signup, later feature or Task19 change.

Subsequent MT-AUTH-007 F-MT01-03 remediation: shared Fortify new-password rule lacked existing frontend/OpenAPI12–128 bounds. Focused TDD reproduced8/11/129 valid-token resets200, then added min12/max128 preserving configured default complexity/confirmation/hash. Five regressions/45 auth-application tests/256 assertions PASS. Full backend223 tests/1,376 assertions (183.42s), Pint and focused auth OWASP51 rules/11 targets/100% parsed/zero findings PASS; this supersedes prior218 backend for current source. Existing login passwords unchanged. Eleven intended paths now include PasswordValidationRules.php and AuthFlowsTest.php; no staging/commit/push or MT-02.

- The runtime qualification refreshed the comprehensive Semgrep OWASP baseline: 108 rules, 323 application targets, approximately 99.9% parsing, zero findings. The explicit final source/test/config delta also passed: 128 rules, 12 targets, approximately 100% parsing, zero findings. Five existing Vitest mock-syntax partial parse warnings were reviewed; production inputs were scanned.
- Ordinary feature work uses focused, risk-based Semgrep coverage for changed and directly relevant application inputs while that baseline remains valid. Security-sensitive boundaries still require explicit review and appropriate scanning, escalating to the full application scan whenever focused coverage is insufficient.
- Future production or security-coverage changes must apply the repository's risk-based invalidation rules to this qualification baseline.
- Gitleaks, dependency audits, tenant/RLS and authorization requirements, and the full Semgrep scan in the configured push/pull-request security workflow are unchanged.

See [ROADMAP_STATUS.md](ROADMAP_STATUS.md) for every task and commit.

## Historical runtime qualification at df7cf61

- The observed login 500 was caused by stale ignored SQLite configuration and absent `security_events`, not an incorrect fixture password or failed browser connection. The previously empty PostgreSQL development DB was migrated non-destructively; the existing verified development fixture was preserved/copied once without reseeding, and its original SQLite file remains intact. Real login and applicant reads now work at `http://127.0.0.1:5173` through API port 8000.
- Corrected origin-only stateful API recognition, required Turnstile CSP loading, protected encrypted offline lease expiry, test DB/runtime-role isolation, CI bootstrap/order, three vulnerable brace-expansion versions, and the official platform bootstrap command. Test bootstrap no longer rotates the live role credential and refuses development/migration DB collisions before connecting.
- Historical proof: **22 live HTTP checks**, **211 backend tests / 1,308 assertions**, **132 frontend tests / 34 files**, and **68 browser scenarios across four emulated targets**. Typecheck, lint, build, contract drift, Pint, strict Composer validation, frozen install, dependency audits, structure, Gitleaks, Semgrep and whitespace checks passed. Later frontend corrections invalidated and reran frontend/browser gates; unchanged backend guarantees retain the current-run aggregate result.
- The 55-row handoff matrix reports **40 PASS, 0 FAIL, 12 BLOCKED, 3 NOT RUN**, explicitly distinguishing live runtime from mocked-API browser tests, backend tests, inspection and historical evidence. The separate 22 HTTP checks are not counted as additional product flows.
- PostgreSQL and Mailpit are individually healthy. Host API, Vite, queue worker and scheduler were started; schema/runtime grants/forced RLS and heartbeat were verified. Following approved prerequisite preparation and MT-AUTH-006, development contains verified AP plus legitimately verified tenantless DA and no churches, applications, memberships or platform admin; the earlier qualification/MT-00 one-user census remains historical.
- Real Turnstile/private platform mailbox/VAPID gaps remain later-phase prerequisites; protected readiness was configured and verified during MT-00 as recorded above. No security bypass, arbitrary platform singleton, deployment, human pilot or physical-device claim was made. Final review has no remaining BLOCKING/SHOULD FIX item within this bounded qualification; production commissioning remains explicit next work, not a new feature.

## Committed Tasks 8–15 foundation

Task 8 is committed at `dc3c13c6cd5e4909c644b0abe37d18875cbe248f`. It provides ministries, students, enrollments, canonical student input normalization, date-only birthdates, server-derived display name/age, Owner roster writes, assignment-limited Teacher reads, bundled gender avatars, forced tenant RLS, and Task 7 audit integration.

Task 9 is committed and pushed at `fbe338f433c7432cc26c98ad8c2e258cf9502a79`. It provides the approved Owner-only safe spreadsheet import with bounded inspection, canonical row normalization, preview/mapping, locked idempotent commit, tenant RLS, privacy-bounded auditing, synchronized OpenAPI types, and responsive UI. Existing students are never updated or merged. See [the Task 9 verification report](../docs/qa/task-9-verification.md).

Task 10 implements the responsive installable PWA shell:

- A standards-based manifest names MinistrySprout/Sprout, supplies install icons and theme metadata, and opens at the application root in standalone mode.
- Vite `injectManifest` builds a controlled Workbox service worker that precaches only the application shell and hashed JS/CSS assets. Same-origin `/api/**` requests are explicitly NetworkOnly, and navigations fall back to the shell while offline.
- The update controller exposes a stable `updateAvailable` signal and will not activate/reload a waiting worker while its registered unsafe-local-work check reports an open draft or pending unsafe write.
- The semantic shell uses phone bottom navigation, a tablet/desktop two-pane sidebar layout, 44-pixel controls, visible focus, reduced-motion and forced-color support, and text-plus-icon connection states.
- Existing public, church, and platform screens remain direct-loadable; Task 8's neutral/male/female SVG avatars remain canonical.
- Playwright covers service-worker control, offline navigation reload, phone touch targets, wide navigation, and keyboard focus in real Chrome.

Final Task 10 validation on 2026-09-28:

- Focused PWA: **6 tests passed**; Playwright: **3 tests passed** in Chrome.
- Aggregate verification: **76 frontend tests in 18 files**, frontend typecheck/build, and **160 backend tests / 884 assertions passed**.
- Frontend lint and OpenAPI generated-type drift check passed.
- Frozen pnpm lockfile install, Pint, Composer strict validation/audit, pnpm audit, repository structure, Gitleaks, and `git diff --check` passed.
- Semgrep `p/owasp-top-ten` found no issues: 103 rules over 222 tracked app files, plus 108 rules over the final 31-file Task 10 change set. Gitleaks covered the same final set including knowledge and QA.

See [the Task 10 verification report](../docs/qa/task-10-verification.md) for the gate evidence and reviewed boundaries.

Task 11 implements protected shared-device profiles and server-issued offline authorization:

- Dexie stores profile-scoped encrypted blobs plus namespaced draft, outbox, cursor, conflict, and metadata stores. No password, cookie, guardian data, full birthdate, or raw audit data is stored offline.
- Per-profile random AES-256 data keys are PIN-wrapped with PBKDF2-HMAC-SHA-256 using 600,000 iterations and random salts. AES-GCM payloads use fresh IVs and authenticated profile/schema/purpose context.
- One profile key is held in memory, with explicit/profile-switch locking, five-minute inactivity lock, background lock, increasing failed-PIN delays, isolated purge, and reauthentication-required state.
- The root profile picker creates, unlocks, switches, and purges local profiles. Online switching clears the server session; offline switching prevents synchronization until reauthentication.
- `GET /api/offline/bootstrap` returns only assigned active ministries, minimal roster projections, birthday month/day and turning age, a cursor, and a signed 14-day device lease. Issuance is rate-limited, tenant-scoped, forced-RLS protected, and atomic with canonical audit evidence.
- Task 6 membership/assignment revocation continues to invalidate offline authorizations and push subscriptions. Task 10's update controller now checks draft/outbox stores for unsafe local work.

Final Task 11 validation on 2026-09-28:

- Focused Task 11: **11 frontend tests** and **4 backend tests / 33 assertions passed**; direct-routing regression: **12 tests passed**.
- Aggregate verification: **88 frontend tests in 21 files**, frontend typecheck/build, and **164 backend tests / 917 assertions passed**.
- Chrome Playwright: **3 tests passed**. Frontend lint, OpenAPI drift, frozen pnpm install, Pint, Composer strict validation/audit, pnpm audit, structure, Gitleaks, and `git diff --check` passed.
- Semgrep `p/owasp-top-ten` found zero issues: 103 rules over 270 application files plus 98 rules over the final Task 11 change set.

See [the Task 11 verification report](../docs/qa/task-11-verification.md) for gate evidence and reviewed boundaries.

Task 12 adds the offline-ready attendance domain and marking workflow:

- Tenant-owned attendance sessions and records use trusted church/ministry/date identity, versioning, constrained states/statuses, tenant-safe foreign keys, restricted runtime grants, and forced RLS.
- Owner or actively assigned Teacher authorization protects drafts. Finalization locks the session and roster, requires an exact active enrollment roster with every regular student marked, preserves the actor/time, increments version, and writes required audit evidence in the same transaction.
- Encrypted profile-local drafts use stable session identifiers and atomically append one minimal outbox event for create, mark, bulk mark, and finalize operations. Concurrent draft creation is idempotent, local mutations use optimistic concurrency, and finalized-pending drafts become read-only.
- The responsive attendance screen loads only the unlocked profile's protected roster, supports ministry/date selection, search, individual and bulk marking, counts, avatars, live connection/pending state, local-save confirmation, and safe fixed-bar finalization.
- Task 13 supplies synchronization transport and acknowledgement; Task 14 now supplies conflict resolution, immutable revisions, and temporary guests.

Final Task 12 validation on 2026-09-28:

- Focused Task 12: **9 frontend tests in 3 files** and **8 backend tests / 23 assertions passed**.
- Aggregate verification: **97 frontend tests in 24 files**, frontend typecheck/lint/build, and **172 backend tests / 940 assertions passed**. The backend aggregate remained valid after the isolated frontend-only final-review remediation.
- Chrome Playwright: **3 tests passed**. OpenAPI drift, frozen pnpm install, Pint, Composer strict validation/audit, pnpm audit, structure, Gitleaks, Semgrep, and `git diff --check` passed.

See [the Task 12 verification report](../docs/qa/task-12-verification.md) for gate evidence and reviewed boundaries.

Task 13 adds idempotent attendance synchronization:

- `sync_events`, `change_feed`, and `device_cursors` are trusted-tenant records with forced RLS and restricted runtime grants. Replay receipts and feed rows are append-only; replay keys are tenant-local to prevent cross-church UUID interference.
- Push revalidates the authenticated actor, active membership, device authorization/lease, tenant, assignment, payload schema, roster, and base version. Sorted advisory locks serialize event/entity races, and each accepted mutation commits domain state, canonical audit, feed projection, and receipt atomically.
- Pull returns bounded ordered assignment-scoped changes, advances a durable cursor across visible or filtered rows, emits targeted assignment tombstones, and renews the signed 14-day lease.
- The unlocked-profile client pushes stable batches with bounded exponential retry, safely acknowledges or quarantines every result, pulls until current, and applies projections plus cursor/lease state in one Dexie transaction. Reconnect is coalesced; authorization failures lock the profile, purge cached roster/ministry/authorization projections, clear child data from memory, and preserve encrypted unsynced work for later quarantine/review.
- Reauthenticated bootstrap and tombstone application remove revoked assignments from encrypted roster/ministry state and quarantine affected drafts/outbox events instead of silently discarding user work.

Final Task 13 validation on 2026-09-29:

- Focused sync: **10 backend tests / 80 assertions** and **8 frontend sync tests passed**; privacy/revocation-focused local profile and attendance coverage also passed.
- Aggregate verification: **108 frontend tests in 26 files**, frontend typecheck/lint/build, and **182 backend tests / 1,020 assertions passed**.
- Chrome Playwright: **4 tests passed**, including lost-response replay convergence. OpenAPI drift, frozen pnpm install, Pint, Composer strict validation/audit, pnpm audit, structure, Gitleaks, Semgrep, and `git diff --check` passed.

See [the Task 13 verification report](../docs/qa/task-13-verification.md) for gate evidence and reviewed boundaries.

Task 14 adds attendance conflicts, revisions, and temporary guests:

- Contradictory stale attendance changes persist bounded evidence and move the session to Needs Review; identical values deduplicate, non-overlapping records merge, and future versions remain conflicts. Multiple open conflicts keep the session in review until the last resolution.
- Owners with current MFA receive online list/show/resolve and finalized-attendance correction actions. Each decision appends an immutable before/after revision with original/resolving actors, bounded reason, and UTC time while preserving the original attendance record value and actor.
- `sync_conflicts`, `attendance_revisions`, and `attendance_guests` use tenant-safe keys, constraints, forced RLS, and restricted runtime grants. Conflict/guest provenance is immutable and revision rows are append-only.
- Offline guest events permit only display name and optional gender, remain encrypted and profile-scoped locally, and preserve actor/device/correlation/local/server time when promoted, linked, or merged by an Owner.
- The online review screen gives Owners side-by-side evidence and guest resolution controls. Assigned Teachers see only a Needs Owner Review boolean, never actor, device, correlation, or unrelated ministry details.

Final Task 14 validation on 2026-09-29:

- Aggregate verification: **113 frontend tests in 27 files**, frontend typecheck/lint/build, and **189 backend tests / 1,136 assertions passed**.
- Chrome Playwright: **4 tests passed**. OpenAPI drift, Pint, Composer strict validation/audit, pnpm audit, structure, Gitleaks, Semgrep, and `git diff --check` passed.
- Semgrep found zero issues from 103 rules over 272 tracked application files and 123 rules over the complete 28-file Task 14 source/contract set.

See [the Task 14 verification report](../docs/qa/task-14-verification.md) for gate evidence and reviewed boundaries.

Task 15 adds online attendance history, basic reports, and safe CSV export:

- Date/ministry-filtered PostgreSQL queries return revision-effective Present/Absent counts, a decimal rate, server-pending sessions, open conflicts, corrections, and up to 100 recent finalized sessions. Pending device events are displayed separately and never count as finalized attendance.
- Current active assignment scope restricts Teachers to their ministries and recent sessions. Owners receive tenant-wide permitted results and the only export capability; application checks and existing forced RLS both remain active.
- Owner CSV export uses explicit UTF-8 headers, ISO dates/timestamps, correct quoting, and apostrophe protection for text beginning with spreadsheet formula prefixes. Birthdates, unresolved work, pending work, and advanced analytics are excluded.
- Each successful export records canonical tenant audit evidence with actor, filters, result count, and correlation ID without copying report rows or child data into audit metadata or logs.
- The online responsive report UI provides filters, summary cards, pending/conflict/correction links, finalized-history table/cards, and a constrained same-origin download path without changing service-worker API caching.

Final Task 15 validation on 2026-09-29:

- Focused proof: **5 backend tests / 43 assertions** and **25 frontend tests in 5 files** passed.
- Aggregate verification: **119 frontend tests in 30 files**, frontend typecheck/build, and **194 backend tests / 1,179 assertions passed**.
- Chrome Playwright: **4 tests passed**. Frontend lint, OpenAPI drift, Pint, Composer strict validation/audit, pnpm audit, structure, Gitleaks, Semgrep, and `git diff --check` passed.
- Full Semgrep found zero issues from 103 OWASP rules over 281 targets with approximately 99.9% parsing.

See [the Task 15 verification report](../docs/qa/task-15-verification.md) for gate evidence and reviewed boundaries.

Task 16 adds privacy-safe birthday reminders and an authorized in-app fallback:

- The every-minute scheduler selects only active churches at 8:00 AM in their IANA timezone through a narrow database function, then creates one church/date dispatch and one church/date/user/device delivery under the restricted runtime role and forced RLS.
- Owner recipients are church-wide; Teachers are limited to students in currently assigned ministries. Recipient authorization and the birthday count are rechecked immediately before sending, so membership or assignment revocation suppresses queued delivery.
- Web Push endpoint/key material is encrypted at rest. Only trusted browser push-service HTTPS hosts are accepted, endpoint hashes support identity without disclosure, and permanent failures or membership revocation disable subscriptions.
- Push payloads contain only the generic title and birthday count. Names and turning ages are available only through the authenticated tenant-scoped route or the existing unlocked, encrypted, leased offline projection; full birthdates remain excluded.
- The UI requests permission only after an authenticated deliberate action, remembers denial without repeatedly prompting, explains unsupported/iOS Home Screen requirements, and keeps the service worker's `/api/**` NetworkOnly boundary.

Final Task 16 validation on 2026-09-29:

- Focused birthday/notification proof: **12 backend tests / 84 assertions** and **22 frontend tests in 5 files passed**.
- Aggregate verification: **126 frontend tests in 33 files**, frontend typecheck/build, and **203 backend tests / 1,232 assertions passed**.
- Chrome Playwright: **4 tests passed**. Frontend lint, OpenAPI drift, frozen install, Pint, Composer strict validation/audit, pnpm audit, structure, Gitleaks, focused risk-based Semgrep, and `git diff --check` passed.
- Focused Semgrep applied 123 OWASP rules to all 33 parsed Task 16 PHP/TypeScript/OpenAPI targets with zero findings and approximately 100% parsing. The Task 15 comprehensive baseline remains the repository-wide development baseline until Task 17 establishes the mandated production-hardening baseline.

See [the Task 16 verification report](../docs/qa/task-16-verification.md) for gate evidence and reviewed boundaries.

Task 17 adds production operations, retention, deployment, and security hardening:

- Public liveness remains minimal; token-protected readiness exposes only component states; the online-only MFA-protected `sage.dev` dashboard provides sanitized aggregate API, database, queue, scheduler, birthday, synchronization, conflict, and storage signals.
- Scheduler heartbeat, operational pruning, and revoked-device purge jobs use bounded configuration and narrow fixed-search-path database functions. Tenant loops set transaction-local church scope so forced RLS remains active.
- Retention removes only approved technical/application data: operational logs after 30 days, security events and sync receipts after 180 days, rejected application PII after 30 days, and change-feed rows only after active cursors pass them plus 90 days. Tenant audit evidence is never deleted. Expired devices are marked for full resynchronization before stale authorization data is purged.
- The web deployment uses same-origin API rewrites, immutable asset caching, strict CSP, HSTS, and privacy headers. The API image supports API/worker/scheduler/migration service modes, honors the platform-injected port, and runs as unprivileged `www-data`.
- Deployment, backup/restore, secret rotation, incident response, data retention, threat-model, rollback, and bootstrap-removal procedures are documented without weakening TLS, tenant, audit, authentication, or offline boundaries.

Final Task 17 validation on 2026-09-30:

- Focused operations/offline proof: **12 backend tests / 114 assertions** and **9 frontend tests** passed.
- Aggregate verification: **128 frontend tests in 34 files**, frontend typecheck/build, and **208 backend tests / 1,299 assertions** passed. Stable Chrome Playwright passed **4 tests**.
- Frontend lint, OpenAPI drift, frozen install, Pint, Composer strict validation/audit, pnpm audit, repository structure, route/config/schedule checks, production image build/runtime checks, Gitleaks, and `git diff --check` passed.
- The mandatory full `semgrep scan --config p/owasp-top-ten apps` baseline passed after remediation: **108 rules over 314 targets**, approximately 99.9% parsed, zero findings. The final image and all applicable service modes run as `www-data`; default and injected-port liveness and the native container health check passed.

See [the Task 17 verification report](../docs/qa/task-17-verification.md) for complete gate evidence and reviewed boundaries.

Task 18 qualifies the complete approved MVP boundary:

- Whole-MVP Playwright scenarios cover onboarding, two Teacher profiles, four offline attendance dates across closure/reopen, authorization refresh, bounded outage retry, exactly-once convergence, conflicts/corrections/reports, safe import, birthday privacy, storage failure, PWA update, and cross-tenant denial.
- A qualification-discovered offline-security defect was remediated: correct PIN unlock can read an unexpired encrypted cache after restart/profile switch, while reauthentication-required state still blocks push/pull until the same actor refreshes authorization online. Expiry, revocation, and online authorization failure remain fail-closed.
- The definitive matrix passed **60/60 Playwright tests** across desktop Chrome, Pixel 7 Chrome emulation, iPhone 13 WebKit emulation, and iPad WebKit emulation. Axe found no serious/critical issue on qualified surfaces.
- Aggregate verification passed **131 frontend tests in 34 files** and **208 backend tests / 1,299 assertions**, with typecheck, production build, lint, OpenAPI drift, formatting, frozen install, structure, audits, Gitleaks, and whitespace checks green. Focused offline profile/device/sync proof passed 20 tests after the final authorization-denial correction.
- Newly published Laravel/Flysystem advisories were remediated to Laravel 13.34.0 and Flysystem 3.36.0; final Composer and pnpm audits report no known vulnerabilities. The dependency-refreshed image and operations checks passed.
- The encrypted isolated PostgreSQL restore drill matched required counts/checksums and destroyed all temporary restore/backup artifacts. Queue startup, scheduler heartbeat, PWA update, and offline-to-online convergence passed.
- Release decision: **GO** for the approved MVP boundary and controlled one-church pilot procedure. See [Task 18 verification](../docs/qa/task-18-verification.md), [browser matrix](../docs/qa/browser-matrix.md), [pilot evidence](../docs/qa/pilot-runbook.md), and [release checklist](../docs/qa/release-checklist.md).

## Next work

1. Preserve the completed Tasks 1–18 MVP foundation and the Task 18 release evidence.
2. Stop at the MVP boundary. Any production rollout follows the existing deployment/pilot runbooks; any product expansion requires a separately approved post-MVP scope.

## Known environment and repository issues

- The default Windows `node` is 22.22.3, below the approved Node 24 baseline. Task 18 used the Codex-bundled Node 24.19.0 with Corepack pnpm 10.34.5 without installing or purging host runtimes.
- No PHP executable is on the default PATH. A pre-existing temporary Windows PHP 8.3.33 runtime and process-scoped extension scan files supply `pdo_pgsql`, GD, and ZIP outside the repository.
- Composer/pnpm audits and Semgrep used process-scoped temporary trust configuration to retain TLS verification behind the host certificate interceptor. The comprehensive Task 18 scan ran in the existing local Docker environment with its trusted roots mounted read-only. No global trust or machine configuration changed.
- Playwright used installed stable Chrome. The host's existing WebKit 2336 was selected through a process-scoped executable-path override because it predates the current package's managed revision; no browser was installed or reconfigured. The 60-test matrix is browser-engine/device-emulation evidence, not physical-device evidence.
- The pre-existing `upstream` remote differs from the roadmap's original one-remote preflight. It was not used or modified; Task 18 finalization is explicitly limited to the existing tracked `origin/feat/mvp-foundation` branch.
- `vite-plugin-pwa` emits an upstream non-blocking `inlineDynamicImports` deprecation warning while building the injected service worker; the production build and offline browser test pass.
