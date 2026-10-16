# COMPAT-01 B2 — complete pull reader and safe failure

## Stakeholder acceptance and controlled finalization — 2026-10-16

The stakeholder accepts B2 complete-page validation, safe unknown-state refusal, encrypted-work preservation and recovery presentation, including the actual desktop/tablet/phone screenshots. Finalization is explicitly authorized for the exact **19 paths:12 modified/seven new** listed below. The earlier24-file count is superseded. No additional implementation or visual changes are selected.

Task commit subject: **`fix: reject unsupported synchronization pages safely B2`**, parent `1cd96b31b50d0b61c2bc96f3178f2f2821b45367`, branch `feat/mvp-foundation`. The exact resulting SHA and committed manifest resolve through that commit in Git; the local publication record is `.git/msprout-compat-b2-20261016/publication-20261016/commit.json` and `final.json`. Exact-SHA hosted CI Web/API and Security results, run URLs and test counts resolve through `hosted.json` in the same directory after push and the stakeholder delivery report. This avoids a self-referential commit SHA or a second reporting commit. At commit preparation hosted results are pending, not passed. **B2 GREEN requires all required hosted successes and synchronized local/tracking/live feature HEAD.** A required hosted failure preserves the commit and stops work without a second correction commit.

The accepted local evidence remains808 frontend/81 files (100 focused included),306 API/3,626 assertions,58 distinct browser regressions through46 original passes plus12 documented closures,16 actual legacy/candidate reader observations,8 real PWA and4 B1 integrity cases. Initial failed attempts, unchanged two Semgrep parser warnings and Windows CRLF contract limitation remain explicit below. All executable code and fixture values match the accepted qualification. Finalization updates this report/three current-knowledge records and removes one extra blank line at EOF from `apps/web/src/sync/__tests__/pull-fixtures.ts`. Scope, links/anchors/whitespace, secrets, protected resources, frozen B1 identity and Git state are revalidated in the publication receipts; unchanged expensive suites are retained by effect.

Final staged whitespace check initially found that new fixture's extra blank line. The earlier unstaged `git diff --check` did not include untracked files. The staged gate correctly refused publication; the EOF-only correction leaves all tokens, assertions and fixture values unchanged. The final staged check, fixture lint and changed-source secret checks are rerun. No application/test behavior or broad test/security guarantee is invalidated, so no expensive suite is repeated. This resolved finalization finding remains documented rather than concealing the failed check.

B2 remains a defensive current three-state reader, not a fully Late-capable application. Actual installed-client upgrades and retention recovery remain **NOT TESTED**; declaration/error protocol, server mutation/cursor/retention/restart choices remain **PROPOSED**. B3–B6, ATT-LATE-01 and Pack06 remain unauthorized. No backend/contract/schema/encryption/update-policy change, merge, deployment or production-data operation. **STOP after this19-path finalization and exact-SHA hosted qualification.**

## Preserved pre-finalization review checkpoint

The review-stage status/hold statements below record the submitted, unstaged checkpoint. They are superseded only for the explicitly approved19-path B2 commit/push above; their evidence, failure ledger, preservation requirements and future-stage exclusions remain intact.

Date: 2026-10-16. Branch: `feat/mvp-foundation`. Parent/checkpoint: `1cd96b31b50d0b61c2bc96f3178f2f2821b45367` (B1). **B2 only; unstaged review candidate. No commit/push authorization.** B1 publication and its historical report remain preserved. B2 does not qualify the overall compatibility program or enable Late.

## Verified cause and implementation

The former pull reader checked the envelope/order/lease superficially, then examined attendance values only while projecting a matching local draft. Unknown states in an unmaterialized session were silently ignored while its cursor and replacement authorization advanced. With a local draft, invalid states, unknown guest values and statuses could be coerced or omitted. An unsupported entity/action could also be skipped. These are reader defects, not authorization denials.

`validatePullPage` now validates the entire authorized page before decryption, projection or durable page writes. The existing profile write transaction still atomically commits projections, scoped revocations, encrypted authorization and cursor. A refused page never reaches that transaction. Preparation/encryption/storage/locking failures abort page effects; replacement-lease expiry is checked again at both transaction boundaries. Existing authorization capture remains in force. The initial `syncNeedsPull=true` marker is intentional: a failed download must remain incomplete even when uploads were previously acknowledged.

