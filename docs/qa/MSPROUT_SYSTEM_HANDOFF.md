# MSprout System Handoff

## Shared workspace maintenance fix — 2026-10-08

Review, Reports, Birthdays, Ministries, Students and Import now share authenticated workspace discovery and scoped authorization preflight, automatic single-membership context, explicit multi-membership selection, and fail-closed invalidation across navigation/refresh. [The verification receipt](shared-workspace-context-verification.md) records passing regression/browser/security gates, reconciliation recovery, source review and rollout ordering. Live migration/rollout and a new manual retest are NOT RUN; historical manual evidence and counts retain their status.

The initial five dirty tracked and two untracked QA files were preserved under recovery stash `9b89c9fc47931b76af19bb9c7dd2699a1f806196`, then reconciled with the three upstream commits using fast-forward only. Both local observations and upstream findings remain. The user-reported approved MTQA A application, Owner MFA and Teacher management state is attributed, not newly verified. No live data/account decision/profile was changed, and unrelated UI findings and subsequent roadmap work remain excluded.

## Current manual QA policy — 2026-10-07

By explicit user decision, MT-00 through MT-22 are optional, risk-based references for exploration, bug reproduction, correction and fix validation. Sequential completion of all 211 cases is not required for development, merging, deployment or release. Incomplete, BLOCKED, NOT_RUN or deferred cases do not automatically block those activities. Applicable automated tests, security controls, authorization boundaries, CI requirements, deployment safeguards and unresolved release-critical defects remain release criteria. Confirmed bugs require severity-based triage, correction in an authorized scope and focused regression validation. Deferred tests remain accurately BLOCKED or NOT_RUN; never represent them as PASS.

Preserve existing results, evidence and known blockers. Phase exit rules describe proof needed to claim a phase passed, not unconditional release prerequisites. See [AGENTS.md](../../AGENTS.md) section 16 and the [manual roadmap](MANUAL_TESTING_ROADMAP.md). Older dated qualification, progression, next-action and no-finalization receipts below describe their historical run scopes; they do not reinstate mandatory sequential qualification.

Current evidence checkpoint: Tasks 1–18 are complete; MT-00 and MT-01 passed and remain preserved. MT-02 is partial: the latest cleanup receipt records 2 PASS / 0 FAIL / 3 BLOCKED / 5 NOT_RUN. MT-APP-003 has five passing subchecks; City121 denial remains BLOCKED with its payload/reproduction uncertainty. MT-APP-004 remains BLOCKED on fresh-fixture authorization; AUTO-MTAPP004 was proposed, not created or designated. Response correlation ID and click count for the combined at-limit acceptance remain unconfirmed. Known blockers and older counts remain in the retained run history; no results are promoted by this policy change.

The earlier request to prepare MT-APP-004 is deferred. This governance run authorizes no manual case, fixture preparation or product fix: do not rerun completed cases or start MT-03 or another phase. Preserve all four existing pending church applications, PostgreSQL/SQLite, APP_KEY, credentials, browser/offline storage, drafts, conflicts, outbox events, cursors, unsynced work and prior evidence. No synthetic user, application submission, record deletion, database reset or storage clearing is authorized. Authentication, CAPTCHA, MFA, RLS, CSRF and other protections remain intact. These are preservation requirements, not a new runtime census or browser inspection.

Observed issue O-QA-20261007-01: human reports horizontal page overflow on Pending review with a long synthetic church name. Reproduction, severity, release impact and root cause remain unassessed; no fix or regression PASS is claimed. See [manual knowledge](../../knowledge/MANUAL_TESTING.md). No application/browser/database operation was performed for this governance update.

## Preserved historical receipts and runtime handoff

## 1. Purpose

Canonical developer/operator/manual-testing orientation for the current implemented MVP. A new session should read this file and `AGENTS.md` first. Repository authority still applies; this operational summary does not approve product expansion. Evidence distinguishes live runtime, modeled browser scenarios, automated backend tests, inspection and historical reports.

Optional risk-based coverage selection now lives in [MANUAL_TESTING_ROADMAP.md](MANUAL_TESTING_ROADMAP.md); current phase/findings/blockers live in [manual knowledge](../../knowledge/MANUAL_TESTING.md). [Codebase Memory knowledge](../../knowledge/CODEBASE_MEMORY.md) covers advisory graph tools. These distinct layers do not alter the historical results below or AGENTS.md authority.

Current manual checkpoint2026-10-01: MT-00 completed/synchronized40525fbe; [MT-01](manual-runs/MTQA-20260930-02/MT-01.md) completes all ten real cases with legitimate mail/recovery and approved isolated offline/failure evidence. Four qualification findings corrected with applicable validation; AP signed-out/unchanged, DA retained, temporary fixture stopped, preserved database/files/browser work. MT-02–MT-22 remain untouched. Sections2/31/41 describe the earlier runtime qualification, not new manual-campaign results.

## 2. Repository Checkpoint

Current operator-mode maintenance starts from committed/pushed MT-01 `3dba978b97fff590ec1b814b66b103344843c19a`, verified clean/0/0 with remote feature/main agreement. [Autonomous Local Operator protocol](AUTONOMOUS_LOCAL_OPERATOR.md) and AGENTS.md section 16 define synthetic-only local probes, an ignored Windows DPAPI credential store, fail-closed checks and mandatory human takeover. Governance/tooling is implemented/validated and the user separately approved section 14 finalization. GREEN for this bounded change; this pre-commit receipt accompanies the single approved `chore: establish autonomous local QA operator mode` commit/normal feature-branch push. Verify its resulting SHA/remote synchronization through Git history/status. No operator credential file/identity is initialized; AP/MT-01 DA/PA remain excluded. No manual phase, live account/session/fixture or product configuration was changed. MT-02 remains untouched; the qualification checkpoint below is historical.

Qualification date: **2026-09-30, Asia/Taipei**; handoff assembled at **21:54:06 +08:00**. Starting HEAD `ffee8ebe9e87fe096c52e23f7a0d49da9c1c0202`, `test: add mvp release qualification`. Branch/upstream: `feat/mvp-foundation` / `origin/feat/mvp-foundation`; initially clean, unstaged, 0/0 ahead/behind. Authenticated remote read agreed. `origin/main`: `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f`, unchanged. Existing `upstream` remote was not used/modified.

Tasks **1–18 are complete, committed and pushed**; no Task19 exists. This explicitly requested qualification is maintenance/QA, not a new feature. Task18's historical GO concerns its controlled automated rehearsal, not a deployed church. The earlier runtime qualification corrected additional defects and was GREEN for its bounded scope at `df7cf6118f5f119253154ce015803fd143bb1a6c`; sections below retain that historical evidence. Positive provider/admin journeys and physical-device commissioning remain explicitly unqualified. Resolve the current MT-01 finalization commit from its run report's Git history, then verify actual status/upstream. Ignored local configuration and disposable runner output are not commit candidates.

## 3. Product Summary

MinistrySprout/Sprout supplies church application/approval, one Owner/church, invited Teachers/assignments, ministries/students/enrollments, safe spreadsheet import, encrypted shared-device offline attendance, replay-safe sync, Owner conflicts/corrections/guest review, reports/CSV, privacy-safe birthdays, audit and operations. Guardian/contact records, photos, points, billing, messaging, Market Day and advanced analytics remain outside MVP.

## 4. Architecture

| Component | Implemented boundary |
|---|---|
| API | Laravel13.34.0/PHP>=8.3; Fortify/Sanctum cookie auth; API/worker/scheduler processes |
| Database | PostgreSQL18; acknowledged authority; trusted UUID tenant scope; policies plus forced RLS |
| Web | React19.2/TypeScript5.9/Vite8.2.2; pnpm10.34.5; pathname router; OpenAPI-generated types |
| PWA | Workbox injectManifest; shell/assets precached; API NetworkOnly; deferred worker activation |
| Offline | Dexie/IndexedDB; profile-keyed AES-GCM; PIN-wrapped key; signed14-day authorization |
| Sync | Cookie/CSRF push, ordered pull; atomic domain/audit/feed/receipt; cursor/conflict preservation |
| Production target | Vercel same-origin API forwarding; Railway API/worker/scheduler plus separate migration job; unprivileged immutable image |

