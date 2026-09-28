# MinistrySprout Agent Operating Contract

This file defines how coding agents operate in this repository. The approved design and implementation roadmap under `docs/superpowers/` define what the product and each roadmap task require. Do not duplicate or broaden those task specifications here.

Correctness, security, privacy, tenant isolation, data integrity, and preservation of user work take priority over speed or usage savings.

## 1. Applicability and authority

Obey system/platform instructions and the user's current explicit scope and permissions. Within the repository, resolve evidence in this order:

1. The closest applicable `AGENTS.md` instructions. The root file applies repository-wide; a nested file may add or narrow rules for its subtree.
2. The approved current roadmap task and approved product/architecture specification in `docs/superpowers/`.
3. Established architecture, security, data-model, and workflow decisions, including verified task-relevant knowledge under `knowledge/`.
4. `contracts/openapi.yaml` and its generated client contract when an API surface is involved.
5. Current implementation, migrations, and tests.

The active task prompt selects and may narrow the work, but it does not silently change approved product scope or security invariants. Tests are evidence of verified behavior; they do not override an explicitly approved newer requirement. When a legitimate requirement changes, update the implementation and its expectations rather than preserving a stale test or weakening a valid one.

Resolve discrepancies using repository evidence, documented recency, and the hierarchy above. Update stale knowledge when the resolution is deterministic. Never invent project state or silently resolve a material conflict. An unresolved conflict affecting product scope, architecture, security, privacy, data integrity, destructive operations, or user-owned work is YELLOW and eventually requires user direction.

## 2. Start and task boundary

Before work:

- Inspect the current branch, `HEAD`, tracking branch, ahead/behind state, `origin/main`, `git status`, staged changes, and relevant diffs. Fetch only when needed to verify remote state and a safe authenticated connection is available.
- Compare the actual checkpoint with the prompt, `knowledge/CURRENT_STATE.md`, and `knowledge/ROADMAP_STATUS.md`. Investigate differences non-destructively; never discard unexplained work.
- Read `knowledge/README.md` and `knowledge/CURRENT_STATE.md`, then use the index to read only task-relevant knowledge. Read the current roadmap task and the relevant approved design sections.
- Locate applicable nested `AGENTS.md` files, repository scripts, workflow gates, and task-specific instructions once during reconnaissance.

Implement exactly one roadmap task per run unless the user explicitly defines a different scope. Verify the preceding task checkpoint before starting. Preserve every completed task. Limit changes to the selected task plus strictly necessary compatibility, correctness, or security corrections that directly block it.

Do not opportunistically implement later tasks, unrelated refactors, or speculative infrastructure. Record an unrelated defect instead of expanding scope unless it directly blocks the task or creates an immediate security, privacy, or data-integrity risk. After a successful task commit and push, stop. Never begin Task N+1 automatically.

Work only in this repository. Never add, copy Git history from, or attach the legacy Expo repository as a remote or submodule.

## 3. Efficient execution lifecycle

Use this default lifecycle:

1. Verify the checkpoint and preserve existing work.
2. Perform one deliberate reconnaissance pass.
3. Form a concise implementation plan and identify affected gates.
4. Add focused failing tests where behavior changes and observe the expected failure.
5. Implement the smallest coherent solution.
6. Stabilize with focused tests and root-cause fixes.
7. Run one final repository-wide validation phase.
8. Perform one complete final diff review.
9. Synchronize knowledge with the verified result.
10. Classify the outcome GREEN, RED, or YELLOW.
11. If GREEN and automatic finalization is authorized, create one reviewed commit and push it normally.
12. Stop.

Do not repeatedly reread unchanged context, narrate routine commands, run the full suite after every small edit, repeat identical security scans, perform multiple nominally final diff reviews, or rerun an expensive still-valid green gate for reassurance. Once repository evidence establishes the direction, avoid speculative exploration.

The task still requires one complete initial final validation phase appropriate to its scope. After a required comprehensive gate has passed, assess every later correction by the inputs it changes and the guarantees it can materially affect. Rerun the focused tests or checks that directly prove the correction, then only the broader gates whose guarantees were invalidated. Record enough reasoning to support preserving any prior green result; do not rerun an expensive still-valid gate merely for reassurance. If repository policy or CI requires a complete gate, follow that requirement.

