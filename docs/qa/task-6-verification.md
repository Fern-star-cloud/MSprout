# Task 6 verification

Date: 2026-09-22. Branch: feat/mvp-foundation.
Baseline: 763bc93610ca44167a1800bd810edd643358620c (feat: add approval-gated church registration).

Continued the existing Task 6 working tree without resetting or replacing prior work. No commit, staging, push, remote modification, dependency change, or Task 7 implementation was performed. Origin is the authoritative Fern-star-cloud/MSprout repository. The pre-existing upstream remote was left untouched and was not contacted.

## Acceptance evidence

| Criterion | Implementation and evidence |
|---|---|
| Active Owner only | ChurchMembershipPolicy, verified church guard, active church/membership checks, current-session Owner MFA, and fresh authorization after acquiring the church lock. Teacher attempts to list, invite, self-assign, revoke, and transfer fail. Platform identities and missing MFA fail. |
| Teacher invitations | Server-fixed role and database role check; normalized email, UUID, trusted church, inviter, SHA-256 token hash, seven-day expiry, acceptance/revocation timestamps. Unknown fields and client-selected roles fail validation. |
| Listing/status | Owner-only tenant-scoped 50-row pages; pending, accepted, revoked, and expired projections exclude tokens and hashes. Replacing an invitation revokes earlier pending invitations for that church/email. Creation responses do not disclose account existence. |
| Secure acceptance | Random 256-bit token and HMAC-signed church/invitation/token/expiry proof. Email fragment is removed from browser history and POSTed in the body. Signature is checked before establishing the narrow pre-membership RLS context; church, invitation, and existing user rows are locked. Exact normalized email, current verification, expiry, unused state and revocation are checked transactionally. |
| Account boundary | A new invitee may set a password through the emailed signed proof, which verifies that exact address. Existing accounts must sign in with a verified matching address; acceptance never replaces their password. |
| Replay/tampering | Tests reject altered token/signature/church, mismatched email or identity, mismatched church header, expired/revoked/replaced proof, and reuse after acceptance. Concurrent loss of email verification is rechecked from the locked user row. |
| Ministry access | Minimal reference table only. Unique membership/ministry assignments and composite tenant foreign keys. Teacher reads and /api/me expose active assignments to unarchived ministries. Unassigned access fails. Empty assignment lists revoke all assignments. |
| Tenant isolation | All seven new tenant tables enable and force PostgreSQL RLS. Restricted-runtime tests check no-context reads, cross-church writes to every table, foreign ministry read/update/delete denial, composite foreign keys, and uniqueness. HTTP tests reject foreign memberships and ministries. |
| Revocation | Atomically revokes membership, assignments, offline/push authorization records; deletes database sessions and rotates remember tokens. Future tenant access fails. Audit history remains. Assignment changes also invalidate previous authorizations. |
| Ownership transfer | Explicit active Teacher target, current password, freshly verified unused TOTP, church/membership/user locking. Atomic demotion/promotion with existing unique and deferred exactly-one-owner constraints checked inside the transaction. New Owner access remains MFA-gated. |
| Immediate former-Owner sign-out | The controller logs out the current web guard, invalidates its session and regenerates CSRF after the transfer action succeeds. A real database-session regression first authenticates an Owner cookie, transfers ownership, asserts guest state, cleared MFA assurance, zero user session rows and rotated remember token, then replays two old cookies through fresh guards/session stores: both return 401 immediately. The frontend explicitly asserts the matching “Ownership transferred. Sign in again.” message and removes management actions. |
| Concurrency | Two independent PHP workers use the runtime DB role. Test holds the church lock until both workers are observed waiting, then releases it. One succeeds, stale Owner is denied, one Owner and one transfer audit remain. Credentials travel via stdin, never arguments or files. |
| Minimal audit | Task-specific membership_audits stores UUID, church, actor/target IDs, action/result/risk, previous Owner ID, correlation UUID and UTC time. Runtime role has SELECT/INSERT only. No Task 7 audit viewer, general security-event framework or logging system. |
| Failure rollback | Audit failures roll back acceptance, assignments, invitation revocation, Teacher revocation, and ownership roles. Transfer failure additionally preserves both users' session rows, remember token and offline/push authorizations; the original Owner stays authenticated and can still read /api/me as Owner. No transfer audit remains. Mail failures roll back invitation/audit creation. |
| Privacy | Synchronous invitation mail keeps raw proof out of jobs/failed_jobs. Logging transports, aliases and failover chains with logging fail closed. Transport exceptions become a generic exception without a previous exception. Task 6 HTTP failures use existing correlation-only reporting. |
| Frontend | Policy-gated lists, invitation status, assignment editing, revocation confirmation, password/MFA transfer confirmation, pagination, safe errors and offline denial. Controls disappear after denial/transfer. Signed invitation acceptance supports existing/new invitees. Approved applications link to Teacher management. |
| Contract | Ten operations across nine paths, tenant headers, closed input/output schemas, safe errors and acceptance/transfer semantics. Regenerated TypeScript passes drift check. Existing /api/me schema already contains the assignment projection. |

