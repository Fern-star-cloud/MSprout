# COMPAT-01 B4-P2-1A — Coordination and conservative persistence foundations

Started 2026-10-16; final interrupted-validation closure 2026-10-17. **YELLOW: STAKEHOLDER REVIEW REQUIRED.** Parent `739e321124411fc1aee1c4198e4a8faa5295d1b8`, branch `feat/mvp-foundation`. This candidate remains unstaged, uncommitted and unpushed. B4-P1 is published GREEN; its dated review holds remain historical. Overall COMPAT-01 remains incomplete and modernization remains5/15 GREEN(33.3%).

## 1. Authority and scope

The stakeholder conditionally approved P2-D01–D06 and selected P2-1A only. [P1 evidence/design](compat-01-b4-p1-recovery-safety-design.md) and the conversational P2 review supply the design; the current task narrows it to additive storage, an unintegrated helper and isolated proofs. [Runner instructions](../../scripts/compatibility/foundations/README.md).

No existing mutation entry point, retention job/function, API contract, generated client, frontend, IndexedDB, encryption, PWA policy or dependency is changed. No production recovery operations, snapshot construction, cutover, new admission protocol or Owner resolution tooling exists. P2-1B and all later stages remain unauthorized.

## 2. Implemented storage foundations

[One additive migration](../../apps/api/database/migrations/2026_10_16_000001_create_recovery_foundations.php) adds:

- Nullable applied cursor, baseline-origin generation, explicit coverage epoch, scope and evidence timestamp as an all-or-none group, distinct from served cursor.
- Receipt coverage defaulting to unknown, with coverage/pruning timestamps. New-device INSERTs require unknown receipt coverage. Existing unknown/pruned evidence cannot be promoted to complete by an ordinary update, and a recorded coverage start cannot move backward. Fresh-admission policy is not implemented; complete admission stays blocked.
- `sync_recovery_progress`: committed head, allocation baseline floor, nullable actual-pruning watermark and epoch. **No church rows are initialized.** Runtime cannot INSERT progress or change the baseline floor/epoch. Actual publication/pruning integration is future work; this stage stores no invented watermark.
- Tenant/device/actor-bound `offline_recovery_runs`, distinct input/snapshot digests, explicit NULL-safe sealed metadata, immutable identity/budgets and guarded lifecycle transitions.
- Immutable `offline_recovery_pages`, composite tenant-safe foreign keys and contiguous zero-based page ordinals.

Input/output page counts, combined item counts and actual ciphertext bytes are transactionally accumulated under the run lock. Per-page bounds remain100 items,1MiB declared plaintext and2MiB ciphertext. Per-run maxima are mandatory positive budgets without production defaults; tests choose small synthetic budgets. This does not select workload limits or a production lifetime. Digest correctness, declared application-manifest completeness, actual encryption and snapshot authorization remain future orchestration responsibilities; a database state labelled ready does not prove those application guarantees.

Active-run and applied-origin foreign keys are added only after the run table exists. The application creates the device, creates the run, then switches the active pointer in one transaction. Applied origins bind the same church/membership/device/generation/epoch/scope. Every changed applied-evidence group requires the correct active device run, sealed metadata, current coverage epoch, ready/client_confirmed state and an unexpired deadline. This also applies to additional credit under an already installed origin. Within-epoch regressions and partial evidence are refused. Expired/superseded storage does not erase previously recorded applied evidence or obstruct an unrelated served-cursor update.

All three new tables ENABLE/FORCE tenant RLS. PUBLIC access/execution is revoked. Runtime has SELECT, run/page INSERT and only head/watermark/time column UPDATE on progress. Runtime has no run/page UPDATE or DELETE. Narrow fixed-search-path lifecycle/cleanup functions bind to transaction-local church scope. They are storage primitives, not HTTP authorization or client-application proof. Future callers must reauthorize actor/device/scope.

Cleanup deletes only inactive terminal temporary pages, retaining run metadata, original domain/audit records and device recovery holds. It is not scheduled or connected to existing retention. Historical migrations remain unchanged. `down()` refuses automatic destructive rollback; deployment/rollback and any removal of used evidence require separate approval.

## 3. Unintegrated coordination helper

