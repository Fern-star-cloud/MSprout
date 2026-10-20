# COMPAT-01 B4-P2-2 — Server recovery snapshots

Current v2 correction and requalification: [P2-2-REV-01 closure](#11-p2-2-rev-01-final-source-review-closure--2026-10-20). Earlier results below retain their original evidence scope.

## 1. Scope and review status

**YELLOW: FULL SERVER SNAPSHOT IMPLEMENTATION COMPLETE, STAKEHOLDER REVIEW REQUIRED.**

Unstaged server-snapshot candidate on `feat/mvp-foundation`, published parent
`39d40a6c443cd7a8563a38378647c3fde3b5c603`. Publication, deployment, protected
migrations, production activation and P2-3/P2-4 are expressly held. This report
records the integrated implementation, actual qualification and final review.
This is server-only technical qualification, not production recovery or publication.

The published BDE predecessor's Web/API/Security results passed for that parent.
They are not hosted results for this uncommitted candidate. Earlier knowledge
entries recording the BDE pre-publication hold are historical; the guarded
publication receipts establish the published parent without rewriting that history.

## 2. Server lifecycle and client boundary

The new child resource is `POST /api/offline/bootstrap/recovery` with explicit
`begin`, `manifest`, and `seal` actions, and authenticated `GET` of an output
ordinal. It reuses the published recovery tables, church-first coordination,
publication progress and independent maintenance identity. There is no new
client admission protocol, forced upgrade or recovery-completion endpoint.

Entry requires both the default-disabled qualification flag and the testing
environment, plus coordinated publication and a qualified coverage epoch/baseline.
Existing cookie/session, CSRF, verified-member, Owner-MFA, device-lease and tenant
middleware apply. Actor, church, membership and scope come from fresh server
authority after acquiring the church gate. Client ownership, cuts, acceptance
claims, extra fields, files and unsupported schema are rejected.

An identical begin request resumes its still-active generation. Changed intent
under the same key fails. A new intent supersedes only that device/membership's
prior generation and creates a recovery hold. Expired/superseded generations
cannot be resumed or silently extended. Ministry/roster authority changes require
a new generation. Responses use the existing correlated safe-error envelope and
`Cache-Control: no-store, private`.

No code clears `full_resync_required`, fabricates applied progress, upgrades
receipt coverage, settles original events, changes the lease or replaces local
encrypted work. The coordinated ordinary-sync completion fence remains intact.
`client_recovered` is always false. An additional database guard forbids applied
evidence originating from the new v1 server-snapshot generation. Historical
schema-NULL foundation fixtures do not constitute a production completion API.

## 3. Bounded original input and immutable output

Input contains typed authorized-session references and unclassified original
event descriptors, including their original identity, action, base version,
timestamp and payload. Uploading an event is preservation, never acceptance.
Canonical map ordering follows the existing push convention; original event
values are not rewritten. UUID reference identity comparisons are case-normalized
without modifying preserved originals.

Each page has an ordinal, predecessor digest, schema and item count. Limits are
100 items, 1 MiB canonical plaintext and 2 MiB encrypted envelope. Identical
retries succeed; changed/reordered/duplicate/omitted items, invalid counts,
unknown schema and broken digest chains fail closed. Seal requires the exact
complete input manifest; the manifest is SHA-256 of concatenated fixed-width page
digests, avoiding a self-referential last-page hash.

Encoding also proves readability using the same JSON depth-64 boundary as the
authenticated decoder. An over-deep original is rejected with 422 before any
page is saved; its client copy remains authoritative. The failing-before test
observed 200 and is retained beside the passing-after proof.

Ciphertext uses the existing authenticated server encryption service. Output is
typed, bounded and encrypted at rest, with per-page SHA-256 and an ordered digest
manifest. Every page binds generation, epoch, authoritative cut, scope digest,
church-local window, timezone and predecessor. Retrieval verifies MAC, plaintext
digest/count/schema, binding and the complete stored digest manifest before
returning anything. No input-ciphertext retrieval API exists. Existing browser
envelopes, keys, encryption and IndexedDB engines are unchanged.

Per-run qualification maxima are 1,000 input pages, 10,000 output pages, 2 million
total input/output items, 10,000 unique referenced sessions and 512 MiB stored
ciphertext. Church ciphertext is capped at 512 MiB, with 128 unpurged v1 runs per
church and eight per device. The API advertises read-only limits. Capacity failures
roll back incomplete output; they never truncate a complete snapshot. These are
bounded qualification choices, not an approved production quota policy.

## 4. Authoritative coverage and cut

Coverage is today plus the previous 89 dates in the church timezone, and every
older authorized session referenced by preserved input. Future references do not
extend the approved window. Missing, foreign and inaccessible references have the
same unavailable representation; feed absence never implies deletion or event
acceptance.

Projection reads authoritative tables rather than retained feed payloads. It
includes scoped ministries/current minimal roster, historical student membership,
session status/version/deletion/finalization, original and latest effective marks,
correction chronology, temporary guests and their resolution/merge provenance,
and allowlisted conflict state/version/timing. Session headers give exact fragment
counts. Broken parent graphs or unsupported authoritative data refuse the whole
seal. Child records remain complete across page boundaries. Dates of birth,
guardian/contact data, audit prose, correction reasons and arbitrary conflict
payloads are excluded.

All construction runs under the exclusive church gate, with fresh authority and
required audit in the same mutation transaction. The cut is the qualified
committed feed head/baseline floor, never a raw sequence allocation or supplied
cursor. Independent workers and observed PostgreSQL waits prove before/after
ordering, no partial ready output, generation replacement, different-device
binding, Owner transfer, Teacher assignment loss, actual roster/import mutation
and same-User independent-church progress. Batching authoritative reads in groups
of 100 removes repeated per-session queries without moving reads outside the gate.

## 5. RLS, SQL permissions, expiry and audit atomicity

The additive migration extends the existing recovery run with immutable v1
schema/request/authority bindings and preserves forced RLS. Published migrations
are unchanged. Runtime receives no new broad UPDATE privilege. The redundant
run row lock was removed because the existing church gate and SQL transition/page
guards serialize the lifecycle; concurrency tests retain the original assertions.

The inherited cleanup signature is tightened: PUBLIC/runtime and unexpected
non-owner EXECUTE grants are revoked. Only the already-approved independent
restricted maintenance LOGIN receives cleanup EXECUTE and minimal run-selection
columns. It receives no general run-transition or device-update grant. The
new migration explicitly revokes any retained maintenance transition EXECUTE:
`CREATE OR REPLACE` alone preserves function ACLs across disposable schema replays.
The SECURITY DEFINER body also checks authenticated `session_user`, uses fixed
`pg_catalog` search path and explicit tenant predicates, and takes the church gate.
Caller-controlled church/worker settings cannot authenticate maintenance. Tests
also deliberately grant runtime EXECUTE and prove the body still refuses it.

Expired v1 collecting/ready runs are logically expired, their own active hold is
cleared by compare-and-set, ciphertext is purged, and a canonical count-only
`offline.recovery.expired` audit is appended atomically. A newer active generation
is untouched. Full-resync, applied/receipt evidence and immutable run metadata
remain. Legacy cleanup keeps its inactive-terminal prerequisite. SQL audit failure
rolls the entire cleanup back. Ordinary maintenance jobs call this through the
existing independently authenticated per-church transaction; no broad new role,
credential or authorization protocol is introduced.

Four hours is a bounded qualification lifetime, not approved production retention.
Expired retrieval refuses immediately; physical purge depends on the existing
maintenance schedule and availability. Outage/backlog/deployment behavior and a
production lifetime/retention decision remain unqualified operational prerequisites.

## 6. Original failures and corrections

All original logs and source seals remain ignored under
`.git/msprout-compat-b4-p2-2-20261019/`.

| Attempt | Actual outcome and correction |
| --- | --- |
| Missing-resource failing-before | One failure/two assertions: 404 before implementation. Begin then passed eight assertions. |
| First lifecycle expansion | 16 failures/three passes: follow-up 403 traced to PostgreSQL UPDATE privilege required by redundant `FOR UPDATE`; removed that lock under existing church coordination. Production-disabled fixture also needed real CSRF. No authorization bypass or extra UPDATE grant. |
| Next lifecycle | 11 failures/eight passes: Laravel GET fixture's empty JSON list was rejected; empty JSON is accepted. Required-audit failure exposed partial commit through rendered exceptions; controller now uses an inner transaction/savepoint. |
| Lifecycle closure | 19 tests/214 assertions passed, including rollback, retry and retained input. |
| Initial security | Five failures/five passes: fixture provision order, sole-Owner invariant, retained HTTP session during maintenance and an expiring fixture setup. Corrected isolated setup; no product permission relaxation. |
| Security closure | Ten tests/100 assertions passed before additional independent-identity cases. |
| Initial concurrency | Four passes/one failure: shared HTTP session caused artificial barrier/session-row contention. Separate authenticated sessions preserve church-gate proof. |
| Optimized combined attempt | 55 passes/15 failures, retained as failed: one shared-session barrier case; one historical migration replay failure caused the following 13 missing-table failures. Dependent migration replay now follows foundations; all original preservation assertions retained. |
| Affected closure | 53 tests/379 assertions passed: security, all 14 races and foundation schema tests. |
| Frontend initial | 805 passes/eight failures across 82 files under parallel load, primarily unchanged five-second timeouts and readiness queries. |
| Frontend closure | All seven affected files,121 tests, passed with four workers, unchanged assertions/timeouts. This is a closure of the failed aggregate, not a fabricated clean 813-test run. |
| Depth boundary review | One failed/one passed: upload initially accepted depth beyond the authenticated reader. The codec now checks readability before storing anything; all affected snapshot cases pass afterward. The same run's strengthened maintenance negative passed SQLSTATE42501 despite accidental runtime EXECUTE, and independently authenticated unexpired cleanup refused with23514. |
| Tool-only closures | Initial isolated PWA config found no tests because of its working-directory-relative path; corrected diagnostic config discovers the original eight unchanged cases, all passing. Late Pint found one increment-style issue in the new depth fixture; formatting-only correction passes. No timeout increase, test skip or assertion removal. |
| Browser request/interruption fixtures | `browser-01` has four failures; a diagnostic case proves cookies present but no Origin/Referer on its raw GET. The helper now matches the established transport's `referrerPolicy: origin`; application authentication remains unchanged. `browser-final` has three interruption-observation failures and one unsequenced login/session-probe failure. A socket close before headers permitted transparent GET retry; the broker now sends genuine controller headers and only part of its genuine body before cutting the connection, without fabricating a receipt. A separate network closure also encountered the login readiness race. Waiting for the actual login response and browser continuation prevents guest-cookie polling from racing session rotation; the original authenticated-session assertion remains. The sequenced Chrome390 pilot passes. |
| Native WebKit induced error | `browser-qualified` has two Chrome passes/two WebKit failures at the final error check, after all security/preservation checks. A diagnostic WebKit case identifies the exact deliberate worker error `FetchEvent.respondWith received an error: Load failed`. Final tests require exactly one such error only inside the verified HTTP200 partial-response interruption, and zero unexpected errors; they do not disable workers, suppress arbitrary errors or remove the original zero-unexpected-error assertion. Both WebKit closures pass. Chrome's unchanged branch retains its two valid passes. |
| Final permission review | Read-only SQL found an earlier disposable iteration's retained maintenance transition EXECUTE. The first added negative used an incorrect `text` signature and failed42883; corrected `varchar` proof fails on the actual unwanted grant. The additive migration now explicitly revokes it. No protected target ever received either grant or migration. |
| Affected permission closure | 73 passes/one failure,535 assertions; the failure is strict activation guard55000, with the saved diagnostic showing an autovacuum worker appearing in the disposable target. All permission, RLS, maintenance/audit and concurrency cases otherwise pass. The original failed case passes unchanged on isolated rerun: one test/seven assertions. The guard is retained; no timeout, activation bypass or speculative product repair. This is a74-case closure, not a clean74-test aggregate. |
| Final whitespace | One new SQL EOF blank line removed, final newline and SQL tokens preserved. Whitespace passes for tracked and all24 new paths; current migration/permission qualification uses the corrected bytes. |

## 7. Qualification and evidence matrix

| Gate | Actual evidence |
| --- | --- |
| Comprehensive API/tenancy/current A/C/BDE/foundation/snapshot regression | **524 tests/5,174 assertions PASS**,858.84s; `dfa8c8f80b/test-1792385417900.log` and its input seal. This includes the default Unit/Feature/Tenancy suites plus the explicit current Compatibility aggregate. Historical dormant-prototype-only runner scenarios are not falsely claimed rerun. |
| Post-review snapshot qualification | **46 tests/480 assertions PASS**,165.49s; `dfa8c8f80b/test-1792386361359.log`. Covers all lifecycle/security/concurrency cases after the depth fix, including strict SQLSTATE checks. |
| Final permission/maintenance qualification |74 distinct cases qualified through73 initial passes and the unchanged one-case closure. Includes snapshot security, foundation schema/replay, published maintenance, independent identity isolation, trusted-system authority and real publication/maintenance/deadlock/Owner-correction races. Exact attempts and input seals are in `maintenance-final-closure.log`, `maintenance-final-isolated-closure.log` and the validation ledger. Final direct SQL confirms cleanup EXECUTE true, maintenance transition EXECUTE false and any device UPDATE-column privilege false. |
| Input invalidation reconciliation | The late depth change is confined to the new recovery codec; only new snapshot services use its encode/decode methods. All46 affected cases and three workloads rerun. The final ACL change only removes an unused maintenance capability; the only production transition caller is the ordinary-runtime snapshot service. Affected74-case role/schema/maintenance/concurrency qualification closes its guarantees. Ordinary-runtime API behavior, construction measurements, frontend and browser/PWA proofs remain valid by unchanged inputs/effect. Fixture sequencing/observation corrections invalidate their browser/type/lint proofs, not product backend suites. SQL EOF and fixture increment style preserve executable semantics. No failed aggregate is relabeled passed. |
| Frontend | 813 distinct cases qualified through805 initial passes and the seven-file121-test closure; `frontend-tests.log`, `frontend-closure.log`. No clean initial aggregate claimed. |
| Actual service-worker/PWA | **8/8 PASS**, Chrome and native WebKit, no retries/skips; `pwa-results.json`. Actual activation/controller identity, update notice, safe deferral, caches and encrypted pending work remain asserted. These are fresh results because build bytes differ from the retained build. |
| Real snapshot browser | **Four distinct cases qualified** at390/1440px in Chrome/native WebKit: two Chrome passes in `browser-qualified/results.json` plus two WebKit passes in `webkit-qualified/results.json`. The initial two WebKit failures remain recorded. Real login/cookies, enforced CSRF419, guarded PostgreSQL HTTP controller, actual worker, encrypted IndexedDB equality, digest/retry, partial-response interruption, supersession, expiry and revocation are tested. No fabricated push/pull receipt, local reconstruction, test skip or timeout increase. |
| Types/lint/build/contracts | PASS: application and standalone browser types, complete web lint, production build, generation/check; final depth description changes generated documentation only. Raw contract/structure commands pass in this run; the historical Windows CRLF limitation is preserved as history, not claimed repaired. Root `pnpm run verify` is not separately claimed run; its applicable components ran through documented isolated commands. |
| PHP/Node | Full Pint310 files PASS; four late inputs pass after the fixture style closure. PHP syntax and both new Node entry-point syntax checks pass. |
| Dependencies | Strict Composer validation, locked Composer advisory audit and pnpm high-severity audit PASS. Read-only Composer cache warning is not a vulnerability. An initial pnpm automatic-install attempt aborted before removal because no TTY was available; process-scoped `verify_deps_before_run=warn` reuses installed dependencies. The warning concerns changed minimumReleaseAge metadata; no dependency/lockfile edit, actual install, upgrade, TLS bypass or permanent runtime configuration. |
| OWASP | Complete application519 inputs plus explicit104 filtered test/support/harness inputs:623 distinct inputs, zero findings. The complete scan retains exactly the two known PartialParsing warnings in ApplicationScreen/AuthScreen test mocks; explicit closure has no parse errors. Late four-input, two-input browser and final three-input migration/security/browser closures each have zero findings/errors. SQL privileges are qualified by actual restricted-role tests and source review, not falsely called scanner-parsed. |
| Secrets and integrity | Initial765 public-source inputs, zero leaks. Final source/knowledge refresh, exact candidate hashes, link/anchor/whitespace and preservation results are recorded in ignored final receipts. Private environments/credentials/runtime output are excluded rather than copied into scanners. |

Ignored `validation-ledger.json` preserves every backend attempt, actual exit and
exact input seal. `final-review.json` and `candidate-inventory.json` reconcile the
final candidate hashes and preservation. No new hosted SHA/run exists for this
unpublished candidate; preceding hosted successes are never substituted for one.

The browser fixture uses disposable synthetic identities and local HTTP. Server
token/security tests are retained, but no live third-party CAPTCHA widget, real
user profile, physical device or installed-client reconstruction is claimed.

### 7.1 Workload and lifetime evidence

Final optimized workloads: **three tests/7,152 assertions PASS**,112.80s,
with independently sealed inputs and complete receipts in `workload-final.json`.
Each workload has ten regular records per session, a guest and correction for
every tenth session, historical-student fragments and current roster. Fixtures
span ministries and their ninety dates. Fixture setup is excluded from seal
timings; the measured operation includes real restricted-role projection,
coordination, encryption, inserts, required audit and commit, rather than HTTP
transfer or browser reconstruction.

| Sessions | Records | Measured seal seconds | Pages | Plaintext bytes | Ciphertext bytes | JSON response bytes | PHP peak bytes |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 1,000 | 0.516 | 22 | 656,370 | 1,170,948 | 662,311 | 50,855,936 |
| 1,000 | 10,000 | 3.410 | 214 | 6,539,142 | 11,664,940 | 6,597,137 | 55,050,240 |
| 10,000 | 100,000 | 35.425 | 2,133 | 65,368,340 | 116,604,496 | 65,948,517 | 88,604,672 |

The original pre-batching three-test pass is retained, with measured seals of
2.739,28.657 and280.225 seconds. It is baseline evidence, not relabeled as the
optimized result. Final tests verify every fragment count, ordered manifest,
bounded envelopes, immutable retry and last-page retrieval, with no applied credit.

| Sessions | Modeled 64 kbit/s | Modeled 256 kbit/s | Modeled 1 Mbit/s | Ideal 120-request/minute window wait floor |
| ---: | ---: | ---: | ---: | ---: |
| 100 | 82.789s | 20.697s | 5.298s | 0s |
| 1,000 | 824.642s | 206.161s | 52.777s | 60s |
| 10,000 | 8,243.565s | 2,060.891s | 527.588s | 1,020s |

Transfer is **modeled**, using measured serialized page-response bytes and
decimal bit rates, not encrypted database bytes. The rate model counts begin,
upload, seal and page reads, starting with an empty window; its first120 requests
require no preceding wait. Original receipts' earlier window calculation is
preserved; the final model corrects that initial-window offset without changing
the real throttle. Models exclude headers/TLS, latency, loss/retries, competing
sync traffic, per-request authorization/processing/queuing and client application.
All2,133 pages were integrity/count checked locally; a complete2,133-request HTTP
transfer was **not** timed. A network and rate-floor estimate are overlapping
constraints, not numbers to blindly add together.

These measurements further disprove a universal 15-minute promise. Four hours
can bound this isolated qualification but is not a universal production guarantee;
slower links, outages, processing or larger/skewed datasets can exceed it. Production
lifetime, quotas, scheduling, contention budget and operational retention remain
**PROPOSED/NOT QUALIFIED**, requiring stakeholder/target qualification. Expiration,
safe refusal, retained original input, supersession and audited cleanup are tested;
installed-client reconstruction remains outside this stage.
The largest measured seal holds its church gate for about35.4 seconds. Production
request/worker time budgets and worst-case contention/admission are not qualified;
no asynchronous infrastructure or throughput promise is silently selected here.

## 8. Disposable environment and preservation

Qualification uses only `msprout-b4-p2-2-dfa8c8f80b-postgres`, PostgreSQL 18 system
identifier `7698202853928955942`, fresh volume
`msprout-b4-p2-2-dfa8c8f80b-data`, internal network and database
`pc_dfa8c8f80b_test`. Restricted runtime, migration setup and maintenance identities
are separate. The PHP runner verifies this identity before Laravel/test bootstrap.
There are no published database ports, protected mounts, private environments or
development data fixtures. Public source/dependencies are copied into disposable
storage. See the [runner instructions](../../scripts/compatibility/snapshots/README.md).

Entry evidence retains all 39 protected development table fingerprints, role
attributes and migration state. In accordance with the resume instruction, no
fresh protected-database connection is used in the resumed phase. File hashes,
isolated-target guards, unchanged migration/private inputs and operation scope
support preservation; this is not falsely described as a fresh database census.
The 42 private/local-QA/backup files,11 stashes and other worktree identities remain
preserved. All32 frozen assets/two manifests,733 unrelated tracked source hashes,
stable Git refs and final Git checks are reconciled in the final preservation
receipt. Existing encrypted browser profiles
are never opened; all browser contexts used here are disposable.

## 9. Exact candidate inventory

Exactly **33 paths: nine modified and 24 new/untracked**. No path is staged.

| Status | Repository-relative path | Purpose |
| --- | --- | --- |
| NEW | `apps/api/app/Domain/Sync/RecoveryCodec.php` | Server-only authorized snapshot lifecycle, projection, encryption or atomic retention |
| NEW | `apps/api/app/Domain/Sync/RecoveryException.php` | Server-only authorized snapshot lifecycle, projection, encryption or atomic retention |
| NEW | `apps/api/app/Domain/Sync/RecoveryProjection.php` | Server-only authorized snapshot lifecycle, projection, encryption or atomic retention |
| NEW | `apps/api/app/Domain/Sync/RecoverySnapshotRetention.php` | Server-only authorized snapshot lifecycle, projection, encryption or atomic retention |
| NEW | `apps/api/app/Domain/Sync/RecoverySnapshots.php` | Server-only authorized snapshot lifecycle, projection, encryption or atomic retention |
| NEW | `apps/api/app/Http/Controllers/RecoverySnapshotController.php` | Server-only authorized snapshot lifecycle, projection, encryption or atomic retention |
| M | `apps/api/app/Jobs/PruneOperationalData.php` | Use narrow audited expiry cleanup inside existing maintenance transaction |
| M | `apps/api/bootstrap/app.php` | Existing safe correlated error rendering for snapshot refusals |
| NEW | `apps/api/config/recovery.php` | Default-disabled testing-only qualification and bounded quotas |
| NEW | `apps/api/database/migrations/2026_10_19_000003_qualify_recovery_snapshots.php` | Additive v1 binding, applied-credit fence and independently audited cleanup permissions |
| NEW | `apps/api/database/sql/recovery-snapshots.sql` | Additive v1 binding, applied-credit fence and independently audited cleanup permissions |
| M | `apps/api/routes/api.php` | Authenticated bootstrap-family child resource using established middleware |
| M | `apps/api/tests/Compatibility/RecoveryFoundationSchemaTest.php` | Retain foundation assertions with independent cleanup identity and dependent replay order |
| NEW | `apps/api/tests/Compatibility/RecoverySnapshotConcurrencyTest.php` | Snapshot fixtures and focused behavior/security/concurrency/workload proof |
| NEW | `apps/api/tests/Compatibility/RecoverySnapshotSecurityTest.php` | Snapshot fixtures and focused behavior/security/concurrency/workload proof |
| NEW | `apps/api/tests/Compatibility/RecoverySnapshotTest.php` | Snapshot fixtures and focused behavior/security/concurrency/workload proof |
| NEW | `apps/api/tests/Compatibility/RecoverySnapshotWorkloadTest.php` | Snapshot fixtures and focused behavior/security/concurrency/workload proof |
| NEW | `apps/api/tests/Support/SnapshotBrowserProbe.php` | Snapshot fixtures and focused behavior/security/concurrency/workload proof |
| NEW | `apps/api/tests/Support/SnapshotScenario.php` | Snapshot fixtures and focused behavior/security/concurrency/workload proof |
| NEW | `apps/api/tests/Support/SnapshotWorkers.php` | Snapshot fixtures and focused behavior/security/concurrency/workload proof |
| NEW | `apps/api/tests/Support/snapshot-worker.php` | Snapshot fixtures and focused behavior/security/concurrency/workload proof |
| NEW | `apps/web/e2e/compatibility/snapshots.spec.ts` | Opt-in real HTTP/browser preservation qualification |
| NEW | `apps/web/playwright.snapshots.config.ts` | Opt-in real HTTP/browser preservation qualification |
| M | `apps/web/src/api/generated.ts` | Generated contract types for the opt-in snapshot resource |
| M | `contracts/openapi.yaml` | Authoritative typed snapshot request, output, limits and error contract |
| NEW | `docs/qa/compat-01-b4-p2-2-server-recovery-snapshots.md` | Consolidated implementation, evidence, review and exact inventory |
| M | `knowledge/CURRENT_STATE.md` | Current task, qualification and preservation handoff; prior history retained |
| M | `knowledge/ROADMAP_STATUS.md` | Current task, qualification and preservation handoff; prior history retained |
| M | `knowledge/TESTING_ENVIRONMENT.md` | Current task, qualification and preservation handoff; prior history retained |
| NEW | `scripts/compatibility/snapshots/README.md` | Disposable runner boundaries and reproduction instructions |
| NEW | `scripts/compatibility/snapshots/bootstrap.php` | Guarded isolated database/browser harness; no production entry |
| NEW | `scripts/compatibility/snapshots/browser-server.mjs` | Guarded isolated database/browser harness; no production entry |
| NEW | `scripts/compatibility/snapshots/run.mjs` | Guarded isolated database/browser harness; no production entry |

Raw logs, helpers, database state, screenshots and seals under `.git/` remain ignored and excluded.

## 10. Review findings, downstream boundaries and recommendation

Production recovery stays disabled. No migration/deployment or protected grants
have been applied. Normalized-email target collision preflight, independent
maintenance secret/process/config-cache isolation, target migration admission,
drainage and monitoring remain separate deployment prerequisites. Qualified local
roles are not evidence those operational steps happened in a protected target.

All five original B4 recovery defects remain **OPEN** overall. This stage adds
server preparation/output; installed-client reconstruction, original-event
reconciliation, durable generation switching, applied confirmation and the final
completion proof require separately authorized P2-3/P2-4 and later qualification.
Installed legacy/new interoperability and retention recovery remain **NOT TESTED**
as complete end-to-end workflows. Late attendance and later roadmap work are
untouched. This candidate does not authorize a production lifetime, activation,
forced upgrade or cursor/receipt transition.

Final review: **zero BLOCKING and zero SHOULD FIX findings within P2-2**. The
403 privilege mismatch, audit rollback, depth boundary, retained ACL and fixture
findings above are closed with actual evidence. The stated downstream/operational
limitations are not declared implemented or approved.

Technically ready for stakeholder source review. Exactly33 paths remain unstaged;
HEAD/local/tracking/live feature branch remain the published parent at0/0. Local
main `d6c66694a8acc252815a088ada3ef8703340b038` and remote main
`5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f` retain their pre-existing independent
identities. No stage, commit, push, protected migration, deployment or production
activation occurred. Separate stakeholder publication authorization is required.

**COMPAT-01 B4-P2-2 — YELLOW: FULL SERVER SNAPSHOT IMPLEMENTATION COMPLETE, STAKEHOLDER REVIEW REQUIRED**

## 11. P2-2-REV-01 final source-review closure — 2026-10-20

**VERIFIED: finding confirmed and corrected. YELLOW: FINAL CORRECTED CANDIDATE
AND SOURCE-REVIEW ZIP READY; publication remains held.** This section is the
current review qualification; sections 6–7 preserve the original attempts and
results rather than relabeling them as fresh runs.

### 11.1 Root cause and bounded source correction

The v1 scope digest bound actor/membership/role, timezone, ministries and roster
but omitted the church-local date window. Seal separately calculated today from
the application clock. The generation therefore survived date rollover with the
same authority digest: prior-day pages, cross-date collection/sealing and even
an in-flight seal could return HTTP200 rather than a non-settling refusal.

`RecoveryProjection::scope()` now captures one PostgreSQL wall-clock instant
(`clock_timestamp()`, not the transaction-start timestamp), converts it to the
trusted church timezone and binds `window_start`/`window_end` into the canonical
scope digest. `window()` returns that captured pair; it never recalculates dates
for the projection. `assertCurrent()` revalidates the same date basis using the
same database clock after work. No client clock or supplied date is authoritative.

`RecoverySnapshots` preserves the existing post-gate authorization and compares
the new date-bound digest on begin retries, manifests, seals and retrieval.
Final checks follow original-input storage/retry, required begin/seal audit,
ready metadata/page-digest reads, and output integrity verification. A rollover
returns the existing HTTP409 `recovery_scope_changed` error. Mutation refusal
occurs within the existing controller savepoint: partial output, ready transition,
audit and any new hold/input write roll back together. Previously committed
original input, identities, prior pages and recovery-required state remain intact.

Only two product files changed relative to the v1 archive:
`apps/api/app/Domain/Sync/RecoveryProjection.php` and
`apps/api/app/Domain/Sync/RecoverySnapshots.php`. Regressions extend the existing
`RecoverySnapshotTest.php`; the affected workload fixture is corrected in the
existing `RecoverySnapshotWorkloadTest.php`. The remaining v2 edits are this
consolidated report and the three current-knowledge files: eight changed files
relative to v1, with no added candidate path. No migration, SQL
permission, request/response shape, configuration, dependency or workflow change
is introduced by this closure. Existing RLS, church gate, encryption, immutable
pages, expiry and completion fences remain unchanged. All other v1 file bytes
are checked unchanged.

### 11.2 Deterministic proof and fixture corrections

Explicit UTC instants are `2026-10-19T09:59:59.900000Z` for Pacific/Kiritimati
(UTC+14) and `2026-10-20T08:59:59.900000Z` for America/Adak (UTC-09 at that date).
Each is church-local October19 23:59:59.900. Advancing exactly200ms crosses local
midnight. SQL expiry/permission/activation clocks remain real. Only the exact
scope-clock query is controlled; all other database calls delegate unchanged.
An application-clock skew positive control proves the database basis wins.

The original retained fixture attempts failed before meaningful assertions:
an uninitialized partial DatabaseManager lost its application; a proxy with a
single matching scalar expectation intercepted the church-gate isolation query;
freezing after login invalidated session timing. The helper now proxies the
initialized manager, delegates every non-scope scalar, and establishes controlled
time before creating the authenticated disposable fixture. Page preservation
uses the actual `(kind, ordinal)` key, not an absent `id` column. These attempts
remain failed fixture evidence, not product failing-before proof.

The corrected failing-before run `test-inputs-1792444960176.json` has **six failures /
39 assertions**, each at HTTP409 expected versus actual HTTP200. Both product
file hashes match the independently reviewed v1 ZIP exactly. It reproduces
prior-day retrieval in both zones, pre-midnight begin/post-midnight seal, rollover
during output insertion, after the real required audit, and during page reads.
After the source correction, three preservation assertions initially objected
only to canonical JSON map-key order. Strict canonical-JSON equality now checks
all original identities, types and values; persisted ciphertext/device rows are
also compared unchanged. No existing assertion, timeout or security control was
removed or relaxed. The first nine-case closure is retained as intermediate proof.

The final ten-case set additionally covers rollover during final ready metadata
reads, begin audit and input insertion; captured-window immutability; and skewed
application time. Positive controls seal/read immediately before midnight, then
admit a genuinely new generation immediately after midnight. Its scope digest and
window advance together, yesterday's unreferenced edge falls out, today's session
enters, and the older authorized original-event target remains included. Stale
requests do not change generation metadata, settle events, advance applied credit
or clear recovery holds; fresh intent alone uses existing supersession behavior.

The first fresh workload attempt failed all three completeness assertions
(3 failed /7,038 assertions):99/989/9,889 sessions instead of100/1,000/10,000.
Its lightweight `ChurchScenario` object populates only id/status, so reading its
absent timezone silently selected UTC. The real persisted church uses Asia/Manila;
at observed UTC October19 21:45 its date was October20. The product correctly
excluded the fixture's extra prior-day edge, one session per90-session group.
The fixture now captures database time and reads the persisted timezone. All
original completeness/digest/size assertions remain, with two explicit window
assertions added per workload. This is an inherited fixture mismatch supported
by source and actual date geometry, not a claimed new baseline rerun. The failed
attempt and its input seals remain preserved; only this affected suite is rerun.

### 11.3 Fresh qualification and retained evidence

| Gate | Actual result and evidence |
| --- | --- |
| Affected lifecycle/date-window/security/RLS/concurrency/integrity/rollback | **56 passed (647 assertions) PASS**, 191.97s; `test-inputs-1792445132115.json`. Ten new midnight cases plus all46 existing snapshot cases. |
| Full current backend regression | **535 passed (5346 assertions) PASS**, 781.29s; `test-inputs-1792445354657.json`. Same complete Unit/Feature/Tenancy and current approved Compatibility collection as the original524-case run, including prior final-review additions and the ten new midnight regressions. Historical dormant prototype scenarios are not claimed rerun. |
| Fresh workloads | **3 passed (7158 assertions) PASS**, 146.54s; `test-inputs-1792446348719.json`. Existing large projection, page/count/digest, preservation and final-page assertions all retained. |
| Real browser compatibility | **4/4 PASS**, Chrome/native WebKit at390/1440px, zero failed/skipped/retries; `rev-01-browser-20261019T214852Z/results.json`. Real authorization/CSRF, worker, encrypted original-work equality, interruption, retry, supersession, expiry and revocation assertions remain intact. |
| Formatting/syntax | Final full Pint310 and all four changed PHP syntax checks PASS. The first formatter check failed only on new-fixture line endings; normalized text is byte-for-byte equal after newline normalization. `pint-format-equivalence.json` retains before/after seals; no assertion or executable token changed. |
| OWASP | Changed two services and both complete affected test files: zero findings, zero errors,98 rules. Prior comprehensive623-input baseline retains exactly its two unchanged mock PartialParsing warnings. Earlier three-input proof and final four-input closure are separately retained. |
| Unaffected gates | Frontend/build/types/lint/contracts, dependency audits and real PWA8/8 retain prior valid evidence: their source/configuration/dependency/build inputs are unchanged. Backend behavior is freshly covered above. No unused broad frontend rerun is claimed. Original failed aggregates and closures remain in sections6–7. |

The fresh aggregate seal predates the equivalent regression-file newline closure
and the isolated workload-fixture correction. Its explicit test collection does
not execute or import that workload file; all executed tokens/assertions remain
unchanged, so its guarantees remain valid. The affected workload suite is freshly
qualified after its correction. The final workload seal
matches every current API and executable harness input exactly. No test was
skipped, disabled or given a longer timeout. Final public-source/secret,
reference/anchor/whitespace and preservation receipts are in `rev-01/` under the
existing ignored evidence root. The v2 ZIP contains safe result summaries and
reference hashes, never raw logs or private evidence.

Fresh workload measurements below supersede only construction observations for
the corrected source; the original measurements/models in section7.1 remain
historical evidence. Transfer remains modeled, not a newly timed HTTP transfer.

| Sessions | Measured seal seconds | Pages | Serialized page-response bytes | PHP peak bytes |
| ---: | ---: | ---: | ---: | ---: |
| 100 | 0.364 | 22 | 662,311 | 50,855,936 |
| 1,000 | 4.213 | 214 | 6,597,137 | 55,050,240 |
| 10,000 | 35.190 | 2,133 | 65,948,517 | 88,604,672 |

This is disposable qualification, not a production performance/lifetime promise.
`rev-01/workload-current.json` retains all actual counts/bytes/retry measurements.

### 11.4 Final inventory, preservation and limits

The exact inventory in section9 remains **33 candidate paths: nine modified
tracked files and24 new/untracked files**. V2 packaging includes all33 current
files, this complete report, the complete33-path parent-relative review diff,
exact status/purpose/size/hash inventory, qualification references, checksum
manifest and compact archive verification. The previous v1 ZIP remains unchanged.
The new file is `Downloads/MSprout-B4-P2-2-Final-Review-v2.zip`; its external ZIP
checksum is recorded in the export receipt/final delivery, avoiding a recursive
checksum inside the packaged report.

Protected42-file hashes,11 stashes,10 backups,32 frozen assets/two manifests,
733 unrelated tracked source hashes, stable history/main refs and other worktree
identities are reconciled read-only. Existing39-table protected-database entry
fingerprints/role/migration receipts are preserved; there is no fresh protected
database connection or census. All new database work is confined to the same
independently guarded disposable PostgreSQL18 identity. No protected migration,
grant/credential change, deployment, activation, staging, commit or push occurred.

Date freshness is checked at the final server validation instant; no result can
promise that a calendar will not change during network transit or offline use.
Every later request revalidates. Existing absolute expiry is not lengthened.
Production quotas/lifetime, largest-workload contention/timeout budgets, target
deployment isolation and normalized-email collision preflight remain unqualified
or separately required as recorded above. All five original B4 recovery defects
remain OPEN overall; client reconstruction/completion and end-to-end recovery
remain NOT TESTED and reserved for separately authorized P2-3/P2-4.

Final review: **zero BLOCKING and zero SHOULD FIX findings within P2-2**.
Technical qualification is complete; overall status remains **YELLOW for
independent stakeholder review and publication authorization**. No hosted check
exists for this unpublished candidate. STOP; no later stage is selected.
