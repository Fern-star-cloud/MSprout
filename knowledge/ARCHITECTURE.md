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

Task 10 adds the installable responsive PWA boundary. Vite builds a custom Workbox service worker in `injectManifest` mode; it precaches only `index.html` and hashed application JS/CSS, serves the application shell for offline navigations, and routes same-origin `/api/**` through `NetworkOnly`. Authentication and other non-navigation requests have no runtime cache route and therefore remain network-only by default. A waiting worker exposes an update signal, but activation and reload are deferred whenever the registered unsafe-local-work check reports an open draft or pending write.

The shell keeps one content tree and changes navigation presentation by viewport: phone bottom navigation below 48rem and a persistent two-pane sidebar/content layout for tablet and desktop. Connectivity uses text and icon state. Task 11 adds IndexedDB profiles and authorization leases without adding service-worker API caching. Task 12 adds encrypted attendance drafts and marking behavior. Task 13 adds cookie/CSRF push/pull synchronization without changing the NetworkOnly API boundary. Task 14 adds an online role-safe conflict/guest review screen while temporary guest capture remains in the encrypted offline attendance flow. Task 15 adds an online responsive report/history route and a constrained same-origin CSV download. Task 16 adds the birthday route, deliberate per-device notification controls, and generic push/click handling while preserving the NetworkOnly API boundary.

## Protected offline profile boundary

Dexie stores local profiles plus encrypted blob, attendance-draft, outbox-event, cursor, conflict, and metadata stores. Every primary key contains `profileId`; child/assignment payloads and signed authorization records are AES-256-GCM encrypted. A random per-profile data key is wrapped by a PBKDF2-HMAC-SHA-256 key derived from a 6–12 digit PIN, random 16-byte salt, and 600,000 iterations. Authenticated data binds ciphertext to profile, schema version, and purpose.

Only one non-exportable unwrapped key exists in application memory. Explicit lock, switching, five minutes of inactivity, and page backgrounding clear it. Persistent failed-PIN counters introduce exponential delay. Profile purge deletes only the selected profile's records. Expired leases or reauthentication-required state block roster/ministry/authorization access; server actor, church, and device mismatches are rejected before bootstrap persistence. An online authorization failure atomically marks the profile for reauthentication and deletes cached roster, ministry, and authorization projections while retaining encrypted drafts/outbox work. The UI immediately clears protected in-memory roster state.

`GET /api/offline/bootstrap` runs inside verified active membership and forced tenant scope. Teachers receive only active assigned ministries and enrolled students; Owners receive the active church roster but still only the minimal offline projection. The response omits full birthdates and names split into source fields, retaining only display name, gender, version, assigned ministry IDs, next birthday month/day, and turning age. Device authorization upsert, signed 14-day lease creation, and canonical audit evidence are atomic. Existing membership revocation paths invalidate authorization and push records.

## Birthday notification boundary

The scheduler runs each minute and calls a narrow `SECURITY DEFINER` PostgreSQL function that returns only active churches currently at 8:00 AM plus their local date. All subsequent dispatch, recipient selection, and delivery updates run through the restricted runtime connection with a transaction-local church context and forced RLS. Unique church/date markers and church/date/user/device deliveries make scheduler and worker retries idempotent; database queue rows are created in the same transactions as their markers or deliveries.

Owners receive church-wide birthday counts. Teachers receive only birthdays for students enrolled in currently assigned ministries, and queued sends recheck active membership, current assignment, local date, and subscription state immediately before contacting the push service. Web Push endpoint/key material is encrypted at rest; only a hash participates in endpoint identity, trusted HTTPS push hosts are allowlisted, and logs/audit metadata never contain endpoints, keys, names, or birthdates. Push payloads contain only a generic title, count, and authenticated birthday route.

The in-app route returns display name, turning age, and permitted ministry names without full birthdate or birth year. Its offline fallback reads only the already encrypted, unlocked, assignment-scoped roster projection under a valid lease and uses the church timezone stored in the encrypted authorization blob. February 29 birthdays map to February 28 in non-leap years. Notification permission is requested only after authenticated preflight and deliberate user action; denial is remembered locally and unsupported/iOS environments receive guidance instead of repeated prompts.

## Attendance domain and local draft boundary

PostgreSQL attendance sessions are unique per church, ministry, and date. Their records are tenant-safe children unique per session/student; both tables use restricted runtime grants and forced RLS. Owners and Teachers with an active assignment may work with a draft. Finalization locks the session and records, compares the complete active enrollment roster, rejects missing, extra, duplicate, or unmarked entries, and atomically persists final status, actor/time, version, and the canonical `attendance.finalized` audit event.

