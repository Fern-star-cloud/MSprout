# MinistrySprout Engineering Rules

- Work only in this repository; never add the legacy Expo repository as a remote or submodule.
- Use test-driven development for all behavior changes: add a focused failing test, observe the expected failure, implement the smallest change, then rerun the test.
- Keep `contracts/openapi.yaml` and `apps/web/src/api/generated.ts` synchronized with every API or schema change.
- Treat API authorization as server-side only. Tenant-owned records must carry a trusted `church_id`; future tenant tables require application authorization and PostgreSQL RLS.
- Do not log or commit passwords, tokens, cookies, child names, birthdates, guardian data, raw request bodies, or production secrets.
- Keep offline data minimal and per-profile. Do not cache API responses in the service worker.
- Before each commit, run the relevant tests, typecheck, build, and structural checks. Stage exact paths only; never use broad `git add` commands.