## Commands and results

Commands use repository-standard executable names. On Windows, existing local PHP 8.3 and pnpm installations were added to process PATH. PHP_INI_SCAN_DIR enabled PostgreSQL for Artisan child processes. Local Docker PostgreSQL 18 migration credentials were read into environment variables without printing them. Backend suites ran sequentially against the shared test database.

| Command/check | Result |
|---|---|
| git status, git log, git cat-file, git branch, git remote -v | Baseline present, expected branch, work preserved, no remote changes. |
| Read AGENTS.md, full design, Task 6/global constraints; inspect Tasks 1–5 and changed code | Completed before implementation and again at continuation. Referenced Superpowers skills were unavailable; direct TDD used. |
| php artisan test tests/Feature/Memberships | Final focused suite: 26 tests / 205 assertions passed, including database-cookie replay, rollback and two-process concurrency. Exit 0. |
| php artisan test tests/Feature/Memberships/OwnershipTransferTest.php | Five tests / 42 assertions passed. Exit 0. The additional database-backed regression verifies the already implemented logout; no further production-code change was required in this continuation. |
| Initial backend red run | Seven expected failures from missing tables/routes. |
| Expanded red/green runs | Exposed empty-assignment rejection, audit rollback gaps, suspended-church reads, unsafe mail aliases/failover, stale verified identity and session-lifecycle issues. Fixed after observed failures. |
| Test-harness fixes | Named independent throttles; correct session fingerprints when switching test users; system-clock stale TOTP; refreshed PostgreSQL statistics snapshot when observing workers. Database-cookie fixtures use the configured JSON serialization and reset the session, resolved guard and default guard between simulated requests. Initial fixture failures were corrected before the final passing run. |
| pnpm --dir apps/web test --run src/features/teachers | Initial missing-screen/contract failures observed; final 10 component tests and one contract test pass. |
| pnpm --dir apps/web test --run src/features/teachers src/features/auth | 39 passed at that checkpoint. |
| pnpm --dir apps/web test --run src/features/teachers src/features/applications/ApplicationScreen.test.tsx | 17 passed. |
| pnpm --dir apps/web typecheck | Passed. |
| pnpm --dir apps/web api:generate and api:check | Passed; generated file matches contract. Temporary editing script removed. |
| pnpm --dir apps/web lint | Passed. |
| pnpm run verify | Full frontend suite, typecheck, production build and backend suite. Final totals below. Includes existing authentication, MFA, platform, application audit/security, contracts, tenancy and RLS tests. |
| php vendor/bin/pint on changed paths; pint --test | Passed. |
| composer validate --strict; composer audit --no-interaction | Passed, no vulnerability advisories. |
| pnpm audit --audit-level high | Passed, no known vulnerabilities. Initial certificate-chain failure resolved with NODE_USE_SYSTEM_CA=1; TLS verification retained. |
| bash scripts/verify-structure.sh | Passed using Git Bash. |
| php artisan route:list --path=api --except-vendor -v | Verified all Task 6 operations, guards, MFA, tenancy and throttles. |
| php artisan config:cache; route:cache; view:cache | Passed with isolated cache paths. Verification files removed without touching active caches. |
| gitleaks dir /scan --redact --no-banner (existing Docker image) | Passed, no leaks. Snapshot includes tracked/new source and excludes ignored environments, dependencies and runtime/build output. |
| semgrep scan --config p/owasp-top-ten --metrics off --disable-version-check --error apps (existing Docker image) | Final full scan passed: 103 applicable rules, 151 targets, zero findings, ~99.9% parsed lines, seven default exclusions. The final test-fixture adjustment also passed a supplemental scan: 27 rules, one file, zero findings. Initial registry TLS failure resolved with the host's public trusted root certificate bundle mounted into the container. TLS validation remained enabled. |
| git diff --check; complete changed-source review; generated drift check; debug/TODO search; staged diff | Passed. No dependency changes, production secrets, raw proof, personal-data logging, temporary generator or Task 7 feature found. Nothing staged. |

## Assumptions and deployment boundaries

