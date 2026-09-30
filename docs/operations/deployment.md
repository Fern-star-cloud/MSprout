# Production deployment

Task 17 defines the deployable topology; Task 18 performs release qualification and the pilot. Do not point production at a release until Task 18 is complete.

## Topology and separation

- Vercel serves `apps/web`. `apps/web/vercel.json` applies the strict browser headers, serves the SPA under `/account/**`, and proxies all authenticated Laravel route families to `https://api.ministrysprout.app` so cookies and CSRF remain same-origin to the browser.
- Railway builds `apps/api/Dockerfile` once. The image declares the unprivileged `www-data` user and Apache listens on Railway's injected `PORT` (8080 by default). Create three services from that image: API (`msprout-entrypoint api`), queue worker (`msprout-entrypoint worker`), and scheduler (`msprout-entrypoint scheduler`). Only the API has a public domain.
- Create a separate, short-lived migration job from the same image with `msprout-entrypoint migrate`. Give migration credentials only to that job. API, worker, and scheduler receive the restricted runtime database credential and must not receive `DB_MIGRATION_USERNAME` or `DB_MIGRATION_PASSWORD`.
- PostgreSQL 18 is authoritative. Production, preview, and test databases and credentials are distinct. The runtime role remains `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, and `NOBYPASSRLS` and does not own tenant tables.

`railway.json` is the API service baseline. Railway service settings override the start command for worker and scheduler. The file remains supported for this release; review Railway's config-as-code migration guidance before its announced legacy-file cutoff.

## Required configuration names

Set values in the deployment secret stores; never paste values into Git, tickets, audit metadata, or logs.

| Scope | Names |
|---|---|
| All Laravel services | `APP_NAME`, `APP_ENV`, `APP_KEY`, `APP_PREVIOUS_KEYS`, `APP_DEBUG`, `APP_URL`, `LOG_CHANNEL`, `LOG_LEVEL` |
| Runtime database | `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, `DB_RUNTIME_USERNAME`, `DB_SSLMODE` |
| Migration job only | `DB_MIGRATION_DATABASE`, `DB_MIGRATION_USERNAME`, `DB_MIGRATION_PASSWORD` |
| Sessions/cache/queue | `SESSION_DRIVER`, `SESSION_COOKIE`, `SESSION_SECURE_COOKIE`, `SESSION_SAME_SITE`, `CACHE_STORE`, `QUEUE_CONNECTION`, `QUEUE_FAILED_DRIVER` |
| Mail and application review | `MAIL_MAILER`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_HOSTNAME` |
| Platform and operations | `PLATFORM_SESSION_COOKIE`, `PLATFORM_SETUP_LIFETIME`, `READINESS_TOKEN`, `QUEUE_LAG_WARNING_SECONDS`, `SCHEDULER_STALE_SECONDS` |
| Web build | `VITE_TURNSTILE_SITE_KEY` (public site key; paired with API Turnstile secret/hostname) |
| Web Push | `WEBPUSH_VAPID_SUBJECT`, `WEBPUSH_VAPID_PUBLIC_KEY`, `WEBPUSH_VAPID_PRIVATE_KEY` |

Production requires `APP_ENV=production`, `APP_DEBUG=false`, HTTPS, secure cookies, PostgreSQL-backed queues, and a cryptographically random `READINESS_TOKEN`. The public `/health/live` response is only `{ "status": "ok" }`; `/health/ready` requires `X-Readiness-Token`; aggregate metrics require an active, verified, MFA-confirmed `sage.dev` session at `/platform/system-health`.

## First deployment

1. Provision PostgreSQL 18, the non-owner runtime role, and a separate migration identity. Require TLS (`DB_SSLMODE=require` or stronger supported verification mode).
2. Run the migration job. Review its output without copying secrets or record data. Remove or rotate the job's migration credential after use.
3. Deploy API, worker, and scheduler from the same immutable image. Verify `/health/live`, then call `/health/ready` with the probe token. Confirm `operations:scheduler-heartbeat --check` succeeds and the queue worker is consuming jobs.
4. Bind Railway's API custom domain to `api.ministrysprout.app` with a valid certificate. Deploy Vercel only after the domain is reachable over verified HTTPS.
5. Verify CSP, HSTS, `no-store` API responses, the service worker's NetworkOnly `/api/**` behavior, email, and Web Push in the production environment.

## `sage.dev` bootstrap and removal

Run `php artisan platform:bootstrap-admin --handle=sage.dev --email=<private-recovery-email>` only in the isolated migration/administrative job using the private recovery email. The command creates a pending identity and a short-lived signed setup link; setup still requires email possession, password creation, MFA confirmation, and recovery-code acknowledgement. Remove the bootstrap job and any one-time delivery secret immediately afterward. To disable access, set the platform administrator status to `disabled`, revoke its sessions, rotate affected credentials if compromise is suspected, and preserve the audit evidence. Never convert a church identity into `sage.dev` or give `sage.dev` a church membership.

## Key rotation

- Rotate `APP_KEY` by placing the previous key in `APP_PREVIOUS_KEYS`, deploying all services, re-encrypting active encrypted fields through a reviewed one-off job, then removing the old key after the maximum session/device transition window. A lost key makes encrypted push endpoints and other ciphertext unrecoverable; keep it in the encrypted secret backup.
- Rotate the platform setup path by expiring the pending setup record and issuing a new bootstrap invitation. Never reuse a signed URL.
- Rotate Web Push VAPID keys deliberately. Existing subscriptions may need to be revoked and re-enrolled; send only the generic count payload throughout the transition.
- Rotate `READINESS_TOKEN`, database, mail, CAPTCHA, and provider credentials independently. Restart all consumers after rotation and confirm logs do not contain old or new values.

## Monitoring and incident handling

Alert on protected readiness degradation, stale scheduler heartbeat, queue lag/failed jobs, birthday delivery failures, sync rejection/conflict rates, storage growth, repeated authentication failures, and backup failures. The health dashboard contains aggregate counts only.

For an incident, record the UTC window and a correlation ID. Use that ID to join sanitized technical logs, canonical audit/security events, queue failures, and provider events. Do not copy child names, birthdates, raw requests, cookies, push endpoints, credentials, or unrestricted metadata into the incident record. Revoke affected sessions/devices, preserve immutable audit evidence, rotate only implicated secrets, and document containment and recovery.

## Retention, rate limits, and browser policy

Run the scheduler continuously. It records a heartbeat each minute, prunes sanitized operational events after 30 days, security events and sync receipts after 180 days, and change-feed entries only after 90 days and after every active cursor has advanced. Expired devices are marked for a complete authenticated bootstrap. Rejected application PII is purged after 30 days. Revoked push endpoint/key ciphertext is erased after 30 days; expired authorization records are removed after 180 days. Tenant audit events are not deleted by these jobs. Configure the Railway log drain itself for a maximum 30-day technical-log retention because provider stderr logs are outside PostgreSQL.

Keep the implemented per-identity and per-IP limits enabled: authentication and recovery, platform setup/MFA, church applications, invitation/ownership actions, imports, offline bootstrap, sync, notifications, and readiness probes. A browser control or CDN rule never replaces Laravel authorization or PostgreSQL RLS.

The Vercel CSP deliberately excludes `unsafe-inline` and `unsafe-eval`. Its sole external script/frame exception is `https://challenges.cloudflare.com` for the required Turnstile widget. Application code, styles, workers, manifests, and API connections remain same-origin; API responses remain `no-store`, and the service worker remains NetworkOnly for `/api/**`. Review both CSP and service-worker routing before adding any external origin.

## Rollback

1. Stop rollout and keep the previous immutable API and web artifacts available.
2. Put writes into maintenance mode only if data integrity requires it; keep the public liveness endpoint available when possible.
3. Roll the web deployment back first when API compatibility permits. API changes must remain compatible with the currently installed PWA.
4. Roll the API/worker/scheduler image back together. Never run a destructive down migration. Use a reviewed forward migration or restore procedure for incompatible schema changes.
5. If authoritative data is affected, follow `backup-restore.md`; verify tenant counts, audit evidence, sync receipts, and RLS before reopening writes.
6. Confirm scheduler, queue, sync, notifications, and protected readiness, then end maintenance mode and record the correlation ID in the incident log.