Details: `knowledge/ARCHITECTURE.md`. Contract: `contracts/openapi.yaml`; generated `apps/web/src/api/generated.ts` is never hand-edited.

## 5. Repository Structure

`apps/api/app/{Actions,Domain,Http,Models,Support}` contains domain/security/tenancy boundaries. `database/migrations` has20 migrations; `seeders/factories` supply limited fixtures. `routes/{api,web,platform,health,console}.php` separates interfaces. `apps/api/tests` contains Pest feature/unit/tenancy and concurrent-worker helpers. `apps/web/src/{app,api,features,offline,sync,pwa}` contains router/UI/transport/local work. `apps/web/e2e` generally models HTTP responses while exercising real browser/UI/crypto/IndexedDB. Root Compose runs only infrastructure. Approved design/roadmap, security/operations/QA documents and `knowledge/` remain authoritative evidence.

## 6. Local Development Environment

Windows11/Docker Desktop. Verified PostgreSQL18.6, PHP8.3.33, bundled Node24.19.0, pnpm10.34.5, Laravel13.34.0. Default Node22.22.3 is below baseline; PHP is absent from default PATH. Use existing process-scoped tools:

```powershell
$qaNodeBin = 'C:\Users\MARYJANE S. ATILLO\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$env:PATH = "$qaNodeBin;$env:TEMP\msprout-corepack-bin;$env:TEMP\msprout-php-8.3;$env:PATH"
$env:PHP_INI_SCAN_DIR = "$env:TEMP\msprout-task9-php-config"
node --version
pnpm --version
php -m
```

Confirm paths exist. Temporary PHP scan files load PDO PostgreSQL/GD; base runtime also loads ZIP, OpenSSL, mbstring, DOM/XML, curl, fileinfo and SQLite PDO. Native Windows lacks PCNTL; production image includes it. Do not install/update/purge host runtimes to repeat a command. See `knowledge/TESTING_ENVIRONMENT.md`.

## 7. Docker / Services

| Service | Purpose / loopback ports | Verification / persistence |
|---|---|---|
| msprout-postgres-1 | PostgreSQL18,5432 | Running/healthy; SQL/version verified; msprout_postgres-data mounted at /var/lib/postgresql |
| msprout-mailpit-1 | SMTP1025, UI/API8025 | Running/healthy; info endpoint health check; no Compose data volume |
| Windows Laravel | 127.0.0.1:8000 | Actual cookie/session/API requests verified; PostgreSQL persistence |
| Windows Vite | browser127.0.0.1:5173 | Live login/application verified; IndexedDB scoped to this origin |
| Windows worker/scheduler | queue:work / schedule:work | Started; empty worker startup, heartbeat write/check/ticks verified |
| Preview | 127.0.0.1:4173 | Production-asset browser scenarios; separate origin; **preview does not proxy API** |

Compose has no PHP/Node/worker/scheduler/Redis service. Existing msprout-api:task18 image is historical evidence, not the live local API.

## 8. Environment Configuration

Only key names/requirements belong here. Ignored `apps/api/.env` now uses PostgreSQL runtime/migration identities, exact browser origin/stateful domains, SMTP/Mailpit and APP_DEBUG=false. Existing APP_KEY was retained. No production credential was used.

| Keys | Requirement |
|---|---|
| APP_ENV,APP_URL,APP_KEY,APP_DEBUG; APP_PREVIOUS_KEYS | Required API; exact browser origin/stable key; previous keys only reviewed rotation; production debugfalse |
| DB_CONNECTION,DB_HOST,DB_PORT,DB_DATABASE,DB_USERNAME,DB_PASSWORD,DB_RUNTIME_USERNAME | PostgreSQL restricted runtime required |
| DB_MIGRATION_DATABASE,DB_MIGRATION_USERNAME,DB_MIGRATION_PASSWORD | Separate migration/admin process; never production runtime service |
| DB_TEST_DATABASE,DB_TEST_RUNTIME_USERNAME | Development/CI only; separate DB/role; default role runtime name plus _test |
| POSTGRES_PASSWORD | Local Compose initialization; changing it does not rotate an initialized volume |
| DB_SSLMODE | Verified PostgreSQL TLS for production; never disable verification to repair tooling |
| SANCTUM_STATEFUL_DOMAINS | Browser host:port, no scheme; hostname consistent |
| SESSION_DRIVER,SESSION_COOKIE,SESSION_DOMAIN,SESSION_PATH,SESSION_LIFETIME,SESSION_SECURE_COOKIE,SESSION_SAME_SITE | DB sessions, host-only cookie; secure production HTTPS; local HTTP securecookiefalse |
| PLATFORM_SESSION_COOKIE,PLATFORM_SETUP_LIFETIME | Separate platform cookie; default invitation30minutes |
| CACHE_STORE,QUEUE_CONNECTION,QUEUE_FAILED_DRIVER | Database cache/queue; transactional mail/dispatch |
| MAIL_MAILER,MAIL_HOST,MAIL_PORT,MAIL_USERNAME,MAIL_PASSWORD,MAIL_FROM_ADDRESS,MAIL_FROM_NAME | Local SMTP/Mailpit; authenticated production provider; no log mailer for authentication mail |
| VITE_TURNSTILE_SITE_KEY | Public web dev/build key; active live dev server has none |
| TURNSTILE_SECRET_KEY,TURNSTILE_HOSTNAME | Application submission required; absent locally, fail closed |
| WEBPUSH_VAPID_SUBJECT,WEBPUSH_VAPID_PUBLIC_KEY,WEBPUSH_VAPID_PRIVATE_KEY | Actual Web Push required; absent locally |
| READINESS_TOKEN | Positive protected probe required; configured privately during MT-00 continuation2026-10-01. Actual authorized readiness200/all dependency checks ok; absent-header401 remains enforced. Value stays ignored/private |
| QUEUE_LAG_WARNING_SECONDS,SCHEDULER_STALE_SECONDS | Bounded defaults300/180 |
| LOG_CHANNEL,LOG_STACK,LOG_LEVEL | Redacted technical logging |

Redis/AWS/Postmark/Resend/Slack example configuration is not evidence those services are provisioned/required. Production configuration: `docs/operations/deployment.md`.

## 9. Exact Safe Startup Procedure

1. Verify branch/HEAD/status and preserve work. Inspect Docker child health, not only parent indicator. Supply existing local Compose credential securely; do not print it.
2. Keep `apps/api/database/database.sqlite`: old starter DB, not MVP authority. Do not reseed or migrate:fresh development.
3. Apply process tool setup(section6). Configure ignored API environment from reviewed example using separate runtime/migration identities; retain APP_KEY. Generate key only for a genuinely new environment.
4. If stopped: `docker compose up -d postgres mailpit`; otherwise reuse healthy services.
5. Verify restricted runtime NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOINHERIT/NOBYPASSRLS, not tenant table owner. Provision through authorized admin with random local credential only if needed; never grant bypass.
6. From apps/api: `php artisan migrate:status --database=pgsql_migration`; apply reviewed pending migrations with `php artisan migrate --database=pgsql_migration`. This run migrated the previously **empty** development PostgreSQL DB; no existing table/data dropped.
7. Check fixture before seeding: known verified SQLite test@example.com was copied once to empty PostgreSQL users, without overwrite. Do not repeat transfer/seed.
8. In separate apps/api terminals:

```text
php artisan serve --host=127.0.0.1 --port=8000
php artisan queue:work --sleep=3 --tries=3 --timeout=120
php artisan schedule:work
```

