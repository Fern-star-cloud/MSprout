# Current State

Verified: 2026-09-30. This is the development checkpoint index. The [canonical system handoff](../docs/qa/MSPROUT_SYSTEM_HANDOFF.md) contains current operation, fixtures, qualification, defects and commissioning limitations.

## Git state

- Branch: `feat/mvp-foundation`.
- The security-validation governance baseline is committed and pushed at `02c825aa7d59f8fb351b83e300f59960b88e0812`.
- Task 17 is committed and pushed at `a989dd904551a26f6f7548ee0c88128f13c6933d`.
- Task 18 is committed and pushed at `ffee8ebe9e87fe096c52e23f7a0d49da9c1c0202` — `test: add mvp release qualification`.
- Runtime-qualification maintenance is committed/pushed at `df7cf6118f5f119253154ce015803fd143bb1a6c` — `fix: qualify runtime and document system handoff`; verified clean/0/0 at planning reconnaissance.
- Repository remotes remain `origin = https://github.com/Fern-star-cloud/MSprout.git` and `upstream = https://github.com/Frierend/ministry-sprout.git`. This differs from the roadmap preflight's original one-remote expectation; do not change remotes without explicit direction.

## Roadmap position

- Tasks 1–17: **COMPLETE / COMMITTED / PUSHED** on `feat/mvp-foundation`.
- Task 18: **COMPLETE / COMMITTED / PUSHED**; the controlled automated one-church qualification rehearsal and all twelve acceptance criteria passed. It was not a human or production pilot.
- The approved MVP roadmap ends at Task 18. Preserve Tasks 1–18; do not invent Task 19 or begin post-MVP development without a new approved scope.

## Manual planning and local tooling

The requested planning/tooling layer adds [23 ordered QA phases](../docs/qa/MANUAL_TESTING_ROADMAP.md), separate [manual state](MANUAL_TESTING.md) and [Codebase Memory operating knowledge](CODEBASE_MEMORY.md). No new manual phase, product feature or development data mutation occurred. Cases remain NOT_RUN; MT-00 is the next execution entry point. Operational authority/security/finalization in AGENTS.md is unchanged. Planning validation was recorded before finalization; resolve the task commit from the roadmap's history and verify actual upstream/worktree state rather than assuming a self-referential commit SHA.

Codebase Memory v0.11.0 is installed outside the repository with a scoped user Codex MCP entry, external cache and explicit indexing. Current desktop-chat tool visibility requires restart and remains distinct from direct server verification recorded in CODEBASE_MEMORY.md. The existing Codex CLI has a config-version mismatch; unrelated desktop settings were preserved. Provider/device commissioning gaps remain future manual prerequisites, not results fabricated by planning.

## Security-validation baseline

- The runtime qualification refreshed the comprehensive Semgrep OWASP baseline: 108 rules, 323 application targets, approximately 99.9% parsing, zero findings. The explicit final source/test/config delta also passed: 128 rules, 12 targets, approximately 100% parsing, zero findings. Five existing Vitest mock-syntax partial parse warnings were reviewed; production inputs were scanned.
- Ordinary feature work uses focused, risk-based Semgrep coverage for changed and directly relevant application inputs while that baseline remains valid. Security-sensitive boundaries still require explicit review and appropriate scanning, escalating to the full application scan whenever focused coverage is insufficient.
- Future production or security-coverage changes must apply the repository's risk-based invalidation rules to this qualification baseline.
- Gitleaks, dependency audits, tenant/RLS and authorization requirements, and the full Semgrep scan in the configured push/pull-request security workflow are unchanged.

See [ROADMAP_STATUS.md](ROADMAP_STATUS.md) for every task and commit.

## Current runtime qualification

