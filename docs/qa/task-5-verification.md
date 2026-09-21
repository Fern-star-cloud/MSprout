# Task 5 verification report

Date: 2026-09-21. Branch: `feat/mvp-foundation`. Base commit: `fe52346d5740d5edd1aa95e73c799101a078b246`.

Task 5 was continued from the existing working tree. No valid prior work was discarded. No Task 6 implementation, commit, push, or remote change was made. All changes remain unstaged for approval.

## Acceptance results

| Requirement | Evidence and result |
|---|---|
| Pending applicants remain tenantless | Lifecycle test inspects memberships using the migration connection, avoiding false negatives caused by RLS. Passed. |
| Exactly one church and active Owner on approval | Row locking, a transaction, restricted runtime queries, existing RLS and deferred owner constraints; approval/replay tests inspect authoritative counts. Passed. |
| Approval/rejection idempotency | Repeated decisions return the original projection and enqueue one notification; opposite decisions return 409. Passed. |
| Verified applicant and platform guard isolation | Applicant routes require the church web guard and email verification. Review requires isolated active sage.dev plus confirmed/current-session MFA and recovery acknowledgement. Church sessions are rejected. Passed. |
| Owner MFA remains mandatory | Approved Owner cannot enter `/api/me` without MFA assurance. Existing authentication/tenancy suites also pass. |
| CAPTCHA and rate limits | Interface fake and HTTP fake tests cover success, invalid proof, missing configuration, wrong hostname/action, and connection failure. Submission throttling passes. No production CAPTCHA calls occurred. |
| Input boundaries | Unicode whitespace normalization; bounded names/city/address; IANA timezone validation; no files or unknown fields; server-selected applicant and church IDs. Passed. |
| Duplicate prevention | Active-user and normalized church/city database uniqueness plus transactional submission checks. Passed. |
| Audit and correlation | Platform audit is append-only to the runtime role, excludes free-form personal data, and preserves actor/category/correlation. Unexpected HTTP failures log a generic message and correlation only. Passed. |
| Transaction rollback | Missing audit persistence or database mail-queue persistence rolls back approval, church, membership, and audit. Passed. |
| Email notifications | Approval and rejection enqueue encrypted mail on the primary database queue. Replays do not enqueue twice. Delivery failures expose no recipient details in the exception. Passed. |
| Thirty-day privacy cleanup | Cutoff, rerun safety, recent-record preservation, session/reset deletion, active-application preservation, and RLS-hidden membership protection pass. Member identities survive while rejected details are purged. |
| Review/status UI | Verification, submission, Pending, Approved/MFA, Rejected, review detail, decisions, and error handling pass component tests. Both new direct routes pass routing tests. |
| Contracts | All six routes are represented with the correct server prefix, request/response types and guard descriptions. Standard generation and drift check pass. |

## Commands and results

Commands below are shown using the repository-standard executable names. On this Windows host, pnpm and PHP were resolved through the existing temporary tool installations. The API bootstrap used the local Docker PostgreSQL 18 test database and a restricted runtime role. Credentials were read into process environment variables without printing them. Backend suites were not run concurrently against the shared test database.