The existing uploaded-event settlement and earlier valid page commits remain authoritative. Refusing a later page does not recreate their outbox events, manufacture rejection receipts or claim rollback of those earlier operations. Supported assignment revocation retains the established encrypted quarantine; malformed pages containing a tombstone do not apply it. No backend, wire contract, bootstrap, cursor meaning, encryption schema, service-worker policy or authentication behavior changes.

Only Sync's error feedback changes visually. The existing accessible error summary explains: “Downloading could not be completed safely. Saved local work remains protected. Previously acknowledged uploads remain accepted. Retry with this existing profile; keep browser storage if the problem continues.” No success is announced for refusal. Existing retry, PIN, sign-in and lock boundaries remain intact.

## Current producer/contract mapping

Sources: [`PublishAttendanceChange`](../../apps/api/app/Domain/Attendance/PublishAttendanceChange.php), [`PullChanges`](../../apps/api/app/Domain/Sync/PullChanges.php), [OpenAPI](../../contracts/openapi.yaml), [existing lease binding](../../apps/web/src/offline/lease.ts). The pull payload is the producer projection, not the larger online AttendanceSession resource: for example, `church_id` is not emitted by the current pull producer and is checked when supplied rather than made mandatory.

| Surface | Validation / compatibility |
| --- | --- |
| Envelope and pagination | Object/arrays, at most the requested 100 changes; digit-string cursors/sequences; strict sequence increase after applied cursor; returned cursor at least last change; `has_more` boolean and forward progress. Authorization-filtered gaps and empty advancing pages remain legitimate. |
| Supported meaning | Only `attendance_session/upsert` and `ministry_assignment/tombstone`; UUID entity/ministry, positive safe-integer version. Tombstone payload ministry must match its enclosing scope. |
| Session | Matching payload entity/ministry/version, real calendar date, required records/guests, all five existing statuses: draft, finalized_pending, finalized, needs_review, revised. No unknown-status fallback. |
| Records | UUID record/student IDs, supported three-state string and positive safe-integer version; duplicate IDs/students refused. Every row is checked even without a local draft. |
| Guests | UUID ID, current 1–120-character display-name bounds, supported gender, Present only, current pending/promoted/linked/merged status, valid optional nullable resolution IDs; duplicates refused. |
| Known optional fields | Valid nullable finalization timestamp/actor; matching church when present. Active producer rows emit null deletion fields; non-null deletion semantics are refused because this reader has no approved deletion projection. No deletion behavior is invented. |
| Lease | Object; numeric actor string, UUID church/device/membership, 64-hex signature, valid timestamps and issued-before-expiry/unexpired interval; existing actor/church/device/profile bindings retained. This is structural/binding validation, not a newly introduced cryptographic signature verifier. |
| Harmless metadata | Additional properties are retained and tolerated; existing semantic fields cannot change type or meaning. |
| Local projection | Saved session/profile/church/ministry/date bindings must match; every original local roster entry must be represented. Extra fully validated records remain permitted because legitimate guest promotion can add server records outside the original local roster. |

Membership ID is structurally checked; the current profile does not persist a membership ID against which to introduce an additional comparison. Existing authenticated transport and authorization rules remain the authority. No B3 membership/capability protocol is implied.

## Failing-before / passing-after and preservation proof

Evidence directory: ignored `.git/msprout-compat-b2-20261016/`. It contains only this task's disposable builds, isolated browser outputs, traces, receipts and diagnostic helpers. It is excluded from the candidate.

- `unknown-state-red.log`: the existing implementation resolved a synthetic unsupported `late` page with no local draft instead of rejecting, demonstrating the cursor-loss defect. `validator-red.log` is an initial missing-module development result, not independent proof of that bug.
- `ui-red.log`: the prior generic UI did not provide the required truthful protected-work guidance. New focused feedback assertions cover refusal, no false success, usable retry and no unintended locking.
- Whole-page validator tests cover unsupported states/entities/actions, malformed nested data, identifiers/versions, dates/statuses, duplicate identities, cursor ordering, leases and supported metadata/nulls/statuses.
- Real PBKDF2/AES-GCM and isolated IndexedDB tests compare every stored table byte-for-byte after refusal and decrypt the original draft and pending event to establish semantic identity. The pending event inserted after the upload snapshot retains its original ID; existing conflict/authorization/cursor records remain exact. Supported retry settles only an explicit synthetic result for that original ID.
- Separate tests prove earlier valid upload acknowledgment/page preservation, rollback on storage/crypto/lock/authorization or replacement-lease expiry, refused tombstone atomicity, valid tombstone encrypted quarantine/provenance, and legitimate guest-promotion records.
- No test removes assertions, increases timeouts, disables product security or changes expected production state to obtain a pass. The existing sync-client unit fixture now pins only Date to its actual lease fixture date; production expiry checks remain unchanged.

