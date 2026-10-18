# COMPAT-01 B4-P2-1B-C — integrated authority qualification

## Stakeholder-approved C publication — 2026-10-18

The stakeholder completed consolidated C1–C4 source review and explicitly authorized guarded publication of exactly76 files (47 modified,29 new) from parent `8017e3b44e5211bcf1dac3b5a78e8ee37cec192f`, with commit subject `feat: integrate B4-P2-1B-C authority safeguards`. The earlier dated review hold below remains an accurate historical record; this later approval supersedes that hold only for this specific C publication.

All76 candidate bytes matched the reviewed ZIP and final qualification seals before these status notices. Executable, test, migration and configuration inputs remain unchanged. Retain API422 tests/4,306 assertions, frontend813/82 files, actual browser4/4, PWA8/8 and the documented contract/style/build/dependency/security passes, including original failures, two unchanged OWASP TSX parser warnings and the raw Windows CRLF limitation. Finalization changes only this notice and the equivalent notices in the existing C report/current-state/roadmap/testing files; fresh reference, whitespace, secret and staged-content validation applies.

The exact resulting commit, inventory, normal push synchronization, protected-resource checks and exact-SHA hosted Web/API/Security results resolve through Git and ignored `.git/msprout-compat-b4-p2-1b-c-20261017/publication/{commit,synchronization,hosted-latest,finalization}.json`. Publication is GREEN only after clean synchronized Git, required hosted successes and preservation verification; a pending or failed result is not a pass. No predecessor hosted result qualifies the C commit.

Publisher activation, protected database migration and deployment remain prohibited. The normalized-email migration requires a separately approved target collision preflight. All five original B4 defects remain open; B/D/E and all later implementation remain separately unauthorized. **STOP after C publication verification.** No additional commit, merge, deployment, activation or next-stage implementation is authorized.

**YELLOW: FULL IMPLEMENTATION COMPLETE, STAKEHOLDER REVIEW REQUIRED.** C1–C4 form one unstaged review candidate. Parent remains `8017e3b44e5211bcf1dac3b5a78e8ee37cec192f` on `feat/mvp-foundation`. No staging, commit, push, merge, deployment, protected migration or publisher activation is authorized. Hosted qualification for this unpublished candidate is **PENDING / NOT RUN**, not inherited from parent A.

## Authority and implementation

The stakeholder's full integrated C authorization supersedes the proposed internal C1/C2/C3 approval stops, while retaining the publication hold. [Current knowledge](../../knowledge/CURRENT_STATE.md), [roadmap status](../../knowledge/ROADMAP_STATUS.md) and [guarded reproduction](../../scripts/compatibility/authority/README.md) route this candidate. B, D, E and all later recovery work remain separately gated.

### C1 — global User and persisted session assurance — VERIFIED

Global Users are locked in numeric order with declared read/write strength before session/domain work. The existing database session store supplies authoritative principal, lifetime and current security claims; no authorization-generation schema was added. Post-wait validation reloads verified email, password and MFA state. Password proof accepts both formats actually supported by installed Laravel/Sanctum: the HMAC cookie proof and legacy raw password hash; malformed or mismatched proofs fail closed using constant-time comparisons.

Authenticated persistence locks User before the session row. A delayed ordinary request cannot recreate a deleted/expired authenticated session or restore old MFA claims. Only a server-issued, immutable, request-local permit tied to actor, identity and session can admit a genuinely new login/MFA/verified-remember session; ordinary permits cannot recreate deletion. Failed audit/authentication rollback removes that permit. Password changes preserve only the explicitly authenticated current session; resets revoke all old sessions and rotate remember tokens. Pending MFA is bound to the checked identity. Remember restoration rechecks the actual token/password cookie proof and does not inherit MFA/recent-password assurance. Platform and church guards remain distinct.

### C2 — real member authority — VERIFIED