Apply invalidation by effect, not file extension alone:

- A CSS or presentation-only correction normally invalidates the relevant UI and accessibility proof plus build or lint when affected, not unrelated backend suites or dependency audits.
- A TypeScript implementation or type correction normally invalidates the relevant frontend tests and affected typecheck, lint, or build guarantees, not unrelated backend gates.
- A PHP or backend-logic correction invalidates focused backend proof and the affected backend or security gates, not unrelated PWA build or browser behavior.
- Authorization, RLS, audit, authentication, migration, or schema changes invalidate the relevant backend, tenant/data-integrity, and security guarantees.
- Dependency, lockfile, or runtime-configuration changes invalidate the applicable install, audit, build, and security guarantees.
- Documentation or knowledge-only corrections do not invalidate application tests or builds unless the changed material is consumed by validation, generation, or runtime behavior.
- CI or security-workflow corrections invalidate the checks whose execution, inputs, coverage, or enforcement semantics changed.

A previously green aggregate regression suite remains valid after a late change only when repository evidence establishes that the change cannot materially affect the suite's guarantees. Rerun the applicable aggregate suite when a correction can affect shared behavior, contracts, application bootstrap, authorization, persistence, cross-cutting infrastructure, dependencies, or another broad surface. Prefer focused proof for genuinely isolated corrections. When uncertain whether a security-critical guarantee was invalidated, prefer safety and rerun the relevant gate. Usage efficiency never justifies reduced correctness or security.

## 4. Implementation and test policy

- Use focused TDD for behavior changes: add a relevant failing test, confirm the expected failure, implement the smallest fix, and rerun the focused test.
- Preserve valid existing tests. Never delete, weaken, skip, or rewrite a valid test merely to obtain a pass. A changed expectation is legitimate only when an approved specification change makes the old expectation stale.
- Cover happy paths and failure/authorization boundaries. Where relevant, test church isolation and RLS, role/ministry scope, rollback and transaction atomicity, concurrency, replay/idempotency, migration/data integrity, privacy/redaction, and contract compatibility.
- Preserve previously completed behavior and prefer root-cause corrections over symptom suppression.
- Treat browser controls as presentation only; authorization belongs on the server.
- Do not run backend suites concurrently against the shared PostgreSQL test database.

Derive commands from current scripts, workflows, task documentation, and `knowledge/TESTING_ENVIRONMENT.md`. The current gate inventory is:

```text
# Repository root
pnpm --dir apps/web test --run
pnpm --dir apps/web typecheck
pnpm --dir apps/web lint
pnpm --dir apps/web build
pnpm --dir apps/web api:check
pnpm run verify
bash scripts/verify-structure.sh
pnpm audit --audit-level high
git diff --check

# apps/api
php artisan test
php vendor/bin/pint --test
composer validate --strict
composer audit --no-interaction

# Security workflow equivalents
gitleaks detect --no-banner
semgrep scan --config p/owasp-top-ten apps
```

Use task-specific focused tests first. Before GREEN, run all applicable full gates once in the task's initial comprehensive validation: backend and frontend tests, typecheck, lint, production build, Pint, contract drift, structure, Composer validation and audit, pnpm audit, Gitleaks, Semgrep, and `git diff --check`. A late correction does not waive that initial phase and follows the invalidation policy in Section 3. Ensure secret scanning covers tracked and newly created source while excluding ignored credentials, dependencies, runtime data, and build output. Review scanner exclusions or parse failures rather than assuming coverage. Do not claim a pass unless the command passed in the current run or an immediately preceding result remains valid after all later changes under the invalidation policy.

The task's required comprehensive security scan must occur. After it passes, rescan the changed and relevant inputs when repository tooling can establish the affected security guarantee reliably. Rerun the complete applicable scan when the correction materially affects security-sensitive behavior, dependencies, scanner configuration or coverage, CI/security workflows, or when tool limitations or repository policy prevent reliable partial coverage. Never exclude relevant new or untracked source to reduce scanning, suppress a legitimate finding, or treat efficiency as a reason to weaken security coverage.

