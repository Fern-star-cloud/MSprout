# Current State

Verified: 2026-09-28. This is the primary development handoff.

## Git state

- Branch: `feat/mvp-foundation`.
- HEAD and `origin/feat/mvp-foundation`: `dc3c13c6cd5e4909c644b0abe37d18875cbe248f` — the committed Task 8 milestone.
- Task 9 is validated but remains unstaged and uncommitted in the working tree. Do not stage, commit, or push it without explicit user authorization.
- Repository remotes remain `origin = https://github.com/Fern-star-cloud/MSprout.git` and `upstream = https://github.com/Frierend/ministry-sprout.git`. This differs from the roadmap preflight's original one-remote expectation; do not change remotes without explicit direction.

## Roadmap position

- Tasks 1–8: **COMPLETE / COMMITTED**.
- Task 9: **VALIDATED / UNCOMMITTED**.
- Tasks 10–18: **NOT STARTED**.
- Preserve Tasks 1–8 and do not begin Task 10.

See [ROADMAP_STATUS.md](ROADMAP_STATUS.md) for every task and commit.

## Committed Task 8 foundation

Task 8 is committed at `dc3c13c6cd5e4909c644b0abe37d18875cbe248f`. It provides ministries, students, enrollments, canonical student input normalization, date-only birthdates, server-derived display name/age, Owner roster writes, assignment-limited Teacher reads, bundled gender avatars, forced tenant RLS, and Task 7 audit integration.

## Task 9 worktree state

The current worktree implements the approved safe student spreadsheet import:

- Owner-only CSV/XLSX upload, preview, inspection, correction, mapping, row exclusion, idempotent commit, status retrieval, and template download.
- Strict 5 MiB/500-row boundaries; verified MIME and XLSX ZIP structure; formula, macro, external-link, embedded-content, hidden/multiple-sheet, malformed-package, and decompression-bomb rejection.
- Approved headers, ISO/genuine-Excel date handling, Task 8 canonical student normalization, case-insensitive ministry matching, explicit unknown-ministry mapping, and duplicate classification.
- Tenant-owned import batches/rows with constraints, composite tenant foreign keys, restricted grants, and forced PostgreSQL RLS.
- Locked transactional commit, stable commit-key replay, concurrency coverage, row outcomes, enrollment creation, and one privacy-bounded Task 7 audit event. Existing students are never updated or merged.
- Synchronized OpenAPI/generated types and a responsive import UI with multipart transport and spreadsheet-safe correction CSV output.
- CI and security jobs enable the GD and ZIP PHP extensions required by the locked PhpSpreadsheet dependency.

Final validation on 2026-09-28:

- Focused Task 9 backend: **15 tests / 91 assertions passed**.
- Task 8 regression: **13 tests / 83 assertions passed**.
- Aggregate verification: **70 frontend tests in 17 files**, frontend typecheck/build, and **160 backend tests / 884 assertions passed**.
- Frontend lint and OpenAPI generated-type drift check passed.
- Pint, Composer strict validation/audit, pnpm audit, repository structure, Gitleaks, and `git diff --check` passed.
- Semgrep `p/owasp-top-ten` found no issues: 103 rules over 207 tracked app files, plus 98 rules over all 16 new/untracked Task 9 source/test files.

See [the Task 9 verification report](../docs/qa/task-9-verification.md) for the gate evidence and reviewed boundaries.

## Next work

1. Review the validated Task 9 diff and wait for explicit commit approval; keep all changes unstaged and uncommitted until then.
2. Preserve the committed Tasks 1–8 foundation and do not start Task 10.

## Known environment and repository issues

- The default Windows `node` is 22.22.3, below the approved Node 24 baseline. A Codex-bundled Node 24.19.0 and a pre-existing temporary pnpm 10.34.5 launcher were used without installing or purging packages.
- No PHP executable is on the default PATH. A pre-existing temporary Windows PHP 8.3.33 runtime works. Process-scoped temporary scan-directory files enable `pdo_pgsql` and GD for testing; they are outside the repository and are not Task 9 artifacts.
- Composer/pnpm audits and Semgrep used process-scoped temporary trust configuration to retain TLS verification behind the host certificate interceptor. No global trust or machine configuration was changed.
- The two-remote configuration conflicts with the approved roadmap's original repository preflight and remains unresolved.