Actual tenant HTTP entry points acquire church `FOR NO KEY UPDATE`, then sorted global Users, authoritative session and existing domain policies/locks. Coordination requires the outer READ COMMITTED transaction, rejects late domain/advisory acquisition and issues a callback/PDO/backend/XID/church-bound capability. Membership, Owner MFA, ministry assignment, device and existing operation policies are freshly checked after waits. Owner transfer/teacher access changes predeclare affected Users with write strength before session revocation.

The complete existing API suite preserves attendance correction/conflict/guest behavior, roster/import/report scope, sync receipts/idempotency/cursors, offline lease/bootstrap, push subscriptions, audits, one active Owner and password/TOTP requirements. Account/session navigation uses the global fence without the unnecessary exclusive church queue. No feed producer was converted.

### C3 — signed invitations and normalized identity — VERIFIED IN DISPOSABLE ENVIRONMENT

A private verified-proof value supplies tenant scope before membership exists. Proof, invitation lifetime/revocation, identity and persisted session are rechecked after authority waits; the owning transaction restores scope on success/failure. Existing-account mismatch remains403, unusable proof410 and conflicting identity422. User creation, membership/assignment, proof acceptance and required audit are atomic; no implicit account replacement or credential reset occurs.

The additive migration creates `users_normalized_email_unique` over `lower(btrim(email))` only after a collision check. A collision refuses without merging, renaming, deleting or rewriting account/email display values. Concurrent case-variant acceptance receives a safe conflict after rollback. Protected/deployment-target collision status is **UNKNOWN / NOT TESTED**: an isolated synthetic pass cannot authorize deployment or establish protected identity cleanliness. A separately approved target preflight and resolution process are prerequisites to applying this migration there.

Private invitation mail remains synchronous. An isolated loopback SMTP protocol fixture proves acceptance/refusal, own-church queueing and rollback; it discards raw proof mail and never sends externally. External provider delivery, recipient inbox behavior and high-load throughput are **NOT TESTED**.

### C4 — explicit trusted system authority — VERIFIED

The internal adapter has explicit BirthdayNotification, RetentionCleanup and RevokedDeviceCleanup purposes, no fabricated User, no HTTP route/human-guard authority, a restricted non-owner/no-bypass runtime and forced tenant RLS. Notifications require active church status. Cleanup authority separately permits actual schema status `suspended`; no fictional inactive status was added. Scope and transaction identity are bounded and restored. Existing notification/prune/cleanup jobs remain on their original paths; maintenance conversion, partial-success/audit redesign and publisher use belong to D/B and are **NOT IMPLEMENTED**.

## Qualification matrix

All backend suites ran sequentially against the independently verified disposable C PostgreSQL18 environment.

| Gate | Actual final result | Evidence under ignored C evidence root |
| --- | --- | --- |
| Complete ordinary API plus explicit C/recovery proofs | **422 tests / 4,306 assertions PASS**,538.01s;339 ordinary API +83 compatibility/recovery cases | `combined-final.log`; `d4d1951d46/result-1792240239782.json` and paired input seal |
| Concurrency subset included above |20 independent-backend cases PASS; observed PostgreSQL waits, not sleep-only proofs | `AuthorityConcurrencyTest.php`; final combined raw log |
| Frontend |**813 tests /82 files PASS**,463.70s | `frontend-final.log` |
| Actual API-backed browser |**4/4 PASS**,390/1440px × Chrome/native WebKit;2.4min, no retries | `browser-02.log`; `browser-02/results.json` |
| Real service-worker/PWA |**8/8 PASS** across Chrome/native WebKit | `pwa-final.log`; `web-mirror/pwa-final/results.json` |
| Accessibility | Existing serious/critical axe assertions pass at login, preparation, attendance and access-denied Sync in all4 browser cases | C browser spec and screenshots |
| Typecheck / frontend lint / production build |PASS on exact public-source mirror; original dist and private env preserved | `web-mirror/typecheck.log`, `eslint.log`, `build.log` |
| New browser types/lint and Node scripts |PASS including final selector and shutdown changes | `browser-types-last.log`, `browser-lint-final.log`, `script-lint-last.log` |
| PHP syntax / Pint |67 inputs/0 syntax failures;276 files Pint PASS | `syntax-final.log`, `pint-final.log` |
| Contract |Exact copied OpenAPI/generated inputs check PASS; no contract changes | `web-mirror/contract-raw.log` |
| Composer strict validation/audit; pnpm audit |PASS; no dependency or lockfile changes | `composer-validate.log`, `composer-audit.log`, `pnpm-audit.log` |
| Structure / whitespace / documentation |PASS, with final reference/anchor and inventory receipts | `structure.log`; `final-review.json` |
| OWASP |Full application:108 rules/494 targets,0 findings; two unchanged TSX parser warnings. Neutral mapped closure:98 rules/71 inputs,0 findings/parse errors; affected late delta separately checked | `semgrep.json`, `semgrep-closure.json`, `semgrep-final-delta.json` |
| Secrets |Initial709 public inputs0 leaks; final candidate content closure0 leaks | `gitleaks.json`, `gitleaks-final.json` |

