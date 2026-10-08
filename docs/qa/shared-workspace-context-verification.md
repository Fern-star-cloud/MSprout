# Shared authenticated church workspace verification

## Scope and checkpoint — 2026-10-08

Maintenance fix for Review, Reports, Birthdays, Ministries, Students and Import. Tasks 1–18 remain complete; no subsequent roadmap task or unrelated UI finding was implemented. This receipt describes automated implementation evidence, not a completed live manual-QA phase.

The initial branch was `feat/mvp-foundation` at `0416c2f3d0785e82afd497e214fd948bf0015bee`, exactly three commits behind its existing tracking branch. The verified upstream commits were:

- `4c9bb157ff43db6b83381b002be56e7995a8a6d3`: pending platform administrator recovery.
- `0f956171e2923e85e8cc3a8924a7f18e8f3e5527`: platform database session restoration.
- `b8b95d76af66af6b2c476cf1ea8532a4245aee59`: local HTTP platform authentication verification.

All five dirty tracked files and two untracked QA evidence files were preserved with `git stash push --include-untracked`. Recovery reference: `9b89c9fc47931b76af19bb9c7dd2699a1f806196`. The local `.git/msprout-workspace-recovery-manifest.json` records normalized Git blob hashes and byte hashes; all seven stash blobs were verified. The branch was updated using `pull --ff-only`, then the stash was applied without conflicts. The recovered tracked patch had the same stable patch identity as the original, and non-overlapping files were individually checked. Upstream findings and local observations both survived. No merge, rebase, reset, history rewrite or live data operation was used. `origin/main` stayed at `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f`.

The original Turnstile example edit, historical handoff/knowledge observations and two manual-run evidence files are outside the task commit. Only this fix's new receipt sections belong in shared documentation. Recovery references remain available locally. Existing observations keep their original attribution.

## Root cause and implementation

The six screens independently initialized church IDs from `?church=` while navigation links opened bare module paths. The existing `/api/me` route already required trusted tenant selection and operational authorization, so it could not discover the initial membership. No authenticated shared context connected the screens.

`/auth/session` now returns the web-guard actor ID and an allowlisted list of that verified actor's active memberships in active churches. The additive `authenticated_church_workspaces(bigint)` SQL function follows the established narrow discovery capability pattern: fixed `pg_catalog` search path, schema-qualified tables, PUBLIC execution revoked, configured runtime role only, and authenticated server-bound actor input. It exposes church ID, name and role; it does not expose children or grant operational authority. Existing forced RLS, runtime table privileges, church/platform guards and `/api/me` authorization are unchanged. A repeated isolated `migrate:fresh` regression proves recreation of the function without relying on SQL functions being dropped by Laravel's table cleanup.

One route boundary resolves the six modules before mounting their data loaders. A single authorized church is automatic; multiple memberships require explicit selection by church name. The selected church is carried through navigation and refresh as a URL hint and revalidated against the server list. Unknown hints fail closed. Scoped `/api/me` then verifies actor, active membership, role and current-session Owner MFA before children mount. There is no local-storage authority or browser authorization substitute.

Loading, absent membership, verification, MFA/session expiry, denial and network errors are explicit states. Authentication changes and scoped request denials invalidate context. Focus, visibility and connectivity changes revalidate it; generation checks prevent stale requests from resurrecting a prior actor/workspace. Church context is separate from platform transport. Existing screens consume the shared ID and retain their server-enforced role/ministry restrictions.

Attendance and synchronization remain on their existing offline path. Offline Birthdays requires an unlocked profile and a decrypting authorization read that enforces the existing actor/church/device binding and lease. No profile schema, encryption, lease policy, draft, outbox or synchronization behavior was changed.

## Validation

Focused failing tests established the missing discovery, shared navigation and invalidation behavior before implementation. Focused backend stabilization passed 64 tests / 423 assertions across authentication, roster, reporting, imports and devices. The final workspace and platform-session focused run passed 11 tests / 240 assertions.

