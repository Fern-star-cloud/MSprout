# COMPAT-01 B4-P2-1B B+D+E — consolidated integration review

**COMPAT-01 B4-P2-1B-B+D+E — YELLOW: BDE-SEC-01 CLOSED, FULL CANDIDATE READY FOR STAKEHOLDER REVIEW.** Unstaged and unpublished. Date: 2026-10-19, Asia/Taipei. The stakeholder authorized B→D→E continuously as one candidate. Publication remains separately held. No next stage, deployment or protected operation is authorized.

## 0. Stakeholder SQL security review — CURRENT, supersedes prior publication qualification

**BDE-SEC-01 CLOSED in the qualified source candidate;0 BLOCKING/0 SHOULD FIX findings. Publication remains held.** The stakeholder's final integrated authorization approves the independent maintenance identity and supersedes the earlier architecture-decision stop. This remains the same B+D+E candidate. Protected deployment/activation is not authorized.

### Corrected SQL and process boundary

A forward additive migration, `2026_10_19_000002_isolate_maintenance_authority.php`, revokes PUBLIC, web runtime and other non-owner grants on all five new helpers and both inherited cleanup signatures. Only a separately provisioned, independently authenticated restricted maintenance LOGIN receives EXECUTE on the five current helpers. The two legacy global cleanup signatures remain owner-only; production jobs do not invoke them. Invalid principals abort; absent provisioning leaves cleanup unavailable. Published C migrations remain byte-identical to the parent. The SECURITY DEFINER owners remain the reviewed migration principal, with fixed pg_catalog search paths and qualified relations; application roles cannot own/replace the functions or inherit their owner. Owner credentials are not worker credentials.

The dedicated process uses its independently authenticated identity as the one default connection, binding domain mutations, church/User locks and canonical audits to their original owning transaction. No runtime SET ROLE, connection fallback, borrowed User or spoofable GUC authorizes maintenance. Cleanup purposes require the maintenance identity; birthday purposes retain the original runtime and active-only policy. Per-church rollback and earlier committed successes remain intentional.