Root `pnpm run verify` is an aggregate of web tests/typecheck/build and API tests. Its constituent gates above passed through the documented isolated equivalents; the root wrapper was not separately rerun because its ordinary API target must not touch protected development. Raw Windows CRLF contract limitations remain historical and unchanged. Composer's read-only cache warning did not fail its audit. Scanner parser warnings are limitations, not silently repaired or unqualified complete parsing.

## Browser, encrypted work and visual evidence

The four C cases use actual cookie login/CSRF and the current built application, not fabricated successful API responses. They prepare an encrypted profile, save a draft and two real outbox events, synchronize through genuine persisted acknowledgments to zero pending events, resume attendance, create fresh pending work, then revoke fixture membership. Sync refuses continuation and encrypted device records remain byte-for-byte identical. Separate actual HTTP/concurrency proofs establish production revocation ordering; the browser's fixture revocation is intentionally not represented as an Owner UI flow.

The8 PWA cases retain actual worker activation/controller identity/update-notice removal, network-only protected routes and exact encrypted pending-work preservation. No worker policy or client source changed. Screenshots cover phone/desktop attendance and access-denied Sync for both engines. Reviewed native WebKit phone denial and desktop attendance show the existing MSprout design and explicit preserved-work feedback. There is no C visual redesign or new stakeholder visual approval claim. Full-page phone screenshots can show fixed navigation midway through the long image at its actual viewport position; this is not evidence that controls below it are unreachable.

Screenshot locations relative to the ignored evidence root:

- `browser-02/authority-real-cookie-auth-2f9c7-ypted-pending-work-at-390px-webkit/{attendance,revoked-preserved}.png`.
- `browser-02/authority-real-cookie-auth-10623-pted-pending-work-at-1440px-webkit/{attendance,revoked-preserved}.png`.
- Equivalent `-chrome` directories retain the same two screenshots. Traces/raw HTTP/cookies/passwords are not persisted by this credential-bearing harness.

## Failures retained and closed

The original comprehensive API result remains **243 passing /96 failing /3,221 assertions**, not a pass. Its raw-only password recheck rejected legitimate Laravel/Sanctum HMAC proofs. The corrected implementation matches the installed framework's supported formats; positive formats and invalid/mismatched negatives pass. A first mismatch negative used factory Users with the same cached password; its distinct-password correction preserves the intended rejection. Subsequent aggregate failures exposed stale in-memory test identities/claims and test-only routes lacking real web middleware, not permission to weaken fresh session validation.

