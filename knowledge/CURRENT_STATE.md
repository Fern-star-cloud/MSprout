# Current State

Verified: 2026-09-29. This is the primary development handoff.

## Git state

- Branch: `feat/mvp-foundation`.
- Task 14 started from clean, synchronized checkpoint `eaddc9d034b7696387bb56ad6aa33bdf2dd63bf2` — `feat: add idempotent attendance synchronization`.
- The current Task 14 milestone is the commit containing this handoff, with subject `feat: preserve attendance conflicts and revisions`.
- Repository remotes remain `origin = https://github.com/Fern-star-cloud/MSprout.git` and `upstream = https://github.com/Frierend/ministry-sprout.git`. This differs from the roadmap preflight's original one-remote expectation; do not change remotes without explicit direction.

## Roadmap position

- Tasks 1–14: **COMPLETE / COMMITTED / PUSHED** on `feat/mvp-foundation`.
- Tasks 15–18: **NOT STARTED**.
- Preserve Tasks 1–14 and do not begin Task 15 automatically.

See [ROADMAP_STATUS.md](ROADMAP_STATUS.md) for every task and commit.

## Committed Tasks 8–14 foundation

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

## Next work

1. Preserve the committed Tasks 1–14 foundation.
2. Task 15 — attendance history, reports, and safe CSV export — is next, but must not begin automatically.

## Known environment and repository issues

- The default Windows `node` is 22.22.3, below the approved Node 24 baseline. Tasks 11–14 used the Codex-bundled Node 24.19.0 and pre-existing temporary pnpm 10.34.5 launcher without installing or purging host runtimes.
- No PHP executable is on the default PATH. A pre-existing temporary Windows PHP 8.3.33 runtime and process-scoped extension scan files supply `pdo_pgsql`, GD, and ZIP outside the repository.
- Composer/pnpm audits and Semgrep used process-scoped temporary trust configuration to retain TLS verification behind the host certificate interceptor. No global trust or machine configuration changed.
- The two-remote configuration conflicts with the approved roadmap's original repository preflight and remains unresolved.
- `vite-plugin-pwa` emits an upstream non-blocking `inlineDynamicImports` deprecation warning while building the injected service worker; the production build and offline browser test pass.
