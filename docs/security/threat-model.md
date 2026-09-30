# Threat model

## Protected assets and boundaries

Protected assets are church membership and role state, child roster and birthdates, attendance and revisions, encrypted local profiles and unsynchronized work, session/MFA material, push endpoints/keys, audit/security evidence, platform administration, deployment secrets, and backups.

Trust boundaries are the browser/PWA, profile-scoped IndexedDB, Vercel reverse proxy, Laravel API, queue/scheduler, external mail/push providers, restricted PostgreSQL runtime role, migration/backup identities, and `sage.dev`. Browser controls are presentation only. Laravel authorization plus forced PostgreSQL RLS are the tenant boundary. `sage.dev` remains a separate online-only guard and has no ordinary child-data path.

## Principal threats and controls

| Threat | Required controls | Verification |
|---|---|---|
| Cross-tenant or role escalation | Trusted membership-derived `church_id`, application policies, forced RLS, tenant-safe foreign keys, current assignment checks | Direct SQL and HTTP isolation tests; runtime role has no bypass |
| Session, CSRF, MFA, or platform-account takeover | Separate guards/cookies, secure same-site cookies, CSRF, email verification, recent auth, MFA/recovery acknowledgement, throttles, generic failures | Authentication, platform, and authorization suites |
| Offline device loss or stale authorization | Profile isolation, PBKDF2/AES-GCM, memory-only key, inactivity/background lock, signed 14-day lease, revocation quarantine, full bootstrap after expiry | Crypto/profile/revocation/sync tests |
| Lost, duplicated, replayed, or conflicting attendance | PostgreSQL authority, atomic draft/outbox writes, idempotency receipts, advisory locking, immutable revisions, bounded conflict evidence | Sync replay/concurrency/conflict tests |
| XSS, content injection, spreadsheet or upload abuse | Output encoding, strict CSP, no child uploads, allowlisted import schema/MIME/size, formula-safe CSV, no inline scripts/styles | Frontend/import/export tests and OWASP scan |
| Sensitive logging or health disclosure | Recursive redaction, allowlisted audit metadata, correlation IDs, aggregate-only health, minimal liveness, no raw requests | Logging and operations tests; review of health schemas |
| Privileged maintenance abuse | Narrow `SECURITY DEFINER` functions with fixed search path and cutoff bounds; no runtime DELETE; separate migration identity | Retention privilege tests and migration review |
| Secret or dependency compromise | Deployment secret stores, key rotation, pinned CI actions, dependency audits, Gitleaks, full Semgrep baseline | Security workflow and Task 17 evidence |
| Backup theft or unsafe restore | Encrypted off-account backups, dedicated identity, isolated restore, aggregate verification, destruction of temporary restore | Task 18 restore drill |
| Service-worker/API cache disclosure | NetworkOnly `/api/**`, explicit encrypted IndexedDB projections, controlled worker activation | PWA and offline tests |

## Operational abuse cases

Public liveness returns no build, dependency, database, queue, tenant, or record information. Readiness uses a high-entropy header secret and returns component states only. `sage.dev` health is aggregate and never returns tenant identifiers, names, birthdates, endpoints, credentials, raw exceptions, or sample rows. Retention can delete security and replay evidence only after fixed minimum windows; active device cursors block change-feed deletion; expired devices are marked for full bootstrap; tenant audit events are never deleted by the job.

The strict browser policy permits same-origin application scripts, styles, connections, workers, images (plus bundled data images), and manifests. The required Turnstile widget alone permits scripts and frames from `https://challenges.cloudflare.com`; inline/evaluated scripts and all other external scripts remain denied. Framing the application, plugins, camera, microphone, geolocation, payment, and USB are denied. HTTPS and HSTS are mandatory in production.

## Residual risk and review triggers

Unsynchronized device work can be lost if browser storage is cleared before sync; the UI exposes pending state and preserves revoked work for quarantine. Compromise of an unlocked device can expose its authorized projection until lock or lease/revocation takes effect. External email and push providers observe delivery metadata but never receive child names or birthdates in push payloads.

Re-review this model for any new upload, external integration, analytics, authentication method, offline scope, tenant table, platform capability, cryptographic change, security-definer function, deployment topology, or retention-policy change.
