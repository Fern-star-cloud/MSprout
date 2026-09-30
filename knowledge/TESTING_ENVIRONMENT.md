# Testing Environment

Verified on 2026-09-30 unless a historical milestone is explicitly identified.

## Manual planning / Codebase Memory integration validation

Planning/tooling-only maintenance against starting checkpoint `df7cf6118f5f119253154ce015803fd143bb1a6c`, 2026-09-30:

- `git diff --check` passed. Local Markdown file references passed; the roadmap has **23 complete phase schemas / 211 unique case IDs**, initially NOT_RUN. Review corrected source-sensitive application/invitation/version assumptions and named fixture dependencies; no BLOCKING or SHOULD FIX item remains in the planning review.
- Gitleaks 8.30.0 scanned a temporary exact-path snapshot of all ten intended added/changed files, including new/untracked documents, using `detect --no-git --no-banner --redact`; **zero leaks**. Private config backups, downloads, receipts, graph cache and scanner output remain outside Git. No real credentials were added.
- User Codex TOML parses; removing only the new MCP entry produces parsed settings equal to the pre-install snapshot. The desktop-bundled CLI reports the entry enabled with the reviewed executable, repository cwd and allowed-root/cache environment. No optional project JSON is necessary: native Blade discovery indexed all four templates.
- Reviewed official pinned Windows **v0.11.0** installer/checksums passed. Independent local stdio MCP initialize/tools-list/list/architecture/symbol/trace smoke checks passed (17 tools). Full MSprout reindex passed with **2,563 nodes / 7,656 edges**, six reviewed partial parses and zero unusable files. Initial graph was 2,521/7,614; graph counts are observations, not completeness/security proof. Out-of-root indexing was denied as intended; indexed path inspection found no excluded environment/private-key/runtime-data paths. See [tool evidence and limitations](CODEBASE_MEMORY.md), including unverified independent signature/attestation checking.
- Active desktop-chat MCP visibility remains **PENDING restart**, explicitly allowed by this request. It is distinct from the passing standalone MCP protocol checks. No desktop invocation, manual phase or new live product qualification is claimed.
- No application source, contract, dependency, migration, scanner/CI execution or product runtime input changed. Therefore backend/frontend/build/audit/OWASP product gates were not invalidated or rerun solely for documentation. The runtime-qualification comprehensive Semgrep baseline and final delta recorded in [CURRENT_STATE.md](CURRENT_STATE.md) remain applicable; full security CI coverage is unchanged. Git whitespace and secret checks cover this documentation/tooling change separately.

These results were recorded before the one permitted task finalization; resolve its commit from the roadmap's history and verify actual tracking/remote state. Tasks 1–18 and development data are preserved; no Task 19 or manual run report was created.

## Canonical architecture

- Local infrastructure: `compose.yaml` runs PostgreSQL `18-alpine` on loopback port 5432 and Mailpit `v1.27.7` on loopback ports 1025/8025.
- Current status: both `msprout-postgres-1` and `msprout-mailpit-1` are healthy.
- Frontend baseline: Node 24 LTS, pnpm 10.34.5, React 19.2, TypeScript 5.9, Vite 8.2, Vitest.
- API baseline: PHP 8.3+, Composer, Laravel 13, Pest 4, PostgreSQL PDO.
- The API test bootstrap requires PostgreSQL 18.x and local migration credentials. It creates/refreshes only `DB_TEST_DATABASE` and provisions `DB_TEST_RUNTIME_USERNAME` (default live role plus `_test`). Before connecting it rejects a test DB equal to development/migration DB or a test role equal to the live runtime role. Application queries use that separate restricted test role; its credential rotation leaves the development role unchanged. Never run backend suites concurrently against the shared test database.
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