## Distinct frozen legacy and candidate browser evidence

Frozen legacy remains UX-F3 `9c30def911bb59ae02ecfd3fa291607f141b8c68`. Both B1 independent frozen outputs and all16 assets remain unchanged. Legacy app SHA256: `d93a0484bea91e4880875dcc8b3a953bde0592524061f53e40af7172fcfc8df3`; worker: `fa2c7fcddaa63accedcb4c3e3e5c336c6eb21d8bc9b182ec0cd5fb0af2ee2b41`.

The uncommitted B2 build is explicitly marked `B2-uncommitted-candidate`, based on B1 HEAD, with source-snapshot SHA256 `7f4e25750570d9e714910ec2e6b2b2936a0e2fa02ae8b144a66ddab2ff3bbbb8`. The base commit is not represented as the committed identity of candidate code. Manifest and exact asset hashes live in `candidate-final/manifest.json`. App `assets/index-CC3BbFej.js` has SHA256 `e31a7fd7e4ea6b1c579545064035f144d1be687843a231ff310f9e3ab2f9ba35`; worker `b5e62119e9be12632f21ee860b1dacf965260f6ef37fecf3a01ded6f6b8bf24a`. A separate working-source build does not modify frozen legacy assets or substitute a current build under a legacy label. All114 non-test runtime source inputs match the final build manifest.

The limited reader matrix uses genuine distinct assets at320/390/768/1440px in installed Chrome and native WebKit. Real UI preparation creates isolated encrypted profiles; all server responses are explicitly synthetic. The legacy accepts unsupported `late` without a local projection (known unsafe baseline). The candidate refuses the entire page, preserves its stored snapshot and does not install the new lease/cursor; a later supported response completes normally. No push occurs. Browser checks cover the actual alert, retry, no false success, serious/critical accessibility findings and horizontal overflow. Service workers are blocked only in this limited intercepted-reader matrix; separate PWA tests retain real activation and safety assertions.

**This is not an installed-client handoff test.** Fresh browser contexts are used for each build; the reader matrix has no existing attendance draft/outbox. Real encrypted pending-work refusal is proved separately by the storage/crypto tests and existing browser preservation regression cases. Synthetic accepted receipts in unit/regression fixtures are not evidence of live server acceptance.

Reader matrix: `reader-first.log` passed16/16 (eight legacy/eight initial candidate). `reader-final.log` passed8/8 against the final candidate. The eight legacy observations remain valid; the final candidate observations replace, rather than add to, the same eight candidate cases. Eight final refusal screenshots cover both engines at all four widths, under `reader-final/`; actual phone390/tablet768/desktop1440 WebKit images were visually inspected. Error text is legible, the retry remains available, and the approved light/navy/blue layout is retained. A keyboard-focused skip link can be visible in a phone capture; this is the existing accessibility control, not a new layout element.

For local reproduction, preserve the two B1 frozen directories. Use the retained ignored `build-candidate.cjs` helper with a **fresh** direct-child output name to snapshot only tracked/new web inputs, junction existing dependencies, clear inherited `VITE_*` values, set only the public test site key, and build without installation. It records source/asset SHA256 manifests and refuses existing outputs. This disposable qualification helper is intentionally not committed or claimed as a generalized build framework. Set `COMPAT_B2_CANDIDATE` to that manifest and `COMPAT_B2_OUTPUT` to a fresh direct-child evidence directory, then run `pnpm --dir apps/web exec playwright test --config playwright.reader.config.ts`. Set `PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH` to the documented native executable on this Windows host. Existing outputs/profiles must not be reused or deleted. The helper, complete diff and receipts remain available for stakeholder review locally; fresh-checkout installed-upgrade reproduction is not claimed.

## Validation ledger

Raw failed attempts are retained alongside their closures; pending checks are not passes. Final receipts are ignored local evidence, not committed runner artifacts.

