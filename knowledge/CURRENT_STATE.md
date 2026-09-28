# Current State

Verified: 2026-09-28. This is the primary development handoff.

## Git state

- Branch: `feat/mvp-foundation`.
- Task 11 started from clean, synchronized checkpoint `9131617ac349704c12c3c5dcd1be10f37e8fb221` — `chore: optimize agent validation workflow`.
- The current Task 11 milestone is the commit containing this handoff, with subject `feat: add protected offline teacher profiles`.
- Repository remotes remain `origin = https://github.com/Fern-star-cloud/MSprout.git` and `upstream = https://github.com/Frierend/ministry-sprout.git`. This differs from the roadmap preflight's original one-remote expectation; do not change remotes without explicit direction.

## Roadmap position

- Tasks 1–11: **COMPLETE / COMMITTED / PUSHED** on `feat/mvp-foundation`.
- Tasks 12–18: **NOT STARTED**.
- Preserve Tasks 1–11 and do not begin Task 12 automatically.

See [ROADMAP_STATUS.md](ROADMAP_STATUS.md) for every task and commit.

## Committed Tasks 8–11 foundation

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

## Next work

1. Preserve the committed Tasks 1–11 foundation.
2. Task 12 — attendance domain, drafts, and responsive marking UI — is next, but must not begin automatically.

## Known environment and repository issues

- The default Windows `node` is 22.22.3, below the approved Node 24 baseline. Task 11 used the Codex-bundled Node 24.19.0 and pre-existing temporary pnpm 10.34.5 launcher without installing or purging host runtimes.
- No PHP executable is on the default PATH. A pre-existing temporary Windows PHP 8.3.33 runtime and process-scoped extension scan files supply `pdo_pgsql`, GD, and ZIP outside the repository.
- Composer/pnpm audits and Semgrep used process-scoped temporary trust configuration to retain TLS verification behind the host certificate interceptor. No global trust or machine configuration changed.
- The two-remote configuration conflicts with the approved roadmap's original repository preflight and remains unresolved.
- `vite-plugin-pwa` emits an upstream non-blocking `inlineDynamicImports` deprecation warning while building the injected service worker; the production build and offline browser test pass.