The real `maintenance` entrypoint receives a worker-only private read-only password mount, checks process configuration before Laravel/config caching, and starts fixed schedules or a fixed one-shot command. It never consumes the shared web-writable queue. Ordinary services reject misplaced maintenance/migration credentials; privileged HTTP is refused before controllers. No new HTTP endpoint, dependency or shared privileged credential is introduced. See the [operational contract](../operations/coordinated-publication.md#maintenance-identity-and-process-isolation). Target infrastructure/secret distribution is NOT TESTED and remains a separate deployment prerequisite, not a local production-isolation claim.

### Failing-before and passing-after evidence

The original seven denial regressions are retained, strengthened with unchanged-record/audit checks, and all now pass. Original 7-fail/7-pass/97-assertion evidence remains under `maintenance-security-qualified.log`; it is never reported as a clean pass. The first corrected focused run had 23 passes and five fixture/assertion failures: historical-C restoration used a nonexistent migration setter, leaving old ACLs visible to subsequent assertions, and two reference captures used PHP arrow-function value capture. Corrected restoration uses the explicit owner test connection and reference-owning closures. The subsequent affected run passed 28 tests/209 assertions. The final aggregate includes a further missing-provisioning case and four no-side-effect assertions for each of the seven denial cases.

Four separate-container process proofs passed in `bcc5870beb/process-isolation-c7f6bd91ca/result.json`: ordinary web HTTP200 with no maintenance secret/environment and four SQL/catalog/SET ROLE denials; real maintenance entrypoint success with independent authentication and privileged HTTP503; web with a misplaced secret rejected78; worker missing its secret rejected78. Private PID namespaces, no Docker socket, no privileged mode, no owner credentials, no shared private mount and explicit environment scope are verified. Generated disposable secrets are excluded from source/receipts. That first proof predates restoration of private-cache scheduler overlap protection; the separate b988b32542 proof below qualifies the final entrypoint/cache/schedules. PHP import/style normalization is behavior-equivalent.

### Final qualification and review

| Gate | Actual outcome and exact evidence |
| --- | --- |
| Full affected backend/C/foundations/BDE aggregate | **479 tests / 4,697 assertions PASS**,308.77s, `bcc5870beb/result-1792374129063.json` and its input seal/log. Covers tenant isolation, membership/session authority, retention/audit, publication/cutover and all10 BDE concurrency proofs. |
| Final targeted security closure | **24 tests / 211 assertions PASS**,12.98s, `security-remediation-least-privilege-focused.log` and its runner receipt. Includes actual inherited-membership rejection and the final owner-only legacy ACL and verifies empty/wrong church scope as the authorized maintenance role, preserving the original7 runtime denials. |
| Isolated process/entrypoint proof retained after unused legacy-grant removal | **4/4 PASS**, `bcc5870beb/process-isolation-b988b32542/result.json`; same4 cases plus private file cache and both fixed schedules' overlap protection. Original process proof remains retained separately. |
| Real Chrome/native-WebKit integration | **8/8 PASS**,196.26s, Chrome/native WebKit at390/1440px and revoked/recovery conditions. `browser-security-final-01/results.json`:0 skipped,0 unexpected,0 flaky;16 screenshots. Actual acknowledgments, visible recovery refusal, exact encrypted records/outbox identity and axe assertions are retained. |
| Full Pint and syntax | **294 PHP files PASS**; all38 candidate PHP paths syntax PASS; both changed Node runners and shell syntax PASS. `security-remediation-minimum-pint-test.log` and `security-remediation-syntax.log`; the last three changed PHP inputs also pass the full final aggregate after formatting. |
| Full application OWASP | **0 findings,508 scanned inputs**, with the same two TSX PartialParsing warnings in ApplicationScreen/AuthScreen tests; `security-remediation-semgrep.json`. No new or security-critical input parse failure. SQL semantics are proven by actual SQL/ACL/RLS tests, not this scanner. |
| Neutral focused OWASP | **47 inputs,0 findings,0 errors**; final5 changed source inputs additionally **0 findings/0 errors**, `security-remediation-{neutral,late-owasp}.json`; final3 migration/test inputs also0 findings/0 errors in `security-remediation-minimum-owasp.json`. |
| Gitleaks | Public source mirror742 files,0 leaks; final54-path candidate0 leaks, with the last report-only metadata delta separately scanned. Private generated fixtures are excluded. |
| Dependencies | Composer strict validation and locked audit PASS (read-only cache notice retained); pnpm high-level audit0 advisories. `security-remediation-{composer,pnpm-audit}.log`. No dependency changes. |
| Retained frontend/PWA/build/contracts | Prior813 frontend tests/82 files and8 real PWA cases; type/lint/build/contract/dependency baseline retains its seal justification. Existing frontend source, service-worker/update/encryption inputs, contracts and lockfiles exactly match parent. Only the new BDE browser proof/config are additional web paths. No new UI or third-party CAPTCHA validation is claimed. |
| Documentation/structure/whitespace/final secrets | **PASS:**7 documents/285 local references,0 errors; current LF public-mirror structure PASS; tracked git diff --check PASS; all29 new paths have0 whitespace diagnostics. No-index exit1 represents expected file differences. Raw Windows CRLF limitation remains unchanged. |

The full aggregate qualifies the changed shared SQL/authorization/connection surface. The final479-case aggregate runs after the minimum-grant migration, all test additions and formatting; every API source hash matches its captured input seal. The prior478/4,694 pass and22-case closure are retained intermediate evidence, not substituted for this final aggregate. The4-process proof covers the final scheduler/entrypoint/cache; the browser rerun covers ordinary HTTP. Only unused privileged legacy-wrapper grants and their owner-only test adapters changed after those independent proofs, leaving their exercised credentials/functions/HTTP/storage paths unchanged. Frontend/PWA suites do not consume the changed privileged-worker implementation and their pure frontend inputs are unchanged; they are retained, not rerun.

Final least-privilege review found the two legacy global signatures have no production caller. Their maintenance EXECUTE grants were removed; owner-only fixture calls preserve internal SQL compatibility assertions, while actual worker/retention tests authenticate the independent role and exercise only current helpers. This stricter ACL prompted a new full affected aggregate. Process/credential isolation, actual entrypoint/cache/schedule proof and ordinary browser HTTP evidence remain valid: none invokes a legacy signature, and all their executed privileges/inputs are otherwise unchanged.

No assertion was skipped/disabled, no timeout was increased, and no valid denial was relaxed. The old runtime-cleanup privilege expectation is deliberately corrected to denial under the approved requirement. The generic trusted-callback rollback fixture now writes a canonical audit rather than renaming a church, because maintenance intentionally lacks that unrelated domain permission; callback rollback, expired capability and cleared scope remain asserted, strengthened with actual audit absence. The original pre-security ZIP/report/results are preserved.

### Preservation and operational limits

Only independently identified PostgreSQL18 system7698056409333256231, database pc_bcc5870beb_test, BDE-labeled container10841529b0ce, volume msprout-b4-p2-1b-bde-bcc5870beb-data and its isolated internal network were reconstructed by the existing guarded test bootstrap. Changes are disposable role creation/password rotation, isolated migrations/fixture resets and two four-container private process proof runs. No protected reconstruction is needed. The fresh READ ONLY protected observer matches all39 original fingerprints, runtime attributes and migration state. Protected files/stashes/backups/frozen assets/worktrees are independently checked; final results follow below.

All five original B4 recovery defects remain OPEN. Snapshot/client reconstruction and end-to-end recovery remain mandatory before activation. Normalized-email target collision preflight remains required. No protected role provisioning, migration, grants, credential rotation, deployment or publisher activation occurred. No staging/commit/push or later stage is authorized.

### Historical security-review stop before the integrated remediation authorization

Historical receipt only: all five following subsections describe the pre-remediation stop, superseded by the approved correction above. They grant no current task permission.

**At that checkpoint BDE-SEC-01 was CONFIRMED and BLOCKING.** The current candidate must not be published. No SQL permission correction has been applied: the current shared database identity cannot distinguish trusted worker calls from ordinary direct SQL. Preserving jobs while adding independent authority requires a role/credential/connection decision, triggering the stakeholder's architectural-dependency stop. This is the same B+D+E candidate, not another roadmap stage.

#### Reproduction and actual privileges

Only the existing independently guarded PostgreSQL18 BDE cluster (system7698056409333256231, pc_bcc5870beb_test) was used. Tests call the ordinary restricted runtime connection directly, with no MaintenanceCoordinator, trusted system context, authenticated worker or migration identity for the calls under attack. The separate owner connection creates disposable fixtures and observes committed effects only.

All five reviewed functions have SECURITY DEFINER=true, ordinary-runtime EXECUTE=true and PUBLIC EXECUTE=false. Their owner in this disposable cluster is superuser/BYPASSRLS; the caller is neither. Forced RLS remains enabled on churches/memberships: direct runtime queries without a scope return zero rows, and direct operational DELETE privilege is false. Definer execution nevertheless accesses/deletes rows with its owner's authority. Production owner attributes were not inspected or changed; no protected database was contacted in this review.

| Direct ordinary-runtime SQL call | Actual result without a trusted maintenance worker |
| --- | --- |
| maintenance_church_ids() | Succeeds without church scope; returns both synthetic churches despite direct churches SELECT returning0. |
| protected_user_has_memberships(bigint) | Succeeds without scope; arbitrary hidden User returns true and nonexistent User returns false while direct membership SELECT returns0. |
| prune_global_operational_data(...) | Succeeds; deletes1 old operational event and1 global security event; canonical audit delta0. |
| prune_church_operational_data(...) | Empty/mismatched church setting correctly denies42501. Caller SET LOCAL/set_config to the target church succeeds and deletes1 foreign church security event; audit delta0. A caller-set maintenance marker adds no real authority. |
| purge_church_revoked_device_data(...) | Caller-controlled target church setting succeeds and deletes1 expired foreign authorization; audit delta0. |
| Existing prune_operational_data(...) wrapper | Succeeds without trusted worker/scope; deletes1 operational and2 security events across scopes; audit delta0. Revoking only new helpers would leave this owner-executed wrapper path. |
| Existing purge_revoked_device_data(...) wrapper | Succeeds without trusted worker/scope; deletes1 expired authorization; audit delta0. |

Successful calls raised no SQL exception; the negative regressions expected SQLSTATE42501 and therefore fail. Cutoff minima and conservative feed logic still operate, but these are retention rules, not caller authorization. The private coordinated-publication flag does not disable these SQL grants. This proves the direct database-role boundary, not a newly demonstrated anonymous HTTP exploit.

#### Published C comparison and missing test coverage

The five named helper entry points are new in B+D+E. Unscoped church enumeration and the unrestricted membership oracle are newly introduced helper surfaces. Targeted/global helper deletion entry points are new, but broad direct maintenance authority and unaudited deletion are **inherited** through the two runtime-executable SECURITY DEFINER cleanup functions in published C's 2026_09_29_000004 operations migration.

Actual published-C function bodies were copied from the unchanged, HEAD-verified migration, installed temporarily only in the BDE disposable schema, and called as runtime. They deleted1 operational event,2 security events and1 expired authorization with zero canonical audits. Relevant EXECUTE grants match the published migration. The test restores the candidate definitions in finally; a subsequent READ ONLY catalog check confirmed restoration. This is exact relevant-function/grant comparison on a compatible schema superset, not a claim that the whole frozen C application/schema was rebuilt or that any protected C environment was operated.

The original five maintenance tests covered retention, receipt flags, partial-success/audit rollback and PHP worker rejection. They did not assert database denial of direct runtime entry. C/cutover tests did not cover these new maintenance grants. Their prior passes did not establish SQL worker authority.

#### Focused evidence and current gate

- Initial security run: **7 failed,7 passed /87 assertions**,15.07s, maintenance-security-before.log.
- Final formatted/permission-matrix run: **7 failed,7 passed /97 assertions**,16.41s, maintenance-security-qualified.log. All five original maintenance tests pass; the forced-RLS/ACL controls and actual C-definition comparison pass. Seven new denied-direct-call regressions fail because calls succeed. No assertions were skipped, weakened or relabeled as successful.
- Ignored per-case receipts: bcc5870beb/sql-boundary-*.json; controls include all five actual ACL/definer-owner values. Both attempts and input seals are retained. Catalog restoration was checked without application mutation.
- Supporting checks: changed witness PHP syntax/Pint PASS; focused OWASP1 target,0 findings/0 parse errors; Gitleaks on the six closure paths0 leaks;276 documentation references/anchors,0 errors; tracked/new-file whitespace PASS. Scanner passes do not model or close the SQL authority defect.
- No production SQL, migration, application behavior, grants or activation setting changed. Only regression tests and current reporting changed. The historical462/4,524 and browser8/8 results remain valid evidence of their original coverage; they **do not qualify the newly exposed boundary or permit publication**. No passing-after correction is claimed. Broader backend/concurrency/RLS correction qualification is deferred until a real, authorized correction exists; rerunning it now cannot close seven known failing boundaries.

#### Why an architectural decision is necessary

PHP worker and web/ordinary SQL calls currently use the same database identity and default connection. PostgreSQL sees the same session_user/current role/ACLs. A function cannot infer that MaintenanceCoordinator ran. A worker-purpose/church/application-name GUC, transaction marker or advisory lock can be set/acquired by the same runtime caller and cannot establish independent authority. SECURITY INVOKER alone loses the cross-church visibility/deletion required by legitimate jobs; granting broad runtime DELETE or borrowing migration-owner credentials would weaken security.

**Recommended approval:** a narrowly privileged, separately authenticated maintenance database identity unavailable to the web runtime, with no web-to-worker role membership/SET ROLE path. Explicitly revoke ordinary runtime EXECUTE on all affected new and inherited entry points. Keep worker operation, church/User coordination, required audits and each church's transaction on the same qualified connection; preserve forced RLS, restricted caller privileges, cutoffs and partial success. Credential provisioning/distribution and connection/identity binding require stakeholder approval; no role, credential or protocol was introduced here.

**Alternative requiring explicit service-impact approval:** revoke runtime access and suspend affected maintenance before deployment until independent worker authority is approved. This deliberately reduces existing maintenance functionality and cannot satisfy the current preserve-jobs requirement without that decision. Revoking only the five new functions, adding a spoofable marker, or relying on PUBLIC revocation does not close the legacy paths or establish worker authority.

**Current review queue:1 BLOCKING (BDE-SEC-01),0 SHOULD FIX. Publication recommendation: DO NOT PUBLISH until the authority choice is approved, implemented and passing-after SQL/RLS/audit/maintenance/concurrency and effect-based broader qualification succeeds.** Production activation and normalized-email collision preflight restrictions remain mandatory; original B4 recovery defects remain open.

#### Exact changes in this security-review closure

The overall candidate remains **38 paths:17 modified,21 new**; no path was added. Relative to the source-review ZIP, exactly these six paths changed:

1. apps/api/tests/Compatibility/IntegrationMaintenanceTest.php — seven denial witnesses, RLS/ACL controls and published-C comparison; original tests/assertions preserved.
2. docs/qa/compat-01-b4-p2-1b-bde-integration.md — this current blocking review and qualification correction.
3. docs/operations/coordinated-publication.md — explicit SQL-authority deployment block.
4. knowledge/CURRENT_STATE.md — current blocker and publication hold.
5. knowledge/ROADMAP_STATUS.md — same B+D+E task blocked, no new stage.
6. knowledge/TESTING_ENVIRONMENT.md — actual failing/passing results, isolation and retained evidence.

The original Downloads source-review ZIP is preserved unchanged as pre-security evidence and no longer represents the current candidate. No replacement package, staging, commit, push, production activation, protected migration or database grant change is authorized or performed.

## 1. Checkpoint and authority

Repository `Fern-star-cloud/MSprout`, branch `feat/mvp-foundation`, unchanged published parent `c5e30e1f3b392a154ac5c64aa39b3ca96c6e6361` (`feat: integrate B4-P2-1B-C authority safeguards`). Initial local, tracking and live feature HEADs agreed, ahead/behind 0/0, with empty index and clean worktree. A/C guarantees and historical evidence are preserved. This candidate contains no governance, workflow, dependency, public-contract, frontend production, encryption or IndexedDB-schema edits.

[Documentation authority](../INDEX.md), [current state](../../knowledge/CURRENT_STATE.md), [roadmap status](../../knowledge/ROADMAP_STATUS.md) and [testing environment](../../knowledge/TESTING_ENVIRONMENT.md) retain their subjects and approval boundaries. The explicit B+D+E authorization supersedes only the earlier internal B/D/E implementation stops. It does not authorize publication or recovery/client implementation.

## 2. Isolated environment

Fresh PostgreSQL18 container `msprout-b4-p2-1b-bde-bcc5870beb-postgres`, PHP container `msprout-b4-p2-1b-bde-bcc5870beb-php`, system identifier `7698056409333256231`, database `pc_bcc5870beb_test`, setup role `pc_setup_bcc5870beb`, restricted runtime `pc_runtime_bcc5870beb`. The independent volume is `msprout-b4-p2-1b-bde-bcc5870beb-data`, on its own internal network with no published database port. No protected dotenv, credentials, APP_KEY, database volume or browser profile is mounted into these tests. Credentials/key are independently generated and omitted from reports.

The pre-Laravel guard verifies PostgreSQL major/system identity, exact fresh database/roles, host, private-input exclusion and separate setup/runtime before role rotation or migration. Workers re-probe independently. PC guard names are deliberately retained so published C tests run unchanged against **new** unique resources; BDE destructive controls additionally require `PDE_ISOLATED=yes`. Neither an old C cluster nor a protected development database is a fallback.

Original attempts, input SHA-256 seals and sanitized receipts remain ignored under `.git/msprout-compat-b4-p2-1b-bde-20261019/`. These are local evidence, not staged source. The runner never executes through ordinary CI or application bootstrap. [Harness instructions](../../scripts/compatibility/integration/README.md) identify explicit reproduction commands.

## 3. Interactive producer inventory and B integration

| Real writer / consumer | Boundary and retained behavior |
| --- | --- |
| Sync push; draft creation, individual/bulk marking, guests and finalization | Existing C HTTP gate before advisory/domain locks → ApplySyncBatch → PublishAttendanceChange → supported publisher. Original per-event savepoints, receipts, event IDs and payload hashes remain. |
| Historical correction/revisions, conflicts, guest link/promotion/merge | Existing actions use PublishAttendanceChange. C authority, original domain/audit transaction and immutable-history semantics remain. |
| Teacher assignment revocation | ManageTeachers emits exactly the existing targeted ministry_assignment tombstone through the same publisher. |
| Membership revocation and Owner transfer | Published C church→sorted global Users→session→domain order remains; no new feed entity type. |
| Ministries, roster, students, enrollment and import | Published C real entry gates remain before domain mutation; no invented roster/student feed representation. Later snapshots must consume this boundary. |
| Device/bootstrap/leases and push subscriptions | Published C real entry gates remain. In coordinated mode only, the device-recovery fence prevents pretending that legacy bootstrap/push/pull reconstruct a qualified baseline. |
| New church/Owner | Real platform approval now locks the global applicant User before the application, rechecks identity and retains verified email, platform authority, Owner constraints, audit and queue semantics. |

Source inventory finds only the central publisher's deliberate disabled-mode ChangeFeedEntry::create in application code. The two existing feed producers delegate once. No duplicate publisher, extra API, Late state or wire representation was added. The existing C migration/authority classes are not rewritten.

With the private setting false, the original legacy insert and representation remain. With it true, the database must be activated; the publisher requires the already-live C context, matching church and qualified epoch, and delegates to narrow SQL append in the caller's transaction. It acquires no late substitute authority, inner commit or silent fallback. Missing/unqualified/mismatched state fails closed and does not reconstruct metadata.

## 4. D maintenance and global lock ownership

MaintenanceCoordinator requires a real console/queue context, no routed/human church/platform session, transaction level zero and the exact restricted runtime. Purpose-specific C coordination owns one transaction per ordered church. Active and suspended churches may undergo approved cleanup; suspended birthday work is refused. Notifications use the existing BirthdayNotification purpose, with the external push outside the database transaction and each claim/result write coordinated.

Global operational/null-church security cleanup and its required platform audit have an independent transaction. Church deletion/coverage flags and required church audit commit together. A later church failure propagates while preserving earlier successful churches; the final all-church success summary is absent. Eligible rejected-application cleanup locks global User before application, rechecks applicant identity, writes canonical per-application audit, and checks hidden memberships before attempting User/session/reset-token deletion. It cannot invert church→User lock ordering through a hidden membership FK.

The old internal SQL signatures remain compatible but delegate to conservative sorted per-church logic. No new public route or direct runtime DELETE grant is added. Canonical audit_events are not deleted. Retention minima remain 30-day operational/secrets, 180-day security/receipts/authorization and 90-day feed; existing rejected-application period remains 30 days. Exact inclusive receipt cutoff is tested.

Actual receipt deletion, grouped by device, marks matching coverage pruned and recovery-required using only returned deleted timestamps. It grants no original-event acceptance or applied-cursor credit. With reconstruction unavailable, **any** retained device cursor or authorization holds its church feed. Served cursor, lease expiry and successful cleanup are not application/recovery evidence. If deletion is safe for a church with no such requirements, only an already-known pruning watermark advances using rows actually deleted; NULL historical coverage remains unknown. Device cleanup flags recovery before deleting eligible authorizations; cursors are retained.

## 5. E admission, drainage and credential fence

The additive migration constructs inactive machinery only. Runtime cannot capture a seal, activate, read private comparison evidence or initialize old progress. No application caller, request/header/body flag, deployment hook or automatic migration invokes activation.

The owner-only operational procedure requires a committed database admission seal from a separate control connection, a dedicated NOLOGIN restricted runtime with no role memberships, SCRAM-authenticated ingress, recorded private seal and a genuinely rotated credential. It rejects every other target backend (including idle or cached consumers), every prepared transaction, malformed/unqualified ingress, additional writer grants and mixed/preinitialized metadata. A lock taken only by new writers is never treated as old-writer drainage.

Actual isolated credential-reentry tests exposed trust authentication in the initial copied harness setup. Only the **new BDE cluster** was changed to SCRAM host rules, exact setup-only local trust and local-all rejection. Runtime has no replication privilege. Before/after HBA receipts are retained; no protected or host-global security configuration changed. Prepared-transaction qualification enabled max_prepared_transactions=10 only in the identified BDE cluster, retaining its volume/system identity. Future runner setup includes both requirements.

The private seal compares the full database catalog transaction identity and a digest of the previous SCRAM verifier, never a raw credential. Catalog xmin is expanded against a current full xid to preserve the PostgreSQL wraparound epoch. Runtime cannot read this evidence. Owner cutover refuses rather than silently changing an unexpected writer's grants. Table and column ACLs are considered; final review reproduced alternate column INSERT/runtime UPDATE gaps and closed them with deterministic failing-before/passing-after tests.

## 6. Floor, head, privileges and genesis

After admission/drainage qualification and CACHE1, atomic cutover locks churches/feed/progress, records each retained committed MAX(sequence) or0 as its head, the existing global allocated sequence boundary as its conservative floor, a fresh epoch and **unknown** historical pruning. The floor can include reservations/rollback gaps; it is not committed or retained-data evidence. Sequence values are never reset or arbitrarily reseeded.

In the same transaction it withdraws direct runtime feed INSERT, sequence access and progress UPDATE rights, grants only supported append execution, marks active and writes required canonical correlation-linked activation audit. Audit failure rolls back metadata, flags and grants together. The append independently enforces scope/transaction, church gate before progress/allocation, qualified epoch/baseline, CACHE1, supported representation and allocation above head/floor. Feed/head commit together; savepoint rollback does not erase harmless sequence gaps.

Only actual new-church INSERT under trusted platform scope creates genesis: fresh epoch, head0, allocation floor and known-empty pruning0. Existing deferred exactly-one-Owner constraints and required approval audit share the transaction. Actual provisioning, repeat approval and injected audit failure prove success/idempotency/rollback. No existing protected church is initialized, and no receipt/applied history is invented.

## 7. Active versus dormant boundaries

**VERIFIED in isolation:** supported legacy/default producers, coordinated internal producers, real cutover/grant transition, new-church genesis, conservative maintenance, authority, ordering and rollback.

**DORMANT / production activation BLOCKED:** SYNC_COORDINATED_PUBLICATION is private and false by default. Even when isolated database/config activation is exercised, real device bootstrap/push/pull return the existing non-settling full_bootstrap_required compatibility response after existing authorization. They do not replace leases, advance cursors, settle events or report recovery complete. This is an intentional safe fence, not a completed recovery API.

P2-2 snapshots, P2-3 client reconstruction and P2-4 end-to-end recovery must replace and qualify this fence before an activation proposal. B5/B6, old/new installed-client transitions, retention reconstruction, original-event classification after missing receipts and Late readiness remain NOT TESTED by this candidate. All five original B4 end-to-end defects remain OPEN; P1 witnesses/assets are preserved. No claim of repaired client history follows from coordinated publication.

The [operational runbook](../operations/coordinated-publication.md) covers target identity, collision preflight, private configuration, existing owner/control connections, worker/pool drainage, SCRAM/credential fencing, cache/floor, atomic cutover/audit, genesis, partial maintenance, reopening prerequisites, and before/after-commit abort. It grants no operational authority. Unknown work, privileges or lost operator access fail closed; forced drainage and protected migration require separate authorization.

## 8. Deterministic concurrency and recovery-boundary matrix

| Proof | Evidence owner and actual boundary |
| --- | --- |
| Same church, two publishers, commit inversion / rollback | IntegrationConcurrencyTest independent workers, IPC and pg_blocking_pids; second allocation/commit follows first gate release. |
| Different churches, including one shared global User | Independent publishers can enter/commit without church-wide serialization. |
| Real deadlock and whole-operation retry | Test-only inverted migration-role worker creates an actual 40P01 against a publisher; victim rollback and fresh retry remain consistent. No product retry/fallback is invented. |
| Cleanup versus interactive publication | Observed same-church wait; another church proceeds; audited scoped maintenance then publisher succeeds. |
| Old uncoordinated writer / cached sequence consumer | Live transaction or cached backend causes cutover refusal; after genuine exit, floor includes committed/reserved allocations and new publication is above it. |
| Prepared transaction / extra writer / wrong cache | Genuine prepared transaction and adverse grants/cache are refused, with no initialized metadata. |
| Audit, savepoint and domain failure | Actual AuditWriter and SQL-audit failures; feed/head/domain/receipt/grants roll back at their proper transaction boundary. |
| Duplicate events and supported payloads | Actual draft/mark/bulk/guest/finalize/revision paths; duplicate receipts preserved; legacy/coordinated attendance payload equality and targeted tombstone representation. |
| Owner transfer, membership revocation and assignment changes | Two additional activated-mode real HTTP Owner-transfer/correction races pass in both directions. Published C membership/assignment HTTP races also rerun in the default mode, retaining stale authorization and snapshot-relevant bootstrap checks. Active public device reconstruction remains deliberately fenced. |
| Missing/mismatched baseline and unknown retention | Explicit refusal without rebuilding; receipt deletion never manufactures complete history. |
| Zero/stale/unissued pull cursors and active push/bootstrap | Existing 409 recovery fence; cursor/lease/receipt state remains non-settling. This does not prove later reconstruction. |
| Real cookie browser and encrypted work | Fresh Chrome/native-WebKit at390/1440px; genuine upload acknowledgments, membership loss or isolated recovery refusal, exact local records and accessible visible error. |

## 9. Original pre-security qualification ledger

The following pre-security qualification is retained as historical evidence. Section0 records the current blocking direct-SQL finding and failing regressions; these earlier passes do not establish maintenance SQL authority or publication readiness.

| Gate | Actual result / evidence |
| --- | --- |
| First combined backend phase | **448 passed,8 failed /4,417 assertions**,578.63s. All eight failed at new worker startup, not domain assertions: Pint shortened Kernel before its import. Imports now precede executable bootstrap. Original combined-final.log retained. |
| Cutover grant negative proof | **3 failed /3 assertions** before correction: column INSERT and runtime UPDATE were accepted. column-grants-before.log retained. |
| Cutover/concurrency closure | **26 passed /140 assertions**,49.09s after privilege/import correction, including new grant/baseline/cursor fence proofs. final-review-closure.log retained. A further **2 passed /24 assertions** proves real Owner transfer against activated HTTP correction publication in both orders. |
| Final combined API + C + foundations + BDE | **462 tests /4,524 assertions PASS**,283.28s in combined-qualified.log, including all40 new BDE cases. All ordinary API, selected published C compatibility and recovery-foundation classes ran together sequentially against the independently guarded cluster. |
| Frontend regression | **813 tests /82 files PASS — retained**, unchanged-input seal verifies274 source/config/lock inputs. No frontend production edits. |
| Real browser | **8/8 PASS**,3.3m, stable browser-03: Chrome/native-WebKit ×390/1440px ×membership-revoked/isolated-recovery. Genuine two-result acknowledgment and both upload/download completion are awaited; recovery409/body/visible text and exact encrypted records are asserted. |
| PWA real service workers | **8/8 PASS — retained**, identical PWA/browser inputs and all16 built asset hashes. No service-worker/cache/activation-policy edits. |
| Production typecheck/lint/build/contract | **PASS — retained** from C unchanged inputs; dedicated new browser types/lint and new mjs lint separately run. Raw Windows CRLF contract/structure limitation remains; normalized public mirror succeeds. No production/generated file rewritten. |
| Pint / PHP syntax | Fresh-cache full Pint287 files PASS; syntax-qualified.json covers26 changed/new PHP inputs including harness bootstrap. Earlier cache-dependent two-test style failures retained and corrected. |
| Dependencies | Composer strict validation PASS; locked Composer audit no advisories; pnpm high audit no vulnerabilities. Read-only Composer mirror warns its cache is unwritable and proceeds without cache. |
| Security | Full OWASP108 rules/504 inputs,0 findings with2 unchanged TSX PartialParsing warnings. Neutral-name closure30 changed/new code inputs,0 findings/0 parse errors. SQL has explicit source/RLS/restricted-role tests; scanner is not claimed to prove SQL correctness. Final neutral30 closure is clean; the added active Owner-race test has a separate1-input delta with0 findings/0 errors. Final source/report Gitleaks closure records0 leaks. SQL is not claimed scanner-proven. |
| Structure/docs/whitespace | Normalized structure PASS; **273 references/anchors across6 documents,0 errors**. Tracked/new-file whitespace PASS. Exact results are recorded in documentation.json and final-review.json. No host CRLF configuration change. |
| Hosted CI/Security | **NOT RUN for this unstaged candidate**; no new SHA/push exists. Published C successes do not qualify unpublished BDE. |

Per-attempt input seals and raw failed logs are preserved in the ignored validation-ledger.json and bcc5870beb/result-*.json/test-*.log. Counts overlap between focused runs and must not be summed as distinct coverage.

## 10. Preserved failures and corrections

1. Initial test fixture used nonexistent AttendanceSession.created_by; corrected only the fixture, then observed the genuine default/fallback failure and implemented the publisher boundary.
2. An arrow closure captured a new session by value; the equivalence fixture now returns the actual created session.
3. Initial retention witnesses reproduced feed deletion behind served progress and missing receipt-prune flags. Scoped conservative SQL closes those witnesses; stale deletion expectation changes to retention under the explicit approved requirement. No other assertion is removed.
4. PostgreSQL refuses sealing admission from the target connection. The fixture/runbook use a verified separate control connection; owner target connection is retained before the seal. Fresh browser kernels exposed the latter lazy-connection issue, which is corrected in the test fixture with guarded cleanup on preparation failure.
5. Prior PHPUnit app/exception objects retain idle PDOs. Positive fixtures explicitly drain only identified disposable idle backends; active transactions/cached/prepared negative proofs remain. Production activation's refusal predicate is unchanged, and no protected termination is authorized.
6. Actual old-credential reentry exposed trust HBA; corrected only BDE ingress and added production preflight refusal. No security exemption or fallback.
7. Initial active bootstrap returned an unqualified completion; the intentional coordinated-mode device fence now prevents it. Future snapshots/client work remains separate.
8. Queue fixtures had borrowed human sessions and a stale feed-deletion expectation. They now model actual console authority, preserving existing privacy/security/functional cases and asserting conservative retention.
9. First aggregate worker import failure, two style/cache failures and three alternate-grant failures are retained as described above. No test skip, security suppression or timeout increase was used.
10. First browser attempt:1 pass/7 failures. One5-second outbox observation raced a real response; tests now await and validate the genuine two-result acknowledgment before asserting settled outbox. Activation had no retained owner connection before sealing, causing subsequent disposable bootstrap failures; guarded fixture preparation now retains it and reopens on preparation failure. Second attempt:2 passes/6 failures, including full-sync completion observation, autovacuum drainage refusal and a response observer incorrectly limited to push while recovery correctly refused bootstrap first. The fixture now awaits both phases, the actual bootstrap-or-push409 and existing bounded background exit; no product predicate/assertion/timeout was weakened. Browser-03 is the separate stable8/8 closure.

### Browser presentation evidence

All16 actual screenshots (attendance and preserved-work states across8 cases) are hashed in ignored browser-screenshots.json. Representative native WebKit recovery captures are browser-03/integration-real-cookie-pe-4d1a5-90px-isolated-recovery-true-webkit/revoked-preserved.png and browser-03/integration-real-cookie-pe-16414-40px-isolated-recovery-true-webkit/revoked-preserved.png. The existing recovery message and pending-upload state are shown; desktop/phone images were inspected. No frontend production CSS/component changes or new visual redesign acceptance is claimed. Full-page phone capture retains transient skip-link focus and fixed-navigation capture position; these screenshots are behavior evidence, not replacement mockups.

## 11. Contention and performance

Database-observed waits and independently advancing churches are acceptance evidence; no sleep-only contention claim. Original25-second IPC and4-second wait-observation limits remain. Navigation samples are descriptive only:30 sequential real-cookie local kernel requests, not a throughput SLA or production capacity result. Final navigation-latency.json records p50=20.75ms, p95=30.71ms and p99=34.74ms, with raw timings and no credentials. Long external push/SMTP behavior retains C's authority/atomicity tests; this task introduces no speculative performance infrastructure.

## 12. Exact candidate inventory

Current corrected candidate: **54 paths: 25 modified and 29 new**. Original38-path source-review inventory is historical. The additional16 paths implement the approved independent-role/process boundary and its affected regression fixtures and deployment documentation. All existing candidate files are preserved; no unrelated application, contract, dependency, CI or governance change is included.

| Status against published parent | Repository-relative path | Purpose |
| --- | --- | --- |
| Modified | `apps/api/app/Actions/Applications/ApproveChurchApplication.php` | Retained BDE supported producer, authority or recovery-fence integration |
| Modified | `apps/api/app/Actions/Memberships/ManageTeachers.php` | Retained BDE supported producer, authority or recovery-fence integration |
| Modified | `apps/api/app/Domain/Attendance/PublishAttendanceChange.php` | Retained BDE supported producer, authority or recovery-fence integration |
| Modified | `apps/api/app/Domain/Sync/ChurchCoordination.php` | Retained BDE supported producer, authority or recovery-fence integration |
| Modified | `apps/api/app/Domain/Sync/CoordinatedChangePublisher.php` | Retained BDE supported producer, authority or recovery-fence integration |
| Modified | `apps/api/app/Domain/Sync/TrustedSystemCoordination.php` | Bind cleanup purposes to independent authentication; preserve notification authority |
| Modified | `apps/api/app/Http/Controllers/OfflineBootstrapController.php` | Retained BDE supported producer, authority or recovery-fence integration |
| Modified | `apps/api/app/Http/Controllers/SyncController.php` | Retained BDE supported producer, authority or recovery-fence integration |
| Modified | `apps/api/app/Jobs/DispatchBirthdayNotifications.php` | Retained coordinated maintenance/notification transaction integration |
| Modified | `apps/api/app/Jobs/PruneOperationalData.php` | Retained coordinated maintenance/notification transaction integration |
| Modified | `apps/api/app/Jobs/PurgeRejectedApplications.php` | Retained coordinated maintenance/notification transaction integration |
| Modified | `apps/api/app/Jobs/PurgeRevokedDeviceData.php` | Retained coordinated maintenance/notification transaction integration |
| Modified | `apps/api/app/Jobs/SendBirthdayPush.php` | Retained coordinated maintenance/notification transaction integration |
| Modified | `apps/api/bootstrap/app.php` | Reject privileged HTTP before controllers |
| Modified | `apps/api/docker/entrypoint.sh` | Validate service isolation and start fixed maintenance schedules/commands |
| Modified | `apps/api/routes/console.php` | Separate maintenance schedules from ordinary queue/scheduler |
| Modified | `apps/api/tests/Compatibility/TrustedSystemAuthorityTest.php` | Preserve scope/capability rollback under least-privilege maintenance |
| Modified | `apps/api/tests/Feature/Applications/ApplicationRetentionTest.php` | Retain identity/membership retention assertions with authenticated fixture |
| Modified | `apps/api/tests/Feature/Notifications/BirthdayDispatchTest.php` | Retained BDE behavior, browser, concurrency or cutover regression proof |
| Modified | `apps/api/tests/Feature/Operations/RetentionTest.php` | Retained BDE behavior, browser, concurrency or cutover regression proof |
| Modified | `apps/api/tests/bootstrap.php` | Guarded disposable identity/bootstrap and independent maintenance fixture |
| Modified | `docs/operations/deployment.md` | Correct maintenance service/credential and conservative retention deployment pointers |
| Modified | `knowledge/CURRENT_STATE.md` | Verified current checkpoint, qualification and preservation knowledge |
| Modified | `knowledge/ROADMAP_STATUS.md` | Verified current checkpoint, qualification and preservation knowledge |
| Modified | `knowledge/TESTING_ENVIRONMENT.md` | Verified current checkpoint, qualification and preservation knowledge |
| New | `apps/api/app/Domain/Sync/MaintenanceCoordinator.php` | Verify independent session identity and restricted worker authority |
| New | `apps/api/app/Domain/Sync/PublicationMode.php` | Retained BDE supported producer, authority or recovery-fence integration |
| New | `apps/api/app/Http/Middleware/RejectMaintenanceHttp.php` | Fail closed for privileged HTTP service configuration |
| New | `apps/api/config/maintenance.php` | Public role/process configuration without privileged credentials |
| New | `apps/api/config/synchronization.php` | Retained BDE supported producer, authority or recovery-fence integration |
| New | `apps/api/database/migrations/2026_10_19_000001_integrate_coordinated_publication.php` | Retained conservative publication/maintenance SQL construction |
| New | `apps/api/database/migrations/2026_10_19_000002_isolate_maintenance_authority.php` | Forward-only seven-function ACL isolation and minimum worker grants |
| New | `apps/api/database/sql/coordinated-maintenance.sql` | Retained conservative publication/maintenance SQL construction |
| New | `apps/api/database/sql/coordinated-publication.sql` | Retained conservative publication/maintenance SQL construction |
| New | `apps/api/docker/process-boundary.php` | Early environment/private secret-mount separation guard |
| New | `apps/api/tests/Compatibility/IntegrationConcurrencyTest.php` | Retained BDE behavior, browser, concurrency or cutover regression proof |
| New | `apps/api/tests/Compatibility/IntegrationCutoverTest.php` | Retained BDE behavior, browser, concurrency or cutover regression proof |
| New | `apps/api/tests/Compatibility/IntegrationMaintenanceTest.php` | Retained BDE behavior, browser, concurrency or cutover regression proof |
| New | `apps/api/tests/Compatibility/IntegrationPublicationTest.php` | Retained BDE behavior, browser, concurrency or cutover regression proof |
| New | `apps/api/tests/Compatibility/MaintenanceIsolationTest.php` | Actual role/ACL/SET ROLE/credential/audit/HTTP/provisioning denials |
| New | `apps/api/tests/Support/IntegrationBrowserProbe.php` | Retained BDE behavior, browser, concurrency or cutover regression proof |
| New | `apps/api/tests/Support/IntegrationScenario.php` | Retained BDE behavior, browser, concurrency or cutover regression proof |
| New | `apps/api/tests/Support/MaintenanceScenario.php` | Test-only separately authenticated maintenance connection |
| New | `apps/api/tests/Support/integration-worker.php` | Retained BDE behavior, browser, concurrency or cutover regression proof |
| New | `apps/api/tests/Support/maintenance-process-probe.php` | Real isolated web/maintenance role and HTTP probe |
| New | `apps/web/e2e/compatibility/integration.spec.ts` | Retained BDE behavior, browser, concurrency or cutover regression proof |
| New | `apps/web/playwright.integration.config.ts` | Retained BDE behavior, browser, concurrency or cutover regression proof |
| New | `docs/operations/coordinated-publication.md` | Consolidated BDE evidence or operational/reproduction contract |
| New | `docs/qa/compat-01-b4-p2-1b-bde-integration.md` | Consolidated BDE evidence or operational/reproduction contract |
| New | `scripts/compatibility/integration/README.md` | Consolidated BDE evidence or operational/reproduction contract |
| New | `scripts/compatibility/integration/bootstrap.php` | Guarded disposable identity/bootstrap and independent maintenance fixture |
| New | `scripts/compatibility/integration/browser-server.mjs` | Isolated BDE test/browser harness and target guard |
| New | `scripts/compatibility/integration/process-isolation.mjs` | Guarded separate-container credential/entrypoint qualification |
| New | `scripts/compatibility/integration/run.mjs` | Isolated BDE test/browser harness and target guard |

## 13A. Current final review, preservation and hold

The complete candidate/source review closes BDE-SEC-01 with0 BLOCKING/0 SHOULD FIX findings. The final narrowing grants maintenance only the five current helpers; two legacy wrappers are owner-only. No new privileged HTTP endpoint/shared queue, broad role, contract/dependency/workflow/governance change, test skip or timeout increase exists. The required canonical audits use the same owning maintenance connection/transaction; User/church lock order, partial success, retention minima, RLS and all original publication/cutover safeguards pass the final aggregate. The deployed/protected databases are NOT claimed patched: no protected migration or grant change is authorized or performed.

Final documentation/reference/anchor/structure, whitespace, source-secret and preservation receipts are `security-remediation-documentation.json`, `security-remediation-structure.log`, `security-remediation-final-review.json`, `security-remediation-candidate-gitleaks.log` and `security-remediation-preservation-final.json` in the existing ignored evidence root. Raw Windows CRLF remains an unchanged host limitation; current LF-normalized public structure validation passes. Two unchanged TSX parser warnings remain explicit limitations; changed security inputs have0 parser errors.

Exact current inventory is54 paths (25 modified/29 new), listed in section12. All candidate executable inputs are sealed in `security-remediation-qualification-seal.json`; private diagnostic/environment fixtures and original evidence remain ignored. Original38-source ZIP is unchanged and historical, not a new review package. Final Git remains published parent c5e30e1f3b392a154ac5c64aa39b3ca96c6e6361 on feat/mvp-foundation, feature local/tracking/live0/0, index empty, intentional54-path unstaged candidate. Local and remote main retain their independently recorded pre-existing values. All39 protected fingerprints/runtime attributes/migration state,42 protected files,11 stashes,10 backups,32 frozen assets+2 manifests and worktree identities remain unchanged under the final read-only comparison.

Publication recommendation: technically ready for one consolidated independent stakeholder source review, with explicit no-stage/no-commit/no-push hold. Candidate hosted CI/Security is NOT RUN because this candidate is unpublished. Production/target secret mount, service/PID/cache isolation, migration stop/admission/drain, role/ACL/owner/RLS and maintenance monitoring qualification remain NOT TESTED operational prerequisites requiring separate authorization. No deployment/activation is approved. Normalized-email collision preflight and snapshot/client reconstruction remain mandatory; all five original B4 defects remain OPEN. No later stage began.

**COMPAT-01 B4-P2-1B-B+D+E — YELLOW: BDE-SEC-01 CLOSED, FULL CANDIDATE READY FOR STAKEHOLDER REVIEW**

The following section13 is the preserved historical pre-security receipt, superseded by this current closure.

## 13. Original pre-security preservation, final review and hold

Fresh READ ONLY observation matches all39 protected table fingerprints, migration state and runtime-role attributes. Two private files,30 QA files,10 backups and all32 frozen assets/two manifests match their before hashes. Eleven stash IDs, user branch/remote/tag/history refs and other worktree identities are unchanged. During the interrupted desktop session, only internal `refs/codex/turn-diffs/` tree-capture refs changed; these point to tree objects, not new task commits. The original tree objects remain available, and no agent history operation occurred. The exact observation is preserved in resume-internal-ref-observation.json. No existing encrypted browser profile was opened/reset; generated test profiles/keys are confined to disposable contexts. No protected migration, grant, metadata, deployment, drainage or production activation occurred.

Local/tracking/live feature HEADs remain c5e30e1f3b392a154ac5c64aa39b3ca96c6e6361, ahead/behind0/0; index empty, intentional38-path candidate unstaged. Local main remains d6c66694a8acc252815a088ada3ef8703340b038; tracking/live main remains5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f. Their pre-existing difference is preserved, not repaired. Exact Git inventory and code seals match; historical knowledge bodies are byte-equivalent after line-ending normalization.

An inherited sources-map comparison initially reported41 mismatches because that map belongs to **C's pre-implementation parent8017e3b**, not the published C parentc5e30e1. Read-only diagnosis confirmed it matches the old C preflight map. Actual published-C Git objects/diff show exactly the authorized17 modifications and21 new files, with no unrelated source change. No file was altered to satisfy the wrong baseline. integrity-final.json records the correction; protected groups and fresh39-table observations use their proper unchanged baselines.

Complete final source review includes all modified/new code, SQL/migration, tests/helpers, new browser configuration, runbook and knowledge. Review checks supported payloads, C primary authority, sorted Users, RLS/restricted role, audit/receipt atomicity, no silent fallback, explicit activation boundaries, new church rollback, no source/test weakening and no later-task leakage. The alternate-grant finding is closed by failing-before/passing-after proof, with no unknown role silently revoked. At the pre-security checkpoint, qualified source seals and original aggregate inputs agreed. The later test-only SQL witnesses expose missing authority coverage; their failure supersedes publication qualification. Production executable inputs remain unchanged, so unaffected frontend/browser/PWA evidence is retained without treating it as SQL authorization proof.

**Prior pre-security review:0 BLOCKING,0 SHOULD FIX; superseded by current BDE-SEC-01 with1 BLOCKING finding.** The worker startup/import, fixture connection ownership, response observation, completion race, style and alternate-grant findings are closed with original evidence preserved. No skip, weakened safety assertion, unnecessary timeout increase or fallback was used.

INFORMATIONAL / ACCEPTABLE: two unchanged OWASP TSX parser warnings; Windows raw CRLF validation limitation; private read-only Composer cache warning; isolated descriptive performance only; production drainage/activation NOT TESTED. D deliberately retains history conservatively while snapshots are absent. These do not authorize storage cleanup or claim active recovery readiness.

PROPOSED / separately approved later work: target-specific deployment/collision preflight, operational permission/credential distribution and qualified replacement of the device fence by snapshots/client reconstruction/end-to-end recovery. Active installed-client recovery/retention transitions remain NOT TESTED. Production activation remains BLOCKED; all five original B4 end-to-end defects remain OPEN. This is a complete authorized source/isolated-qualification candidate, not complete recovery or GREEN delivery.

Publication recommendation is **DO NOT PUBLISH** until BDE-SEC-01 has an approved authority design and passing-after correction qualification; guarded publication authorization remains separately required. Any future publication must stage exact reviewed paths, exclude ignored evidence, reverify source hashes/preservation, and obtain exact-new-SHA hosted results. Nothing here grants activation or deployment. C's normalized-email migration still requires separately approved target-database collision preflight. No B4 snapshots, client reconstruction, end-to-end recovery, B5/B6, Late or Packs06–12 work is authorized.

**DO NOT stage, commit, push, merge, deploy, apply protected migrations/grants, initialize protected recovery metadata or activate production. STOP for consolidated stakeholder review.**