| Gate | Final qualified outcome | Evidence / limits |
| --- | --- | --- |
| Complete frontend | PASS808/808,81 files | `frontend-final.log`;100 focused cases included, not extra. Initial four failures retained. |
| Complete API | PASS306/306,3,626 assertions | `api-linux-full.log`; unchanged tests/source,PHP8.3.35 existing container. Earlier native and mounted-source failures remain failures. |
| Actual distinct-build reader matrix | PASS16 distinct cases | Legacy8 expected-unsafe observations retained; final candidate8 safe refusal/retry cases. Initial candidate8 replaced, not double-counted. Chrome/WebKit at320/390/768/1440px. Synthetic API, fresh contexts. |
| Affected browser regressions |58 distinct cases with passing proof |46 initial passes +12 verified focused closures. Initial58-case aggregate had12 failures and is not relabeled passed. |
| Real worker/PWA | PASS8/8 | Final assets; real activation/controller/notice, pending encrypted-work deferral, offline/cache protections. Same-build update policy, not B5 handoff. |
| B1 harness integrity | PASS4/4 | Exact copied frozen assets; original B1 source/output untouched. |
| Types/lint/build | PASS | Final web types/lint, independent reader-harness types, isolated production build; final selector lint closure. |
| API style/dependency metadata | PASS | Pint and strict Composer validation; unchanged backend. |
| Dependency security | PASS | Composer and pnpm audits report no known advisories/vulnerabilities. No dependency changes. |
| Contract | LF-only isolated proof PASS | Raw Windows command retains CRLF-only failure; tracked OpenAPI/generated source unchanged. |
| Structure/whitespace | PASS | Structure script and final `git diff --check`; no relocation/cleanup. |
| OWASP | Zero findings | Full99 applicable rules/428 files retains two unchanged PartialParsing warnings. Final15 changed inputs plus exact-selector closure have zero findings/parse errors. Not an unqualified claim of complete parsing. |
| Secrets | PASS647 tracked/new inputs | Retained complete-source scan plus hash-verified changed-document scans. Ignored private/dependency/runtime/build data excluded. |
| Documentation | PASS237 references | Paths/anchors/title/whitespace; final inventory and actual Git state agree on19 paths. |
| Preservation | PASS | Original39-table/role fingerprint, private2/backups10/local-QA30/stashes11, frozen assets/main/history unchanged. |
| B2 hosted CI/Security | NOT RUN | Uncommitted review candidate; no B2 SHA/publication. B1 hosted successes are predecessor evidence only. |

Initial comprehensive frontend:803 passed/4 failed of807 in81 files with four workers. The unchanged conflict/review/report failures were timing/observation failures under concurrent validation. Exact unchanged serial rerun:51/51 in those three files. **Final complete single-worker aggregate:808/808 in81 files passed**, including the additional positive guest-promotion case (`frontend-final.log`,618.16s). The final aggregate includes100 focused validator/client/encrypted-preservation/Sync screen cases. No timeout or assertion changes were made to close the initial failures.

Preserved failed-attempt ledger:

| Attempt | Actual failure / classification | Closure |
| --- | --- | --- |
| `validator-red.log` | One suite could not import the not-yet-created validator; development setup, not proof of the old product bug. | Validator51 cases in `focused-second.log`/final aggregate pass. |
| `unknown-state-red.log` | One selected regression failed because the old reader resolved the unsupported page and advanced its cursor. Other14 tests were excluded by the focused name filter. | Same regression passes in the15 client cases and final808 aggregate. |
| `ui-red.log` | One selected feedback regression failed against the old generic wording; other23 tests excluded by name filter. | All24 Sync screen cases pass in focused97 and final808. |
| `focused-first.log` | 56 pass/8 fail: real-calendar expiry made the original14-day fixture stale; guest fixture omitted current producer binding fields. Test-fixture defects exposed by stronger validation. | Date-only deterministic fixture and full payload;64/64 in `focused-second.log`, then97/97 and final100 focused cases inside808. |
| `crypto-first.log` | 7 fail: new test setup supplied key-material wrapper rather than an unwrapped CryptoKey to WebCrypto. Test-helper defect. | Real `unwrapDataKey`,7/7 in `crypto-second.log`; three additional preservation cases bring this file to10 in final808. |
| `frontend.log` | 803 pass/4 fail: two5-second conflict workflow timeouts, one subsequent guest-action observation and one warm-report request-count observation in unchanged files. | Exact unchanged serial51/51, then clean complete808/808; no timeout/assertion edits. |
| `api.log` | 305 pass/1 fail: cURL28,12,553ms/zero bytes on isolated real-HTTP Platform login. Transport/startup timing failure; no product cause independently established. | Unchanged two-dataset serial closure2/26 assertions; complete-suite closure is recorded separately below. |
| `api-final.log` | Resumed mounted-source PHP8.3.35 container run:304 pass/2 fail,3,601 assertions,353.22s,exit2. Platform HTTP readiness exceeded the original15-second budget in one case; the other `/health/live` request hit the original5-second cURL28 timeout. Pest additionally could not write its result cache to the read-only dependency mount. | Same274 byte-identical source files and existing dependencies copied into disposable container-local storage; original `.env` stays mounted read-only. Unchanged Platform cases2/26 pass in4.21s; subsequent complete suite306/3,626 passes in102.46s. No timeout, assertion or product edits. |
| `regression.log` | 46 pass/12 fail: eight stale unlock/control selectors plus four origin4173-vs4239 wire-assertion failures. | Current selectors and expected isolated origin:ten pass; the two lock-substring failures close in final2/2. |
| `regression-closure.log` | 10 pass/2 fail: “Lock profile” substring matched both the existing Lock and Unlock accessible names. | Exact-name selector; `profile-selector-final.log`2/2 passes. |
| `pwa-final.log` | Zero tests executed: ignored mirror lacked unchanged package ES-module context; `import.meta` could not load. Local runner setup. | Byte-identical package metadata restored to mirror; real PWA8/8 passes. |
| `contract-raw.log` | Exit1 for known Windows CRLF-only generated-client drift. Platform limitation, not a schema change. | Isolated LF mirror passes; original tracked bytes unchanged. Raw Windows command is not relabeled passed. |

Focused name filters are not permanent skipped/disabled tests. Final frontend808, reader matrix16, PWA8 and browser regression58 contain no skipped cases. No `.skip`, `.todo`, coverage removal or timeout increase is introduced. Existing service-worker fixture blocking is confined to intercepted non-PWA probes; all real PWA assertions remain exercised.

API comprehensive:305 passed/1 failed,3,615 assertions. The unchanged real-HTTP Platform runtime test timed out with cURL28 and zero response bytes. Both unchanged Platform HTTP datasets then passed serially:2 tests/26 assertions. This is305 aggregate passes plus focused closure of the one failed dataset, not a claim that the original full run passed. Backend source/fixtures/keys/database initialization remain unchanged.

**Complete API qualification on resume:306/306 passed,3,626 assertions,zero skipped,exit0**,102.46s (`api-linux-full.log`, wrapper `api-linux-run.log`). This is a genuine complete passing API result after the final B2 runtime changes; it replaces the earlier lack of a clean aggregate without relabeling either failed run. The existing `msprout-api:task18` image supplies PHP8.3.35; the previous native PHP8.3.33 temporary runtime was unavailable on resume. No runtime/dependency installation or global configuration occurs. Read-only original source/private environment plus an ephemeral Linux source/dependency/runtime copy avoid Windows bind-file latency and allow disposable Pest cache writes. Guarded tests still use the separate PostgreSQL18 test database/restricted role; no backend suite runs concurrently. Both before/after39-table development/runtime-role fingerprints match the original entry fingerprint exactly.

The mounted-vs-local timing difference supports an execution-environment explanation for the resumed HTTP failures; the precise internal scheduling cause of the original native timeout was not independently traced. The verified cache write failure is a runner mount configuration problem. No speculative application repair is made. All original five-second HTTP and fifteen-second readiness limits remain intact. Original Windows failure, native focused closure, resumed mounted failure and clean container-local aggregate are reported separately.

Fresh B1 harness integrity:4/4 passed on a byte-exact copy under B2 resources, leaving original B1 assets/evidence untouched. Final types, lint, standalone reader-harness types and production build pass (`typecheck-final.log`, `lint-final.log`, `reader-types.log`, `build-final.log`). Pint, strict Composer validation, Composer audit, pnpm high-severity audit and structure pass. Root `verify` combines the same frontend/type/build/API gates; their recorded constituent outcomes are used without duplicating the expensive suites. Raw Windows API generation reports the known CRLF-only drift; an LF-only isolated mirror passes without modifying tracked contract/generated bytes. The limitation is retained, not called fixed.