Keep disposable test and tool output ignored and uncommitted. Distinguish generated evidence that repository policy intentionally tracks from runner artifacts such as screenshots, traces, temporary databases, caches, coverage output, browser reports, and runner state. Do not stage or commit those artifacts unless the task or repository explicitly requires them as reviewed evidence; preserve existing ignore rules when they already cover the output.

## 5. Durable architecture and security invariants

Preserve these established cross-task requirements whenever they apply:

- PostgreSQL is authoritative for acknowledged data. Future IndexedDB state is authoritative only for unsynchronized local work and remains minimal, encrypted, assignment-scoped, lease-bound, and isolated per profile.
- Every tenant-owned server record uses a trusted UUID `church_id`. Tenant scope comes from validated membership and transaction-local context, never a client ownership field.
- Application authorization and forced PostgreSQL RLS both protect tenant tables. The runtime role is restricted, does not own tenant tables, and cannot bypass RLS; migration credentials remain separate.
- Owners and Teachers remain role- and ministry-scoped. Frontend visibility never substitutes for backend authorization. Avoid every form of cross-tenant disclosure, including errors, audit views, exports, logs, and generated data.
- Church and `sage.dev` identities, guards, sessions, cookies, routes, and permissions remain separate. Honor verified-email, recent-authentication, and MFA requirements. `sage.dev` is online-only and cannot gain ordinary child-data access.
- Each church has exactly one active Owner. High-risk membership and ownership operations remain locked, transactional, reauthenticated, MFA-protected where specified, and audited.
- `audit_events` and `security_events` are the canonical evidence stores. Audit evidence is append-only; legacy audit domains remain frozen/read-only and must not be silently reactivated or destructively migrated.
- Required high-risk success audits participate in the domain transaction. Denial telemetry remains best-effort where replacing an already-computed denial would be unsafe.
- Correlation IDs flow through responses, jobs, safe errors, audit/security events, and sanitized logs.
- Never log or commit passwords, tokens, cookies, authorization headers, credentials, certificate contents, raw request bodies, child names, birthdates, guardian data, production secrets, or unrestricted free-form PII. Use allowlisted audit metadata and aggressive log redaction.
- Multi-record domain changes, required audit evidence, and change-feed/idempotency receipts remain transactionally consistent. Introduce locking, replay protection, and concurrency tests when the risk exists.
- `contracts/openapi.yaml` is the API source of truth. Update it and regenerate/check `apps/web/src/api/generated.ts` in the same task as every API or schema change.
- New or changed tenant tables require trusted `church_id`, constraints and tenant-safe foreign keys, application authorization, runtime grants, enabled and forced RLS, isolation tests, and reviewed migrations.
- Migrations preserve tenant, audit, security, and data-integrity invariants. Destructive schema/data changes require an explicit recovery/rollback plan and user authorization when consequences are not already approved.
- Service workers must never cache API responses as static assets. Offline scope must not expand beyond the approved design.

Task-specific requirements stay in the approved roadmap; do not infer additional product requirements from these invariants.

## 6. Environment and tool failures

Classify failures before changing code:

- implementation/correctness defect;
- test or validation failure;
- security or dependency finding;
- local runtime/tooling failure;
- network/TLS failure; or
- external access, permission, or dependency failure.

Never repair an environment issue by weakening product behavior, tests, validation, or security. Do not install, update, purge, or permanently reconfigure host runtimes merely to reproduce a command when a documented process-scoped setup exists.

On the known Windows host, use the documented Node 24/pnpm 10 and PHP 8.3 process-scoped tools when needed. Temporary PHP extension scan files and trusted CA bundles must stay outside the repository. TLS certificate verification stays enabled: never use `http.sslVerify=false`, `GIT_SSL_NO_VERIFY`, global verification disablement, or an equivalent bypass. Git for Windows may use `schannel` as a process-scoped override. Dependency/scanner processes may use an existing trusted, process-scoped CA/bundle approach. Do not print or persist credentials, tokens, passwords, secrets, or certificate contents.

If resolution would require an uncertain permanent or global security change, classify it as unresolved YELLOW and escalate.

## 7. RED: autonomous remediation

