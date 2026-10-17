# COMPAT-01 B4-P2-1B-A — dormant coordination and publication

## Stakeholder acceptance and guarded publication — 2026-10-17

The stakeholder accepted the reviewed dormant A candidate and separately authorized exactly these 15 files for one `feat: establish B4-P2-1B-A dormant publication foundations` commit and normal feature push from parent `0c984f8cb9c13cc2088efb08c2df62cceda8e73f`. No executable change or production activation is included. The prepublication YELLOW report and every failure/qualification record below remain preserved historical evidence; their staging/publication hold is superseded only by this explicit A publication authorization.

Finalization adds this acceptance notice and current-knowledge status only. All executable/test/harness hashes must match the approved seals. Final reference/secret/whitespace, exact staged-content and read-only preservation checks are refreshed. Actual resulting SHA, committed inventory, Git synchronization and exact-SHA hosted Web/API/Security results resolve through Git and ignored `.git/msprout-compat-b4-p2-1b-a-20261017/publication/{commit,hosted-latest,finalization}.json`. Hosted qualification is determined from those actual new-commit results, never the predecessor checks. At stakeholder authorization no new hosted SHA had been published.

Publication constructs no production caller, changes no SQL execution or legacy-feed grant, and initializes no actual progress/applied/receipt evidence. Session/account authority and all C/B/D/E integration/activation dependencies remain as documented below; all five original B4 defects remain open. **STOP after A publication qualification.** No next unit, recovery activation, genesis, migration/deployment, merge, Late or packs are authorized.


Date: 2026-10-17. **YELLOW: STAKEHOLDER REVIEW REQUIRED.** Bounded A implementation only; finalization remains explicitly held. No staging, commit, push, production migration, caller activation or deployment.

## Checkpoint and authority

Starting HEAD: `0c984f8cb9c13cc2088efb08c2df62cceda8e73f`, `feat: establish B4-P2-1A recovery foundations`, on `feat/mvp-foundation`. Local/upstream/live feature HEAD agreed and staging/worktree were empty before implementation. That published predecessor passed exact-SHA Web/API CI 38985585560 and Security 38985585671; the older P2-1A prepublication YELLOW entries remain historical. This candidate has no new hosted SHA or hosted pass.