Comprehensive OWASP application scan:99 applicable rules,428 scanned files,zero findings. Two PartialParsing warnings are in unchanged generic mocks in ApplicationScreen.test.tsx and AuthScreen.test.tsx; their parse limitation is preserved and disclosed. Final changed/directly relevant source rescan:77 applicable rules/15 inputs,zero findings and **zero parse errors** (`semgrep-final.json/log`). Ignored credential/dependency/runtime/build output is excluded; relevant new source is included. No scanner exclusion or workflow changes.

The final exact lock-button selector has its own lint and OWASP rerun (`selector-lint.log`, `semgrep-selector.json/log`), preserving prior unchanged-source coverage. Gitleaks scans all647 tracked/new files, including new source and a text alias for the lockfile:zero leaks. Changed documentation link/anchor/title/whitespace review checks237 local references with zero errors. The complete final tracked/new diff is `.git/msprout-compat-b2-20261016/candidate-final.patch`; the earlier `candidate.patch` is preserved. No staging is used to produce either diff.

Real PWA qualification on final candidate assets:8/8 Chrome/native WebKit passed (`pwa-qualified.log/json`): offline assets, protected-route cache exclusions, exact pending encrypted-work update deferral, real waiting-worker activation/controller identity and notice removal. Unchanged test/server/support files and package module context are copied byte-for-byte into an ignored isolated project pointing only to final build output, leaving existing `apps/web/dist` intact. Initial `pwa-final.log` records a local mirror setup failure (missing ES-module package context, zero tests executed); restoring the unchanged package metadata resolves it without test/product changes. This remains a same-build update-policy test, not B5 distinct-client handoff.

The initial browser regression runner used a loopback-only static origin on4239, without Vite's live-API proxy. Referrer tests correctly refused that origin because their unchanged wire assertions expect4173. Their closure uses the expected4173 origin. Four older profile tests still addressed the pre-UX-F2 unlock control as “Use profile 1”; the current control is “Unlock Profile 1”. Only those post-PIN selectors changed, including persisted-delay enabled/disabled assertions; no safety expectation was removed. The lock selector additionally uses exact matching so it cannot match “Unlock”. The full needs-review pull fixture now supplies the current producer's required fields. All raw failing traces remain available.

Browser regression selection:58 distinct cases across Chrome/native WebKit. `regression.log/json` records46 passes/12 failures; every failure has the fixture/runner cause described above. The twelve affected engine/case pairs close through `regression-closure.log/json` (ten passes; the two remaining lock substring-selector failures are retained) plus `profile-selector-final.log/json` (both exact-selector cases pass). All58 distinct cases therefore have valid passing evidence; **the original aggregate did not pass**. The original retry delay, post-reload persistence, original pending-event IDs/counts, origin-only referrers/cookies, auth-denial behavior and encrypted-storage preservation assertions remain intact. These are focused closures, not a representation that the earlier failing aggregate was green.

Invalidation: the final production correction only removes an overly strict extra-server-roster-record rejection. Full final frontend/crypto tests include a positive guest-promotion case; final reader8 and real PWA8 use the final assets. Earlier browser regression passes using the first candidate are retained only for fixtures with empty change pages or an exact matching original roster, where that removed comparison cannot alter behavior. Final-build focused closure checks cover all changed profile selectors and wire-origin cases. Test-only selector/fixture corrections invalidate their browser proof and relevant lint/scanning, not unchanged backend/contract/crypto/update-policy gates. Documentation updates invalidate only documentation/secret proof. No expensive still-valid suite is repeated merely for reassurance.

## Exact candidate inventory

**Inventory reconciliation on resume:** the stakeholder's interruption summary reports24 changed files. Actual `git diff --name-only`, `git ls-files --others --exclude-standard` and the preserved pre-interruption `review.json` all agree on **19 candidate paths:12 modified tracked files (`M`),7 new untracked files (`??`)**. No additional five source paths are present or identified in the saved receipt. Ignored diagnostics, snapshots and receipts are separate local evidence, not added to manufacture a24-file source inventory. No work was removed, reverted, recreated or silently excluded. The exact authoritative inventory below is19, not24.

No B1 harness source, workflow, dependency, backend, contract, profile schema or governance change.

Modified (`M`):