9. Root: `pnpm --dir apps/web dev --host 127.0.0.1 --port 5173 --strictPort`. Open http://127.0.0.1:5173/ and consistently use that origin for APP_URL, cookies, signed links and profiles. Vite proxies API/auth/Sanctum/Fortify/platform paths to8000.
10. Check health/live, real login, auth/session and api/church-applications/current. API alone does not run worker/scheduler.

Fresh dependency setup: pnpm install --frozen-lockfile; composer install from apps/api. Reuse verified installed dependencies; avoid fallback purge prompts. Production modes/procedures remain separate.

## 10. Exact Safe Shutdown Procedure

Ctrl+C only services you started. For detached helpers, identify exact PID/executable/command; do not kill all Node/PHP processes. `docker compose stop` retains volume. Never down -v, delete SQLite, reset/clean Git, or clear IndexedDB with pending work. Do not export unsynced child payloads into logs/documents as recovery.

## 11. Database Model and Roles

Local ministrysprout is privileged Compose admin/migration identity, unsuitable for application traffic. ministrysprout_runtime is verified restricted non-owner runtime. ministrysprout_runtime_test is separate restricted test role with per-run random credential; test application queries target only ministrysprout_test. Backend suites must run serially.

New bootstrap refuses test/development or test/migration DB equality and test/development role equality **before connecting**; previous bootstrap rotated development runtime password. TenantContext validates active membership/church with UUID header, opens transaction, sets transaction-local app.current_church_id, then applies policy and forced RLS. Client ownership fields are never trusted. Deferred triggers require exactly one active Owner; tenant-safe references prevent church crossing. Audit/revisions/receipt/feed/provenance remain immutable where specified.

Core tables: churches/memberships, invitations/assignments, ministries/students/enrollments, imports, device authorizations/push subscriptions, attendance sessions/records/guests/conflicts/revisions, sync_events/change_feed/device_cursors and birthday dispatch/delivery. Users/platform identities/sessions/cache/queue/operations have distinct global control purposes. Canonical evidence supports reviewed global/tenant scopes.

## 12. Database Readiness Checks

```text
docker compose ps
docker compose exec -T postgres pg_isready -U ministrysprout -d ministrysprout
php artisan migrate:status --database=pgsql_migration
php artisan operations:scheduler-heartbeat --check
```

Authorized non-destructive SQL, never credentials/record rows:

```sql
SELECT current_database(),current_user;
SELECT rolname,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles
 WHERE rolname LIKE 'ministrysprout%';
SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class
 WHERE relname IN ('churches','students','attendance_sessions','sync_events','audit_events','security_events');
SELECT count(*) FROM users;
SELECT count(*) FROM churches;
SELECT count(*) FROM platform_admins;
```

Historical runtime-qualification census: **1 user,0 churches,0 applications,0 platform admins**. Current MT-01 final read-only census2026-10-01: **2 verified tenantless users (preserved AP and approved DA),0 churches/applications/memberships/platform admins**. DA verification/password changes used supported mail flows; no recreation/reseed. Six historically sampled protected tables have enabled/forced RLS; no enabled-but-unforced application table found. Security-event runtime grants SELECT/INSERT only. Full tenancy suite proves same-church/cross-church/no-context and exactly-one-Owner behavior.

## 13. Seeders, Factories, Fixtures and Test Identities

**DEVELOPMENT/TEST ONLY — NEVER PRODUCTION.** Only DatabaseSeeder creates **Test User**, **test@example.com**, an intentional development-only fixture credential (retrieve privately; do not copy it into chat or evidence), through UserFactory. Verified by default; **no tenant, role, application or MFA**. Present in original SQLite and now local PostgreSQL. Seeder was not rerun; it is non-idempotent and conflicts on existing email. It is not complete manual-test data or suitable production bootstrap.

| Mechanism | Purpose / identity / assurance | Existence / recreate policy |
|---|---|---|
| UserFactory | Faker safe-email church users; default password; unverified state; no automatic tenant/MFA | Isolated tests; individual tests override random passwords; AP alone came from the earlier fixture; approved live DA used validated CreateNewUser once |
| PlatformAdminFactory | Faker handle/recovery mailbox; pending default; active() random password/TOTP, verified/MFA/recovery acknowledged; no church membership | No live admin; tests only, not official bootstrap substitute |
| AuditEventFactory | Synthetic platform/system audit event; no credential | Isolated test evidence |
| tests/Support/ChurchScenario | Synthetic Owner/church and Teacher memberships via admin connection; random identities; explicit assurance as required | Disposable test DB only; not live onboarding |
| tests/Support/MembershipScenario | Membership/assignment/high-risk fixtures | Test DB only |
| PostgresTestDatabase | Fresh schema then per-test truncate; restricted runtime queries | Destructive only DB_TEST_DATABASE; never development |
| transfer-worker.php,import-worker.php | Concurrent test subprocesses | Isolated test DB; do not point at development |
| e2e/support.ts | Mock Owner response, actors11/12, fixed synthetic UUIDs, PIN examples184629/934175, far-future dummy lease/signature; real browser crypto | No live accounts or valid server leases; isolated browser contexts |
| e2e scenario identities | owner@example.test/teacher@example.test, mocked password/MFA responses | Not a live login directory; no corresponding dev records |

Static test-only addresses found: developer@example.com, existing@example.com, invite@example.test, invited@example.test, limited@example.com, missing@example.com, missing@example.test, new-invitee@example.test, owner@example.test, private@example.test, replacement@example.com, teacher@example.test, unknown@example.test, unrelated@example.test. These are isolated fixture inputs/assertions; missing/unknown are deliberately absent. No generated secret, TOTP material, signed URL, recovery code or production identity belongs here.

## 14. Platform Administrator Bootstrap

Verified official command:

```text
php artisan platform:bootstrap-admin --handle=sage.dev --email=<private-recovery-email>
```

Old deployment prose incorrectly named platform:bootstrap; corrected. Use approved private mailbox in authorized admin process with SMTP/queue and APP_URL correct. Creates unique pending identity, queues signed invitation(default30minutes), refuses duplicate; no usable password login yet. Invitation possession, chosen password, TOTP confirmation and saved-recovery acknowledgement activate it. Remove one-time bootstrap infrastructure/credential per runbook.

No live admin created: arbitrary QA address would occupy the human's singleton. Positive live setup remains blocked on that private prerequisite. Automated bootstrap/platform tests passed.

## 15. Role and Permission Model

Applicant: verified church account, only own application, no tenant authority. Owner: exactly one active/church, mandatory current-session MFA; church administration, imports, permanent correction, export/audit. Teacher: active invited membership and current assigned ministries/rosters/attendance/sync/permitted recent reports; no self-assignment, role grants, import/export/permanent correction. sage.dev: separate verified/active/current-MFA/recovery-acknowledged platform guard; online review/audit/sanitized operations, no ordinary child-data access.

## 16. Authentication Architecture

Fortify root routes/web guard + Sanctum first-party API session middleware; database sessions/CSRF. auth/session returns verification/MFA without church selection. api/me additionally requires trusted active membership/context and Owner assurance. Platform uses distinct cookie(path/platform), guard/CSRF flow. Login/MFA regenerate sessions; recovery/auth throttle; errors avoid account enumeration.

**Corrected trap:** API GET usually has no Origin. Suppressed Referer caused Sanctum fromFrontend false. Transports now send **origin-only Referer** on same-origin requests/upload/download, never page path/query/fragment. Global no-referrer protects navigation. Browser regression verifies override under that global header. Signed fragments are captured/removed from history; secret-bearing paths never enter Referer. See transport.ts/client.ts and Task4 security document.

## 17. MFA Model

Owner/platform require confirmed TOTP and current-session assurance; Teachers not forced. Owner enrollment uses recent password confirmation, enrollment/material and code confirmation. Platform setup also requires recovery-code acknowledgement. Single-use recovery locking where implemented; never logged/IndexedDB-persisted. Do not manually set assurance flags for live qualification.

## 18. Church Application Lifecycle