Security gates also include `pnpm audit --audit-level high`, Gitleaks over tracked and new source while excluding secrets/dependencies/runtime output, and risk-appropriate Semgrep OWASP Top Ten validation. Use focused Semgrep over changed and directly relevant application inputs when a valid comprehensive baseline remains applicable and that scope reliably covers the affected risks. Use the full `semgrep scan --config p/owasp-top-ten apps` command when the baseline is invalidated or focused coverage is insufficient; it is mandatory for Task 17's production-hardening baseline and for Task 18 when intervening production-code or security-coverage changes invalidate that baseline. The GitHub security workflow continues to run the full configured scan on pull requests and pushes to `main` and `feat/mvp-foundation`. Contract changes use `pnpm --dir apps/web api:generate` followed by `api:check`.

Task-specific commands and deployment boundaries are in `docs/security/task-4-authentication.md`, `docs/security/task-5-applications.md`, and the Task 5/6 QA reports. Do not infer a current pass from an older report.

## Runtime qualification results — 2026-09-30

- Focused collision TDD passed **3 tests / 9 assertions**; an independent disposable-role probe verified the development credential survives test bootstrap. Focused profile/sync/attendance/profile-UI proof passed **28 tests** after the expired encrypted lease/edited clear metadata regression.
- Current-run aggregate backend passed **211 tests / 1,308 assertions**. After final frontend/offline/dependency corrections, the full frontend passed **132 tests in 34 files**, with typecheck/lint/build green. Backend inputs did not change afterward, so the backend result remains valid under effect-based invalidation.
- Definitive Playwright passed **68/68 tests**, 17 per desktop Chrome, Pixel 7 Chrome emulation, iPhone 13 WebKit emulation and iPad WebKit emulation. API responses are largely intercepted: this proves real browser/UI/crypto/IndexedDB behavior, not live Laravel integration or physical-device operation. The preview build supplied a public dummy Turnstile key; it does not bypass/configure live server verification.
- OpenAPI drift, Pint, Composer strict validation/audit, frozen pnpm install/audit and structure passed. Both audits report zero known vulnerabilities after narrow brace-expansion remediation. Gitleaks current source/history and final document delta found no leaks; whitespace and final review passed.
- Full Semgrep baseline: **108 rules / 323 targets / ~99.9% parsing / zero findings**. Five existing Vitest mock-syntax partial parse warnings were reviewed. Explicit final source/test/config snapshot with empty ignore file: **128 rules / 12 targets / ~100% parsing / zero findings**. New tests and sensitive bootstrap/transport/offline/workflow inputs are covered; ignored credentials/dependencies/runtime output are excluded from snapshots.
- **22 direct HTTP expected-status checks** passed, including real login/session/application read, stale session, authorization/CSRF/CAPTCHA denials, rate limiting and minimal health. Live browser login/application form/logout/profile empty state were observed. Missing provider/private-admin/tenant fixtures block additional positive live role journeys, as itemized in [the canonical handoff](../docs/qa/MSPROUT_SYSTEM_HANDOFF.md).
- Ignored local API configuration now selects PostgreSQL, separate runtime/migration identities, consistent 127.0.0.1:5173 stateful origin, Mailpit SMTP1025 and debug off. APP_KEY retained; 20 migrations applied only to the previously empty development PostgreSQL DB. Known verified test@example.com fixture copied once after existence/hash checks; original SQLite preserved, no reseed. Worker/scheduler startup and heartbeat passed.
- Default Windows bash resolves WSL without /bin/bash. Structure proof used `docker run --rm -v "${PWD}:/repo:ro" -w /repo alpine:latest sh scripts/verify-structure.sh` **from the repository root**. CI YAML/order/bootstrap were inspected; hosted execution remains NOT RUN. No global runtime/TLS reconfiguration occurred.

## Historical milestone results