Existing test adaptations explicitly admit persisted identities before requests, preserve supplied negative proofs and Owner assurance, and use real cookie/session lifecycle where needed. No blanket actingAs override or per-request resurrection was added. Raw session bookkeeping/fixed synthetic row-count expectations became exact session identity/security-claim snapshots, while non-session tables retain full-row rollback hashes. The expired-invitation test reauthenticates only after verifying expiry to exercise later logout/anonymous controls. Existing domain/security assertions and test cases remain; no skip/disable or timeout increase conceals failure.

The first C browser attempt failed at90s after successful sync because the new fixture sequence omitted the existing **Resume attendance** action; its trace-free error context/screenshot/log remain in `browser-01`. The owned runner was stopped; it was not a completed aggregate pass. Adding that genuine action closed all4 cases without changing product behavior, safety assertions or timeouts. Browser shutdown now awaits the child before the next isolated database reset.

Initial frontend attempts stalled/terminated, one pnpm wrapper requested a noninteractive reinstall, and a test mirror under ignored .git was invisible to Vite. No dependency removal/upgrade or host reconfiguration was performed. Final tests ran from apps/web with installed Vitest/thread workers and CLI exclusion of ignored historical `.git/**` artifacts; all82 actual source test files/813 cases ran. Build/type/lint used a sealed public-source mirror. Initial root type resolution and missing DOM.Iterable diagnostics were corrected in the command, not assertions. Docker Desktop's unavailable pipe was a local runtime interruption: guards refused before bootstrap, existing C containers resumed with identical identities, and fresh read-only protected-database observation matched.

Every backend attempt retains its exit, args, raw log and paired input seal. The full59-attempt ledger below records failures rather than retrospectively calling them aggregate passes.

