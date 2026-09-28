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