The stakeholder selected only coordination contracts and dormant publication. The [modernization roadmap](../superpowers/plans/2026-10-14-unified-modernization-roadmap.md), [compatibility design](../superpowers/specs/2026-10-14-unified-modernization-design.md#6-compatibility-proposal-and-mandatory-proof), [P1 defect witnesses](compat-01-b4-p1-recovery-safety-design.md) and [published P2-1A foundation record](compat-01-b4-p2-1a-foundations.md) retain their unsuperseded requirements. No proposal labeled unresolved is silently activated.

## Exact ownership inventory

15 paths: four modified and eleven new. This inventory was announced before source edits. Local diagnostics, generated snapshots, raw logs and scanner output under `.git/` are excluded.

| Status | Repository path | Purpose |
|---|---|---|
| M | `apps/api/app/Domain/Sync/ChurchCoordination.php` | Primary-gate ordering, fresh authority and live transaction context |
| New | `apps/api/app/Domain/Sync/CoordinatedChurchTransaction.php` | Callback/connection/transaction/church-bound capability |
| New | `apps/api/app/Domain/Sync/CoordinatedChangePublisher.php` | Dormant internal append abstraction |
| New | `apps/api/database/migrations/2026_10_17_000001_create_dormant_change_publisher.php` | Additive owner-only SQL append boundary |
| New | `apps/api/tests/Compatibility/CoordinationContractTest.php` | Ownership, ordering, lifecycle and savepoint proof |
| New | `apps/api/tests/Compatibility/DormantPublisherTest.php` | Payload, privilege, metadata, atomicity and sequence proof |
| New | `apps/api/tests/Compatibility/PublisherConcurrencyTest.php` | Independent-backend ordering, rollback, deadlock and authority limits |
| New | `apps/api/tests/Support/coordinated-publisher-worker.php` | Guarded fixtures and IPC worker |
| New | `scripts/compatibility/publication/run.mjs` | New independently pinned isolated runner |
| New | `scripts/compatibility/publication/bootstrap.php` | Affirmative pre-bootstrap database guard |
| New | `scripts/compatibility/publication/README.md` | Reproduction, trust boundaries and evidence limitations |
| New | `docs/qa/compat-01-b4-p2-1b-a-dormant-publication.md` | This report |
| M | `knowledge/CURRENT_STATE.md` | Selected A candidate and hold |
| M | `knowledge/ROADMAP_STATUS.md` | Published predecessor and A-only status |
| M | `knowledge/TESTING_ENVIRONMENT.md` | Fresh versus retained qualification and isolation |

## Implemented contract and dormant boundary

The helper requires a trusted outer TenantContext/Laravel transaction, acquires `FOR NO KEY UPDATE` at primary transaction level1, and rejects an initial gate after advisory/domain locks. READ COMMITTED is required so post-wait reads cannot reuse a repeatable-read snapshot. Active church, Auth/request identity, current User verification, active membership, current role and applicable Owner MFA are checked after acquisition. A changed cached role causes refusal/restart; cached authority never replaces the fresh models passed downstream. Optional ministry authorization remains unchanged.

`CoordinatedChurchTransaction` is registered with its issuing helper only during the callback. A clone, expired callback, another church/scope, replaced PDO transaction or new backend/transaction cannot reuse it. It checks PDO object identity, active transaction, tenant/GUC scope, backend PID and PostgreSQL transaction ID. This is more than an in-memory flag. Nested Laravel savepoints may use an existing primary context; primary acquisition inside a savepoint is refused. The primary gate remains until the outer transaction ends, including after callback exit. Exceptions propagate; no helper/publisher commit, partial retry or fabricated success is added. Trusted callers must retain Laravel transaction ownership and let operation failures unwind; raw SQL savepoint/transaction manipulation is outside the qualified calling contract.

The new SQL function uses a fixed `pg_catalog` search path and schema-qualified relations. It refuses mismatched tenant/transaction, inactive church, missing/unqualified progress, wrong epoch, unsupported required fields/actions and adverse sequence caching. It locks church before progress, allocates from the existing feed sequence, inserts the unchanged supported representation, then advances head in the same outer transaction. Allocation gaps leave `pruned_through` untouched. Target ministry/member composite FKs retain tenant isolation.

SQL EXECUTE is revoked from PUBLIC and the ordinary runtime. No role, table or public API is introduced. A narrowly bounded SECURITY DEFINER body provides no arbitrary SQL or initialization operation. Existing forced RLS, runtime role attributes and legacy feed INSERT/sequence/progress-update privileges are preserved. The future PHP append path requires a live context and an explicitly supplied matching server-qualified epoch; it has no legacy fallback.

**Trust limit:** expected transaction ID is not an authentication credential. A separately privileged SQL executor still needs a qualified authority/caller contract. SQL reacquires the gate before its own progress/allocation work, but cannot prove that an arbitrary privileged caller acquired all earlier domain locks in the correct order. Normal runtime has no EXECUTE; future C/B/E activation must qualify that integration and remove direct publication/head bypass privileges after drainage. These tests do not establish an application-wide B4-04 fix.

## Legacy behavior and integration map

`TenantContext`, `PublishAttendanceChange::handle`, `ManageTeachers::assign`, `ChangeFeedEntry`, existing attendance actions, invitation flow, maintenance jobs, Fortify, contracts and frontend are unchanged. Source inspection finds no production caller of the coordination helper or dormant publisher. Actual old-producer representations are compared with the new path in disposable fixtures for attendance upsert and targeted assignment tombstone. The new method only copies that already-supported representation; it does not construct new feed entities or infer future business semantics.

No actual church progress is initialized. Test-only setup seeds hypothetical metadata and temporarily grants EXECUTE only to the specifically guarded disposable runtime. Teardown revokes it. This fixture setup is neither old-writer drainage nor original-event acceptance evidence. Legacy traffic continues using its existing grants and uninitialized metadata.

## Independent PostgreSQL isolation

The [new runner and guard](../../scripts/compatibility/publication/README.md) are separate from the unchanged historical foundations runner and its pin. This run uses:

- PostgreSQL container `msprout-b4-p2-1b-a-8bf440074c-postgres`; PHP namespace `msprout-b4-p2-1b-a-8bf440074c-php`.
- Internal network `msprout-b4-p2-1b-a-8bf440074c-net`; independent volume `msprout-b4-p2-1b-a-8bf440074c-data`; no published database port.
- PostgreSQL18 system identifier `7697431057611870253`, independently verified different from protected development.
- Isolated database `pa_8bf440074c_test`, setup `pa_setup_8bf440074c`, restricted runtime `pa_runtime_8bf440074c`; fresh credentials/APP_KEY remain undisclosed.
- Explicit marker/name/system checks run before destructive bootstrap. Empty/fallback DB URLs, loopback and generated-empty dotenv restrictions are enforced; workers probe the same guard without bootstrapping roles again.

Public source, retained vendor archive and current proof directory are mounted independently; private environments, development volume and browser data are absent. A separate preservation-only observer reads the protected database in a READ ONLY transaction, without Laravel or any test bootstrap. No test process has protected development credentials.

All local receipts below are relative to ignored `.git/msprout-compat-b4-p2-1b-a-20261017/`. `preflight.json`, `database-before.json`, `environment.json` and `8bf440074c/{isolation,guard}.json` establish the boundary. Individual `test-inputs-*`, `result-*` and `test-*` retain source identity, commands and raw outcomes.

## Qualification matrix

The initial combined focused run and ordinary API aggregate passed. Later changes hardened only new fixture guards and strengthened one transaction-identity assertion; their affected closures pass. Earlier failed attempts remain preserved and are not aggregate passes.

| Guarantee | Concrete proof owner |
|---|---|
| Primary ordering and trusted outer ownership | CoordinationContract: savepoint/advisory/domain/isolation refusals |
| Capability expiry and connection/scope identity | CoordinationContract: fresh models, clone/foreign scope, replaced transaction, exception/retry |
| Primary gate survives nested rollback and callback exit | CoordinationContract: nested savepoint plus independent blocked worker |
| Missing/incorrect metadata, scope, transaction and unsupported data refuse | DormantPublisher: restricted-role negative matrix |
| SQL privilege, forced RLS, fixed search path | DormantPublisher: catalog assertions, actual denied execution and legacy positive control |
| Allocation/insert/head rollback and domain atomicity | DormantPublisher: test-only failure triggers, outer failure/commit, nested publication rollback |
| Same church cannot overtake paused uncommitted append; another church proceeds | PublisherConcurrency: IPC barriers plus `pg_blocking_pids` and invisible uncommitted rows |
| Whole-operation retry and real deadlock | PublisherConcurrency plus unchanged P2-1A timeout/deadlock tests |
| Role/member/church/assignment/email/MFA changes during waits | Unchanged P2-1A ChurchCoordinationTest |
| Global User sharing and post-check account/session uncertainty | PublisherConcurrency: two churches and deleted synthetic session limitation witnesses |
| Adverse sequence cache and harmless gaps | DormantPublisher: new CACHE8 witness, publisher cache refusal, no sequence reset/pruning inference |
| Existing applied/receipt conservatism, RC-01/02 and migration preservation | Unchanged P2-1A RecoveryFoundationSchemaTest |

| Gate | Actual result and receipt |
|---|---|
| Initial combined focused qualification | **81 tests/418 assertions PASS**,80.31s; `8bf440074c/test-1792208912733.log`. Includes all 41 unchanged P2-1A cases. |
| Final affected new fixtures | **41 tests/213 assertions PASS**,41.75s; `8bf440074c/test-1792209454370.log`. Includes the additional foreign-Laravel-target refusal. |
| Strengthened transaction identity | **1 test/1 assertion PASS**,3.90s; `8bf440074c/test-1792209681703.log`. Restores the same church GUC after replacing the PDO transaction, so scope mismatch alone cannot make it pass. |
| Ordinary API aggregate | **339 tests/3,769 assertions PASS**,312.23s; `8bf440074c/test-1792209092647.log`. No application/migration change follows this run. |
| PHP syntax and style | Full syntax/full Pint PASS; final fixture guard closure and last identity-test Pint/syntax PASS. `8bf440074c/{syntax,pint,bootstrapPint,pint-closure,pintXid,syntaxXid}.log` and per-file final syntax logs. |
| JavaScript | New runner Node24 syntax/ESLint PASS; wrong working directory refused before Git/Docker/bootstrap. `guard-negative-root.log`. |
| Independent bootstrap guards | Wrong marker, host, system identity, URL and database all refuse; `8bf440074c/guard-negative-*.log`. No credential-rotating bootstrap executed in those negatives. |
| OWASP application baseline | **Zero findings**,487 scanned targets; `semgrep.json`/`semgrep.log`. Two unchanged PartialParsing warnings in ApplicationScreen.test.tsx8 and AuthScreen.test.tsx9 remain limitations. |
| OWASP trust-boundary closure | **Ten sources, zero findings/errors**, including all new PHP test/helper sources and runner/bootstrap: `semgrep-closure.json`, `review-source-inputs.json`. Default scan exclusions omitted PHP test paths; neutral-path copies preserve exact bytes and record their source/hash mapping. |
| Final identity-test scan | **One source, zero findings/errors**; `xid-closure/{inputs,semgrep}.json`. No application scan guarantee was invalidated by that test-only addition. |
| Dependencies | Composer strict validation and audit PASS (`8bf440074c/composer.log`); pnpm audit reports no known vulnerabilities (`pnpm-audit.log`). Composer's read-only cache warning did not prevent validation/audit and was not suppressed. |
| Structure | Native `scripts/verify-structure.sh` PASS. No normalization or structure/workflow edit. |
| Source-secret and documentation closure | Gitleaks: **684 tracked/new public source inputs, zero leaks**, `gitleaks.json`/`gitleaks-inputs.json`. Exact current15-path inventory, references/anchors/structure/whitespace: **259 references, zero errors**, `references-final.json`/`preservation-final.json`. Final documentation-only edits receive an exact15-path source-secret closure; ignored/private/generated material is excluded. |

These runs cover **82 distinct focused cases**. The overlapping81-case run,41-case affected closure and1-case strengthened probe are not summed into a fabricated clean82-case aggregate or combined assertion total. Deadlock-victim-dependent assertions may vary between runs. The original41 P2-1A cases remain valid from the combined pass because subsequent edits only affect new fixtures outside their ownership; the ordinary API suite excludes Compatibility discovery and has unchanged application inputs.

Frontend/browser/PWA/type/lint/build and LF contract guarantees are retained from the qualified predecessor by exact unchanged inputs; no fresh browser or installed-client test is claimed. The documented Windows raw-CRLF contract-check limitation remains unchanged. This task adds an internal SQL routine, with no HTTP schema/wire expansion; OpenAPI and generated client remain byte-preserved.

## Preserved failure ledger

All raw attempts remain in `8bf440074c/`; later successes do not rewrite them.

1. `test-1792197944731.log`: nine expected-red tests, four assertions. Existing helper failed to refuse late/savepoint primary gates; new context/function were absent.
2. `test-1792208234618.log`: nine passes/one failure,42 assertions. PHP arrow capture copied the fixture variable, so the outer reference remained null; corrected explicit closure retains the original lifecycle assertion.
3. `test-1792208584857.log`:74 failures/zero assertions. New function survived fresh-table rebuild; `CREATE FUNCTION` failed duplicate-name replay. New migration now uses `CREATE OR REPLACE`, matching existing routine migrations.
4. `test-1792208598339.log`:14 passes/one failure/23 unexecuted,50 assertions. ACL substring check incorrectly matched the owner's EXECUTE grant. Replaced with `aclexplode` grantee/owner comparison, explicitly rejecting every non-owner grant.
5. `test-1792208644922.log`:16 passes/one failure/22 unexecuted,63 assertions. Second church fixture changed the active test actor; restored the original actor so the SQL refusal, rather than an earlier membership refusal, is actually exercised.
6. `test-1792208679202.log`:38 passes/one failure,189 assertions. Deliberate ministry lock blocked the publisher's FK check before its IPC barrier. Only the positively identified worker in this new disposable container was stopped; receipt `fixture-barrier-interruption.json` preserves that intervention. The fixture now uses the intended post-publication User-lock inversion and bounded IPC/statement deadlines. No assertion or product timeout was relaxed.
7. `test-1792208812817.log`: the subsequent 80-case run passed 66 and failed 14,358 assertions: the unchanged historical migration fixture deliberately omitted the recovery table; the new function's `%ROWTYPE` declaration required it at CREATE time. Remaining schema cases inherited that failed fixture state. Using a generic `record` in the new migration removes compile-time table coupling while runtime metadata checks remain fail-closed. Historical migration/tests/guard remain unchanged.

Final review also strengthened the new fixture boundary: helpers require an affirmative identity re-probe and matching Laravel runtime/migration configurations before refresh, seeding, grants or cleanup. The added negative substitutes a database name in local configuration and observes refusal before connecting or writing; it does not connect to development. This test-only correction and the root-directory guard do not invalidate the passing ordinary API aggregate. The final identity-test addition and affected scanner/style closures are explicitly reported above; no application code was changed to obtain the later passes.

No skipped/disabled assertion, hidden failed aggregate or invented browser pass is permitted. Subsequent closure receipts identify final inputs and actual outcomes.

## Deferred ownership and activation decisions

**A → C → B → D → E is conditionally safe as construction/qualification order, not permission to activate each intermediate unit.** A supplies a dormant boundary. C must qualify distinct authority and lock ownership before B integrates mutations. B/D may prepare caller conversion but cannot route normal writes to uninitialized progress; E must coordinate final initialization, privilege changes and activation after complete old-writer drainage. No partial stage establishes committed-head coverage.

| Later unit | Required responsibility; not implemented here |
|---|---|
| C | Fresh authenticated-member/session/recent-auth/Owner assurance; safe global User writer coordination; signed-proof invitation authority before membership; trusted system authority including inactive churches. The deleted-session and post-check email witnesses prevent a completeness claim. No global User lock inversion or fabricated actor is acceptable. |
| B | Gate before all attendance/event advisory and domain locks; integrate supported attendance/assignment producers and atomic audit/receipt outcome; qualify whole-operation retry without repeating external effects. Preserve current private synchronous invitation email until separately qualified. |
| D | Per-church maintenance transaction boundaries, tenant-safe audit/partial-failure semantics, active/inactive eligibility and retention/recovery holds. Do not infer approval to alter retention policy or mail behavior. |
| E | Verify drainage of all old web/queue/invitation/maintenance writers and cached connections; qualify CACHE1; initialize trusted epoch/floor/head conservatively; withdraw direct feed/sequence/head bypass rights and grant only the reviewed execution path; qualify every caller before activation. Actual pruning evidence remains unknown unless proven; allocated floor is not committed head. |

**Genesis design only:** future C owns platform/trusted authority; B owns the eventual `ApproveChurchApplication` provisioning integration; E owns activation and genesis/old-church cutover tests. The proposed post-cutover genesis must create metadata atomically with church/Owner provisioning using a trusted fresh epoch, no inferred receipts/applied history and a qualified global allocation boundary. It must not initialize from a device's served cursor. Exact genesis floor acquisition and deployment/cutover ordering remain stakeholder-reviewed E prerequisites. `ApproveChurchApplication` is unchanged; no genesis rows are created here.

All original B4-01–B4-05 defects remain open. Complete snapshots/recovery, retention changes, installed-client transition, B5/B6, Late, Packs06–12, merge/deployment and later units remain excluded. Late details and unapproved recovery/cutover mechanics retain their actual PROPOSED/NOT TESTED status.

## Final review and preservation

Source/diff review found **zero remaining BLOCKING and zero SHOULD FIX findings within A**. Migration replay, historical-schema coupling, fixture identity/barrier/ACL errors and missing fixture-target defense are closed through the disclosed proofs. No existing test was edited, skipped, disabled or weakened; no timeout was increased to conceal failure. New worker deadlines bound failures and do not change product timing or safety.

Preservation-only before/after READ ONLY observations match all 39 development-table fingerprints and runtime-role attributes (`database-before.json`, `database-final.json`). Protected private/QA/backup files, 11 stashes, 32 frozen assets plus their two manifests, 14 protected refs and other worktree identities are compared with the published predecessor; exact final inventory/reference/hash results resolve through `preservation-final.json` and `references-final.json`. The eight original intentionally failing P1 safety witnesses remain preserved, not marked passing. No existing browser/IndexedDB store was opened; preservation is by non-access, not a fabricated byte-level browser audit.

The unchanged local main remains `d6c66694a8acc252815a088ada3ef8703340b038`; tracking/live main remains `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f`. Local/upstream/live feature remain the starting SHA with ahead/behind 0/0. No stage/commit/push or history manipulation occurred. Current candidate has no hosted Web/API/Security result; predecessor successes are separately identified above.

**INFORMATIONAL / ACTIVATION BLOCKED:** session/recent-auth/account fencing, signed invitation/system authority, all-writer ordering, maintenance/audit semantics, cache/drainage/cutover, direct-grant withdrawal and conservative genesis require later reviewed units. Ordinary runtime cannot activate this SQL path. No claim of security completeness, initialized production progress or B4-04 resolution follows from these isolated tests.

**COMPAT-01 B4-P2-1B-A — YELLOW: STAKEHOLDER REVIEW REQUIRED**