| Attempt | Result receipt under d4d1951d46 | Exit | Exact test summary |
| --- | --- | --- | --- |
| 1 | `result-1792214002207.json` | 1 | 2 failed, 1 passed (5 assertions) |
| 2 | `result-1792214069191.json` | 0 | 3 passed (5 assertions) |
| 3 | `result-1792214097039.json` | 1 | 3 failed (16 assertions) |
| 4 | `result-1792214170535.json` | 0 | 6 passed (41 assertions) |
| 5 | `result-1792214256157.json` | 1 | 1 failed, 3 passed (25 assertions) |
| 6 | `result-1792214298758.json` | 2 | 1 failed (3 assertions) |
| 7 | `result-1792214326326.json` | 2 | 1 failed (3 assertions) |
| 8 | `result-1792214376388.json` | 1 | 1 failed, 9 passed (66 assertions) |
| 9 | `result-1792214498778.json` | 0 | 12 passed (85 assertions) |
| 10 | `result-1792214604167.json` | 2 | 1 failed (3 assertions) |
| 11 | `result-1792214678649.json` | 0 | 1 passed (7 assertions) |
| 12 | `result-1792214775331.json` | 1 | 1 failed, 15 passed (125 assertions) |
| 13 | `result-1792214827315.json` | 1 | 1 failed, 9 passed (74 assertions) |
| 14 | `result-1792214918198.json` | 0 | 25 passed (200 assertions) |
| 15 | `result-1792215016655.json` | 1 | 1 failed (1 assertions) |
| 16 | `result-1792215084694.json` | 2 | 1 failed (2 assertions) |
| 17 | `result-1792215178411.json` | 1 | 1 failed (3 assertions) |
| 18 | `result-1792215276431.json` | 1 | 1 failed, 10 passed (93 assertions) |
| 19 | `result-1792215345476.json` | 1 | 1 failed (4 assertions) |
| 20 | `result-1792215422096.json` | 2 | 1 failed, 27 passed (219 assertions) |
| 21 | `result-1792215501523.json` | 2 | 3 failed, 2 passed (7 assertions) |
| 22 | `result-1792215581638.json` | 2 | 1 failed, 16 passed (86 assertions) |
| 23 | `result-1792215669395.json` | 0 | 3 passed (16 assertions) |
| 24 | `result-1792215688675.json` | 1 | 1 failed, 70 passed, 268 pending (458 assertions) |
| 25 | `result-1792215984645.json` | 1 | 1 failed (6 assertions) |
| 26 | `result-1792216010529.json` | 0 | 1 passed (6 assertions) |
| 27 | `result-1792216019953.json` | 1 | 1 failed, 18 passed (91 assertions) |
| 28 | `result-1792216106373.json` | 0 | 1 passed (4 assertions) |
| 29 | `result-1792216267035.json` | 1 | 1 failed, 41 passed (266 assertions) |
| 30 | `result-1792216538535.json` | 0 | 16 passed (78 assertions) |
| 31 | `result-1792216602462.json` | 0 | 4 passed (33 assertions) |
| 32 | `result-1792216643536.json` | 1 | 1 failed (4 assertions) |
| 33 | `result-1792216682096.json` | 0 | 1 passed (6 assertions) |
| 34 | `result-1792216727755.json` | 1 | 4 failed (32 assertions) |
| 35 | `result-1792216760895.json` | 1 | 1 failed (1 assertions) |
| 36 | `result-1792216789124.json` | 2 | 4 failed, 1 passed (33 assertions) |
| 37 | `result-1792216848868.json` | 2 | 10 failed, 6 passed (112 assertions) |
| 38 | `result-1792216888691.json` | 1 | 1 failed (6 assertions) |
| 39 | `result-1792216925502.json` | 2 | 4 failed, 13 passed (145 assertions) |
| 40 | `result-1792216976949.json` | 2 | 1 failed, 4 passed (60 assertions) |
| 41 | `result-1792217038637.json` | 2 | 4 failed (32 assertions) |
| 42 | `result-1792217108564.json` | 2 | 1 failed, 3 passed (52 assertions) |
| 43 | `result-1792217160726.json` | 1 | 2 failed, 4 passed (76 assertions) |
| 44 | `result-1792217264568.json` | 1 | 2 failed (18 assertions) |
| 45 | `result-1792217323311.json` | 2 | 2 failed (16 assertions) |
| 46 | `result-1792217370500.json` | 0 | 4 passed (71 assertions) |
| 47 | `result-1792217541836.json` | 1 | ParseError before tests |
| 48 | `result-1792217570224.json` | 1 | 1 failed, 78 passed (530 assertions) |
| 49 | `result-1792217731011.json` | 0 | 1 passed (5 assertions) |
| 50 | `result-1792217777875.json` | 1 | 96 failed, 243 passed (3221 assertions) |
| 51 | `result-1792218140839.json` | 1 | 2 failed, 21 passed (199 assertions) |
| 52 | `result-1792239597448.json` | 1 | 6 failed, 57 passed (369 assertions) |
| 53 | `result-1792239743660.json` | 2 | 1 failed (0 assertions) |
| 54 | `result-1792239806504.json` | 1 | 1 failed, 62 passed (385 assertions) |
| 55 | `result-1792239926162.json` | 1 | 1 failed (3 assertions) |
| 56 | `result-1792239971792.json` | 2 | 1 failed (2 assertions) |
| 57 | `result-1792240017007.json` | 1 | 1 failed, 17 passed (75 assertions) |
| 58 | `result-1792240077661.json` | 0 | 4 passed (4 assertions) |
| 59 | `result-1792240239782.json` | 0 | 422 passed (4306 assertions) |

## Isolation and preservation

C PostgreSQL container `msprout-b4-p2-1b-c-d4d1951d46-postgres`, volume `msprout-b4-p2-1b-c-d4d1951d46-data` and internal network of the same prefix are independent. System identifier is `7697500289917567015`; database `pc_d4d1951d46_test`, setup `pc_setup_d4d1951d46` and restricted runtime `pc_runtime_d4d1951d46` are separate. No database host port, protected dotenv, development key, real browser profile or private credentials enter fixtures. Guards verify independent identity and C target before any role rotation/migration; marker, identity, host, database and role negatives refuse before bootstrap. Workers independently validate both Laravel connections before writes.