[ChurchCoordination](../../apps/api/app/Domain/Sync/ChurchCoordination.php) requires the existing outer trusted tenant transaction. It locks the existing church row using `FOR NO KEY UPDATE`, then rereads church status, authenticated verified actor, active membership and role. A changed cached role refuses the operation rather than continuing under stale authority. Owner MFA is revalidated against the fresh user and designated session. An explicitly supplied ministry requires current active ministry and applicable Teacher assignment.

Nested same-transaction calls are safe. Exceptions propagate; the helper neither commits an outer transaction nor automatically retries partial operations. The closure retains responsibility for operation-specific authorization. Future integration must acquire this gate before domain/advisory/progress locks; this helper cannot prove that a caller has not already taken another lock. No production caller invokes it in P2-1A. Its qualification is limited to authenticated, verified active members and existing applicable Owner assurance. P2-1B must separately account for signed-proof invitation acceptance before membership creation and trusted system/maintenance operations; neither can be assumed to use this member-only helper. Existing Owner assurance must be preserved. No integration or redesign of these flows is performed here.

## 4. Verified disposable PostgreSQL boundary

Final environment: PostgreSQL container `msprout-b4-p2-1a-1aae137149-postgres`; separate volume `msprout-b4-p2-1a-1aae137149-data`; internal network `msprout-b4-p2-1a-1aae137149-net`; PHP container shares only that new network namespace. No database port is published.

System identifier `7697277587624869927` differs from the protected cluster. Database `p1_1aae137149_test`, setup/migration role `p1_setup_1aae137149`, restricted runtime `p1_runtime_1aae137149`. The reused P1-shaped environment-variable/role prefix does not mean reuse of a P1 database, volume or credential. All identities/passwords and APP_KEY are generated for this new environment.

The [guard](../../scripts/compatibility/foundations/bootstrap.php) verifies markers, explicit target identities, empty connection strings and PostgreSQL18 system identity before loading the credential-rotating repository bootstrap. Source is a public tracked/new API snapshot; no private environment/browser/SQLite data is mounted. An empty non-symlink `/work/.env` is generated only after verification, with no settings/credentials. Vendor dependencies are read-only archived from the retained B3 container. No protected container is reconfigured.

Negative marker, host and system-identifier probes each exit255 before test bootstrap. Worker processes inherit initialized restricted credentials and recheck the same isolation guard; they do not refresh or rotate credentials. Sanitized receipts and logs remain ignored under `.git/msprout-compat-b4-p2-1a-20261016/`; environment-specific receipts are in `1aae137149/`.

## 5. Fresh qualification

| Gate | Actual outcome |
|---|---|
| Initial focused negative proof | Two tests failed as expected: table/helper absent; original log retained |
| Final explicit foundation suite |41 tests /209 assertions PASS;29.52seconds; no warnings, skips or disabled tests |
| Ordinary API suite through guarded isolated runner | Fresh post-RC339 tests /3,769 assertions PASS;142.18seconds |
| PHP syntax / scoped Pint | Six candidate PHP files PASS |
| Node syntax / explicit Node lint | PASS using installed Node24/ESLint directly |
| Composer strict validation / audit | PASS; no known advisories; non-writable cache warning remains informational |
| pnpm high-severity audit | PASS; no known vulnerabilities |
| Repository structure | Native Git Bash PASS; separate normalized disposable snapshot also PASS |
| Full OWASP scan | Semgrep1.177.0:108 executed rules,550 targets,0 findings; two unchanged historical TSX partial-parser warnings |
| Final changed-input OWASP closure | Prior8-input and test closures retained; latest RC migration/test scan27 rules /2 targets,0 findings/errors |
| Final exact-file secret scan | Gitleaks8.24.3:12 candidate paths,0 leaks; `gitleaks-final.json` |
| References / whitespace / preservation |258 local references,0 errors; exact-file whitespace and `git diff --check` PASS;39 database tables/runtime role,42 protected files,11 stashes and32 frozen assets preserved |

Focused tests are [schema qualification](../../apps/api/tests/Compatibility/RecoveryFoundationSchemaTest.php) and [coordination qualification](../../apps/api/tests/Compatibility/ChurchCoordinationTest.php), using the [restricted worker](../../apps/api/tests/Support/recovery-coordination-worker.php). They are explicitly invoked outside default PHPUnit suite discovery because they require the positive local-isolation guard. No existing suite discovery, assertion, test or workflow is changed. Hosted CI alone would not establish these foundation results.