- Run migrations with the separate migration role and requests with the restricted non-owner PostgreSQL role.
- Preserve the existing primary database-backed session driver/table. Invalidation deletes all sessions for a target user, including sessions for other churches; offline/push revocation is scoped to the selected membership. Remember-me credentials rotate.
- Role changes, persistent session deletion, authorization revocation and the required audit share the same PostgreSQL transaction. Current-request logout happens only after the action succeeds; the enclosing tenant transaction commits before session-response persistence. A failed database commit can sign the requester out, but cannot commit a church with zero or multiple active Owners. A consumed TOTP must be replaced with a new code when retrying a failed action.
- Configure transactional email and frontend APP_URL. Logging transports, including nested fallbacks, are rejected. Production SMTP was not exercised; tests fake delivery.
- Synchronous mail avoids storing raw proof. A provider could deliver before a later commit failure; that link is unusable. An Owner can issue a replacement; only the newest pending invitation remains valid.
- Existing users sign in, verify their email and reopen the invitation. New-account acceptance treats the emailed signed proof as verification of the exact address. Acceptance does not automatically sign in.
- Keep Fortify's replay cache persistent/shared and API clocks synchronized. Transfer requires a fresh TOTP, not a recovery code or earlier session assurance.
- Ministry rows support assignments/authorization only. Ministry creation, roster CRUD and student data remain Task 8. A fresh workspace needs those ministry rows before inviting with assignments.
- Offline/push tables contain only membership/device authorization and revocation fields. Issuance, encrypted push data, client cache purge, actual sync/quarantine and birthday delivery remain later tasks. Task 6 verifies server invalidation; it does not claim to test nonexistent offline/sync clients.
- Disconnected devices learn revocation on reconnect; the design's 14-day lease boundary still applies.
- Revoked memberships are not silently reactivated by invitations. No restoration endpoint is introduced.
- Component/transport tests and builds ran. No physical-device pilot or live external-provider delivery test is claimed.
- One recursive verification-cache cleanup command was blocked by command policy; cleanup succeeded by removing only the known generated files and empty directory.

## Final verification totals

Task 6 is complete and verified within the deployment boundaries above. No commit or push has been made; approval remains the next step.

- Full `pnpm run verify`: exit 0; 58 frontend tests in 12 files, typecheck and production build passed; 95 backend tests / 513 assertions passed. No skipped or incomplete tests were reported.
- Focused memberships: 26 tests / 205 assertions passed. Focused Teachers: 11 tests in two files passed. The full suite covers authentication, MFA, tenancy, forced RLS, exactly-one-owner constraints, audit rollback/immutability, CSRF and security regressions.
- Contract generation and drift checks, ESLint, Pint, Composer validation, structural checks and `git diff --check` passed. Composer/pnpm audits reported no known vulnerabilities with TLS validation enabled. Gitleaks reported no leaks; Semgrep reported zero findings.
- Final review found no actual environment files, committed credentials, raw invitation/MFA data, personal-information leakage, missing tenant RLS, authorization bypass, transaction inconsistency, dependency artifact, unfinished code or Task 7 implementation. The generated TypeScript file is intentional and reproducible. Build/runtime/scan artifacts are ignored.
- The manifest matches all 40 changed files: 14 tracked modifications and 26 new files, totaling 2,971 additions and 35 deletions (including untracked source/report files). HEAD remains the Task 5 baseline; there are no staged changes.

## Complete changed-file manifest

All 40 changed files are listed below, including this report.

- apps/api/app/Actions/Invitations/AcceptTeacherInvitation.php
- apps/api/app/Actions/Invitations/InvitationProof.php
- apps/api/app/Actions/Invitations/InviteTeacher.php
- apps/api/app/Actions/Memberships/ManageTeachers.php
- apps/api/app/Actions/Memberships/RecordMembershipAudit.php
- apps/api/app/Actions/Memberships/RevokeMembershipAccess.php
- apps/api/app/Actions/Memberships/RevokeTeacher.php
- apps/api/app/Actions/Memberships/TransferOwnership.php
- apps/api/app/Http/Controllers/Auth/ChurchAccountController.php
- apps/api/app/Http/Controllers/TeacherManagementController.php
- apps/api/app/Mail/TeacherInvitationMail.php
- apps/api/app/Models/Invitation.php
- apps/api/app/Models/TeacherMinistryAssignment.php
- apps/api/app/Policies/ChurchMembershipPolicy.php
- apps/api/app/Providers/AppServiceProvider.php
- apps/api/app/Support/Tenancy/TenantContext.php
- apps/api/bootstrap/app.php
- apps/api/database/migrations/2026_09_21_000002_create_teacher_management.php
- apps/api/resources/views/mail/teacher-invitation.blade.php
- apps/api/routes/api.php
- apps/api/tests/Feature/Memberships/ConcurrentOwnershipTransferTest.php
- apps/api/tests/Feature/Memberships/MembershipSecurityTest.php
- apps/api/tests/Feature/Memberships/OwnershipTransferTest.php
- apps/api/tests/Feature/Memberships/TeacherInvitationTest.php
- apps/api/tests/Support/MembershipScenario.php
- apps/api/tests/Support/transfer-worker.php
- apps/web/src/api/generated.ts
- apps/web/src/App.css
- apps/web/src/App.tsx
- apps/web/src/features/applications/ApplicationScreen.test.tsx
- apps/web/src/features/applications/ApplicationScreen.tsx
- apps/web/src/features/auth/routing.test.tsx
- apps/web/src/features/auth/transport.test.ts
- apps/web/src/features/auth/transport.ts
- apps/web/src/features/teachers/contract.test.ts
- apps/web/src/features/teachers/TeacherInvitationScreen.tsx
- apps/web/src/features/teachers/TeacherManagementScreen.test.tsx
- apps/web/src/features/teachers/TeacherManagementScreen.tsx
- contracts/openapi.yaml
- docs/qa/task-6-verification.md