- Committed Task 6 milestone: `pnpm run verify` passed 58 frontend tests in 12 files, frontend typecheck/build, and 95 backend tests / 513 assertions. Contract, lint, Pint, Composer checks, structure, dependency audits, Gitleaks, Semgrep, and `git diff --check` also passed. Source: `docs/qa/task-6-verification.md`.
- Committed Task 7 (`32fad0a1735c0e2a677832252f72197252c8cd05`), final 2026-09-27 validation: focused audit/logging suite passed **37 tests / 197 assertions**; focused audit frontend passed **7 tests in 2 files**.
- Final `pnpm run verify` passed **65 frontend tests in 14 files**, frontend typecheck/build, and **132 backend tests / 710 assertions**.
- Frontend lint, `api:check`, Pint, Composer validation, structure, and `git diff --check` passed. Composer and pnpm audits reported no known vulnerabilities. Gitleaks reported no leaks. Semgrep ran 103 OWASP rules on 169 targets with zero findings.
- Full evidence is recorded in `docs/qa/task-7-verification.md`.
- Task 8 is committed at `dc3c13c6cd5e4909c644b0abe37d18875cbe248f`; its final validation included focused backend **13 tests / 83 assertions**, full backend **145 tests / 793 assertions**, and full frontend **66 tests in 15 files**.
- Task 9 validation before commit `fbe338f433c7432cc26c98ad8c2e258cf9502a79` (2026-09-28): focused backend **15 tests / 91 assertions**, Task 8 regression **13 tests / 83 assertions**, and aggregate `pnpm run verify` with **70 frontend tests in 17 files**, typecheck/build, and **160 backend tests / 884 assertions** passed. Frontend lint, OpenAPI drift check, Pint, Composer strict validation/audit, pnpm audit, scoped Gitleaks, repository structure, and `git diff --check` passed.
- Task 9 Semgrep `p/owasp-top-ten` completed with **0 findings**: 103 rules on 207 tracked app files (about 99.9% parsed), plus an explicit supplemental scan of all 16 new/untracked Task 9 source/test files using 98 rules (100% parsed). See `docs/qa/task-9-verification.md`.
- Task 10 final validation (2026-09-28): focused PWA **6 tests**, Chrome Playwright **3 tests**, full frontend **76 tests in 18 files**, and backend **160 tests / 884 assertions** passed. Frontend typecheck/lint/build, OpenAPI drift, frozen pnpm install, Pint, Composer strict validation/audit, pnpm audit, structure, Gitleaks, and `git diff --check` passed. Semgrep reported zero findings from 103 rules over 222 tracked application files and 108 rules over the final 31-file Task 10 change set. See `docs/qa/task-10-verification.md`.
- Task 11 final validation (2026-09-28): focused offline profiles **11 frontend tests** and **4 backend tests / 33 assertions**, direct-routing **12 tests**, Chrome Playwright **3 tests**, full frontend **88 tests in 21 files**, and full backend **164 tests / 917 assertions** passed. Typecheck/lint/build, OpenAPI drift, frozen install, Pint, Composer strict validation/audit, pnpm audit, structure, Gitleaks, and `git diff --check` passed. Semgrep found zero issues from 103 rules over 270 application files plus 98 rules over the final Task 11 source set. See `docs/qa/task-11-verification.md`.
- Task 12 final validation (2026-09-28): focused attendance **9 frontend tests in 3 files** and **8 backend tests / 23 assertions**, Chrome Playwright **3 tests**, full frontend **97 tests in 24 files**, and full backend **172 tests / 940 assertions** passed. Typecheck/lint/build, OpenAPI drift, frozen install, Pint, Composer strict validation/audit, pnpm audit, structure, Gitleaks, Semgrep, and `git diff --check` passed. See `docs/qa/task-12-verification.md`.
- Task 13 final validation (2026-09-29): focused sync **10 backend tests / 80 assertions** and **8 frontend tests**, Chrome Playwright **4 tests**, full frontend **108 tests in 26 files**, and full backend **182 tests / 1,020 assertions** passed. Typecheck/lint/build, OpenAPI drift, frozen install, Pint, Composer strict validation/audit, pnpm audit, structure, Gitleaks, Semgrep, and `git diff --check` passed. The final Semgrep run reported zero findings from 103 rules over 260 tracked application files and 122 rules over the complete 29-file Task 13 source/contract set with about 100% parsing. See `docs/qa/task-13-verification.md`.
- Task 14 final validation (2026-09-29): Task 14 attendance/conflict/guest frontend proof passed **22 tests in 5 files** and the final sync/conflict backend rerun passed **9 tests / 119 assertions**. Chrome Playwright **4 tests**, full frontend **113 tests in 27 files**, and final full backend **189 tests / 1,136 assertions** passed. Typecheck/lint/build, OpenAPI drift, Pint, Composer strict validation/audit, pnpm audit, structure, Gitleaks, Semgrep, and `git diff --check` passed. Final Semgrep reported zero findings from 103 rules over 272 tracked application files and 123 rules over all 28 changed source/contract files. See `docs/qa/task-14-verification.md`.
- Task 15 final validation (2026-09-29): focused reports/history proof passed **5 backend tests / 43 assertions** and **25 frontend tests in 5 files**. Chrome Playwright **4 tests**, full frontend **119 tests in 30 files**, and full backend **194 tests / 1,179 assertions** passed. Typecheck/lint/build, OpenAPI drift, Pint, Composer strict validation/audit, pnpm audit, structure, Gitleaks, Semgrep, and `git diff --check` passed. Full Semgrep reported zero findings from 103 OWASP rules over 281 targets with approximately 99.9% parsing. See `docs/qa/task-15-verification.md`.
- Security-validation governance optimization (2026-09-29): repository structure and `git diff --check` passed. Checksum-verified, process-scoped Gitleaks 8.30.0 scanned all 21 commits plus the complete six-file governance change snapshot and found no leaks. No application, dependency, scanner configuration, or CI workflow input changed, so application tests, audits, and a redundant local Semgrep scan were not applicable; Task 15's comprehensive Semgrep evidence remains valid.
- Task 16 final validation (2026-09-29): focused birthday/notification proof passed **12 backend tests / 84 assertions** and **22 frontend tests in 5 files**. Chrome Playwright passed **4 tests**; aggregate `pnpm run verify` passed **126 frontend tests in 33 files**, typecheck/build, and **203 backend tests / 1,232 assertions**. Frontend lint, OpenAPI drift, frozen install, Pint, Composer strict validation/audit, pnpm audit, structure, Gitleaks, and `git diff --check` passed. Risk-based Semgrep applied 123 OWASP rules to all 33 parsed changed PHP/TypeScript/OpenAPI targets with zero findings and approximately 100% parsing; Task 15's comprehensive baseline remains applicable until Task 17. See `docs/qa/task-16-verification.md`.
- Task 17 final validation (2026-09-30): focused operations/offline proof passed **12 backend tests / 114 assertions** and **9 frontend tests**. Stable Chrome Playwright passed **4 tests**; aggregate `pnpm run verify` passed **128 frontend tests in 34 files**, typecheck/build, and **208 backend tests / 1,299 assertions**. Frontend lint, OpenAPI drift, frozen install, Pint, Composer strict validation/audit, pnpm audit, structure, route/config/schedule checks, Gitleaks, and `git diff --check` passed. The production Docker image built successfully, ran as `www-data`, loaded GD/PCNTL/PDO PostgreSQL/ZIP, honored default and injected ports, returned minimal liveness, and reached Docker `healthy`. The required comprehensive `semgrep scan --config p/owasp-top-ten apps` baseline applied **108 rules to 314 targets**, parsed approximately 99.9%, and found zero issues after the missing-non-root-user finding was remediated. The five parser warnings are confined to existing Vitest generic mock syntax in test files; production source was scanned. See `docs/qa/task-17-verification.md`.
- Task 18 final validation (2026-09-30): focused offline profile/device/sync proof passed **20 tests** after final-review authorization-denial remediation. The definitive Playwright matrix passed **60/60 tests** across desktop Chrome, Pixel 7 Chrome emulation, iPhone 13 WebKit emulation, and iPad WebKit emulation. Aggregate verification passed **131 frontend tests in 34 files**, typecheck/build, and **208 backend tests / 1,299 assertions**; the backend aggregate passed again after dependency-advisory remediation. Frontend lint, OpenAPI drift, frozen install, Pint, Composer strict validation/audit, pnpm audit, structure, route/config/schedule/heartbeat/queue checks, Gitleaks, and `git diff --check` passed. The refreshed image built and ran as `www-data`, loaded required extensions, honored an injected port, and returned minimal liveness. The required comprehensive Semgrep rerun applied **108 rules to 322 targets**, parsed approximately 99.9%, and found zero issues; the later two-production-file security correction received a zero-finding **76-rule** focused OWASP rescan. The encrypted isolated restore drill matched every required count/checksum and destroyed its temporary artifacts. See `docs/qa/task-18-verification.md`.