Final applicable comprehensive gates:

| Gate | Verified result |
|---|---|
| `php artisan test --compact` | 257 passed / 1,764 assertions |
| `pnpm --dir apps/web test --run` | 166 passed / 35 files |
| Frontend workspace/transport focused rerun | 42 passed |
| Web typecheck, lint, production build | PASS |
| OpenAPI generation/drift check | PASS |
| Pint, Composer strict validation and audit | PASS; no vulnerable packages |
| pnpm high-severity audit | PASS; no vulnerabilities |
| Repository structure and `git diff --check` | PASS |
| Gitleaks history and complete source snapshot | PASS; zero leaks |
| Full application OWASP Semgrep | PASS; 108 rules, 333 targets, zero findings |
| Final changed/relevant OWASP Semgrep | PASS; 123 rules, 39 targets, zero findings |

The constituent verification commands were executed directly; the aggregate `pnpm run verify` wrapper was not redundantly rerun. The initial aggregate backend run exposed an exact-response assertion for the old session schema. Its expected metadata was updated to the approved new contract while retaining guard/session assertions; the complete backend suite was rerun after all backend/test corrections.

Browser evidence: eight desktop checks (three new workspace cases plus existing birthday, onboarding, conflict, import and tenant-isolation checks), three Pixel 7 Chrome emulation workspace cases, and four existing offline/profile checks passed: 15 total. The new checks cover Owner and Teacher navigation across all six modules, direct entry/refresh, expired or unauthorized context, mobile layout, and serious/critical accessibility findings. Browser APIs are intercepted test fixtures, not evidence that the live Laravel instance has this migration or that a physical phone was tested.

Semgrep's comprehensive run retained five existing generic-Vitest-mock partial-parse warnings in unchanged auth/application/platform test files; affected new/changed source and relevant authorization/RLS/offline inputs were scanned separately with complete parsing. Relevant untracked source was included. Dependency/build/runtime output and ignored credentials were excluded from source snapshots. The unchanged lockfile was also supplied as a scanner-readable evidence copy. No legitimate finding was suppressed.

Validation used documented process-scoped Node 24/pnpm 10 and PHP 8.3 tools. Composer used the existing PHP 8.3 image. An existing trusted CA bundle resolved pnpm's local TLS-chain failure with verification enabled. No global runtime/security setting was changed.

## Review, preservation and operational limits

The complete source/diff/security review closed the remediation queue: repeat migration recreation, stale exact session assertions, real platform-guard negative coverage, an isolated Teacher positive-control fixture, and transport formatting. No BLOCKING or SHOULD FIX item remains. Later whitespace-only transport edits were checked for identical non-whitespace content and covered by focused frontend tests/lint; later backend test changes received focused proof, Pint and the complete backend suite. Documentation-only receipt updates do not invalidate those application results. Relevant final security scanning includes the corrected source/tests.

No live database reset/reseed, synthetic account/application decision, MFA material, existing browser/IndexedDB profile, draft, conflict or outbox was altered. Backend factories/fresh migration tests ran only through the repository's isolated test-database bootstrap. A disposable preview used for browser proof was stopped after verifying its owned PID; existing API, Vite, worker and scheduler processes were preserved.

The user's reports of approved MTQA A / Approved application status, confirmed Owner MFA and reachable Teacher management remain human-attributed observations. Existing manual-run history/counts were not promoted to PASS by these automated checks, and the unrelated UI findings remain excluded.

Live rollout is NOT RUN. Apply the additive migration with the matching API before serving the new frontend. Follow the existing checkout/runtime identity and deployment safeguards; the separately running local API is not assumed to use this checkout. Rollback order is the previous frontend/API followed by this migration's function-only `down`; no tenant, audit, security or application record is removed.

This is the precommit verification receipt for `fix: inherit authenticated church workspace across modules`, based on `b8b95d76af66af6b2c476cf1ea8532a4245aee59`. The final commit and push must be verified against the existing feature tracking branch; no next task is authorized.