| Command | Result |
|---|---|
| `php artisan test tests/Feature/Applications` (from `apps/api`) | Final: **22 passed, 133 assertions**. |
| `php artisan test tests/Feature/Applications --filter="unrecognized\|paginates\|notification queue"` | Initially 2 passed/1 expected failure: decision endpoints ignored unknown fields. Fixed by rejecting extra fields; final suite passes. |
| `php artisan test tests/Feature/Applications/ApplicationSecurityTest.php --filter="background mail"` | Expected failure demonstrated a recipient-bearing transport exception. Fixed; final suite passes. |
| `pnpm --dir apps/web test --run src/features/applications src/features/platform/applications` | **9 passed** across 3 files, including the application contract test. |
| `pnpm --dir apps/web test --run src/features/auth/routing.test.tsx` | Initially exposed the two missing routes during TDD; all 9 routing cases pass in the final full frontend suite. |
| `pnpm --dir apps/web api:generate` | Passed; generated `src/api/generated.ts` from OpenAPI using the standard script. |
| `pnpm --dir apps/web api:check` | Passed; no generated-type drift. |
| `pnpm --dir apps/web typecheck` | Passed. |
| `pnpm --dir apps/web lint` | Passed. |
| `pnpm run verify` | Final: **43 frontend tests**, frontend typecheck and production build, **69 backend tests / 308 assertions** all passed. |
| `pnpm web:test`, `pnpm web:typecheck`, `pnpm web:build`, `pnpm api:test` | Executed by `verify`; all passed. Backend coverage includes all existing Auth, Platform, Contract, Tenancy, and Unit suites plus Task 5. |
| `php artisan test` | Executed by `pnpm api:test`; 69 passed, no skipped tests. |
| `php vendor/bin/pint <changed PHP paths>` | Formatted only Task 5 PHP changes. |
| `php vendor/bin/pint --test` (from `apps/api`) | Passed. A final root invocation targeting `apps/api` also passed. |
| `composer validate --strict` (from `apps/api`) | Passed. |
| `composer audit --no-interaction` (from `apps/api`) | Passed; no security vulnerability advisories. |
| `pnpm audit --audit-level high` | Passed; no known vulnerabilities. |
| `php artisan route:list --path=applications -v` | Six expected routes; verified guard/middleware groups and submission limiter. |
| `php artisan schedule:list` | Verified daily `PurgeRejectedApplications` registration. |
| `php artisan config:cache` | Passed with an isolated repository-relative cache path. |
| `php artisan route:cache` | Passed with an isolated repository-relative cache path. |
| `php artisan view:cache` | Passed with an isolated compiled-view directory. Generated verification files were removed afterward. |
| `bash scripts/verify-structure.sh` | Passed using the installed Git Bash. |
| `gitleaks dir /scan --redact --no-banner` in the existing Gitleaks Docker image | Passed; no leaks. Source snapshot includes tracked and new files, excluding ignored local environments, dependencies, runtime storage, and build output. |
| `semgrep scan --config p/owasp-top-ten --metrics off --disable-version-check --error apps` in the existing Semgrep Docker image | Passed: 103 applicable rules on 142 files, zero findings. Scanner reported seven default-pattern exclusions and approximately 99.9% parsed lines. |
| Same Semgrep command targeting the two files changed by the final mail privacy fix | Passed: 27 applicable rules on 2 files, zero findings. |
| `git diff --check` | Passed. Git's LF/CRLF normalization notices are not whitespace failures. |
| `git diff --cached --stat` | Empty; nothing staged. |
| `git branch --show-current`, `git log -1 --format="%h %s"`, `git remote -v` | Correct feature branch and unchanged Task 4 HEAD; authoritative origin remains Fern-star-cloud/MSprout. |
| `git status --short --untracked-files=all`, `git diff`, `git diff --stat`, `git diff --name-only`, `git ls-files --others --exclude-standard` | Inspected tracked and new changes; manifest below contains every changed file. |
| `Get-Content` for AGENTS.md, the complete design, Task 5, changed sources/tests, and relevant installed framework code; `rg --files` and targeted `rg` searches | Completed review. No leftover temporary generator, debugging code, skipped tests, Task 6 feature files, production secrets, or unrelated edits found. |
| `docker images --format ...`, `Get-Command`, `php --ini`, and scoped tool/config file inspection | Confirmed available local dependencies and diagnosed PHP extension/cache-path issues. |

The earlier implementation followed red/green TDD: the complete lifecycle first failed with 404, then boundary and component tests failed before their implementation. PostgreSQL RLS caught an initial discarded church UUID; the creation path was fixed without changing RLS. Retention's PostgreSQL `RESTRICT` code was handled explicitly. All those regressions now pass.

### Resolved environment issues

- `php -d extension=pdo_pgsql artisan test ...` initially failed because Artisan's child PHP process did not inherit the `-d` option. A temporary `PHP_INI_SCAN_DIR` configuration enabled `pdo_pgsql` for both processes. The required unmodified `php artisan test` and `pnpm run verify` commands then passed.
- Initial Laravel config/route cache verification rejected Windows absolute cache paths by treating them as application-relative. Repository-relative isolated paths fixed the check. View compilation passed as well; verification files were cleaned without touching active application caches.
- A combined build/recursive-cleanup command was blocked by command policy. Build and cache checks were rerun separately, then only the verified directory's individual generated files and empty directory were removed successfully.
- The initial sandbox denied Docker access earlier in the implementation. The continuation used the available local Docker service successfully. No service/dependency blocker remains for the recorded checks.