RED is a confirmed implementation, correctness, security, privacy, data-integrity, validation, or final-review defect. Examples include regressions, authorization/RLS/MFA bypasses, audit/correlation/redaction failures, transaction/concurrency/idempotency defects, unsafe migrations, contract drift, dependency/scanner findings, implementation-caused type/lint/build failures, and BLOCKING or SHOULD FIX review findings.

RED normally means remediate, not stop:

1. Record and classify all known failures.
2. Determine root cause from repository evidence.
3. Choose the safest repository-consistent in-scope correction.
4. Implement it autonomously.
5. Add or strengthen regression coverage where appropriate.
6. Run the smallest focused validation that proves the correction.
7. Rerun the broader gates invalidated by the correction.
8. Continue until RED is eliminated or a genuine user-owned decision/action is required.

Do not ask the user to choose when the roadmap, architecture, decisions, tests, or established secure practice determine the correction. Maintain awareness of every RED finding until it is resolved.

Never obtain GREEN by weakening/deleting tests, suppressing a legitimate finding, bypassing RLS or authorization, disabling TLS verification, excluding relevant files from scanning, hiding errors, weakening validation, silently changing requirements, or implementing a later task.

If safe autonomous remediation becomes impossible because a real user decision or action is necessary, reclassify the remaining condition as unresolved YELLOW. RED cannot commit or push.

## 8. YELLOW: autonomous resolution first

YELLOW is uncertainty or an environmental/external/repository-state condition that may impede safe progress but is not yet a confirmed product defect. It does not automatically mean stop.

For YELLOW:

1. Record and classify the condition.
2. Investigate non-destructively.
3. Resolve it from authoritative evidence or established safe practice when deterministic.
4. If one clearly safest authorized solution exists, apply it autonomously.
5. Validate the resolution and continue.

Do not ask the user merely because a command failed once, a safe retry exists, documented process-scoped setup resolves the problem, generated contracts are stale, a temporary test setup is missing, push transport failed normally, or read-only diagnosis can resolve the ambiguity. If investigation proves a code/security defect, reclassify it as RED and remediate.

Stop and request user action only when continuation genuinely requires something the agent cannot safely decide or perform: credentials, MFA, CAPTCHA, interactive authentication, external approval/access, an unresolved product or architecture choice between materially different valid options, destructive Git/history work, unexpected remote divergence requiring merge/rebase/reset, overwriting unexplained work, changing approved scope, accepting a security/privacy/data-integrity tradeoff, permanent/global security configuration, or unavailable infrastructure.

Before escalation, exhaust safe diagnosis and already-authorized remediation. Report the condition, diagnosis, attempted remediation, exact blocker, why autonomous continuation is unsafe, and the recommended next action. Offer alternatives only for a genuine decision. Unresolved YELLOW cannot commit or push.

## 9. GREEN and final review

GREEN requires all applicable conditions:

- the selected task is fully implemented and the next task remains untouched;
- focused and required repository-wide validation is green;
- security gates are green;
- no BLOCKING or SHOULD FIX finding remains;
- knowledge is synchronized with verified reality;
- no unexpected/unrelated files or material ambiguity remains;
- previous tasks remain intact; and
- Git branch, checkpoint, staging, remote, and worktree state are understood and safe.

After implementation stabilizes, perform one complete final diff and source review. Verify scope, no Task N+1 leakage, no unrelated refactor, no debug/temp/generated junk, no secrets or weakened tests, safe migrations/data changes, correct tenant/RLS/authorization/audit/privacy behavior, synchronized backend/contract/frontend, justified workflow/dependency changes, accurate knowledge, and preservation of prior work.

Classify all findings as BLOCKING, SHOULD FIX, or INFORMATIONAL/ACCEPTABLE and record BLOCKING and SHOULD FIX findings in one remediation queue. Remediate that queue autonomously when a clear safe in-scope correction exists, verify each correction, rerun the focused and broader gates actually invalidated under Section 3, and inspect the corrected portions plus their direct interactions. Add any defect introduced or exposed by remediation to the same queue. Do not call the result GREEN while a BLOCKING or SHOULD FIX item remains.

Do not automatically restart the complete final review after each correction. Closing the remediation queue, completing invalidation-based validation, and reviewing corrected portions and direct interactions is sufficient unless remediation materially changes task scope, architecture, security boundaries, the data model or migrations, dependencies, authorization or tenant behavior, or a sufficiently broad part of the implementation that the original review is no longer reliable. In those cases, perform a second complete final review.

