# CI-01 — Hosted API Test Working Directory

## Controlled finalization authorization — 2026-10-14

The stakeholder reviewed this candidate and separately authorized exactly the five paths below, one commit with subject **fix: run API tests from Laravel working directory**, and a normal push to the existing origin/feat/mvp-foundation tracking branch. Parent/checkpoint: DOC-GOV-01 65c5072c0c15498027ed8c4333f83315c324ede1. The approved workflow correction is unchanged. No additional task, second corrective commit, merge, deployment or application-data operation is authorized.

Final documentation-status edits supersede the publication hold for this candidate only. The original review record below remains verbatim historical evidence. Previously completed comprehensive validation remains applicable through exact executable, dependency, workflow and scanner-input equality; finalization refreshes documentation references/anchors, whitespace, candidate-text secrets, preservation and Git safety. Windows CRLF contract-check limits and the two unchanged reviewed Semgrep parser warnings remain documented, not repaired or concealed.

The exact commit SHA, committed-file list, final validation/preservation proof, normal push synchronization and separate hosted web/API/Security outcomes resolve through Git and the ignored .git/msprout-ci01-20261014/finalization/final.json receipt. An absent receipt is not proof of publication or hosted success. Qualify the exact new SHA, confirm the API test step actually runs the real suite, and classify pending/passed/failed accurately. If a required hosted check fails, preserve the commit, report exact failure evidence and stop; no automatic second commit. GREEN delivery requires all required hosted checks to pass. Stop after CI-01 and wait for the next explicit task authorization.

## Preserved pre-finalization review record

2026-10-14 (Asia/Taipei). **Repair candidate prepared for review; staging, commit and push are not authorized.** Selected task: CI-01 only. Starting checkpoint: DOC-GOV-01 `65c5072c0c15498027ed8c4333f83315c324ede1`, branch `feat/mvp-foundation`, tracking `origin/feat/mvp-foundation`, entry ahead/behind 0/0 with clean worktree/staging.

[Current state](../../knowledge/CURRENT_STATE.md) · [Task status](../../knowledge/ROADMAP_STATUS.md) · [Validation knowledge](../../knowledge/TESTING_ENVIRONMENT.md) · [Modernization roadmap](../superpowers/plans/2026-10-14-unified-modernization-roadmap.md).

## Verified diagnosis

