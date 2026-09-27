# Testing Environment

Verified on 2026-09-27 unless a historical milestone is explicitly identified.

## Canonical architecture

- Local infrastructure: `compose.yaml` runs PostgreSQL `18-alpine` on loopback port 5432 and Mailpit `v1.27.7` on loopback ports 1025/8025.
- Current status: both `msprout-postgres-1` and `msprout-mailpit-1` are healthy.
- Frontend baseline: Node 24 LTS, pnpm 10.34.5, React 19.2, TypeScript 5.9, Vite 8.2, Vitest.
- API baseline: PHP 8.3+, Composer, Laravel 13, Pest 4, PostgreSQL PDO.
- The API test bootstrap requires PostgreSQL 18.x and local migration credentials. It creates or refreshes only `DB_TEST_DATABASE`, creates/updates the restricted runtime test role, and runs application queries through that role. Never run backend suites concurrently against the shared test database.
- Secrets are supplied through local process/environment configuration and must never be printed or recorded here.

## Standard commands

From the repository root:

```text
pnpm --dir apps/web test --run
pnpm --dir apps/web typecheck
pnpm --dir apps/web lint
pnpm --dir apps/web build
pnpm --dir apps/web api:check
pnpm run verify
bash scripts/verify-structure.sh
git diff --check
```

From `apps/api`:

```text
php artisan test
php vendor/bin/pint --test
composer validate --strict
composer audit --no-interaction
```

Security gates also include `pnpm audit --audit-level high`, Gitleaks over tracked and new source while excluding secrets/dependencies/runtime output, and Semgrep OWASP Top Ten rules over `apps`. Contract changes use `pnpm --dir apps/web api:generate` followed by `api:check`.

Task-specific commands and deployment boundaries are in `docs/security/task-4-authentication.md`, `docs/security/task-5-applications.md`, and the Task 5/6 QA reports. Do not infer a current pass from an older report.

## Last verified results

- Committed Task 6 milestone: `pnpm run verify` passed 58 frontend tests in 12 files, frontend typecheck/build, and 95 backend tests / 513 assertions. Contract, lint, Pint, Composer checks, structure, dependency audits, Gitleaks, Semgrep, and `git diff --check` also passed. Source: `docs/qa/task-6-verification.md`.
- Committed Task 7 (`32fad0a1735c0e2a677832252f72197252c8cd05`), final 2026-09-27 validation: focused audit/logging suite passed **37 tests / 197 assertions**; focused audit frontend passed **7 tests in 2 files**.
- Final `pnpm run verify` passed **65 frontend tests in 14 files**, frontend typecheck/build, and **132 backend tests / 710 assertions**.
- Frontend lint, `api:check`, Pint, Composer validation, structure, and `git diff --check` passed. Composer and pnpm audits reported no known vulnerabilities. Gitleaks reported no leaks. Semgrep ran 103 OWASP rules on 169 targets with zero findings.
- Full evidence is recorded in `docs/qa/task-7-verification.md`.

## Current Windows host details

- Default `node` is 22.22.3 and does not meet the approved Node 24 baseline. A Codex-bundled Node 24.19.0 exists.
- The currently resolved Codex fallback `pnpm` attempted an automatic module-directory install/purge check and aborted because no TTY was available. No install or purge completed. The pre-existing `%TEMP%\msprout-corepack-bin\pnpm.cmd` is pnpm 10.34.5 and successfully ran the current Task 7 frontend checks using existing dependencies.
- No `php` executable is on the default PATH. A pre-existing `%TEMP%\msprout-php-8.3\php.exe` reports PHP 8.3.33.
- The PHP runtime contains `pdo_pgsql`, but it is enabled for repository test commands through the pre-existing `%TEMP%\msprout-task5-php-config\pgsql.ini` and a process-local `PHP_INI_SCAN_DIR`.
- Composer audit and Semgrep can retain TLS verification behind the host certificate interceptor by exporting the Windows CurrentUser/LocalMachine trusted roots to a temporary PEM and setting only the audit/scan process to use it. The temporary file is not a repository artifact or global trust-store change.
- Only the Docker Desktop WSL distribution is present. The Compose stack contains PostgreSQL and Mailpit, not PHP or Node.

Do not install, update, purge, or reconfigure runtimes merely to reproduce a command. Confirm with the user before changing the environment.

## `Install pdo_pgsql finished` investigation

The exact UI label is not present as an action in the stored prior-session transcript. Repository and local-session evidence does establish the underlying effect:

- The temporary PHP runtime directory predates Task 5 and already contained PostgreSQL support files.
- During Task 5, the agent created `%TEMP%\msprout-task5-php-config\pgsql.ini` containing only `extension=pdo_pgsql`, then set `PHP_INI_SCAN_DIR` for the test process. Current read-only inspection confirms that this loads `pdo_pgsql` in the temporary PHP runtime.
- No repository dependency or configuration file was created for this enablement; current Git history/status shows no such environment change.
- No system PHP is on PATH, WSL contains only `docker-desktop`, and the Compose services contain no PHP runtime.

Conclusion: the verified change was a temporary Windows-user runtime configuration used by test processes. There is no evidence that it installed or changed Windows system PHP, WSL, Docker, or repository files. Because the UI label itself is not recorded, any broader effect would be unverified rather than assumed.