Only GREEN permits automatic commit and push.

## 10. Knowledge maintenance

`knowledge/README.md` routes project knowledge. Keep files concise and evidence-based:

- `CURRENT_STATE.md`: primary handoff, Git/task checkpoint, validated current behavior, next work, and active environment issues. Update whenever development state changes.
- `ROADMAP_STATUS.md`: task status and commit evidence. Update only when status changes.
- `ARCHITECTURE.md`: verified current topology, boundaries, and implemented architecture. Update only when those facts change.
- `DECISIONS.md`: durable approved or implemented rationale. Add only a real decision, not routine implementation detail.
- `TESTING_ENVIRONMENT.md`: canonical commands, verified environment facts, and actual validation results.
- `CHANGELOG.md`: meaningful completed milestones, not routine churn or speculative work.

Knowledge must contain verified facts only, distinguish validated/uncommitted work from committed/pushed work, record actual results rather than intended commands, preserve decision history, and avoid volatile duplication. Perform final knowledge synchronization after implementation, validation, and review remediation but before the task commit. If a knowledge edit invalidates a required check, rerun only that affected check.

Do not report implementation complete while relevant knowledge is stale.

## 11. Automatic commit on GREEN

For ordinary future roadmap tasks, a prompt to implement the task authorizes one automatic task commit after deterministic GREEN unless the prompt explicitly disables finalization. A separate approval message is not required.

On GREEN:

1. Reverify the expected branch and starting checkpoint.
2. Stage only exact, reviewed paths belonging to the current task.
3. Inspect the staged file list and staged diff once. Unexpected staged content leaves GREEN and must be investigated.
4. Use the roadmap-specified commit subject; otherwise follow the repository's conventional style (`feat:`, `fix:`, `test:`, `docs:`, or `chore:`).
5. Create exactly one current-task commit.
6. Verify its parent, subject, branch, and clean worktree.

Never amend an already completed task commit automatically.

## 12. Automatic push on GREEN

After the GREEN commit, a normal push is authorized only when the checked-out branch is the expected feature branch, its tracking remote is the expected existing feature branch, the worktree is clean, local `HEAD` is the newly reviewed commit, the remote has not diverged, no force/history manipulation is needed, and TLS verification remains enabled.

Push normally only to that existing feature tracking branch. Then verify local and remote `HEAD` match, ahead/behind is `0/0`, the worktree is clean, `origin/main` is unchanged, and the next task remains untouched. Report completion and stop. Treat normal transport/TLS trouble through YELLOW resolution; escalate unexpected divergence or any destructive-history requirement.

## 13. Absolute Git safety

Unless the user gives a separate explicit instruction after the specific situation is known, never:

- push to or merge into `main`;
- force push or use `--force-with-lease`;
- rebase completed/shared history;
- amend a completed task commit;
- reset, clean, restore, or otherwise discard reviewed or unexplained work;
- delete branches or rewrite remote history;
- bypass hooks, validation, or security gates;
- destructively resolve remote divergence;
- stage unrelated files; or
- start the next roadmap task.

Preserve user work. If a destructive operation is genuinely necessary, stop with YELLOW and request explicit authorization after explaining the exact targets and consequences.

## 14. Governance self-modification

Material changes to `AGENTS.md`, source authority, security policy, validation requirements, RED/YELLOW/GREEN rules, automatic commit/push authority, or Git safety do not self-authorize their own commit or push. They require deliberate review unless a future explicit repository policy says otherwise.

Therefore a governance-changing run must remain unstaged, uncommitted, and unpushed unless the user separately authorizes finalization after reviewing the known change. This exception overrides the ordinary GREEN automatic-finalization rule for the governance change itself.

## 15. Reporting

Avoid narrating routine commands. During execution, interrupt the user only for a genuine unresolved blocker, unexplained unsafe repository state, or a material product/architecture/security decision requiring their input.

At completion, report concisely: task/status, changed files and implementation summary, focused and full validation/security results, final-review result, knowledge updates, commit SHA/subject and push synchronization when finalized, confirmation the next task is untouched, and any unresolved risk. Stop after the selected task.