Positive/negative coverage includes actual database-observed same-church waits, different-church completion, commit/rollback lock release, nested use, real55P03 timeout, deliberately induced40P01 deadlock and a separate whole-operation retry. Authority changes during a wait cover role, membership, assignment, church status, verified email and Owner MFA. Schema tests cover restricted roles, forced RLS, foreign reads/writes/FKs, actor binding, partial evidence, monotonicity, page gaps/duplicates, byte/item/page limits, lifecycle/immutability, active-pointer cleanup refusal, hold preservation and destructive rollback refusal.

The legacy migration experiment first installs only the historical migrations in the verified disposable database, inserts a device with served cursor9000, applies only the additive migration and verifies that applied/receipt evidence remains unknown. No existing development migration is executed.

Only helper-level contention behavior is qualified. Individual case runtimes are not throughput or production latency benchmarks. Same-church load, synchronous mail under existing locks, complete publisher ordering and maintenance interactions remain NOT TESTED.

### 5.1 Interrupted safeguard closure and gate reuse

The previously interrupted run completed successfully:28/159 in `1aae137149/test-1792164081716.log`; its two-file OWASP closure used27 rules with0 findings/errors. Neither result alone qualified the additional cases requested on resumption.

Eleven added cases cover first binding and subsequent applied credit for inactive, different-active-generation, superseded, explicitly expired and deadline-elapsed-still-ready origins, plus foreign-tenant/device references and positive active ready/client-confirmed evidence. The original inactive-ready, wrong-epoch, monotonicity and legacy-migration proofs remain intact. The expiry fixture waits only until its recorded real PostgreSQL deadline; no assertion timeout was increased. Existing applied evidence survives unrelated served-cursor changes even after its origin becomes inactive or terminal.

The failing-before extension is `1aae137149/test-1792194438792.log`:3 safeguard failures (same-origin credit was incorrectly accepted),3 passing first-binding controls and1 fixture closure-capture error. The trigger now removes both same-generation bypasses; the missing fixture capture was corrected without changing assertions. Intermediate closure `1aae137149/test-1792194501309.log` passed35/183. The pre-RC complete focused closure, including different-active-generation and elapsed-deadline controls, is `1aae137149/test-1792194752621.log`:39/195 PASS. Test-input hash receipts accompany every invocation. Initial failures are retained; this is not a clean aggregate of all attempts.

For the pre-RC applied-binding correction, the339/3769 ordinary API result was retained from `1aae137149/test-1792163508097.log`. Existing production inputs/callers are unchanged and never write the new applied fields. The final trigger correction is reached only when that nullable evidence group changes, so it does not invalidate ordinary legacy API behavior. The complete focused suite reruns the additive migration, legacy default/served-update path, RLS, lifecycle and all coordination proof after the correction. Frontend, contract, browser and PWA inputs are unchanged; their published predecessor evidence is retained, not reported as freshly rerun. No B4-P1 destructive reproduction was repeated.

The final changed-evidence predicate is:

```sql
AND NEW.active_recovery_id=r.id
AND r.state IN ('ready','client_confirmed') AND r.expires_at>clock_timestamp()
```

Both previous same-generation alternatives were removed. Unchanged applied fields do not enter this predicate; this preserves recorded historical evidence without granting additional credit to an invalid origin.

Final receipts are `qualification-final.json`, `preservation-final.json`, `references-final.json` and `gitleaks-final.json` in the ignored evidence root. Current source hashes bind these results to this unstaged candidate. No new SHA has been published or hosted check qualified.

Security receipts are `semgrep.json` (full application baseline), `semgrep-closure.json` (all8 foundation inputs) and `semgrep-test-closure.json` (last test extension). Snapshots retain the actual scanned bytes; no parser warning was suppressed.

### 5.2 Stakeholder-targeted receipt coverage review — RC-01 / RC-02

Both gaps were REPRODUCED with actual restricted-role SQL before changing the migration. `1aae137149/test-1792195405243.log` contains2 expected failing negative tests/6 assertions: neither explicit complete coverage on INSERT nor complete-start backdating raised the required database exception. Each test independently verifies INSERT/UPDATE authority and a nonsuperuser, non-bypass-RLS runtime identity.