The web repository stores each draft and its minimal outbox events as profile-scoped AES-GCM envelopes. Session identifiers are stable for church/ministry/date, so development remounts and concurrent local creation reuse one draft and one creation event. Mark, bulk-mark, and finalize mutations write the encrypted draft and matching event in one IndexedDB transaction with optimistic local version checks. Only unsynchronized local work is authoritative locally; PostgreSQL remains authoritative after acknowledgment.

Task 14 extends attendance with tenant-owned conflicts, append-only revisions, and session-scoped temporary guests. Conflicts store bounded value/actor/device/correlation/time evidence rather than raw requests. Owner resolution and finalized corrections append revisions without changing the original attendance value or actor; session version, canonical audit, and change feed advance in one locked transaction. Guest payloads contain only display name and optional gender, and promote/link/merge keeps the original attendance provenance. Runtime column grants prevent mutation of conflict/guest evidence, and revisions are not runtime-updateable or deletable.

Task 15 report queries are read-only over the established tenant tables and transaction-local church scope. Totals include only finalized/revised sessions and derive each record's effective state from its newest immutable revision; pending server sessions, encrypted profile-local outbox events, and open conflicts remain separately visible and do not affect finalized arithmetic. Teachers are constrained by current active ministry assignments. Owners alone may export bounded date/ministry results as formula-safe UTF-8 CSV, and the export audit stores only actor, filters, row count, and correlation—not report rows or birthdates.

## Synchronization boundary

`POST /api/sync/push` and `GET /api/sync/pull` run inside the authenticated, verified, tenant transaction and Owner-MFA boundary. `SyncAuthorization` revalidates the active membership plus the exact non-revoked, unexpired device authorization. Push uses sorted transaction-scoped advisory locks for event and attendance-entity keys. Exact replay returns the stored outcome; actor or payload-hash mismatch is rejected and audited. An accepted event commits attendance state, required audit evidence, a complete attendance projection in `change_feed`, and its `sync_events` receipt atomically.

`change_feed.sequence` is globally increasing and therefore monotonically increasing within each church. Pull pages raw church rows in sequence order, filters Teachers to current assignments while retaining targeted assignment tombstones, and advances `device_cursors` across filtered rows so pagination cannot stall. Successful pull renews the signed device lease.

The client sends at most 100 locally ordered events per stable request body, retries only network/429/server failures with bounded exponential backoff and jitter, validates acknowledgement identity, and deletes outbox events only after accepted/duplicate acknowledgement or encrypted conflict/rejection quarantine. It pulls to `has_more = false`; each page applies attendance and guest projections, cumulative assignment tombstones, cursor, and renewed lease in one Dexie transaction. Reauthenticated bootstrap performs the same revoked-assignment reconciliation before advancing its cursor. Task 14 classifies stale marks by field/value/finalization state, preserves contradictions for Owner review, and publishes revision-effective attendance without mutating the original record.

## Authentication and authorization

- Church accounts use Laravel Fortify and Sanctum-compatible same-origin cookie sessions through the `web` guard.
- `sage.dev` uses a separate `platform` guard, model, cookie scoped to `/platform`, CSRF flow, and online-only authorization.
- Verified email gates application/invitation flows. Owners and `sage.dev` require confirmed MFA and current-session assurance where specified; Teachers are not forced to enroll MFA.
- `ResolveChurchMembership` accepts only a UUID `X-Church-Id`. `TenantDatabaseTransaction` delegates to `TenantContext`, which opens a transaction, sets transaction-local `app.current_church_id`, and validates the active membership and church before populating in-memory context.
- Policies and action/controller checks enforce role and ministry permissions. RLS is a second boundary, not a replacement for application authorization.

See `docs/security/task-4-authentication.md`, `docs/security/task-5-applications.md`, and the tenancy middleware/support classes for current behavior.

## Data and tenant boundaries

PostgreSQL is authoritative. Tenant tables use UUIDs, trusted `church_id`, forced RLS, and policies comparing against transaction-local `app.current_church_id`. The restricted runtime role must not own tables or bypass RLS; migrations use a separate connection and role.

The committed foundation includes users/platform administrators, churches and memberships, applications, invitations, ministry assignment support, sessions/queues, offline authorization and push-revocation placeholders, canonical audit stores, ministry tombstones/versioning, tenant-owned students and enrollments, optional date-only birthdates, server-derived display name/age, Owner-only roster writes, assignment-limited Teacher reads, bundled gender avatars, tenant-owned attendance sessions/records/conflicts/revisions/guests, and forced-RLS sync receipts/change feed/device cursors.

## Student import architecture

Committed Task 9 adds tenant-owned `import_batches` and `import_rows` with forced RLS and restricted runtime grants. Uploads are inspected in memory from temporary request files and are not retained as repository or application artifacts. `InspectWorkbook` bounds size, row count, ZIP expansion, structure, sheet count, and scalar content before PhpSpreadsheet parsing. It rejects formulas, macros, external links, embedded content, hidden sheets, ambiguous dates, and spreadsheet-executable prefixes.

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
