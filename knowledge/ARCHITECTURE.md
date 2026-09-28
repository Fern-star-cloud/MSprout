# Architecture

## Topology

```text
React + TypeScript web client
        |
        | same-origin cookie/CSRF requests; OpenAPI contract
        v
Laravel API, queue worker, scheduler
        |
        | restricted runtime connection / separate migration connection
        v
PostgreSQL 18 (authoritative data, tenant RLS, audit evidence)
```

The monorepo contains `apps/web`, `apps/api`, `contracts`, and project documentation. Vite serves the current frontend locally. The approved deployment target is Vercel for the web client and Railway initially for the API, worker, scheduler, and PostgreSQL; production deployment is not yet implemented.

Authoritative entry points:

- API contract: `contracts/openapi.yaml`; generated client types: `apps/web/src/api/generated.ts`
- Tenant routes: `apps/api/routes/api.php`; platform routes: `apps/api/routes/platform.php`
- Database schema: `apps/api/database/migrations/`
- Approved target architecture: `docs/superpowers/specs/2026-08-20-ministry-sprout-design.md`

## Frontend and API boundary

The React client uses typed definitions generated from OpenAPI and sends credentials with same-origin requests. Browser state and components are not authorization boundaries. API or schema changes must update the contract and regenerated TypeScript in the same task.

Offline/PWA, IndexedDB, synchronization, and attendance features are planned for later roadmap tasks and do not yet exist. The committed Task 8 foundation implements online ministry and student roster management; the current uncommitted Task 9 worktree adds online-only student spreadsheet import. API responses must not be cached by a future service worker.

## Authentication and authorization

- Church accounts use Laravel Fortify and Sanctum-compatible same-origin cookie sessions through the `web` guard.
- `sage.dev` uses a separate `platform` guard, model, cookie scoped to `/platform`, CSRF flow, and online-only authorization.
- Verified email gates application/invitation flows. Owners and `sage.dev` require confirmed MFA and current-session assurance where specified; Teachers are not forced to enroll MFA.
- `ResolveChurchMembership` accepts only a UUID `X-Church-Id`. `TenantDatabaseTransaction` delegates to `TenantContext`, which opens a transaction, sets transaction-local `app.current_church_id`, and validates the active membership and church before populating in-memory context.
- Policies and action/controller checks enforce role and ministry permissions. RLS is a second boundary, not a replacement for application authorization.

See `docs/security/task-4-authentication.md`, `docs/security/task-5-applications.md`, and the tenancy middleware/support classes for current behavior.

## Data and tenant boundaries

PostgreSQL is authoritative. Tenant tables use UUIDs, trusted `church_id`, forced RLS, and policies comparing against transaction-local `app.current_church_id`. The restricted runtime role must not own tables or bypass RLS; migrations use a separate connection and role.

The committed foundation includes users/platform administrators, churches and memberships, applications, invitations, ministry assignment support, sessions/queues, offline-authorization and push-revocation placeholders, canonical audit stores, ministry tombstones/versioning, tenant-owned students and enrollments, optional date-only birthdates, server-derived display name/age, Owner-only roster writes, assignment-limited Teacher reads, and bundled gender avatars. Task 8 is committed at `dc3c13c6cd5e4909c644b0abe37d18875cbe248f`.

## Student import architecture

The validated, uncommitted Task 9 worktree adds tenant-owned `import_batches` and `import_rows` with forced RLS and restricted runtime grants. Uploads are inspected in memory from temporary request files and are not retained as repository or application artifacts. `InspectWorkbook` bounds size, row count, ZIP expansion, structure, sheet count, and scalar content before PhpSpreadsheet parsing. It rejects formulas, macros, external links, embedded content, hidden sheets, ambiguous dates, and spreadsheet-executable prefixes.

Preview persists bounded source/normalized row projections but creates no students. `MapStudentRow` delegates child fields to Task 8's canonical `NormalizeStudentInput`. Commit locks one preview batch in a transaction, validates selected rows and same-church ministry mappings, rechecks duplicates, creates students/enrollments, stores stable results for commit-key replay, and writes one allowlisted Task 7 batch audit event. The API policy permits only the church Owner with confirmed MFA; forced RLS independently enforces church isolation.

## Application and membership transactions

Platform approval locks the application and atomically creates a church and Owner, records the decision, and queues encrypted notification mail. Membership invitation, assignment, revocation, and ownership transfer are transactionally scoped; ownership transfer preserves exactly one active Owner. The database queue is required for transactional application-decision mail.

## Canonical audit and security architecture

The Task 7 implementation committed at `32fad0a1735c0e2a677832252f72197252c8cd05` is the canonical path; completion status remains in [CURRENT_STATE.md](CURRENT_STATE.md).

- `AuditEntry` is the bounded command object. `AuditWriter` validates category, actor/target identifiers, tenant context, result, and a small non-PII metadata allowlist before inserting.
- `audit_events` holds platform and church audit evidence. `security_events` holds authentication, MFA, reset, denial, and rate-limit evidence. Both are append-only at the model and runtime-role database layers.
- Tenant audit rows require the active transaction-local church scope and forced RLS. Platform rows have no church scope. Security rows may be global or tenant-scoped.
- The migration copies legacy audit rows with original IDs, timestamps, correlation, and allowlisted provenance; legacy tables remain present and are made read-only to the runtime role. Downgrade is deliberately blocked to avoid evidence loss.
- Required high-risk action audits participate in the action transaction. `RecordDeniedAttempt` is best-effort because telemetry failure must not transform an already-computed denial into a server error. Authentication middleware marks a request only after its specific denial evidence persists; the outer correlation middleware then suppresses a generic duplicate. Otherwise it records one guard-attributed global denial without trusting a tenant header.
- `CorrelationId` accepts a valid client UUID or creates one, returns it as `X-Correlation-Id`, and feeds request/job/audit/log context.
- `RedactContext` recursively redacts sensitive keys, arbitrary strings, objects, resources, exceptions, and unsafe messages. Logging channels are tapped through `SanitizeLogs`.
- Audit viewers return bounded projections without metadata. Owners see their church, Teachers only permitted own submission/sync activity, and `sage.dev` only platform events.

Relevant paths: `apps/api/app/Domain/Audit/`, `apps/api/app/Http/Middleware/CorrelationId.php`, `apps/api/app/Http/Middleware/AuditAuthentication.php`, `apps/api/app/Logging/`, the two `2026_09_22` migrations, `AuditController.php`, and `apps/web/src/features/audit/`.