- The observed login 500 was caused by stale ignored SQLite configuration and absent `security_events`, not an incorrect fixture password or failed browser connection. The previously empty PostgreSQL development DB was migrated non-destructively; the existing verified development fixture was preserved/copied once without reseeding, and its original SQLite file remains intact. Real login and applicant reads now work at `http://127.0.0.1:5173` through API port 8000.
- Corrected origin-only stateful API recognition, required Turnstile CSP loading, protected encrypted offline lease expiry, test DB/runtime-role isolation, CI bootstrap/order, three vulnerable brace-expansion versions, and the official platform bootstrap command. Test bootstrap no longer rotates the live role credential and refuses development/migration DB collisions before connecting.
- Current proof: **22 live HTTP checks**, **211 backend tests / 1,308 assertions**, **132 frontend tests / 34 files**, and **68 browser scenarios across four emulated targets**. Typecheck, lint, build, contract drift, Pint, strict Composer validation, frozen install, dependency audits, structure, Gitleaks, Semgrep and whitespace checks passed. Later frontend corrections invalidated and reran frontend/browser gates; unchanged backend guarantees retain the current-run aggregate result.
- The 55-row handoff matrix reports **40 PASS, 0 FAIL, 12 BLOCKED, 3 NOT RUN**, explicitly distinguishing live runtime from mocked-API browser tests, backend tests, inspection and historical evidence. The separate 22 HTTP checks are not counted as additional product flows.
- PostgreSQL and Mailpit are individually healthy. Host API, Vite, queue worker and scheduler were started; schema/runtime grants/forced RLS and heartbeat were verified. Development contains one tenantless verified fixture and no churches, applications or platform admin.
- Missing real Turnstile/private platform mailbox/VAPID/readiness configuration blocks positive live onboarding/admin/provider journeys. No security bypass, arbitrary platform singleton, deployment, human pilot or physical-device claim was made. Final review has no remaining BLOCKING/SHOULD FIX item within this bounded qualification; production commissioning remains explicit next work, not a new feature.

## Committed Tasks 8–15 foundation

Task 8 is committed at `dc3c13c6cd5e4909c644b0abe37d18875cbe248f`. It provides ministries, students, enrollments, canonical student input normalization, date-only birthdates, server-derived display name/age, Owner roster writes, assignment-limited Teacher reads, bundled gender avatars, forced tenant RLS, and Task 7 audit integration.

Task 9 is committed and pushed at `fbe338f433c7432cc26c98ad8c2e258cf9502a79`. It provides the approved Owner-only safe spreadsheet import with bounded inspection, canonical row normalization, preview/mapping, locked idempotent commit, tenant RLS, privacy-bounded auditing, synchronized OpenAPI types, and responsive UI. Existing students are never updated or merged. See [the Task 9 verification report](../docs/qa/task-9-verification.md).

Task 10 implements the responsive installable PWA shell:

- A standards-based manifest names MinistrySprout/Sprout, supplies install icons and theme metadata, and opens at the application root in standalone mode.
- Vite `injectManifest` builds a controlled Workbox service worker that precaches only the application shell and hashed JS/CSS assets. Same-origin `/api/**` requests are explicitly NetworkOnly, and navigations fall back to the shell while offline.
- The update controller exposes a stable `updateAvailable` signal and will not activate/reload a waiting worker while its registered unsafe-local-work check reports an open draft or pending unsafe write.
- The semantic shell uses phone bottom navigation, a tablet/desktop two-pane sidebar layout, 44-pixel controls, visible focus, reduced-motion and forced-color support, and text-plus-icon connection states.
- Existing public, church, and platform screens remain direct-loadable; Task 8's neutral/male/female SVG avatars remain canonical.
- Playwright covers service-worker control, offline navigation reload, phone touch targets, wide navigation, and keyboard focus in real Chrome.

Final Task 10 validation on 2026-09-28:

- Focused PWA: **6 tests passed**; Playwright: **3 tests passed** in Chrome.
- Aggregate verification: **76 frontend tests in 18 files**, frontend typecheck/build, and **160 backend tests / 884 assertions passed**.
- Frontend lint and OpenAPI generated-type drift check passed.
- Frozen pnpm lockfile install, Pint, Composer strict validation/audit, pnpm audit, repository structure, Gitleaks, and `git diff --check` passed.
- Semgrep `p/owasp-top-ten` found no issues: 103 rules over 222 tracked app files, plus 108 rules over the final 31-file Task 10 change set. Gitleaks covered the same final set including knowledge and QA.

See [the Task 10 verification report](../docs/qa/task-10-verification.md) for the gate evidence and reviewed boundaries.

Task 11 implements protected shared-device profiles and server-issued offline authorization:

- Dexie stores profile-scoped encrypted blobs plus namespaced draft, outbox, cursor, conflict, and metadata stores. No password, cookie, guardian data, full birthdate, or raw audit data is stored offline.
- Per-profile random AES-256 data keys are PIN-wrapped with PBKDF2-HMAC-SHA-256 using 600,000 iterations and random salts. AES-GCM payloads use fresh IVs and authenticated profile/schema/purpose context.
- One profile key is held in memory, with explicit/profile-switch locking, five-minute inactivity lock, background lock, increasing failed-PIN delays, isolated purge, and reauthentication-required state.
- The root profile picker creates, unlocks, switches, and purges local profiles. Online switching clears the server session; offline switching prevents synchronization until reauthentication.
- `GET /api/offline/bootstrap` returns only assigned active ministries, minimal roster projections, birthday month/day and turning age, a cursor, and a signed 14-day device lease. Issuance is rate-limited, tenant-scoped, forced-RLS protected, and atomic with canonical audit evidence.
- Task 6 membership/assignment revocation continues to invalidate offline authorizations and push subscriptions. Task 10's update controller now checks draft/outbox stores for unsafe local work.

Final Task 11 validation on 2026-09-28:

- Focused Task 11: **11 frontend tests** and **4 backend tests / 33 assertions passed**; direct-routing regression: **12 tests passed**.
- Aggregate verification: **88 frontend tests in 21 files**, frontend typecheck/build, and **164 backend tests / 917 assertions passed**.
- Chrome Playwright: **3 tests passed**. Frontend lint, OpenAPI drift, frozen pnpm install, Pint, Composer strict validation/audit, pnpm audit, structure, Gitleaks, and `git diff --check` passed.
- Semgrep `p/owasp-top-ten` found zero issues: 103 rules over 270 application files plus 98 rules over the final Task 11 change set.

See [the Task 11 verification report](../docs/qa/task-11-verification.md) for gate evidence and reviewed boundaries.

Task 12 adds the offline-ready attendance domain and marking workflow:

- Tenant-owned attendance sessions and records use trusted church/ministry/date identity, versioning, constrained states/statuses, tenant-safe foreign keys, restricted runtime grants, and forced RLS.
- Owner or actively assigned Teacher authorization protects drafts. Finalization locks the session and roster, requires an exact active enrollment roster with every regular student marked, preserves the actor/time, increments version, and writes required audit evidence in the same transaction.
- Encrypted profile-local drafts use stable session identifiers and atomically append one minimal outbox event for create, mark, bulk mark, and finalize operations. Concurrent draft creation is idempotent, local mutations use optimistic concurrency, and finalized-pending drafts become read-only.
- The responsive attendance screen loads only the unlocked profile's protected roster, supports ministry/date selection, search, individual and bulk marking, counts, avatars, live connection/pending state, local-save confirmation, and safe fixed-bar finalization.
- Task 13 supplies synchronization transport and acknowledgement; Task 14 now supplies conflict resolution, immutable revisions, and temporary guests.

Final Task 12 validation on 2026-09-28:

- Focused Task 12: **9 frontend tests in 3 files** and **8 backend tests / 23 assertions passed**.
- Aggregate verification: **97 frontend tests in 24 files**, frontend typecheck/lint/build, and **172 backend tests / 940 assertions passed**. The backend aggregate remained valid after the isolated frontend-only final-review remediation.
- Chrome Playwright: **3 tests passed**. OpenAPI drift, frozen pnpm install, Pint, Composer strict validation/audit, pnpm audit, structure, Gitleaks, Semgrep, and `git diff --check` passed.

See [the Task 12 verification report](../docs/qa/task-12-verification.md) for gate evidence and reviewed boundaries.

Task 13 adds idempotent attendance synchronization:

- `sync_events`, `change_feed`, and `device_cursors` are trusted-tenant records with forced RLS and restricted runtime grants. Replay receipts and feed rows are append-only; replay keys are tenant-local to prevent cross-church UUID interference.
- Push revalidates the authenticated actor, active membership, device authorization/lease, tenant, assignment, payload schema, roster, and base version. Sorted advisory locks serialize event/entity races, and each accepted mutation commits domain state, canonical audit, feed projection, and receipt atomically.
- Pull returns bounded ordered assignment-scoped changes, advances a durable cursor across visible or filtered rows, emits targeted assignment tombstones, and renews the signed 14-day lease.
- The unlocked-profile client pushes stable batches with bounded exponential retry, safely acknowledges or quarantines every result, pulls until current, and applies projections plus cursor/lease state in one Dexie transaction. Reconnect is coalesced; authorization failures lock the profile, purge cached roster/ministry/authorization projections, clear child data from memory, and preserve encrypted unsynced work for later quarantine/review.
- Reauthenticated bootstrap and tombstone application remove revoked assignments from encrypted roster/ministry state and quarantine affected drafts/outbox events instead of silently discarding user work.

Final Task 13 validation on 2026-09-29:

- Focused sync: **10 backend tests / 80 assertions** and **8 frontend sync tests passed**; privacy/revocation-focused local profile and attendance coverage also passed.
- Aggregate verification: **108 frontend tests in 26 files**, frontend typecheck/lint/build, and **182 backend tests / 1,020 assertions passed**.
- Chrome Playwright: **4 tests passed**, including lost-response replay convergence. OpenAPI drift, frozen pnpm install, Pint, Composer strict validation/audit, pnpm audit, structure, Gitleaks, Semgrep, and `git diff --check` passed.

See [the Task 13 verification report](../docs/qa/task-13-verification.md) for gate evidence and reviewed boundaries.

Task 14 adds attendance conflicts, revisions, and temporary guests:

- Contradictory stale attendance changes persist bounded evidence and move the session to Needs Review; identical values deduplicate, non-overlapping records merge, and future versions remain conflicts. Multiple open conflicts keep the session in review until the last resolution.
- Owners with current MFA receive online list/show/resolve and finalized-attendance correction actions. Each decision appends an immutable before/after revision with original/resolving actors, bounded reason, and UTC time while preserving the original attendance record value and actor.
- `sync_conflicts`, `attendance_revisions`, and `attendance_guests` use tenant-safe keys, constraints, forced RLS, and restricted runtime grants. Conflict/guest provenance is immutable and revision rows are append-only.
- Offline guest events permit only display name and optional gender, remain encrypted and profile-scoped locally, and preserve actor/device/correlation/local/server time when promoted, linked, or merged by an Owner.
- The online review screen gives Owners side-by-side evidence and guest resolution controls. Assigned Teachers see only a Needs Owner Review boolean, never actor, device, correlation, or unrelated ministry details.

Final Task 14 validation on 2026-09-29:

- Aggregate verification: **113 frontend tests in 27 files**, frontend typecheck/lint/build, and **189 backend tests / 1,136 assertions passed**.
- Chrome Playwright: **4 tests passed**. OpenAPI drift, Pint, Composer strict validation/audit, pnpm audit, structure, Gitleaks, Semgrep, and `git diff --check` passed.
- Semgrep found zero issues from 103 rules over 272 tracked application files and 123 rules over the complete 28-file Task 14 source/contract set.

See [the Task 14 verification report](../docs/qa/task-14-verification.md) for gate evidence and reviewed boundaries.

Task 15 adds online attendance history, basic reports, and safe CSV export:

- Date/ministry-filtered PostgreSQL queries return revision-effective Present/Absent counts, a decimal rate, server-pending sessions, open conflicts, corrections, and up to 100 recent finalized sessions. Pending device events are displayed separately and never count as finalized attendance.
- Current active assignment scope restricts Teachers to their ministries and recent sessions. Owners receive tenant-wide permitted results and the only export capability; application checks and existing forced RLS both remain active.
- Owner CSV export uses explicit UTF-8 headers, ISO dates/timestamps, correct quoting, and apostrophe protection for text beginning with spreadsheet formula prefixes. Birthdates, unresolved work, pending work, and advanced analytics are excluded.
- Each successful export records canonical tenant audit evidence with actor, filters, result count, and correlation ID without copying report rows or child data into audit metadata or logs.
- The online responsive report UI provides filters, summary cards, pending/conflict/correction links, finalized-history table/cards, and a constrained same-origin download path without changing service-worker API caching.

Final Task 15 validation on 2026-09-29:

- Focused proof: **5 backend tests / 43 assertions** and **25 frontend tests in 5 files** passed.
- Aggregate verification: **119 frontend tests in 30 files**, frontend typecheck/build, and **194 backend tests / 1,179 assertions passed**.
- Chrome Playwright: **4 tests passed**. Frontend lint, OpenAPI drift, Pint, Composer strict validation/audit, pnpm audit, structure, Gitleaks, Semgrep, and `git diff --check` passed.
- Full Semgrep found zero issues from 103 OWASP rules over 281 targets with approximately 99.9% parsing.

See [the Task 15 verification report](../docs/qa/task-15-verification.md) for gate evidence and reviewed boundaries.

Task 16 adds privacy-safe birthday reminders and an authorized in-app fallback:

- The every-minute scheduler selects only active churches at 8:00 AM in their IANA timezone through a narrow database function, then creates one church/date dispatch and one church/date/user/device delivery under the restricted runtime role and forced RLS.
- Owner recipients are church-wide; Teachers are limited to students in currently assigned ministries. Recipient authorization and the birthday count are rechecked immediately before sending, so membership or assignment revocation suppresses queued delivery.
- Web Push endpoint/key material is encrypted at rest. Only trusted browser push-service HTTPS hosts are accepted, endpoint hashes support identity without disclosure, and permanent failures or membership revocation disable subscriptions.
- Push payloads contain only the generic title and birthday count. Names and turning ages are available only through the authenticated tenant-scoped route or the existing unlocked, encrypted, leased offline projection; full birthdates remain excluded.
- The UI requests permission only after an authenticated deliberate action, remembers denial without repeatedly prompting, explains unsupported/iOS Home Screen requirements, and keeps the service worker's `/api/**` NetworkOnly boundary.

Final Task 16 validation on 2026-09-29:

- Focused birthday/notification proof: **12 backend tests / 84 assertions** and **22 frontend tests in 5 files passed**.
- Aggregate verification: **126 frontend tests in 33 files**, frontend typecheck/build, and **203 backend tests / 1,232 assertions passed**.
- Chrome Playwright: **4 tests passed**. Frontend lint, OpenAPI drift, frozen install, Pint, Composer strict validation/audit, pnpm audit, structure, Gitleaks, focused risk-based Semgrep, and `git diff --check` passed.
- Focused Semgrep applied 123 OWASP rules to all 33 parsed Task 16 PHP/TypeScript/OpenAPI targets with zero findings and approximately 100% parsing. The Task 15 comprehensive baseline remains the repository-wide development baseline until Task 17 establishes the mandated production-hardening baseline.

See [the Task 16 verification report](../docs/qa/task-16-verification.md) for gate evidence and reviewed boundaries.

Task 17 adds production operations, retention, deployment, and security hardening:

- Public liveness remains minimal; token-protected readiness exposes only component states; the online-only MFA-protected `sage.dev` dashboard provides sanitized aggregate API, database, queue, scheduler, birthday, synchronization, conflict, and storage signals.
- Scheduler heartbeat, operational pruning, and revoked-device purge jobs use bounded configuration and narrow fixed-search-path database functions. Tenant loops set transaction-local church scope so forced RLS remains active.
- Retention removes only approved technical/application data: operational logs after 30 days, security events and sync receipts after 180 days, rejected application PII after 30 days, and change-feed rows only after active cursors pass them plus 90 days. Tenant audit evidence is never deleted. Expired devices are marked for full resynchronization before stale authorization data is purged.
- The web deployment uses same-origin API rewrites, immutable asset caching, strict CSP, HSTS, and privacy headers. The API image supports API/worker/scheduler/migration service modes, honors the platform-injected port, and runs as unprivileged `www-data`.
- Deployment, backup/restore, secret rotation, incident response, data retention, threat-model, rollback, and bootstrap-removal procedures are documented without weakening TLS, tenant, audit, authentication, or offline boundaries.

Final Task 17 validation on 2026-09-30:

- Focused operations/offline proof: **12 backend tests / 114 assertions** and **9 frontend tests** passed.
- Aggregate verification: **128 frontend tests in 34 files**, frontend typecheck/build, and **208 backend tests / 1,299 assertions** passed. Stable Chrome Playwright passed **4 tests**.
- Frontend lint, OpenAPI drift, frozen install, Pint, Composer strict validation/audit, pnpm audit, repository structure, route/config/schedule checks, production image build/runtime checks, Gitleaks, and `git diff --check` passed.
- The mandatory full `semgrep scan --config p/owasp-top-ten apps` baseline passed after remediation: **108 rules over 314 targets**, approximately 99.9% parsed, zero findings. The final image and all applicable service modes run as `www-data`; default and injected-port liveness and the native container health check passed.

See [the Task 17 verification report](../docs/qa/task-17-verification.md) for complete gate evidence and reviewed boundaries.

Task 18 qualifies the complete approved MVP boundary:

- Whole-MVP Playwright scenarios cover onboarding, two Teacher profiles, four offline attendance dates across closure/reopen, authorization refresh, bounded outage retry, exactly-once convergence, conflicts/corrections/reports, safe import, birthday privacy, storage failure, PWA update, and cross-tenant denial.
- A qualification-discovered offline-security defect was remediated: correct PIN unlock can read an unexpired encrypted cache after restart/profile switch, while reauthentication-required state still blocks push/pull until the same actor refreshes authorization online. Expiry, revocation, and online authorization failure remain fail-closed.
- The definitive matrix passed **60/60 Playwright tests** across desktop Chrome, Pixel 7 Chrome emulation, iPhone 13 WebKit emulation, and iPad WebKit emulation. Axe found no serious/critical issue on qualified surfaces.
- Aggregate verification passed **131 frontend tests in 34 files** and **208 backend tests / 1,299 assertions**, with typecheck, production build, lint, OpenAPI drift, formatting, frozen install, structure, audits, Gitleaks, and whitespace checks green. Focused offline profile/device/sync proof passed 20 tests after the final authorization-denial correction.
- Newly published Laravel/Flysystem advisories were remediated to Laravel 13.34.0 and Flysystem 3.36.0; final Composer and pnpm audits report no known vulnerabilities. The dependency-refreshed image and operations checks passed.
- The encrypted isolated PostgreSQL restore drill matched required counts/checksums and destroyed all temporary restore/backup artifacts. Queue startup, scheduler heartbeat, PWA update, and offline-to-online convergence passed.
- Release decision: **GO** for the approved MVP boundary and controlled one-church pilot procedure. See [Task 18 verification](../docs/qa/task-18-verification.md), [browser matrix](../docs/qa/browser-matrix.md), [pilot evidence](../docs/qa/pilot-runbook.md), and [release checklist](../docs/qa/release-checklist.md).

## Next work

1. Preserve the completed Tasks 1–18 MVP foundation and the Task 18 release evidence.
2. Stop at the MVP boundary. Any production rollout follows the existing deployment/pilot runbooks; any product expansion requires a separately approved post-MVP scope.

## Known environment and repository issues

- The default Windows `node` is 22.22.3, below the approved Node 24 baseline. Task 18 used the Codex-bundled Node 24.19.0 with Corepack pnpm 10.34.5 without installing or purging host runtimes.
- No PHP executable is on the default PATH. A pre-existing temporary Windows PHP 8.3.33 runtime and process-scoped extension scan files supply `pdo_pgsql`, GD, and ZIP outside the repository.
- Composer/pnpm audits and Semgrep used process-scoped temporary trust configuration to retain TLS verification behind the host certificate interceptor. The comprehensive Task 18 scan ran in the existing local Docker environment with its trusted roots mounted read-only. No global trust or machine configuration changed.
- Playwright used installed stable Chrome. The host's existing WebKit 2336 was selected through a process-scoped executable-path override because it predates the current package's managed revision; no browser was installed or reconfigured. The 60-test matrix is browser-engine/device-emulation evidence, not physical-device evidence.
- The pre-existing `upstream` remote differs from the roadmap's original one-remote preflight. It was not used or modified; Task 18 finalization is explicitly limited to the existing tracked `origin/feat/mvp-foundation` branch.
- `vite-plugin-pwa` emits an upstream non-blocking `inlineDynamicImports` deprecation warning while building the injected service worker; the production build and offline browser test pass.