Fresh read-only observation matches all39 protected development-table fingerprints and runtime-role attributes. Final preservation seals match42 protected files (2 private,30 local-QA originals,10 backups),11 stashes,32 frozen assets/two manifests, worktree identities and preserved refs. No existing encrypted browser profile was opened; only disposable browser contexts were used. Git remains at parent with local/upstream/live feature agreement0/0 and empty staging. Local main `d6c66694a8acc252815a088ada3ef8703340b038` and remote main `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f` remain independently unchanged; their pre-existing difference is not divergence created by C.

Publisher dormancy is VERIFIED: no new production caller, no runtime/PUBLIC SQL EXECUTE, no recovery-progress initialization, no legacy feed/sequence privilege withdrawal, no sequence reset or maintenance conversion. The SQL boundary and unchanged recovery constraints/RC-01/RC-02 pass in the final combined suite. Protected database fingerprint equality also confirms the C migration was not applied there.

## Contention and performance

Owner transfer versus correction and teacher revocation versus push/pull pass in both race orders. Additional proofs cover assignment revocation/bootstrap, identity/MFA/email/session changes after waits, invitation acceptance/revocation/expiry, concurrent normalized identities, two churches sharing a User, numeric lock ordering and genuine induced deadlock rollback followed by a fresh whole-operation retry. Deliberate inverted order exists only in the negative fixture; no automatic hidden retry/correctness waiver was introduced.

Thirty sequential warm real-cookie /auth/session requests measured p50 **21.506778ms**, p95 **34.846439ms**, p99 **49.493348ms** (`d4d1951d46/navigation-latency.json`). These are isolated local-kernel observations, not load/throughput acceptance. Synchronous mail can hold its church queue; unrelated church and global account navigation with independent legitimate sessions remains available. Same-cookie persistence can safely serialize responses. No speculative performance infrastructure was added.

## Final review and remaining gates

Complete diff/source review covers all76 paths, trust boundaries, assertion adaptations, migration and helper guards. **0 BLOCKING /0 SHOULD FIX findings remain within C.** Final corrected portions and their direct interactions were rechecked. Late browser fixture/selector/shutdown changes invalidated their focused lint/types/security/browser proof, all closed; they do not invalidate the final ordinary API/C aggregate or unchanged frontend/PWA production inputs. The final TenantContext edit is a comment correction only. Final report/knowledge changes invalidate references/secrets/whitespace, not application suites.

INFORMATIONAL / downstream: protected target email collisions UNKNOWN; external SMTP provider/inbox and load targets NOT TESTED; unchanged scanner parse warnings and Windows CRLF limitation retained. Existing five B4 recovery defects remain **OPEN**. B all-writer publication conversion, D maintenance/audit/partial-success restructuring, E contention/drainage/privilege withdrawal/genesis/cutover and later recovery/client-upgrade stages remain **NOT IMPLEMENTED**. C authority success does not establish complete recovery, installed old/new upgrade safety or Late readiness.

Recommendation: review this single integrated candidate for separately authorized guarded publication. **DO NOT stage, commit, push, activate or deploy on this report alone.** There is no new commit or candidate hosted result. Stop after C; no later task begins.

## Exact candidate inventory

**76 paths:47 modified and29 new.** The earlier approximately35-path estimate was not an approved fixed publication list. Expansion is accounted for by32 existing regression/support fixtures requiring genuine persisted-session authority, the new integrated/concurrency/browser harness and required evidence/knowledge; no unrelated application, contract, dependency, CI or governance path changed. Category totals:12 modified production +10 new production/migration +32 modified existing tests/support +7 new compatibility tests +5 new PHP helpers +4 authority runner files +2 browser files +1 report +3 knowledge files.