**RC-01 — REPRODUCED, CORRECTED, VERIFIED.** The device guard now executes BEFORE INSERT OR UPDATE. Its INSERT branch refuses every receipt classification other than unknown (SQLSTATE23514); existing table constraints require unknown timestamps to remain NULL. Tests reject explicit complete history and invented pruned history, then positively exercise a default-unknown runtime INSERT and ordinary served-cursor UPDATE. No fresh-admission protocol or original-event acceptance evidence is introduced.

**RC-02 — REPRODUCED, CORRECTED, VERIFIED.** UPDATE refuses `NEW.receipt_coverage_since < OLD.receipt_coverage_since` whenever the old start is known, including complete/pruned metadata. Existing unknown/pruned-to-complete and pruning-monotonicity protections remain intact. A complete row with unchanged coverage still accepts an ordinary served-cursor update. NULL/default and existing-device migration assertions remain unchanged.

The RC-02 fixture represents hypothetical already established complete metadata only. The isolated migration identity disables only the fixture device trigger within a transaction, seeds that metadata and reenables the trigger before runtime SQL. It does not insert event receipts, prove original-event acceptance, expose an admission path or authorize production bypass. The restricted runtime cannot disable the guard. All database-writing qualification stays inside the original positively verified disposable cluster.

Post-fix complete foundation qualification is `1aae137149/test-1792195460973.log`:41/209 PASS, including both RC cases, additive/legacy migration, RLS, applied-origin safeguards and coordination. PHP syntax/Pint pass for both changed PHP files. `rc-review-20261017/semgrep.json` records27 OWASP rules/2 targets,0 findings/errors. Earlier failed/successful logs and pre-RC final receipts remain preserved.

The new INSERT guard affects an existing persistence entry point, so the pre-RC API aggregate is not used as sufficient proof of this correction. The fresh ordinary API suite passed339 tests/3,769 assertions in142.18seconds: `1aae137149/test-1792195631168.log`. Its recorded source hashes match the corrected migration/test inputs. Frontend/contract/PWA/dependency/structure inputs are unchanged; those valid results remain retained. No original B4-P1 witness is rerun or reclassified as fixed.

This targeted review changes7 existing candidate paths: migration, schema test, harness README, this report and the three knowledge updates. The overall inventory remains12 paths (9 new/3 modified); no path is added. Only the authenticated-member helper boundary is documented; its implementation and production callers are unchanged.

Fresh RC preservation observations are under `rc-review-20261017/database-final.json` (39 protected development tables and runtime-role attributes match the original read-only baseline). Previous final receipts and exact pre-RC candidate source are preserved under `rc-review-20261017/before-*` and `before-source/`; `targeted-review.patch` records the final RC diff. The latest root `qualification-final.json` and `preservation-final.json` bind final candidate hashes. Diagnostics remain ignored and unstaged.

## 6. Failed attempts and closure

- Reused runner initially retained the P1 parent pin and refused before setup; corrected to the authorized parent. A test invocation while initial preparation was still finishing refused because no environment receipt existed. Neither ran database bootstrap.
- Expected initial two-test failures establish absent foundations.
- Final review first reproduced inactive-ready initial binding and closed it at28/159. Resumption extended this to subsequent credit and terminal/foreign origins; the additional failing-before and39/195 final closure are detailed above. No original assertion was weakened, skipped or disabled.
- Initial PL/pgSQL CASE parsing failed during the disposable migration; parentheses corrected. Repeated migrate:fresh revealed functions survive table recreation; migration now recreates its own uniquely named functions safely. Failed logs remain retained.
- Initial worker omitted the Laravel Request needed before SessionGuard creation; diagnosed from a local ignored probe, then supplied the synthetic request. No authentication assertion was removed.
- A failed fixture left disposable worker/transaction cleanup incomplete; cleanup now rolls back the fixture setup transaction and closes owned workers on failure. Only the named P2-1A child processes were terminated; protected resources were untouched.
- Missing empty environment caused dotenv/PHPUnit warnings. The guard now permits only a locally generated empty non-symlink fixture after identity verification; private environment files remain refused. The completed28/159,35/183, final39/195 and339/3769 runs have no such warnings.
- On resumption the existing disposable containers were stopped; the guard refused before bootstrap. The same containers/volume were restarted and the original system identity reverified. An early attempt preceded vendor extraction and failed autoload; no test pass is claimed. The short-expiry fixture override initially lost to PHP array-union precedence, causing a long fixture wait. Only its owned PHP process and subsequently identified disposable PostgreSQL sleep backend were terminated. That backend had retained a relation lock, blocking the next refresh and a diagnostic read; this was a fixture-lock issue, not a demonstrated product defect. A missing closure capture was also fixed. Raw logs and `resume-attempts.json` remain preserved. No protected Docker resource was started, stopped or reconfigured by the agent.
- Docker archive API cannot copy files out of the tmpfs work directory; scoped formatted candidate files were read through docker exec instead. No protected source was overwritten.
- pnpm exec attempted an environment-dependent install and aborted before removal for lack of a TTY. No purge/install override was used; installed ESLint was invoked directly. Initial ESLint CLI global spelling was corrected; no lint rule was disabled. Failed tool logs remain retained.

