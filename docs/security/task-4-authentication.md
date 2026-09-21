# Task 4 authentication

Church accounts use Fortify and Sanctum same-origin cookie sessions. Public registration remains disabled; church applications and approval belong to Task 5. No application or child-data endpoints are added by Task 4.

## Local use

1. Configure the API using `apps/api/.env.example`. Keep credentials in the local environment, never in Git. The migration connection is separate from the restricted runtime connection.
2. Start PostgreSQL 18 and Mailpit using the existing Compose services. Run migrations with the migration connection, then start Laravel on `127.0.0.1:8000`.
3. Set `APP_URL` to the browser's public origin, locally `http://localhost:5173`, and include that origin's host and port in `SANCTUM_STATEFUL_DOMAINS`.
4. Run `pnpm --dir apps/web dev` and open `/account/login`. Vite proxies authentication and API requests to Laravel; `/account/*` is served by React. Use one hostname consistently.
5. Run the Laravel queue worker to deliver queued platform invitations. Mailpit receives local mail. Never use the log mail transport for authentication email.

Production must use HTTPS, `APP_DEBUG=false`, secure HttpOnly SameSite session cookies, a host-only cookie domain, and a correctly configured public `APP_URL`. Deployments must route the root authentication paths as well as `/api/*` to Laravel. They must serve `/account/*` from the frontend. Infrastructure request logs must omit credentials, cookies, bodies, and signed/reset query parameters. No authentication response may be cached by a proxy or service worker.

## Account boundaries

`/auth/session` returns only verification and MFA enrollment state. `/api/me` additionally requires verified email, an active server-validated membership for `X-Church-Id`, and confirmed MFA for Owners. Teachers are not required to enroll MFA. The membership lookup runs within the existing PostgreSQL RLS boundary. The response allowlists account, current membership, assignment summary, and MFA metadata; it contains no password, token, recovery code, or child data. The assignment summary is empty until the assignment feature is introduced.

`PlatformAdmin` records use the `platform` guard and `ministrysprout_platform_session` cookie scoped to `/platform`. Church sessions do not authorize platform routes; platform sessions do not authorize church routes. `/platform/me` rechecks activation, email verification, confirmed MFA, recovery acknowledgement, and session MFA assurance. Platform access is online-only, and its UI and transport do not cache account data.

Mutations require CSRF. Church forms initialize `/sanctum/csrf-cookie` and send the decoded `XSRF-TOKEN` cookie as `X-XSRF-TOKEN`. Platform forms obtain their own in-memory token from `/platform/csrf-token` before every mutation and send `X-CSRF-TOKEN`. Login and MFA completion rotate sessions. Recovery, login, and MFA attempts are rate limited, with generic recovery responses that do not reveal account existence.

## One-time platform setup

Run `php artisan platform:bootstrap-admin --handle=sage.dev --email=<private-recovery-email>` from `apps/api`. There is no password argument. The command creates a pending administrator and queues an invitation expiring after `PLATFORM_SETUP_LIFETIME` minutes (default 30). It does not create a usable login and rejects duplicate bootstrap identities.

Open the private invitation in the browser. It proves access to the recovery email, requests a new password, then requires a real TOTP and acknowledgement that the recovery codes have been saved. Only then does the account become active. Subsequent sign-ins require password plus TOTP or a single-use recovery code. Platform recovery codes are consumed under a database lock.

Email links carry their signed/reset values in the frontend URL fragment; the frontend removes that fragment from browser history after capturing it in memory. Signed API URLs must match the current origin and the expected endpoint. Enrollment keys and recovery codes are displayed only during the explicit setup flow and are never saved in local storage or IndexedDB.

## Verification

From `apps/api`, run `php artisan test tests/Feature/Auth tests/Feature/Platform`, then `php artisan test` and `vendor/bin/pint --test`. The test bootstrap requires PostgreSQL 18 and local migration credentials, creates/refreshes only `DB_TEST_DATABASE`, and executes application queries as a restricted role without RLS bypass. Do not run concurrent backend suites against that same test database.

From the root, run:

```sh
pnpm --dir apps/web test --run src/features/auth src/features/platform-auth
pnpm --dir apps/web test --run
pnpm --dir apps/web typecheck
pnpm --dir apps/web lint
pnpm --dir apps/web build
pnpm --dir apps/web api:check
bash scripts/verify-structure.sh
git diff --check
```

Security verification includes Composer audit, `pnpm audit --audit-level high`, Gitleaks secret scanning, Semgrep's OWASP Top Ten rules, and review of the complete Task 4 diff. Secret scans must cover tracked and new source files while excluding local credentials, dependencies, runtime storage, and generated build output. No security finding is waived merely to permit a commit.

The workspace pnpm override pins `js-yaml` 4.3.1 consumers to patched 4.3.2 for GHSA-2883-xcg3-v3hh; one OpenAPI tooling dependency pins the vulnerable version exactly. Generated API types are checked with `api:check` and regenerated with `api:generate` whenever the contract changes.