## Complete changed-file manifest

### Application domain and persistence

- `apps/api/app/Actions/Applications/ApproveChurchApplication.php`
- `apps/api/app/Actions/Applications/RecordApplicationDecision.php`
- `apps/api/app/Actions/Applications/RejectChurchApplication.php`
- `apps/api/app/Actions/Applications/SubmitChurchApplication.php`
- `apps/api/app/Enums/ApplicationStatus.php`
- `apps/api/app/Models/ChurchApplication.php`
- `apps/api/database/migrations/2026_09_21_000001_create_church_applications.php`
- `apps/api/database/factories/PlatformAdminFactory.php`

### API, authorization, CAPTCHA, and configuration

- `apps/api/app/Http/Controllers/ChurchApplicationController.php`
- `apps/api/app/Http/Controllers/Platform/ApplicationReviewController.php`
- `apps/api/app/Http/Middleware/ApplicationRequest.php`
- `apps/api/app/Http/Middleware/RequirePlatformReview.php`
- `apps/api/app/Http/Requests/SubmitChurchApplicationRequest.php`
- `apps/api/app/Support/Captcha/CaptchaVerifier.php`
- `apps/api/app/Support/Captcha/TurnstileVerifier.php`
- `apps/api/app/Providers/AppServiceProvider.php`
- `apps/api/bootstrap/app.php`
- `apps/api/config/applications.php`
- `apps/api/.env.example`
- `apps/api/routes/api.php`
- `apps/api/routes/platform.php`

### Notifications and privacy cleanup

- `apps/api/app/Jobs/PurgeRejectedApplications.php`
- `apps/api/app/Mail/ChurchApplicationDecisionMail.php`
- `apps/api/resources/views/mail/application-decision.blade.php`
- `apps/api/routes/console.php`

### Backend regression tests

- `apps/api/tests/Feature/Applications/ApplicationRetentionTest.php`
- `apps/api/tests/Feature/Applications/ApplicationSecurityTest.php`
- `apps/api/tests/Feature/Applications/CaptchaVerificationTest.php`
- `apps/api/tests/Feature/Applications/ChurchApplicationFlowTest.php`

### Frontend screens, navigation, and tests

- `apps/web/.env.example`
- `apps/web/src/App.css`
- `apps/web/src/App.tsx`
- `apps/web/src/features/applications/ApplicationScreen.tsx`
- `apps/web/src/features/applications/ApplicationScreen.test.tsx`
- `apps/web/src/features/applications/CaptchaChallenge.tsx`
- `apps/web/src/features/applications/contract.test.ts`
- `apps/web/src/features/platform/applications/ApplicationReviewScreen.tsx`
- `apps/web/src/features/platform/applications/ApplicationReviewScreen.test.tsx`
- `apps/web/src/features/auth/AuthScreen.tsx`
- `apps/web/src/features/auth/routing.test.tsx`
- `apps/web/src/features/auth/transport.ts`
- `apps/web/src/features/platform-auth/PlatformAuthScreen.tsx`

### Contract and documentation

- `contracts/openapi.yaml`
- `apps/web/src/api/generated.ts`
- `docs/security/task-5-applications.md`
- `docs/qa/task-5-verification.md`

## Assumptions and operational boundaries

Task 5 is complete for the explicitly requested verified-user application flow. Existing account registration remains disabled as in Task 4; public signup was not silently enabled. No Teacher invitation or other Task 6 functionality was introduced.

Production still needs Turnstile configuration, a configured transactional mail transport, a running database queue worker, and a running Laravel scheduler. These are deployment requirements, not unrun automated checks. Actual provider CAPTCHA/SMTP delivery was not exercised against production services; CAPTCHA tests use fakes and notification tests inspect the real local database queue or fake mail delivery.

Cleanup executes at the first daily run at/after 30 days. Accounts with any membership, including inactive memberships, are preserved. SMTP retries can redeliver a notification; idempotent application decisions enqueue it only once. The wider append-only audit framework belongs to Task 7; this task supplies the minimal platform decision audit required for Task 5.

The roadmap's old Frierend remote reference was not used. Existing remotes and Git history are unchanged. Await explicit user approval before staging exact paths and creating the Task 5 commit.
