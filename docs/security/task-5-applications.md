# Task 5 church applications

Task 5 starts with an existing verified church account. It adds application submission and review, not public account signup or Teacher invitations. The Task 4 registration setting is unchanged.

## Access and decisions

The applicant screen is `/account/application`. Submission and current status require the church `web` session and verified email, without granting a tenant membership. Browser mutations retain the existing Sanctum CSRF flow. Only the authenticated applicant's current application is returned.

The reviewer screen is `/account/platform-applications`. All four platform application endpoints require the isolated `platform` session, the `sage.dev` handle, active status, verified recovery email, confirmed MFA, recovery-code acknowledgement, and MFA assurance in the current session. Church cookies cannot authorize these routes. Platform requests use their own CSRF token.

Approval locks the application, rechecks applicant verification, creates one church and one active Owner, and records the decision, audit, and notification queue entry in one transaction. The new church UUID is the transaction-local RLS scope; no migration credentials or RLS bypass are used. Existing deferred exactly-one-owner constraints are checked before restoring the prior database scope. Owner workspace access still requires MFA.

Repeated decisions return the original result without a second church, membership, audit, or notification. A conflicting decision returns 409. Rejection accepts one bounded category and a bounded, sanitized explanation. Database uniqueness protects active applications by user and normalized church/city, including competing submissions.

`platform_application_audits` is a deliberately narrow Task 5 platform audit foundation. It records IDs, decision action/category, actor, UTC time, and correlation ID, with no free-form reason or applicant metadata. The runtime role has INSERT/SELECT only. Task 7's broader audit system is not introduced here. Unexpected application HTTP failures log only a generic event and correlation ID.

## CAPTCHA and input limits

Configure the API's `TURNSTILE_SECRET_KEY` and `TURNSTILE_HOSTNAME`, and the frontend build's public `VITE_TURNSTILE_SITE_KEY`. Keep the secret out of frontend variables and source control. An unset configuration fails closed. The verifier checks success, hostname, and the `church_application` action against Cloudflare's Siteverify response. Tests replace the interface or fake HTTP; they never contact production CAPTCHA services. See [Cloudflare server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

Allow the Turnstile widget origin in deployment CSP as described in [Cloudflare's CSP guidance](https://developers.cloudflare.com/turnstile/reference/content-security-policy/). This task does not provision service credentials or change deployment infrastructure.

Submission allows only church name (160 characters), city (120), optional address (240), an IANA timezone, and CAPTCHA proof (2048). Unicode whitespace is normalized without changing intended capitalization. Uploaded files and unknown fields are rejected. Submission limits are five attempts per applicant per minute and ten per IP per minute. A rejected applicant can apply again. Browser data stays in memory and responses use `no-store`.

## Notification and retention operations

Use the PostgreSQL database queue and an SMTP/transactional mail transport, never the log mailer. `DB_QUEUE_CONNECTION` must be unset or equal the primary runtime database connection. Decisions fail closed if the queue uses another database connection. Mail payloads are encrypted and queue insertion occurs within the decision transaction. Run `php artisan queue:work database --tries=3` to deliver messages; normal transport retries may redeliver an email, while decision replay never enqueues it twice.

Run the Laravel scheduler every minute (`php artisan schedule:run`). It queues `PurgeRejectedApplications` daily. At the first daily run at or after 30 days, the job removes rejected application name, location, timezone, duplicate key, and free-form reason. It retains minimal internal decision metadata and append-only audits. It deletes applicant-only accounts plus sessions/reset records when no unpurged application remains.

Memberships now use `ON DELETE RESTRICT` for users. This prevents retention from deleting an account with any membership, including one hidden by RLS or an inactive membership. Restrict violations preserve the account while application details are still purged. The job is safe to rerun. Recent rejected applications are retained until their own cutoff; approved/pending applications and member accounts remain.

Apply migrations using the existing migration connection, with the configured restricted runtime role. This migration adds platform tables and strengthens the user/membership foreign key; it does not change tenant RLS policies. Rollback drops the new application/audit tables and restores the previous foreign key, so production rollback requires a backup and preservation of decision evidence.
