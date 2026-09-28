# Task 9 Verification — Safe XLSX/CSV Import

Verified 2026-09-28 against committed Task 8 base `dc3c13c6cd5e4909c644b0abe37d18875cbe248f`, then committed and pushed as `fbe338f433c7432cc26c98ad8c2e258cf9502a79`.

## Acceptance evidence

- Owner-only endpoints provide preview, commit, batch retrieval, and a bounded CSV template; Teachers are denied.
- Preview does not create students. It uses the Task 8 canonical normalizer, identifies existing/in-file duplicates, and requires Owner mapping for unknown ministries.
- CSV/XLSX inspection enforces 5 MiB and 500-row limits, approved headers, verified MIME/ZIP structure, one visible worksheet, ISO or genuine Excel dates, safe scalar content, and bounded package expansion.
- Formula cells and formula-like CSV values, macros, `.xlsm`, external workbook links, embedded/executable content, malformed packages, spoofed types, unexpected/hidden worksheets, and decompression bombs are rejected with safe errors.
- Commit locks the batch, requires Previewed state, rechecks duplicates and active same-church ministries, creates only approved rows/enrollments, records row outcomes, and writes one privacy-bounded batch audit event in the transaction. Same-key retries return the stored result; concurrent same-batch retries create one student set and one audit event.
- `import_batches` and `import_rows` carry trusted `church_id`, bounded database constraints, composite tenant foreign keys, restricted runtime grants, and forced RLS.
- OpenAPI and generated TypeScript are synchronized. The frontend provides counts, row selection, ministry mapping, stable commit keys, template/error downloads, and spreadsheet-safe correction CSV escaping.

## Results

- Focused Task 9 backend: **15 tests / 91 assertions passed**.
- Task 8 regression: **13 tests / 83 assertions passed**.
- Aggregate `pnpm run verify`: **70 frontend tests in 17 files**, typecheck/build, and **160 backend tests / 884 assertions passed**.
- Frontend lint, production build, typecheck, and `api:check`: passed.
- Pint and Composer strict validation: passed.
- Composer audit and pnpm audit: no known vulnerabilities.
- Repository structure and `git diff --check`: passed.
- Gitleaks: no leaks in tracked or new Task 9 source/test/contract/workflow/knowledge inputs.
- Semgrep `p/owasp-top-ten`: zero findings from 103 rules over 207 tracked app files; supplemental explicit coverage found zero findings from 98 rules over all 16 new/untracked Task 9 source/test files.

## Environment classification

The temporary PHP extension files at `%TEMP%/msprout-task9-php-config/gd.ini` and `%TEMP%/msprout-task9-php-config/pgsql.ini` are process-scoped host configuration outside the repository. They are not repository files, Git changes, staged/untracked artifacts, or commit candidates. Temporary trust files used for TLS-verifying audits/scans are likewise external and process-scoped.

The CI workflow adds GD and ZIP alongside its existing `pdo_pgsql` extension because the API test job installs and exercises PhpSpreadsheet. The security workflow adds GD and ZIP because its Composer install/audit must resolve the same locked production dependency set.