The stakeholder supplied the successfully retrieved API log excerpt for [run 38550603825](https://github.com/Fern-star-cloud/MSprout/actions/runs/38550603825), job `115807343017`:

```text
Run php apps/api/artisan test
Could not open input file: vendor/pestphp/pest/bin/pest
Process completed with exit code 1.
```

This task does not claim an independent authenticated download of that hosted log. The supplied failure was independently reproduced locally with the same launcher mechanism.

- Composer installs under `apps/api`. The installed Pest executable exists at `apps/api/vendor/pestphp/pest/bin/pest`; repository-root `vendor/pestphp/pest/bin/pest` does not exist.
- `apps/api/artisan` resolves its own Composer autoloader and application bootstrap relative to `__DIR__`. It can start from repository root, but it does not change the process working directory to the API directory.
- Installed Collision's Laravel `TestCommand::binary()` selects `[PHP_BINARY, 'vendor/pestphp/pest/bin/pest']`. `handle()` constructs Symfony Process with a null working directory.
- Installed Symfony Process documents null as inheriting the current PHP process directory. Thus the runner binary is resolved relative to repository root, not `apps/api`, and PHP exits before Pest/PHPUnit or test database bootstrap can execute. The absolute PHPUnit configuration path does not repair a missing executable path.
- Installed versions match Composer lock: Laravel `v13.34.0`, Collision `v8.9.5`, Pest `v4.7.8`, Symfony Process `v7.4.19`. No dependency is missing or upgraded by this repair.
- Root `package.json` already uses `cd apps/api && php artisan test`, consistent with the required API working directory.

## Smallest repair and exact implementation diff

Only the final API test step changes. Composer installation, environment/key preparation, PHP/PostgreSQL versions, database credentials/roles/isolation, workflow triggers, web job, Security workflow, dependencies and assertions remain unchanged.

```diff
-      - run: php apps/api/artisan test
+      - run: php artisan test
+        working-directory: apps/api
```

The API step is the correct scope: setting a job-wide directory would affect the existing repository-relative setup command; changing dependencies, adding root vendor links, or expanding workflow infrastructure is unnecessary. Parsed before/after YAML is identical after substituting the original final API step, establishing that no other workflow semantics changed.

## Validation and preservation

Confirmed focused reproduction before the workflow edit:

| Invocation | Result |
|---|---|
| Repository root: `php apps/api/artisan test --filter=ExampleTest --no-ansi` | Exit 1; exact missing-Pest error above. |
| API directory: `php artisan test --filter=ExampleTest --no-ansi` | Exit 0; both existing Example tests pass, 2 tests / 2 assertions. |
| Parsed workflow check | PASS: YAML valid, final step resolves Artisan/Pest under `apps/api`; all other steps/jobs/settings unchanged. |

| Comprehensive check | Actual result |
|---|---|
| API-directory `php artisan test --no-ansi` | PASS: 306 tests / 3,626 assertions, 390.20 seconds. No test or assertion changed. |
| Frontend `pnpm --dir apps/web test --run --maxWorkers=2` | PASS: 740 tests / 79 files. Two workers limit local resource contention; no test is excluded. |
| Frontend typecheck / lint / production build | PASS, each exit 0. |
| `php vendor/bin/pint --test` | PASS, exit 0; no formatter writes. |
| `composer validate --strict` | PASS, exit 0. |
| Composer audit / high-severity pnpm audit | PASS on safe process-scoped trusted-CA retry; no advisories reported. Initial older-bundle TLS failures are retained separately, not called passes. No TLS verification disablement or dependency changes. |
| OpenAPI generated-client check | Raw Windows invocation exits 1 on the unchanged CRLF generated file. Identical `--check` against an ignored LF-normalized mirror passes (exit 0); original contract/generated bytes remain exact. This is a documented local line-ending/tooling condition, not semantic drift or a contract repair. |
| Structure | PASS with existing Git for Windows bash, exit 0. |
| OWASP Semgrep 1.177.0 | Completed: 132 rules / 462 targets, plus a targeted closure of all 61 API test/support/bootstrap files initially filtered out. Combined coverage includes all 523 non-PNG application/workflow inputs; 0 findings. Six PNG assets are outside code analysis. Two reviewed partial-parser warnings remain in unchanged Vitest type-parameterized mock-import expressions; production, changed workflow and API test closure have no parser errors. No finding is suppressed. |
| Gitleaks | Complete tracked/new-source snapshot: 627 files plus explicit dependency-lock text aliases, 0 leaks. Final candidate text receives a focused five-file refresh after documentation synchronization; ignored credentials/runtime/evidence are not source inputs. |
| Documentation / whitespace | All 88 Markdown files checked: 597 relative references, 17 anchors, 335 host-local references, no broken links. Whitespace checks include the new untracked report explicitly; 65 external-link occurrences are not newly network-qualified. |
| Final source/diff review | 0 BLOCKING / 0 SHOULD FIX within CI-01. YAML semantics, exact five-path scope, original knowledge bodies, application/contract/dependency/security policy and preservation reviewed. Parser/tooling limitations above are explicit informational items, not hidden passes. |

The root aggregate wrapper is not relabeled as a current pass: its frontend test/type/build and API-test component equivalents were executed individually, plus the additional gates above. Backend suites ran serially against the existing guarded test database/role, distinct from development/migration databases and the development runtime role. Local PostgreSQL 18 isolation was verified read-only. All 39 development-table fingerprints and the development runtime role match before/after the suite; no contents or credentials were printed. No existing backend test process was active before launch.

The first directory-based Semgrep attempt was stopped without completed coverage after more than seven minutes; it is retained as an incomplete diagnostic, not a pass. The replacement uses exact copies of all 529 tracked/new-unignored application and changed-workflow inputs. Coverage review found 61 API test/support files still filtered despite the empty snapshot ignore file. A separate explicit-project-root/no-git-ignore scan closes all 61 without findings/errors; no repository ignore rule is changed. Two type-only Vitest mock-import parser warnings were inspected and classified informational for this unchanged test syntax and the workflow-only repair; blanket 100% parsing is not claimed. Dependencies/runtime/private data are not copied. Input hashes tie both completed scans to current application sources and the reviewed workflow. TLS stays enabled with the existing recent trusted bundle.

Entry preservation records cover all 626 tracked files, the Git index/refs, 11 stashes, 9 protected original blobs, 10 backups, 2 private environment/SQLite files and 30 local QA files. Disposable logs/scripts/scanner output live ignored under `.git/msprout-ci01-20261014/`. No development reset, application-key replacement, real-user operation, browser/profile operation or encrypted-work cleanup is authorized.

Final preservation: all 622 tracked files outside the four modified paths are entry-byte exact, including every application/test/contract/dependency/Security-workflow/AGENTS input. The three modified knowledge files retain their complete previous bodies. Protected hashes, stashes/originals/backups, development PostgreSQL fingerprints, Git checkpoint/refs/index and empty staging remain unchanged. Isolated test data and process-scoped/disposable tool output are separate from user-owned data.

## Exact candidate scope and review boundary

1. `.github/workflows/ci.yml` — API test command and step-level working directory only.
2. `docs/qa/ci-01-hosted-api-test-working-directory.md` — diagnosis, proof, results and review evidence.
3. `knowledge/CURRENT_STATE.md` — selected CI-01 candidate and explicit publication hold.
4. `knowledge/ROADMAP_STATUS.md` — actual CI-01 status; future tasks remain unselected.
5. `knowledge/TESTING_ENVIRONMENT.md` — actual validation and environment findings.

No AGENTS, product/design specification, contract, application/test source, dependency, Security workflow or CI-02 change is included. The workflow affects a quality gate: section 14 and the explicit CI-01 user hold require review and separate authorization to publish this specific candidate. Prior DOC-GOV-01 publication permission does not carry forward.

Hosted candidate verification is NOT RUN because publication is held. A locally passing suite establishes the working-directory correction, not a claim that hosted CI is already repaired or that no later hosted issue exists. Stop for stakeholder review; no stage/commit/push, next task, merge, deployment or application-data operation.
