# Technical Decisions

Only decisions established by the approved design, roadmap, committed implementation, or a validated current worktree belong here.

## Repository and delivery

1. **Independent monorepo.** React, Laravel, OpenAPI, documentation, and CI live together for atomic review. The legacy Expo project is behavioral reference only and contributes no Git history, remote, submodule, deployment, or automatic data migration. Source: approved design sections 3–4.
2. **Task and slice gates.** Roadmap tasks are completed one at a time with TDD and verification. Tasks 1–7 must pass before child data begins in Task 8. Source: approved roadmap.
3. **Contract-first API.** `contracts/openapi.yaml` is the API source of truth; `apps/web/src/api/generated.ts` is generated and must remain synchronized. Source: Task 2 and root engineering rules.

## Data, tenancy, and authorization

4. **PostgreSQL is authoritative.** Future IndexedDB data is authoritative only for unsynchronized local work. Source: approved design sections 8 and 14.
5. **Dual tenant enforcement.** Application authorization and forced PostgreSQL RLS both protect every tenant-owned table. Tenant scope comes from a validated active membership and transaction-local database setting, never client-supplied ownership fields. Source: Task 3 implementation and design section 12.
6. **Separate database duties.** Migrations use a privileged migration connection; application requests use a restricted non-owner role without RLS bypass. Source: Task 3 and `config/database.php`.
7. **Exactly one Owner.** Each church has exactly one active Owner. Teachers are invite-only and ministry-scoped; ownership transfer is locked, reauthenticated, MFA-protected, and atomic. Source: design section 5 and Task 6.

## Authentication and privacy

8. **Separate platform identity.** `sage.dev` uses a distinct model, guard, path-scoped cookie, CSRF flow, mandatory MFA, and online-only access. Church and platform sessions cannot authorize each other's protected routes. Source: Task 4.
9. **Minimal pre-approval and retention.** Applicants remain tenantless until approval. Rejected application PII is purged after 30 days while minimal internal decision evidence remains. Source: Task 5.
10. **Minimal offline disclosure.** Offline data is per-profile, encrypted, assignment-scoped, and leased for 14 days. Full birthdates, guardian/contact data, credentials, and API response caches do not belong offline. Source: approved design sections 8, 10, and 12.

## Audit, correlation, and logging

11. **One canonical append-only audit domain.** Task 7 consolidates platform and church evidence into `audit_events` and keeps security telemetry in `security_events`. Runtime UPDATE, DELETE, and TRUNCATE are revoked, and model mutation is rejected. Source: approved Task 7 and commit `32fad0a1735c0e2a677832252f72197252c8cd05`.
12. **Preserve legacy evidence forward.** Existing Task 5/6 audit rows are copied with original identifiers and timestamps. Legacy tables remain frozen archives; destructive down-migration is refused. Source: Task 7 migration/tests in commit `32fad0a1735c0e2a677832252f72197252c8cd05`.
13. **Audit atomicity follows outcome.** Required high-risk success audit is in the domain transaction and failure rolls back the action. Telemetry for an already-denied request is best-effort so audit/log failure cannot replace the denial. Source: design section 13 and Task 7 tests in commit `32fad0a1735c0e2a677832252f72197252c8cd05`.
14. **Allowlist audit data; aggressively redact logs.** Audit metadata is limited to explicit non-PII keys. Technical log processors redact sensitive containers and arbitrary free-form strings, preserving only safe structured values and valid correlation IDs. Source: design section 13 and current Task 7 implementation.
15. **Correlation is end-to-end.** Accept a valid client UUID or generate one; reuse it for the response, safe error envelope, queued job, audit/security event, and sanitized log. Source: Tasks 2 and 7.

## Messaging and background work

16. **Database-backed transactional queue first.** Approval mail must use the primary database queue so the queue record participates in the decision transaction. Redis is not required for the pilot. Source: approved design and Task 5.
17. **Privacy-safe birthday delivery.** Future push notifications contain a count, not child names or birthdates; authorized details appear only after opening the app. Source: approved design section 10.

## Student import

18. **Inspect before interpreting.** Student imports accept only CSV/XLSX, at most 5 MiB and 500 data rows. Server-side MIME/ZIP inspection rejects formulas, macros, external links, embedded or hidden executable content, unexpected sheets, ambiguous numeric dates, unsafe CSV prefixes, and excessive expansion before any preview is trusted. Source: approved Task 9 and validated `InspectWorkbook` tests.
19. **Preview is non-authoritative; commit is locked and idempotent.** Preview creates import evidence but no students. Owner-approved rows are committed under a batch lock with a stable commit key, current duplicate/ministry checks, row outcomes, and one transactional batch audit. Existing students are never merged or updated automatically. Source: approved Task 9 and validated import flow/concurrency tests.
20. **Reuse canonical student normalization.** Imported names, dates, gender, suffixes, and external references pass through Task 8's `NormalizeStudentInput`; the import layer does not create a second normalization contract. Source: approved Tasks 8–9 and `MapStudentRow`.