| Status | Exact path | Required purpose |
| --- | --- | --- |
| M | `apps/api/app/Actions/Fortify/UpdateUserProfileInformation.php` | Safe existing validation response for normalized identity collision |
| M | `apps/api/app/Actions/Invitations/AcceptTeacherInvitation.php` | Verified signed invitation scope, fresh authority and atomic identity/membership acceptance |
| M | `apps/api/app/Actions/Memberships/ManageTeachers.php` | Predeclared User write authority and church-first membership/revocation ordering |
| M | `apps/api/app/Actions/Memberships/RevokeMembershipAccess.php` | Predeclared User write authority and church-first membership/revocation ordering |
| M | `apps/api/app/Domain/Sync/ChurchCoordination.php` | Member, invitation and explicit system coordination; publisher stays dormant |
| M | `apps/api/app/Domain/Sync/CoordinatedChurchTransaction.php` | Member, invitation and explicit system coordination; publisher stays dormant |
| M | `apps/api/app/Http/Middleware/AuditAuthentication.php` | Remove request-local admission authority on failed authentication rollback |
| M | `apps/api/app/Http/Middleware/TenantDatabaseTransaction.php` | Integrate fresh member authority at real tenant HTTP entry points |
| M | `apps/api/app/Providers/AppServiceProvider.php` | Request-scoped coordination and User authority services |
| M | `apps/api/app/Support/Auth/GuardAwareDatabaseSessionHandler.php` | User-before-session persistence; prevent revoked principal or stale assurance resurrection |
| M | `apps/api/app/Support/Tenancy/TenantContext.php` | Narrow signed-invitation and purpose-bound system transaction scopes |
| M | `apps/api/bootstrap/app.php` | Install global account/session fence in existing HTTP middleware |
| M | `apps/api/tests/Feature/Applications/ApplicationSecurityTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Applications/ChurchApplicationFlowTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Attendance/AttendanceAuthorizationTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Attendance/ConflictResolutionTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Attendance/GuestResolutionTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Audit/AuditIntegrationTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Audit/ViewerAuthorizationTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Auth/AuthFlowsTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Auth/AuthHardeningTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Auth/ChurchAuthenticationTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Auth/ExistingLoginSessionTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Auth/ProfileRecoverySessionTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Auth/WorkspaceSessionTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Devices/OfflineAuthorizationTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Imports/StudentImportFlowTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Memberships/MembershipSecurityTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Memberships/OwnershipTransferTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Memberships/TeacherInvitationIdentityTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Memberships/TeacherInvitationTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Notifications/BirthdayDispatchTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Operations/SystemHealthTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Platform/BootstrapPlatformAdminTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Reports/AttendanceReportTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Students/StudentListingProjectionTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Students/StudentManagementTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Sync/AttendanceCompatibilityTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Sync/PullCursorTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Feature/Sync/PushIdempotencyTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/Support/MembershipScenario.php` | Explicit Owner session and MFA fixture admission |
| M | `apps/api/tests/Support/transfer-worker.php` | Independent guarded persisted-session ownership-transfer worker |
| M | `apps/api/tests/Tenancy/PostgresTenantIsolationTest.php` | Preserve existing domain assertions using explicit persisted church sessions |
| M | `apps/api/tests/TestCase.php` | Opt-in real-cookie fixture lifecycle; preserve ordinary test discovery |
| M | `knowledge/CURRENT_STATE.md` | Current C qualification, handoff and explicit publication hold |
| M | `knowledge/ROADMAP_STATUS.md` | Current C qualification, handoff and explicit publication hold |
| M | `knowledge/TESTING_ENVIRONMENT.md` | Current C qualification, handoff and explicit publication hold |
| NEW | `apps/api/app/Actions/Invitations/VerifiedInvitationAuthority.php` | Verified signed invitation scope, fresh authority and atomic identity/membership acceptance |
| NEW | `apps/api/app/Domain/Sync/MemberCoordinationIntent.php` | Member, invitation and explicit system coordination; publisher stays dormant |
| NEW | `apps/api/app/Domain/Sync/SignedInvitationCoordination.php` | Member, invitation and explicit system coordination; publisher stays dormant |
| NEW | `apps/api/app/Domain/Sync/TrustedSystemCoordination.php` | Member, invitation and explicit system coordination; publisher stays dormant |
| NEW | `apps/api/app/Domain/Sync/TrustedSystemPurpose.php` | Member, invitation and explicit system coordination; publisher stays dormant |
| NEW | `apps/api/app/Http/Middleware/FenceChurchAuthentication.php` | Fresh global account/session assurance across authentication and account routes |
| NEW | `apps/api/app/Support/Auth/AuthenticatedSessionWritePermit.php` | Persisted session and deterministic global User authority with bounded admission |
| NEW | `apps/api/app/Support/Auth/DatabaseSessionAuthority.php` | Persisted session and deterministic global User authority with bounded admission |
| NEW | `apps/api/app/Support/Auth/UserAuthorityLocks.php` | Persisted session and deterministic global User authority with bounded admission |
| NEW | `apps/api/database/migrations/2026_10_17_000002_add_normalized_user_email_uniqueness.php` | Additive normalized-email uniqueness; refuse collisions without account repair |
| NEW | `apps/api/tests/Compatibility/AuthorityBoundaryTest.php` | Focused authority, concurrency, identity, rollback and security regression proof |
| NEW | `apps/api/tests/Compatibility/AuthorityCapabilityTest.php` | Focused authority, concurrency, identity, rollback and security regression proof |
| NEW | `apps/api/tests/Compatibility/AuthorityConcurrencyTest.php` | Focused authority, concurrency, identity, rollback and security regression proof |
| NEW | `apps/api/tests/Compatibility/AuthorityHttpTest.php` | Focused authority, concurrency, identity, rollback and security regression proof |
| NEW | `apps/api/tests/Compatibility/InvitationIdentityIndexTest.php` | Focused authority, concurrency, identity, rollback and security regression proof |
| NEW | `apps/api/tests/Compatibility/SessionAuthorityTest.php` | Focused authority, concurrency, identity, rollback and security regression proof |
| NEW | `apps/api/tests/Compatibility/TrustedSystemAuthorityTest.php` | Focused authority, concurrency, identity, rollback and security regression proof |
| NEW | `apps/api/tests/Support/AuthorityBrowserProbe.php` | C-only guarded disposable fixtures, real HTTP/session or independent worker proof |
| NEW | `apps/api/tests/Support/AuthorityHttpScenario.php` | C-only guarded disposable fixtures, real HTTP/session or independent worker proof |
| NEW | `apps/api/tests/Support/AuthorityScenario.php` | C-only guarded disposable fixtures, real HTTP/session or independent worker proof |
| NEW | `apps/api/tests/Support/PersistedChurchSession.php` | C-only guarded disposable fixtures, real HTTP/session or independent worker proof |
| NEW | `apps/api/tests/Support/authority-worker.php` | C-only guarded disposable fixtures, real HTTP/session or independent worker proof |
| NEW | `apps/web/e2e/compatibility/authority.spec.ts` | Real cookie login, encrypted pending work, genuine sync and revocation browser proof |
| NEW | `apps/web/playwright.authority.config.ts` | Separate sequential Chrome/WebKit configuration; no existing suite changes |
| NEW | `docs/qa/compat-01-b4-p2-1b-c-authority-integration.md` | Consolidated C evidence, complete inventory, limitations and review |
| NEW | `scripts/compatibility/authority/README.md` | Independently guarded C-only runner, browser bridge or reproduction instructions |
| NEW | `scripts/compatibility/authority/bootstrap.php` | Independently guarded C-only runner, browser bridge or reproduction instructions |
| NEW | `scripts/compatibility/authority/browser-server.mjs` | Independently guarded C-only runner, browser bridge or reproduction instructions |
| NEW | `scripts/compatibility/authority/run.mjs` | Independently guarded C-only runner, browser bridge or reproduction instructions |