The original Windows CRLF limitation remains historical context, not claimed fixed; native structure passed in this run. The two full-scan parser warnings remain the unchanged ApplicationScreen/AuthScreen test locations, not new findings or complete parsing claims.

## 7. Exact candidate inventory

Git reports nine new paths plus three modified paths, not approximately11. The complete runner README is part of the approved harness ownership; directory-collapsed status/UI counts are not an exact path inventory. No candidate path was added during the resumption.

Nine new paths:

1. `apps/api/database/migrations/2026_10_16_000001_create_recovery_foundations.php`
2. `apps/api/app/Domain/Sync/ChurchCoordination.php`
3. `apps/api/tests/Compatibility/RecoveryFoundationSchemaTest.php`
4. `apps/api/tests/Compatibility/ChurchCoordinationTest.php`
5. `apps/api/tests/Support/recovery-coordination-worker.php`
6. `scripts/compatibility/foundations/run.mjs`
7. `scripts/compatibility/foundations/bootstrap.php`
8. `scripts/compatibility/foundations/README.md`
9. `docs/qa/compat-01-b4-p2-1a-foundations.md`

Three modified paths: `knowledge/CURRENT_STATE.md`, `knowledge/ROADMAP_STATUS.md`, `knowledge/TESTING_ENVIRONMENT.md`. Total12 paths. Tests were initially drafted under Feature/Sync, then moved while still new/untracked to Compatibility to require explicit isolated execution; disposable stale copies were removed only inside the verified P2-1A snapshot/tmpfs. No historical/test file was moved or deleted.

## 8. Preservation, review and stopping boundary

Final review found zero BLOCKING and zero SHOULD FIX items within P2-1A. The open five B4 product defects remain separately gated future work, not repaired by these foundations. Final fingerprints and reviewed candidate hashes resolve through ignored `preservation-final.json` and `qualification-final.json` under the evidence root. The final protected PostgreSQL observation uses a separate disposable read-only observer (PDO transaction explicitly READ ONLY; no Laravel/test bootstrap), with the private environment mounted read-only solely for this authorized preservation comparison. All39 table hashes and runtime-role attributes match `database-before.json`; see the latest `rc-review-20261017/database-final.json` (earlier `database-final-resume.json` is retained). The guarded test environment never mounts or connects to those protected resources. Protected development39-table/runtime-role fingerprints, private2/local-QA30/backups10,11 stashes,32 frozen assets, other worktrees/branches, main and B1–B4-P1 evidence are checked independently. Protected database observations are read-only preservation work, never test targets. Existing browser stores are unopened; no byte-level browser-store audit is claimed.

The migration is applied only to the independently verified disposable test database. No integration, actual pruning watermark population, production cutover, snapshot builder, API, client reconstruction, event settlement or lifetime setting is activated. B4-01–05 and their eight intentionally failing P1 assertions remain unchanged and open; these passing foundation tests do not repair those defects.

P2-1B must separately integrate all mutation/publication paths, authorize maintenance transaction/audit ownership, qualify contention and preserve lock ordering. Later stages own actual manifests/snapshots, client fencing, installed transitions and final recovery qualification. Four hours remains experimental. No next stage or publication is selected automatically.

**COMPAT-01 B4-P2-1A — YELLOW: STAKEHOLDER REVIEW REQUIRED.** Do not stage, commit, push, merge, deploy or continue without separate stakeholder authorization.