Existing verified account -> bounded church/city/optional address/IANA timezone + Turnstile -> pending -> isolated platform decision. Approval locks/atomically creates church+exactly one Owner, decision/audit and encrypted queued notification; repeat decisions replay/conflict safely. No tenant membership before approval. Own-current read filters authenticated applicant/nonpurged state. Rejected PII purge30days preserves minimal evidence.

Public signup is currently disabled(register404). Task4/5 explicitly start with existing verified account, while high-level design describes prospective-Owner signup. This is a documented commissioning/scope gap, not authority to implement signup now. Local fixture supplies existing account; expansion requires separately approved scope.

Verifier requires configured secret, success, exact expected hostname and action church_application; missing config/network fails closed. Cloudflare dummy response documents action test, so dummy keys alone do not provide a supported complete local mechanism; never relax action/hostname validation. Production CSP now permits only the required Turnstile script/frame origin. References: [Cloudflare CSP](https://developers.cloudflare.com/turnstile/reference/content-security-policy/), [dummy-key behavior](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).

## 19. Teacher Invitation Lifecycle

Owner/current MFA/recent auth selects email/nonempty assignments -> expiring invitation/synchronous private-transport mail -> signed-fragment recipient link -> token/identity checks -> create/use church account, verified membership/assignments. Source inspection during manual planning confirms Teacher invitation mail is synchronous to keep raw proofs out of serialized jobs; application decisions/platform setup use the queue. Re-invitation revokes older pending invitations; consumed acceptance returns410. Mismatch/expiry/replay/revocation fail safely. Owner can revoke/change scope, including clearing accepted Teacher assignments; device/push invalidation and tombstone reconciliation quarantine unsynced work. Ownership transfer locks memberships, requires assurance, preserves one Owner and audits atomically.

## 20. Ministry and Roster Model

UUID tenant/version/archive ministries; normalized student name fields, optional date-only birthdate, gender and tenant-safe enrollments. Server derives display name/age; bundled gender avatars, no uploads. Owner writes, assigned Teacher reads. Versions/tombstones reconcile archive/scope changes. Offline omits full birthdate/birth year/source name parts/guardian/contact data.

## 21. Spreadsheet Import

Online Owner/current MFA; CSV/XLSX,5MiB input,500 data rows,25MiB expanded XLSX, bounded ZIP entries/ratio. Columns first_name,last_name,middle_name,preferred_name,suffix,birthdate,gender,ministries,external_reference. Reject malformed structure, formulas/executable prefixes, macros/links/embedded content, hidden/unsupported sheets, ambiguous dates and oversized expansion. Preview creates no students. Locked idempotent commit rechecks same-church mapping/duplicates and atomically creates students/enrollments plus bounded audit. No silent update/merge of existing students or partial commit. Template endpoint api/imports/template.

## 22. PWA Architecture

Manifest MinistrySprout/Sprout, standalone root/icons. Workbox precaches shell/hashed assets; api/** NetworkOnly; auth has no runtime cache. Waiting-worker activation/reload deferred while unsafe work exists. Production retains HTTPS/HSTS/privacy/frame-denial, same-origin application code/styles/workers/connections, no inline/eval/wildcards; exact challenges.cloudflare.com script/frame exception supplies required verification. Preview4173 is not live API environment.

## 23. Offline Profile Architecture

ministry-sprout-offline Dexie stores profiles/encrypted blobs/drafts/outbox/conflicts/cursors/metadata; every key scoped profileId. Random AES256-GCM data key wrapped with PIN-derived PBKDF2-HMAC-SHA256:6–12digits,16-byte random salt,600000iterations. AAD binds profile/schema/purpose; one non-exportable unwrapped key in memory. Lock/switch/background/five-minute inactivity clears it; failed PIN exponential delay.

Server-signed14-day lease binds actor/church/membership/device and minimal assignment projection. Correct PIN reopens unexpired cache after restart; reauthentication separately blocks sync until same actor refreshes online. Denial purges cached projections but preserves encrypted drafts/outbox. Clear profile expiry is now only an index: protected reads/local crypto decrypt and validate encrypted authorization expiry/binding. Browser has no server HMAC secret; authenticated encryption protects stored authority, server validates sync. Hostile clock/PIN/unlocked-browser control remains a residual limitation, not absolute tamper-proof time.

## 24. Attendance Lifecycle

Unique church/ministry/date session, tenant-safe per-student records. Device date-only input(default device-local today), ministry/leased roster; stable local session IDs; draft+minimal outbox write atomic with optimistic versioning. Complete roster before finalization. Local Pending Sync is distinct from acknowledged Finalized. Offline scope only drafts/states/finalization/minimal guests. Server locks/validates roster and atomically commits original actor/time/status/version/audit. Permanent corrections append Owner revisions.

## 25. Synchronization Protocol

Push max100 ordered events/stable body; revalidate actor/tenant/membership/assignment/device lease/schema/base version. Sorted advisory locks; exact replay stored outcome; hash/actor mismatch denial. Domain/audit/receipt/feed one transaction. Bounded network/429/server backoff/jitter, validated acknowledgement identity before outbox deletion, encrypted rejection/conflict quarantine. Pull ordered tenant feed with assignment filtering/tombstones, advance cursor over filtered rows, atomically apply projections/cursor/renewed authorization to has_morefalse. Reconnect coalesced; revoked authority locks/clears UI but preserves unsynced work. Stale cursor requires full bootstrap; retention respects active cursors.

## 26. Conflict / Revision / Temporary Guest Model

Identical values deduplicate; independent changes merge; stale contradiction preserves bounded immutable evidence/Needs Owner Review; future versions conflict. Owner online/current MFA sees both values, resolves with bounded reason and immutable actor/UTC/correlation revision; original value/actor unchanged. Multiple open conflicts retain review. Teacher sees limited status, not other device/actor evidence. Guest stores display name/optional gender only; Owner promote/link/merge retains provenance.

## 27. Audit / Security Logging

Canonical audit_events/security_events are append-only at model/runtime grant layers. Required high-risk success audit participates in domain transaction; authentication success requires security persistence. Denial telemetry is best-effort so its failure cannot turn an already computed denial into500. RecordDeniedAttempt was not the reported successful-login root cause. Correlation UUID travels responses/jobs/audit/redacted logs; specific evidence suppresses duplicate generic denial. Metadata allowlist excludes PII/raw request; legacy audit tables frozen/read-only. Generic Application operation failed deliberately hides exceptions: diagnose schema/roles safely, not by logging credentials.

Retention: operational30days; security/sync receipts180; rejected application PII30; feed90plus active-cursor bounds; revoked push ciphertext30; expired device authorization180. Tenant audit never purged. Narrow fixed-search-path functions and transaction-local tenant loops preserve RLS.

## 28. Current Frontend Route Map

| Routes | Screen / prerequisite / role | Availability |
|---|---|---|
| / and /profiles | Shared-device picker; PIN lease; new/refresh requires authorized church session | Picker/cache offline; authority refresh online |
| /account/login, forgot-password, reset-password, verify-email, mfa | Church/Fortify; signed fragment/recent auth as appropriate | Online |
| /account/application | Verified applicant; tenant not required | Online |
| /account/teacher-invitation | Valid signed invitation/account identity | Online |
| /account/dashboard | Responsive church shell; optional ?church UUID birthday projection | Shell offline; details authorized |
| /account/attendance | Unlocked valid leased assigned profile | Offline marking/pending; online sync after refresh |
| /account/ministries, students | Owner writes/Teacher assignment reads; explicit church UUID | Online |
| /account/teachers, imports, audit | Owner/current MFA/tenant; recent auth where required | Online |
| /account/conflicts | Owner/current MFA; Teacher limited status | Online |
| /account/reports | Tenant/assignment authorized; Owner export | Online |
| /account/birthdays | Authorized assignment or unlocked leased minimal projection | Online/minimal offline fallback |
| /account/platform-login, platform-setup | Separate sage.dev guard, invitation/MFA/recovery acknowledgement | Online only |
| /account/platform-applications, platform-audit, platform-system-health | Verified/active/current-MFA platform guard | Online only |

Grouped account names above all use the /account/ prefix. Router resolves last pathname segment; renderable shell is not authorization. Many screens require explicit UUID/workspace selection; api/me is not global membership discovery.

## 29. Current API Surface Summary

| Group | Endpoints / authorization |
|---|---|
| Health | /api/health and /health/live minimal public; /health/ready secret header; /platform/system-health platform MFA aggregates |
| Church auth | /sanctum/csrf-cookie, /login, /logout, /auth/session, root Fortify password/email/MFA |
| Applicant | /api/church-applications/current GET and /api/church-applications POST; verified church session, CAPTCHA submission |
| Tenant | /api/me,/api/audit-events; validated UUID/membership/transaction/RLS/Owner MFA |
| Platform | /platform/csrf-token, setup/{id}, login, two-factor-challenge, me, logout; isolated cookie/CSRF |
| Review | /platform/applications, detail, approve/reject; no church-cookie crossover |
| Membership | /api/teachers, teacher-invitations, teacher-invitations/accept, ownership-transfer, assigned-ministries |
| Roster | /api/ministries and students; detail/archive/restore/enrollments |
| Import | /api/imports/students/preview, /api/imports/{batch}, /api/imports/{batch}/commit, /api/imports/template |
| Offline | /api/offline/bootstrap,/api/sync/push,/api/sync/pull |
| Attendance review | /api/sync-conflicts plus detail/resolve; session record corrections; /api/attendance-guests plus promote/link/merge |
| Reports/birthdays | /api/attendance-reports and export, /api/birthdays/today, /api/push-subscriptions/config and subscription POST/DELETE |

Contract defines exact shape/limits; no endpoint/schema changed this run. Actual protected dashboard API is **/platform/system-health**; the stale /api/platform/system-health reference in knowledge/ARCHITECTURE.md was corrected.

## 30. Manual Testing Prerequisites

Live5173/8000, migrated PostgreSQL, worker/scheduler, consistent stateful origin/cookies/CSRF, existing verified applicant. Positive onboarding additionally needs real Turnstile site/secret/expected host, approved private operator invitation and completed MFA. Owner/Teacher/roster/offline/sync live journeys need approved church/memberships/assignments and authorized synthetic roster; current development has none. Use disposable test DB/browser contexts for factories. Current tests are not a human pilot. Real mail/push requires configured provider identity and supported permission/device; physical iOS installation cannot be claimed from emulation.

## 31. Manual / Runtime Test Matrix

Results qualify the **stated action/evidence only**. DIRECT_RUNTIME means actual local service/HTTP/SQL or directly observed UI, not human interaction. BROWSER_AUTOMATION means real browser, usually modeled API responses. AUTOMATED_TEST means current Pest/Vitest execution. CODE_INSPECTION means inspected source/help/config, not operated flow. DOCUMENTATION is historical evidence. BLOCKED means missing prerequisite. Automated PASS does not create live identities or establish deployed integration.

Default automated prerequisites: isolated migrated PostgreSQL test fixtures and appropriate role/assurance; browser4173 uses mocked API with real UI/Dexie/crypto. Live prerequisites: verified development fixture on5173/8000. Server/administrative actions are online. Offline states are stated explicitly. Route details in sections28–29 apply to matrix shorthand. **55 rows: 40 PASS / 0 FAIL / 12 BLOCKED / 3 NOT RUN.** Counts apply only to the stated action/evidence of each row.

| ID | Area / route | Identity | Preconditions | Action | Expected | Actual | Result | Evidence |
|---|---|---|---|---|---|---|---|---|
| Q01 | Church login | Applicant | Live verified applicant; online | Submit fixture credentials | Login authenticates | UI Your account; HTTP200/security success | PASS | DIRECT_RUNTIME |
| Q02 | Invalid login | Unknown account | Unknown synthetic identity; CSRF | Submit invalid credentials repeatedly | Deny safely/throttle | 422; sixth repeated identity attempt429 | PASS | DIRECT_RUNTIME |
| Q03 | Stale auth/session | Signed-out applicant | Logged out; online | Read session and current application | Read401 | Session/current application401 | PASS | DIRECT_RUNTIME |
| Q04 | Application submission | Applicant | Live applicant; CAPTCHA absent | Complete application form and verification | Submit->pending | Form loads; submit disabled; no application created | BLOCKED | BLOCKED |
| Q05 | Application status | Applicant | Live applicant; online | Read own current application | Own current only | 200/application null | PASS | DIRECT_RUNTIME |
| Q06 | Turnstile local success | Applicant | Site/secret/host absent | Load widget and attempt valid verification | Accepted challenge/action | Fail closed; CSP regression passes; no live success | BLOCKED | BLOCKED |
| Q07 | Platform bootstrap prerequisites | Operator | Command/private mailbox needed | Inspect command signature and bootstrap prerequisites | Inspect official mechanism | Help/source confirms signature/pending/queue/expiry; not executed live | PASS | CODE_INSPECTION |
| Q08 | Platform login success | sage.dev | No live sage.dev | Open form and authenticate platform identity | Password->challenge | Form renders; positive identity absent | BLOCKED | BLOCKED |
| Q09 | Platform MFA | sage.dev | No live invitation/admin | Complete invitation TOTP and recovery acknowledgement | TOTP/recovery assurance | Isolated tests pass; no live ceremony | BLOCKED | BLOCKED |
| Q10 | Platform review | sage.dev | No live admin/application | List and inspect pending applications | Authorized list/show | Church-cookie denial proven; no positive review | BLOCKED | BLOCKED |
| Q11 | Approval | sage.dev | No live pending app/platform | Approve pending application and retry | Atomic approval | Backend approval/idempotency/rollback tests pass; no live mutation | BLOCKED | BLOCKED |
| Q12 | Rejection | sage.dev | No live pending app/platform | Reject application and exercise retention | Safe rejection/retention | Backend rejection/retention pass; no live decision | BLOCKED | BLOCKED |
| Q13 | First Owner | Approved applicant/Owner | No approved application | Inspect approval-created membership | Exactly-one Owner | Dev churches0; backend constraint/approval pass | BLOCKED | BLOCKED |
| Q14 | Owner login/MFA | Owner | No live Owner/material | Sign in and confirm MFA | Current assurance | Isolated auth/MFA tests pass; no live claim | BLOCKED | BLOCKED |
| Q15 | Owner workspace | Owner | No live active membership | Open authorized church administration | Authorized administration | Applicant api/me403; shell is not authorization | BLOCKED | BLOCKED |
| Q16 | Teacher invitation | Owner | Isolated Owner/MFA/ministry | Invite, assign, replay and revoke Teacher | Invite/replay/revoke/assign | Membership/invitation/security tests pass | PASS | AUTOMATED_TEST |
| Q17 | Invitation acceptance | Invitee | Isolated invitee/token | Accept valid/expired/mismatched invitation | Accept/expiry/mismatch | TeacherInvitation/MembershipSecurity pass | PASS | AUTOMATED_TEST |
| Q18 | Ministry management | Owner/Teacher | Isolated roles/assignments | Create, list, archive and restore ministry | CRUD/archive/restore boundaries | StudentManagement/backend setup pass | PASS | AUTOMATED_TEST |
| Q19 | Student roster | Owner | Isolated Owner/tenant | Create, normalize and enroll student | Normalize/birthdate/enroll/archive | StudentManagement/NormalizeStudentInput pass | PASS | AUTOMATED_TEST |
| Q20 | Roster authorization | Teacher/other tenant | Assigned/unassigned/other tenant | Read roster and attempt unauthorized writes | Scope reads/deny writes | Roster/tenancy tests pass; live applicant denied | PASS | AUTOMATED_TEST |
| Q21 | Spreadsheet import | Owner | Isolated Owner/MFA/synthetic workbook | Upload, preview, map and commit synthetic spreadsheet | Preview then atomic create | StudentImportFlow/browser import pass | PASS | AUTOMATED_TEST |
| Q22 | Malformed workbook | Owner | Isolated Owner/unsafe fixture | Upload malformed or unsafe workbooks | Safe reject/no partial write | Import parser/flow rejection pass | PASS | AUTOMATED_TEST |
| Q23 | Duplicate import | Owner | Isolated duplicate batch/key/concurrent workers | Replay commit and execute concurrent import | Replay/single create | ConcurrentStudentImport/flow/browser proof pass | PASS | AUTOMATED_TEST |
| Q24 | Responsive shell | Synthetic browser roles | Four emulated targets | Navigate four viewport targets and check accessibility | Nav/focus/touch/axe | 68-case matrix/serious-critical axe pass | PASS | BROWSER_AUTOMATION |
| Q25 | PWA | Browser profile | Production preview; offline | Exercise offline navigation, updates and API cache boundary | Navigation/update/API NetworkOnly | Current PWA browser checks pass | PASS | BROWSER_AUTOMATION |
| Q26 | Profile picker | No session/profile | Empty live origin | Open root picker and inspect actions | Empty state/actions | No stored profiles/Add profile/Sign in online observed | PASS | DIRECT_RUNTIME |
| Q27 | Encrypted profile creation | Authorized synthetic actor | Mock authorized bootstrap | Create PIN-protected profile | PIN profile encrypts | Real UI/Dexie/crypto browser scenarios pass | PASS | BROWSER_AUTOMATION |
| Q28 | PIN unlock | Local profile actor | Isolated correct/wrong PIN | Unlock with correct/wrong PIN and inspect isolation | Selected key only/delay | Profile/crypto and browser checks pass | PASS | AUTOMATED_TEST |
| Q29 | Assignment bootstrap | Owner/assigned Teacher | Isolated Owner/assigned Teacher | Request offline bootstrap | Minimal trusted scope | OfflineAuthorization tests pass | PASS | AUTOMATED_TEST |
| Q30 | Authorization lease | Authorized device actor | Bound actor/device/church | Issue/check actor-device-church bound lease | 14-day scoped authority | Device/profile binding tests pass | PASS | AUTOMATED_TEST |
| Q31 | Cached roster | Local profile actor | Browser encrypted assigned profile; offline | Read protected cached roster offline | Minimal cache read | Browser/profile scenarios pass | PASS | BROWSER_AUTOMATION |
| Q32 | Offline restart | Local profile actor | Unexpired cache/pending work | Close, reopen and unlock while offline | Close/reopen/PIN | Cache/work retained; sync needs refresh | PASS | BROWSER_AUTOMATION |
| Q33 | Offline attendance | Assigned Teacher | Assigned synthetic roster; offline | Create and mark four dated drafts offline | Four-date draft/mark/bulk | Current browser scenarios pass | PASS | BROWSER_AUTOMATION |
| Q34 | Finalization | Owner/Teacher | Complete/incomplete isolated roster | Finalize complete and incomplete rosters | Pending then atomic server commit | Repository/FinalizeAttendance/authorization pass | PASS | AUTOMATED_TEST |
| Q35 | Pending sync | Local profile actor | Real browser outbox; offline | Queue changes through outage and closure | Closure/outage preserves | Browser pending/outage proof pass | PASS | BROWSER_AUTOMATION |
| Q36 | Reconnect | Same profile actor | Same-actor refresh; simulated outage | Refresh online authority and reconnect | Coalesced bounded retry | Browser reconnect/retry pass | PASS | BROWSER_AUTOMATION |
| Q37 | Push | Authorized device actor | Isolated tenant/device/events | Push valid and invalid event batches | Atomic acceptance/denial | PushIdempotency/client tests pass | PASS | AUTOMATED_TEST |
| Q38 | Pull | Assigned Teacher/device | Isolated assigned feed/cursor | Pull pages and apply tombstones/renewal | Ordered filter/tombstone/renew | PullCursor/client tests pass | PASS | AUTOMATED_TEST |
| Q39 | Replay/idempotency | Authorized device actor | Stable keys/lost-response/concurrent fixtures | Replay events, mismatch payload and race workers | Exactly-once/mismatch denial | Backend/browser replay pass | PASS | AUTOMATED_TEST |
| Q40 | Profile isolation | Two Teacher profiles | Two browser Teachers; offline switch | Switch profiles offline and inspect roster | Other roster absent | Shared-device/profile browser pass | PASS | BROWSER_AUTOMATION |
| Q41 | Actor binding | Mismatched actor/device | Mismatched server/local actor/device | Attempt bootstrap persistence and sync acknowledgement | Reject before persist/ack | Profile/sync/device proof pass | PASS | AUTOMATED_TEST |
| Q42 | Lease expiry | Local profile actor | Expired encrypted lease/PIN; edited clear expiry | Expire encrypted lease then edit clear expiry | Deny reads/writes | New metadata-tamper regression and expiry tests pass | PASS | AUTOMATED_TEST |
| Q43 | Conflict detection | Competing devices | Stale contradiction/nonoverlap | Push stale contradictory and independent marks | Preserve/merge/dedupe safely | ConflictResolution/PushIdempotency pass | PASS | AUTOMATED_TEST |
| Q44 | Owner review | Owner | Isolated Owner/MFA; modeled browser | Inspect conflict values and resolve | Both values/audited resolve | Backend/browser conflict-report pass | PASS | AUTOMATED_TEST |
| Q45 | Revision/correction | Owner | Isolated finalized session/Owner | Correct finalized record and inspect immutable history | Append/preserve original | Conflict/AttendanceReport proof pass | PASS | AUTOMATED_TEST |
| Q46 | Temporary guests | Teacher/Owner | Minimal encrypted event/Owner | Capture guest then promote/link/merge | Promote/link/merge/provenance | GuestResolution/repository proof pass | PASS | AUTOMATED_TEST |
| Q47 | Audit | Applicant/domain actors | Live login/denial plus isolated actions | Sign in/deny and exercise audited transactions | Atomic/rollback-safe evidence | Live security actions and AuditIntegrity/Integration pass | PASS | DIRECT_RUNTIME |
| Q48 | Tenant isolation | Other church/role | Isolated multiple churches/restricted SQL | Query through restricted tenant scope | Same allowed/other denied | Tenancy suite/browser denial pass | PASS | AUTOMATED_TEST |
| Q49 | Authorization denials | Applicant/church session | Live applicant/church cookie/no tenant | Attempt tenant/platform/missing-CSRF/invalid-CAPTCHA requests | Deny tenant/platform/CSRF | 403/401/419; rejected CAPTCHA422 | PASS | DIRECT_RUNTIME |
| Q50 | Birthdays/reports/operations | Owner/Teacher/operator | Isolated timezone/roles; actual scheduler | Run birthdays, reports, retention and heartbeat | Scope/privacy/effective reports/retention | Notification/report/operations tests and live heartbeat pass | PASS | AUTOMATED_TEST |
| Q51 | Actual Web Push | Authorized subscriber | No VAPID/subscription/permission | Subscribe and observe real generic push | Generic real delivery | No provider/device delivery tested | BLOCKED | BLOCKED |
| Q52 | Positive readiness | Operator | READINESS_TOKEN absent | Send authorized readiness header | Authorized readiness200 | Unauthorized401 proven; positive probe not configured | BLOCKED | BLOCKED |
| Q53 | Physical install/pilot | Human/mobile operator | No physical devices/human pilot | Install and pilot on physical devices | Real mobile/background/offline | Emulation only | NOT RUN | BLOCKED |
| Q54 | Hosted CI | CI runner | Runner results unavailable | Execute corrected workflow jobs | Execute corrected workflows | YAML/order/bootstrap inspected; local equivalents pass; hosted unobserved | NOT RUN | CODE_INSPECTION |
| Q55 | Fresh restore drill | Backup operator | No schema/data change requiring repeat | Perform a new encrypted isolated restore drill | Encrypted isolated restore | Task18 evidence historical; not rerun | NOT RUN | DOCUMENTATION |

Supplemental live HTTP: RT01 CSRF204; RT02 login200; RT03 session200; RT04 own-current200; RT05 tenantless403; RT06 church cookie/platform401; RT07 platform CSRF200; RT08 missing-CSRF POST419; RT09 rejected-CAPTCHA POST422; RT10 register404; RT11 logout204; RT12 stale session401; RT13 stale application401; RT14 bad credentials422; RT15-0..3 bad credentials422; RT15-4 throttle429. **19 requests passed** expected status. Liveness200/minimal, API health200 and unauthorized readiness401 add3: **22 direct HTTP PASS**. Separate from Q matrix, not additional independent product-flow coverage.

## 32. Browser / Responsive Findings

Live in-app browser showed successful login/verified account without MFA, application form after transport fix, missing verification/disabled submit, isolated platform form, logout and empty profile picker. Layout inspected visually; no claim of all-device human sign-off. Final Playwright: **68/68 passed**,17each on desktop Chrome, Pixel7 Chrome, iPhone13 WebKit and iPad(gen7) WebKit emulations. Installed stable Chrome and existing WebKit2336 override; no browser installed. Serious/critical axe checks clear on tested surfaces.

Browser journeys mostly **mock HTTP/API**. Real backend integration is separately covered by211 Pest tests and the limited live requests. New policy tests use real browser CSP/referrer enforcement with intercepted harmless resources; not real completed CAPTCHA/MFA. A controlled browser rehearsal is not a human church pilot.

## 33. Offline / PWA Findings

Actual browser/unit proof: real IndexedDB encryption, profile switch/restart, current leased cache, same-actor refresh before sync, four-date offline attendance/outbox, bounded retry/replay, quota failure, API NetworkOnly and worker update safety. Fixed expiry-index extension.5173and4173 profiles differ by origin. Clearing site storage/uninstall can destroy unsynced work. Physical background eviction/storage pressure, hostile clock rollback and all pending-work upgrade combinations remain unqualified. registration.update alone does not prove every version transition.

## 34. Security Findings

No auth/CSRF/MFA/RLS/audit/CAPTCHA/lease/sync bypass used. Corrected real first-party GET failure, production Turnstile CSP denial, expiry-index bypass, test isolation/CI defects and dependency findings. Runtime remains restricted/nonowner; code/contract boundaries preserved. No production credential or tenant child data introduced. Scanners/audits in section41; remaining provider/physical-device commissioning gaps are explicit.

## 35. Confirmed Bugs / Defects

| ID / severity / area | Reproduction; expected vs actual | Root cause / evidence | Correction / regression |
|---|---|---|---|
| D01 High environment/login | Fixture CSRF204/login500 vs authenticated session | Ignored env SQLite; only starter tables; password verified; success writer failed missing security_events(HY000), rollback. RecordDeniedAttempt was best-effort telemetry, not root cause | Correct PostgreSQL env/migrate empty DB, preserve SQLite/copy known fixture once. Live HTTP/UI200/security event. No auth bypass |
| D02 High functional/session | Live login then applicationGET401 vs own-current200 | No-referrer plus GET without Origin => Sanctum fromFrontend false. Same session with origin-only Referer200; UI reproduced | Request/upload/download/client origin-only policy; live form works; browser regression proves no page/query disclosure under global no-referrer |
| D03 High deployment/CAPTCHA | Production CSP blocks required script/frame vs permitted verification | script-src self/default frames self; real-browser test failed; official Cloudflare requirements | Exact HTTPS Turnstile script/frame exception; no inline/eval/wildcard; browser also denies unrelated script; deployment/threat docs sync |
| D04 High test/data safety | Test bootstrap rotates live runtime password; DB_TEST collision could migrate development | ALTER ROLE used DB_RUNTIME; destructive feature refresh accepted same DB; preconnection refusal tests failed | Separate test role/default suffix, preconnection DB/role collision guards, examples/tests.3tests/9assertions; isolated role probe preserved independently provisioned dev credential |
| D05 High validation/CI | Clean recipe contradicted required bootstrap/runtime config | Missing local app key/migration password, premature migrate/runtime setup; cache requested before pnpm activation | Generate local key; disposable trust-service placeholder; separate test names; harness owns test migration; no premature cache in either workflow. YAML/order inspected, local equivalents pass; hosted run unobserved |
| D06 High dependency | Initial pnpm audit9findings(6high/3moderate) vs zero | brace-expansion recursion DoS advisory families: GHSA-q2hr-2g5m-vwhr, GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p | Exact overrides1.1.21/2.1.7/5.0.12 and narrow lock update; frozen install/audit and all frontend/browser gates pass |
| D07 High offline authority | Expired encrypted lease plus clear expiry2099 => isLeaseValidtrue vs denial | Protected read/write trusted editable clear index | Decrypt/bind/check protected encrypted lease; failing-then-passing metadata-tamper test;28focused/132full/68browser tests. Purge test keeps assertions, now uses valid encrypted bootstrap instead of forged index |
| D08 Medium operator docs | Runbook names nonexistent platform:bootstrap | Actual signature platform:bootstrap-admin(handle/email) | Correct deployment/handoff command; artisan help verified |

D01 is configuration, not a login source regression. Generic500 connectivity text is a contributing diagnostic/UX issue, not cause. No finding suppressed or legitimate test weakened. Final review queue is closed: no remaining BLOCKING/SHOULD FIX finding in this scope.

## 36. Likely / Hidden Bug Candidates

Unconfirmed, not asserted product bugs:

| ID / candidate | Plausibility / evidence / confidence | Prove/disprove / priority |
|---|---|---|
| H01 Live role journeys differ from modeled responses | Most E2E endpoints intercepted; live applicant bugs escaped them; medium | Authorized real provider/session onboarding-to-sync fixture journey; high |
| H02 Repeated workspace selection/navigation context | Many nav links omit church query but screens have explicit workspace fields; low | Real Owner crosses every nav link; only then propose context preservation; medium |
| H03 Device/church timezone attendance rollover | AttendanceScreen today uses device local date; explicit date selectable; requirement alignment uncertain; medium | Two timezone devices/church near midnight; do not silently change semantics; medium |

## 37. Risks / Needs Testing

Hostile device clock/PIN/unlocked-browser control; physical iOS Home Screen/background push; OS storage eviction; real multi-device timeout/reordering; changed worker version with pending work; actual CAPTCHA hostname/action/TLS; private mailbox/MFA ceremony; real Web Push. Corrected CI needs observed hosted run. Task18 restore historical, not new drill. Production provider backup/rollback/DNS/TLS rollout untested here. Record evidence before strengthening claims or inventing requirements.

## 38. Improvements (Optional, Not Implemented)

| Category / priority | Improvement |
|---|---|
| DX/high | Safe preflight/start automation checks driver/schema/roles/origin/worker/scheduler without reseeding |
| Documentation/high | Replace stock API README; commissioning and live-vs-modeled test guidance |
| Testing/high | Authorized isolated real-HTTP browser integration suite |
| UX/medium | Differentiate500/server failure from offline safely; correlation support |
| Operations/medium | Sanitized schema/role/audit diagnostic codes, no raw exception/PII |
| UX/medium | Workspace navigation persistence after proving friction |
| Accessibility/medium | Physical keyboard/screen-reader/touch beyond axe subset |
| Testing/medium | Explicit changed-worker/pending-work, timezone and OS-storage cases |
| Security hardening/scoped review | Offline hostile-clock/unlocked-device residual threats |
| Performance/low | Measure allowed large roster/import/cursor load, no speculative rewrite |

## 39. Known Environment Limitations

Default Node22, no PHP PATH, temporary extension/trust files, no Windows PCNTL. Default bash resolves WSL without /bin/bash; structure passed through disposable Alpine sh/read-only root mount. Existing trusted-roots.pem supplied process-scoped to Composer/pnpm/Semgrep, with TLS verification enabled. Existing WebKit2336 selected by PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH. Preview reused without public dummy key at build caused initial modeled onboarding failure; proper build environment corrected it before definitive68pass matrix. No test weakened. Session PIDs/handles are not durable startup instructions. Upstream inlineDynamicImports deprecation is nonblocking.

## 40. Known External Dependencies

Turnstile server hostname/action validation; mail/push providers; Vercel/Railway/DNS/HTTPS; registries/advisories/scanner rules; GitHub runners. Local Mailpit substitutes local capture only. Dummy CAPTCHA is not authority to relax verification. Local/provider credentials remain ignored/secret-store configuration. No new deployment or actual external delivery was claimed.

## 41. Current Validation Evidence

This run, not relabeled historical Task18 results:

| Gate | Result |
|---|---|
| Safety TDD |3collision tests initially failed, then3passed/9assertions; independent dev-role credential survived bootstrap integration probe |
| Offline TDD | Metadata expiry reproduced; corrected profile/sync/attendance/profile-UI subset28passed |
| Backend | **211passed/1308assertions**, separate test role/DB; dev fixture still authenticates afterward |
| Frontend | **132passed/34files** after final offline/transport/dependency changes |
| Browser | **68/68**, four emulated targets, real UI/crypto/worker, mostly modeled API; serious/critical axe clear |
| Typecheck/lint/build | Passed after final code/dependency corrections |
| OpenAPI | api:check passed; contract/generated unchanged |
| Pint/Composer | Pint --test and strict validation pass; Composer audit no vulnerabilities |
| pnpm | Frozen install pass; audit no vulnerabilities after9findings remediated |
| Structure | Root read-only Alpine sh scripts/verify-structure.sh passed |
| Runtime |22HTTP expected statuses; PostgreSQL/schema/grants; worker startup; heartbeat write/check/scheduled ticks |
| CI | YAML parse/order/bootstrap review; local equivalent gates pass; hosted run NOT RUN |
| Semgrep baseline | Full OWASP apps scan108rules/323targets/~99.9%parse/0findings |
| Semgrep final delta |128rules/12source-test-config targets/~100%parse/0findings; no parse errors; includes new PHP/browser tests and final offline code |
| Secrets |Gitleaks tracked/untracked nonignored source and25-commit history:0leaks; final documentation/knowledge delta:0leaks |
| Final review / whitespace |git diff --check passed; source/scope/document review complete; remediation queue closed,0BLOCKING/SHOULD FIX |

Full scanner had5partial parse warnings, all existing Vitest generic mock syntax in test files(ApplicationScreen/AuthScreen/PlatformAuthScreen/ApplicationReviewScreen/SystemHealthScreen), not production inputs. Default scanner excludes some PHP tests; explicit final-source delta uses an empty ignore file on an already secret-free exact-path snapshot to cover new/changed test/bootstrap/security input. No relevant new source is waived.

Invalidation: initial pnpm run verify131frontend/211backend passed. Later TypeScript/offline/frontend dependency changes required full frontend/type/lint/build/browser reruns. No PHP domain/test-bootstrap/migration/backend dependency input changed after backend aggregate; that result remains valid. Full security baseline plus explicit final security delta handles changed inputs. Knowledge-only edits do not invalidate builds/tests.

## 42. Historical Important Decisions

Independent history; no legacy Expo import. One Owner/invited Teachers; isolated platform. PostgreSQL authority; minimal encrypted assigned leased cache. Policy plus forced RLS; separate runtime/migration. Atomic success evidence/best-effort denials; immutable records. Create-first safe import/no silent merge. No silent last-write-wins contradiction. Guest/correction provenance. Generic count-only push/full birthdate excluded offline. API NetworkOnly, preserved pending work on revocation, deferred updates. Task18 rehearsal/restore evidence historical. Rationale: knowledge/DECISIONS.md and approved design/roadmap.

## 43. Security Invariants

Trusted UUID/active membership/assignment/current assurance; transaction-local forced RLS; runtime nonowner/no bypass. No platform child-data shortcut; exactly-one Owner. Separate cookies/CSRF/guards. Server authorization, not visibility. Canonical append-only evidence/frozen legacy. Atomic domain/audit/feed/receipt; locking/idempotency. Correlation/allowlist redaction. No secrets/PII/raw bodies in logs/Git. Encrypted per-profile key lifecycle and protected lease expiry/binding; PIN alone never grants sync authority. Preserve unsynced work. Bounded import/guest scope. API never cached as static. TLS stays verified. Reviewed migrations/contracts/generated types/gates before GREEN.

## 44. Things Future ChatGPT/Codex Must Know

Login500 was SQLite starter schema, not necessarily password/network/denial writer. Verified fixture has no tenant. auth/session success does not grant api/me without church/MFA. API GET needs origin evidence: retain origin-only request Referer, never page/query disclosure. Preview4173 lacks API proxy and owns separate profiles. Widget loading is not server CAPTCHA success; dummy action differs. Never occupy sage.dev with arbitrary QA mailbox. Test role now separate; collision guards; destructive test refresh serial/test-only. Keep APP_KEY and live DB role credential stable. Node/PHP/Corepack/CA/WebKit paths process-scoped; bash means unavailable WSL on this host. Browser has no HMAC secret: authenticated encrypted lease controls cache; reauthentication independently blocks sync. Timestamp/retention uses UTC/server/church IANA; attendance default device-local. No Task19.

## 45. Do Not Do

No dev migrate:fresh/volume delete/reseed/SQLite delete/history discard/broad process kill/storage purge with pending work. No production secret/PII/recovery material in docs/logs. No auth/MFA/CSRF/RLS/audit/CAPTCHA/lease/sync bypass; no hand-edit generated types. No false human/physical/live-backend PASS. No main push/merge, force/rebase/amend or unrelated staging/refactor/next feature. No global runtime/TLS weakening. Governance changes follow separate approval rules; AGENTS.md was not modified.

## 46. Current Backlog

**CONFIRMED DEFECTS:** D01–D08 corrected; final review queue closed. No outstanding confirmed defect within this qualification scope. **LIKELY DEFECTS:** H01–H03 unconfirmed; prove first. **RISKS TO TEST:** section37 provider/identity/device/clock/upgrade/hosted-CI. **OPTIONAL IMPROVEMENTS:** section38, not automatically implemented. **ROADMAP WORK:** none; preserve all18tasks. Signup expansion/post-MVP work requires separately approved scope.

## 47. Exact Next Action

MT-00 and MT-01 are complete; stop before MT-02. Verify the latest reviewed phase commit/worktree/upstream through its report and [manual state](../../knowledge/MANUAL_TESTING.md). MT-02 requires a separate explicit request, real configured Turnstile for the exact origin/action and approved additional applicant preparation under the [roadmap](MANUAL_TESTING_ROADMAP.md). Preserve AP/DA, mail, canonical evidence and unsynced work. Provider/admin/device commissioning remains unqualified; no next phase or product feature is authorized.

## 48. Historical MT-00 Entry Prompt

> Read AGENTS.md, docs/qa/MSPROUT_SYSTEM_HANDOFF.md, docs/qa/MANUAL_TESTING_ROADMAP.md, knowledge/MANUAL_TESTING.md and knowledge/CODEBASE_MEMORY.md. Verify checkpoint/status/upstream and preserve work. Tasks 1–18 are complete; no new feature/Task 19. Execute MT-00 only, record actual expected/actual/result/evidence and exact prerequisites, update manual knowledge and stop at the reviewed checkpoint. Distinguish live runtime, modeled browser, automated tests, inspection and historical evidence. Preserve PostgreSQL/RLS, MFA/CSRF/CAPTCHA/audit, protected leases and unsynced work. Use documented process-scoped Windows tools; never reset/reseed development or weaken security. Verify scoped MCP visibility after restart if pending; source/tests remain authoritative. Follow AGENTS.md remediation/validation/finalization.
