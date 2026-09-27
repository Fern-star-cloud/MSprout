# MinistrySprout Agent Instructions

## Start here

- Inspect `git status`, staged changes, and relevant diffs before working. Preserve all unfinished work.
- Always read `knowledge/README.md` and `knowledge/CURRENT_STATE.md`.
- Read only the task-relevant knowledge routed by `knowledge/README.md`; do not load every knowledge file by default.

## Source precedence

1. Explicit current user instruction.
2. The approved roadmap and specification under `docs/superpowers/`.
3. Current code, migrations, contracts, and tests.
4. Verified documents under `knowledge/`.
5. Historical notes and verification reports.

If sources disagree, investigate and update stale knowledge. Never invent project state: record only repository evidence, confirmed requirements or decisions, actual test results, and explicitly unresolved issues.

## Engineering and safety

- Work only in this repository; never add the legacy Expo repository as a remote or submodule.
- Use TDD for behavior changes: add a focused failing test, observe the expected failure, implement the smallest change, then rerun it.
- Keep `contracts/openapi.yaml` and `apps/web/src/api/generated.ts` synchronized with every API or schema change.
- Authorization is server-side. Tenant-owned records carry a trusted `church_id`; new tenant tables require application authorization and PostgreSQL RLS.
- Never log or commit passwords, tokens, cookies, child names, birthdates, guardian data, raw request bodies, credentials, or production secrets.
- Keep offline data minimal and per-profile. Never cache API responses in the service worker.
- Before a commit, run relevant tests, typecheck, build, contract, formatting, security, and structural checks.
- Do not stage, commit, push, amend, rebase, reset, clean, or rewrite history unless the user explicitly authorizes it. If authorized to stage, use exact paths only.
- Preserve scope. Do not begin the next roadmap task automatically.

## Knowledge maintenance

- Update `knowledge/CURRENT_STATE.md` whenever development state changes.
- Update `knowledge/ROADMAP_STATUS.md` only when a task status changes.
- Update `knowledge/DECISIONS.md`, `ARCHITECTURE.md`, or `TESTING_ENVIRONMENT.md` only when the corresponding verified fact changes.
- Append `knowledge/CHANGELOG.md` for meaningful completed implementation milestones, not routine churn.
- Relevant knowledge updates are part of task completion. Do not report implementation complete while its verified state is stale.