## Current Windows host details

- Default `node` is 22.22.3 and does not meet the approved Node 24 baseline. The current Codex-bundled runtime is Node 24.19.0.
- The Codex fallback `pnpm` attempted an automatic module-directory install/purge check and aborted because no TTY was available. No install or purge completed. Task 18 instead invoked Corepack pnpm 10.34.5 directly with the bundled Node runtime and existing dependencies.
- Tasks 10–14 and 16–18 used the Codex-bundled Node 24.19.0; Task 15 used the then-current bundled Node 24.21.0. Task 18 Playwright used the installed stable Chrome channel and the host's existing WebKit 2336 through a process-scoped `PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH` override. No browser runtime was downloaded or globally configured.
- No `php` executable is on the default PATH. A pre-existing `%TEMP%\msprout-php-8.3\php.exe` reports PHP 8.3.33.
- The PHP runtime contains the required extension binaries. Task 9 test commands used process-local `PHP_INI_SCAN_DIR` files `%TEMP%\msprout-task9-php-config\pgsql.ini` and `%TEMP%\msprout-task9-php-config\gd.ini`. Both are external temporary environment files—not repository files, Git changes, staged/untracked artifacts, or commit candidates.
- Composer audit and Semgrep can retain TLS verification behind the host certificate interceptor by exporting the Windows CurrentUser/LocalMachine trusted roots to a temporary PEM and setting only the audit/scan process to use it. The temporary file is not a repository artifact or global trust-store change.
- Only the Docker Desktop WSL distribution is present. The Compose stack contains PostgreSQL and Mailpit, not PHP or Node.

Do not install, update, purge, or reconfigure runtimes merely to reproduce a command. Confirm with the user before changing the environment.

## `Install pdo_pgsql finished` investigation

The exact UI label is not present as an action in the stored prior-session transcript. Repository and local-session evidence does establish the underlying effect:

- The temporary PHP runtime directory predates Task 5 and already contained PostgreSQL support files.
- During Task 5, the agent created `%TEMP%\msprout-task5-php-config\pgsql.ini` containing only `extension=pdo_pgsql`, then set `PHP_INI_SCAN_DIR` for the test process. Current read-only inspection confirms that this loads `pdo_pgsql` in the temporary PHP runtime.
- No repository dependency or configuration file was created for this enablement; current Git history/status shows no such environment change.
- No system PHP is on PATH, WSL contains only `docker-desktop`, and the Compose services contain no PHP runtime.

Conclusion: the verified change was a temporary Windows-user runtime configuration used by test processes. Task 9 followed the same process-scoped pattern and added a temporary GD scan file for PhpSpreadsheet. There is no evidence that either changed Windows system PHP, WSL, Docker, or repository files. Because the historical UI label itself is not recorded, any broader effect would be unverified rather than assumed.