## PWA shell

21. **Prompted, safety-gated PWA updates.** The service worker uses `injectManifest` with a minimal shell precache and explicit same-origin `/api/**` NetworkOnly handling. Waiting workers do not activate until the application-level unsafe-local-work checker says reload is safe; future attendance work must register its draft/outbox check with this controller. Source: approved Task 10 and `apps/web/src/pwa/`.
22. **Prefer patched, provenance-backed build dependencies.** Workbox's build-only dependency graph is pinned to provenance-backed compatible releases where pnpm's no-downgrade policy rejected weaker historical attestations. The forced semver release is patched and the resulting graph passes frozen install, production build, audit, and browser tests. Source: Task 10 dependency validation and `pnpm-workspace.yaml`.

## Offline profiles and leases

23. **Encrypt payloads; namespace all local state.** Every IndexedDB primary key carries the local profile identifier. Cached roster, ministry, and authorization payloads use a random profile data key protected by the local PIN; identifiers and lease-control metadata remain minimal. Only one data key may be live in memory. Source: approved Task 11 and `apps/web/src/offline/`.
24. **Server authorization remains authoritative.** Local lease expiry gates cached access, but active membership, tenant, assignment, and device authorization are rechecked server-side. A successful authenticated bootstrap atomically renews the 14-day authorization and required audit evidence; revocation remains immediately authoritative online. Source: approved design section 8.4, Task 6 revocation, and Task 11 bootstrap implementation.

## Attendance

25. **One stable local draft and atomic event per attendance mutation.** A church/ministry/date deterministically identifies the local attendance session so concurrent creation reuses one encrypted draft. Every create, individual mark, bulk mark, and finalize transition persists the encrypted draft and one minimal outbox event in the same IndexedDB transaction. Server finalization independently locks and validates the exact active roster, assignment, state completeness, and required audit before acknowledging the session. Source: approved Task 12 and validated attendance repository/finalization tests.

## Synchronization

26. **Receipts, domain state, audit, and feed converge atomically.** Replay identity is trusted church plus device and client event UUID. Sorted advisory locks serialize concurrent event/entity application; exact payload replays return the stored outcome, while claim or payload mismatch is rejected and audited. Accepted attendance state, canonical audit evidence, change-feed projection, and replay receipt share the tenant transaction. Source: approved Task 13 and validated sync replay/concurrency boundaries.
27. **Revocation preserves work but removes cached authority.** Assignment tombstones or a refreshed bootstrap delete unauthorized roster/ministry projections and quarantine affected encrypted drafts/outbox events. Online 401/403 responses mark the profile for reauthentication, purge cached roster/ministry/authorization blobs, and clear protected UI state without deleting encrypted unsynced work. Source: design section 8.4 and validated Task 13 client/profile tests.
28. **Resolve attendance by append-only evidence, not record mutation.** Contradictory stale values become bounded tenant-owned conflicts. An Owner decision or finalized correction appends a revision carrying before/after state, original and resolving actors, bounded reason, and UTC time; the original attendance value and actor remain unchanged. Conflict/guest provenance columns are database-protected, revision rows are append-only, and every resolution advances session version, audit, and change-feed state atomically. Source: approved Task 14 and validated conflict/revision/RLS tests.
29. **Temporary guests remain minimal and session-scoped.** Offline guest input permits only display name and optional gender and records Present attendance with actor/device/correlation/local/server provenance. Owner promote/link/merge operations retain the guest row and attendance lineage; guardian/contact data is never accepted by the offline guest flow. Source: approved design section 6.4, Task 14, and validated guest lifecycle/client tests.
30. **Reports aggregate effective finalized state and keep pending work separate.** Attendance rates divide revision-effective Present records by finalized resolved Present plus Absent records. Server-pending sessions and encrypted device outbox counts are displayed separately, while Teachers remain current-assignment scoped. Only Owners export, using audited formula-safe CSV without birthdates or row data in evidence/logs. Source: approved Task 15 and validated report/export tests.

## Security validation

31. **Static-analysis evidence is invalidated by risk, not task count.** Task 15's clean comprehensive Semgrep OWASP scan remains the development baseline until affected production code, security controls, scanner configuration, or coverage invalidates it. Ordinary tasks use changed and security-relevant scope when that provides reliable assurance; security-sensitive boundaries receive explicit review and appropriate scanning. Task 17 establishes the mandatory production-hardening full-repository baseline, and Task 18 reruns it when intervening production or coverage changes invalidate it. Gitleaks, dependency audits, tenant and authorization review, and the full configured CI security scan remain unchanged. Source: root engineering rules and approved Tasks 17–18.