1. `apps/web/e2e/offline-guest-lifecycle.spec.ts` — current post-PIN unlock selector.
2. `apps/web/e2e/offline-restart-sync.spec.ts` — current post-PIN unlock selector.
3. `apps/web/e2e/online-profile-recovery.spec.ts` — current post-PIN unlock selector.
4. `apps/web/e2e/ui-profiles.spec.ts` — retry-delay assertions address the actual unlock action.
5. `apps/web/e2e/ui-sync.spec.ts` — complete current-producer needs-review fixture.
6. `apps/web/src/features/synchronization/SyncScreen.tsx` — narrowly scoped accessible refusal wording.
7. `apps/web/src/features/synchronization/SyncScreen.test.tsx` — refusal/retry/no-success regression.
8. `apps/web/src/sync/sync-client.ts` — complete validation, safe projection and lease-expiry guard.
9. `apps/web/src/sync/sync-client.test.ts` — expected-red regression and valid fixture/date correction.
10. `knowledge/CURRENT_STATE.md` — selected B2 checkpoint and hold.
11. `knowledge/ROADMAP_STATUS.md` — B2 status and later-task exclusions.
12. `knowledge/TESTING_ENVIRONMENT.md` — actual evidence/reproduction/limitations.

New/untracked (`??`):

13. `apps/web/src/sync/pull-validation.ts` — current-producer semantic validator and safe error.
14. `apps/web/src/sync/pull-validation.test.ts` — full-page contract-boundary cases.
15. `apps/web/src/sync/pull-preservation.test.ts` — real encryption/atomicity/pending identity proof.
16. `apps/web/src/sync/__tests__/pull-fixtures.ts` — explicit synthetic current-producer fixtures.
17. `apps/web/playwright.reader.config.ts` — isolated, fresh-output, limited two-engine reader configuration.
18. `apps/web/e2e/compatibility/reader.spec.ts` — synthetic distinct-build reader matrix.
19. `docs/qa/compat-01-b2-reader-validation.md` — this review record.

The four selector-only test paths were added to make the existing preservation regression tests address the approved UX-F2 control identity. This is test maintenance directly supporting B2 qualification, not a profile redesign or weakened unlock behavior. Screenshots, helper scripts, raw logs, build outputs and scan snapshots remain ignored and uncommitted.

## Boundaries, review and remaining gaps

**VERIFIED:** whole-page refusal before durable apply, supported producer acceptance, page atomicity, retained earlier verified work, truthful recovery feedback and isolated preservation evidence described above. Final source/diff review is complete: **zero BLOCKING, zero SHOULD FIX** within B2. No weakened assertion, scope leakage, new layout behavior, hidden failure or protected-resource discrepancy remains. Qualified for B2 stakeholder review; not committed or GREEN delivered.

**PROPOSED:** future compatibility declaration/error policy, protocol versioning, mutation rules, retention/bootstrap/cursor recovery and restart strategy remain undecided. No policy is implicitly selected by B2.

**NOT TESTED:** genuine installed old/new PWA transition, shared storage handoff, multiple-window cross-version safety, retention recovery, live old/new API interoperability and physical-device behavior. B3–B6 and a complete Late-capable domain/reporting/correction reader are prerequisites for later claims; no Late writing/reading activation is enabled here.

**BLOCKED BY AUTHORIZATION:** staging, commit, push and every later task. This is the requested review hold, not a missing technical check. No hosted workflow has run for this uncommitted candidate; B1's hosted successes apply to B1 only. No GREEN delivery claim is made for B2.

Read-only development PostgreSQL fingerprint:39 tables and runtime-role attributes remain byte-identical before/after isolated API qualification. Protected file groups, stashes, backups, original history, main and frozen assets remain unchanged. Exact final Git/preservation receipt and complete diff are retained locally. Stop for stakeholder review and separate finalization authorization; no merge, deployment or application-data operation.

Final Git/preservation checks: HEAD/local tracking/live feature remain B1 `1cd96b31b50d0b61c2bc96f3178f2f2821b45367`, ahead/behind0/0, staging empty. Local main `d6c66694a8acc252815a088ada3ef8703340b038` and origin/live main `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f` retain their respective entry identities. Two protected private files (including environment/key material and SQLite),10 backup files,30 local-QA files and11 stashes remain unchanged. No unexpected tracked byte changes outside the19-path inventory. B1 frozen manifests/assets and original harness source are preserved. New diagnostics, traces, screenshot manifest and complete patch remain ignored under `.git/`; existing generated dist is unchanged. The worktree intentionally contains this unstaged candidate. No B2 hosted result exists.
