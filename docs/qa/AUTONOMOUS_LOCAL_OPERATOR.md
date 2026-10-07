# Autonomous Local Manual-Test Operator Mode

Governed by [AGENTS.md](../../AGENTS.md), especially sections 5–9 and 14–16. Use with the [manual roadmap](MANUAL_TESTING_ROADMAP.md), [handoff](MSPROUT_SYSTEM_HANDOFF.md) and [current manual checkpoint](../../knowledge/MANUAL_TESTING.md). MT-00…MT-22 are optional risk-based references; this protocol does not authorize case execution or fixture preparation by itself. Preserve MT-00/MT-01 and partial MT-02 evidence. Deferred/BLOCKED/NOT_RUN cases do not automatically block development, merging or deployment and never become PASS by deferral. Current explicit case/operation authority, actual safety prerequisites and applicable release gates remain required.

## Entry and authority

Before selected cases or a phase, verify Git checkpoint/upstream/main/worktree, existing evidence for actual dependencies (no mandatory predecessor completion), the human's current authorized cases/operations, exact infrastructure, fixture mappings and preservation baseline. Record that authorization in the sanitized run record. An authorization reference is a pointer to that human instruction, not a freely invented grant. A local file, classification switch, helper invocation, READY output or agent-created run record cannot substitute for the instruction. Check authority before retrieving credentials or making requests.

Codex may execute source-reviewed repository-owned PowerShell/manual-QA probes itself when every identity is explicitly designated synthetic/disposable and every target is approved local isolated test infrastructure. It may create/use/verify individual run-owned sessions and separately authorized fixtures, operate permitted browser automation and collect sanitized evidence. Script approval requires reviewing its exact source, phase/case scope, target, writes, redaction and cleanup; do not use a generic arbitrary command/URL dispatcher. Old `%TEMP%` MT-01 probes are historical, not automatically approved for a future phase. Reuse the repository helper in future reviewed probes instead of reimplementing secret prompts.

This run adds credential/preflight support only: no account provisioning, HTTP runner, generic command executor, application configuration change or authentication bypass. Before a future probe is used, review and validate it under AGENTS.md. Live preparation uses the validated supported action/normal onboarding flow through a specifically approved procedure; no public signup or later feature may be added as preparation. Factories, hand-set assurance and destructive schema preparation cannot target the development database. A local label does not prove database/role isolation: inspect the effective target and role before use.

## Qualifying identities and resources

An autonomous identity must have a human designation recorded by alias/reference before credential creation, contain only synthetic test data, use a controlled local Mailpit address, and have an individually authorized creation/use procedure. The helper accepts only new `AUTO-*` aliases and `mtqa-*@example.test` addresses. The private mapping must be checked against actual server identity/role/tenant before execution. Read before create; reject any existing-account/address collision instead of replacing its password. No real human, guardian, child or private mailbox is eligible.

Existing AP (`test@example.com`), DA from MT-01, planned AP-derived OA and human PA stay outside this store/mode. MT-01 DA's synthetic origin does not authorize converting its retained private password or evidence into disposable automation. No credentials are imported or extracted from browser sessions, mail, environment files, factories or existing accounts. New stored credentials do not create server accounts, verify mail, enroll MFA, or qualify onboarding.

A disposable resource needs an exact run/phase-owned identity, database/role or browser context/origin, recorded purpose and cleanup authority, verified separation from preserved resources, and no dependent unsynced work. Namespace alone is insufficient. Reusable baseline churches/profiles/fixtures and canonical evidence remain retained. Preserve PostgreSQL/SQLite, APP_KEY, credentials, browser/IndexedDB storage, offline profiles, drafts, conflicts, outbox, cursors, unsynced work and prior evidence. Never migrate:fresh, reseed development, remove volumes, clear shared browser storage, invalidate unrelated sessions, replace credentials or backdate tokens/time. Destructive or irreversible preparation requires a separate human approval of exact consequences even for a proposed test target.

## Private store and initialization

[Operator.psm1](../../scripts/manual-qa/Operator.psm1) uses Windows user-scoped DPAPI to encrypt the entire JSON record (identity mapping and generated password) into `/.manual-qa/operator.dpapi`. Schema/environment/repository path/Windows SID are bound and checked. Git and Codebase Memory exclude the directory; files must remain untracked. New store directories receive an owner-only ACL; existing directories/files with broader read access are refused rather than silently repaired. Reparse points inside the repository/store are refused. The repository is under OneDrive: ignored is not a sync exclusion; ciphertext may sync. No plaintext credential/config is written. Decryption requires the owning Windows DPAPI security context; the helper also checks repository path and owner SID. DPAPI and ACLs protect persistence, not a compromised/unlocked Windows account or privileged host administrator; do not promise protection against host backup/roaming-profile access.

From this repository in Windows PowerShell 5.1 or PowerShell 7:

```powershell
Import-Module ./scripts/manual-qa/Operator.psm1
Initialize-ManualQaStore
```

Initialization makes an empty store and prints only status/counts. It neither designates an identity nor authorizes a phase. Reinitialization refuses to overwrite. Missing material fails closed; do not fall back to an AP/factory/default password. An existing unsafe directory, unreadable DPAPI file, changed Windows account/repository path or crashed registration lock requires safe diagnosis and human direction if recovery would replace unexplained work. There is no automatic password/store recovery, rotation, unlock or bulk cleanup.

After the human explicitly designates a **new** synthetic identity and approves its prerequisite preparation, use nonsecret alias/email/reference arguments:

```powershell
New-ManualQaIdentity -Alias AUTO-EXAMPLE -Email mtqa-example@example.test `
  -DesignationReference 'human instruction recorded in the authorized run' -SyntheticDisposable
```

This is an example, not an identity designation; do not run it during this governance task. A cryptographically random compliant password is generated once and thereafter reused privately. No password parameter, prompt, plaintext file or output exists. Duplicate alias/email registration refuses replacement. Atomic replacement and an exclusive registration lock preserve existing entries; never remove a busy/stale lock without checking process ownership and an interrupted operation. Do not add MFA, PIN, tokens or recovery codes to this store.

An approved probe imports the module, checks its actual phase authorization and preservation/target facts, then assigns the result of `Get-ManualQaCredential` to a private variable with `-Phase`, `-CaseId`, `-Alias`, `-AuthorizationReference` and `-PreservationVerified`. The helper checks that the case belongs to the roadmap phase and accepts only the exact local live origin `http://127.0.0.1:5173`. Other targets need a separately reviewed scoped helper change, not an origin override. These checks validate supplied context; they do not independently inspect human instructions, database state, role, browser storage or identity existence. `Test-ManualQaContext` returns only READY/phase/case/no-execution, never a live case PASS.

Never invoke the credential getter as a standalone terminal command or emit its object. Only an approved in-process probe consumes it. Convert the SecureString to plaintext only for the specific normal auth request or approved new-account action; send through memory/private stdin, never CLI arguments, environment variables, transcript/debug/verbose output or persisted request bodies. Managed plaintext can briefly exist in process memory; do not claim guaranteed memory erasure. Dispose the SecureString, release credential/plaintext variables and close owned cookie jars when done. Do not store credentials in product IndexedDB/localStorage or application runtime configuration.

## Probe and browser requirements

Before network use, verify effective APP_ENV/local target, restricted PostgreSQL runtime and expected identities/roles/tenant; factories require the separate approved test database/role. Use exact reviewed methods/routes, normal CSRF, same-origin transport and memory-only cookie jars. Disable redirects or validate every redirect target before sending any secret; never forward credentials/cookies to another origin. Do not print raw responses, headers or exception objects. Extract only allowlisted statuses/counts/correlation IDs. A fresh owned guest context prevents the authenticated-login mistake seen in MT-01. Logout only the owned session via supported flow in finally; report cleanup failure, preserving other sessions and immutable telemetry.

Browser automation is allowed only through available supported APIs under current platform/computer-use policy. Read the applicable skill before browser operation. No hidden browser-state extraction, policy workaround, authentication interception or mocked positive response may qualify a live flow. If a secure local credential channel is unavailable and automation would expose values in tool arguments/screenshots, use the approved in-process HTTP probe for eligible R cases or hand the browser credential step to the human. R evidence does not satisfy an L/H case by itself. Explicit browser-policy human takeover remains mandatory.

## Human takeover boundaries

Stop at the boundary and request only the exact required input/approval:

- Real/private human credentials, MFA secrets/codes/enrollment, recovery material and external identity-provider authorization, including PA bootstrap mailbox selection.
- CAPTCHA or other human-verification controls; never manufacture challenge responses, relax hostname/action checks or replace real integration with a dummy success.
- Destructive/irreversible preparation, production/staging/external-service mutations, protected security-policy changes or weakening any security control.
- Out-of-phase actions, roadmap-reserved/new-feature work, and any platform/computer-use/browser action explicitly requiring human takeover.

Do independent safe diagnosis while waiting. Human takeover is scoped; it does not expand later cases/phase authority. No TOTP generation, recovery capture, CAPTCHA bypass, provider provisioning or public-registration workaround is supplied by this mode.

## Evidence, cleanup and outcomes

Use the roadmap's full result/evidence enums and existing per-phase record schema. Record candidate, date/window, authorized phase/cases, environment/origin/database/browser target, opaque aliases/designation/authorization references, expected/actual, correlation/aggregate counts, actual evidence source, defects/blockers, exact owned resources and verified cleanup/preservation. Distinguish agent LIVE_BROWSER, DIRECT_RUNTIME, modeled BROWSER_AUTOMATION and human HUMAN_MANUAL. Never promote helper checks or historical/mocked evidence to a live PASS. Preserve earlier receipts; reruns supersede by reference.

Allowlist evidence; never persist credentials/hashes, cookies, tokens/links, PINs, MFA/recovery material, raw bodies/headers/mail/HAR, unrestricted SQL/PII or sensitive screenshots in chat/tools/logs/Git. Disable traces/screenshots during secret entry and token-bearing navigation; collect only reviewed safe frames. Runner output stays ignored in `/.manual-qa/` or the roadmap's owner-private temporary directory. Secret-scanner source snapshots exclude private runtime material but include every tracked/new source input; do not upload private stores to a scanner or graph tool.

Clean up only verified individually authorized run-owned resources: supported logout for its session, exact owned processes/tabs, and disposable runner files after resolved-path containment checks. Retain identity credentials for reuse, dependent fixtures/mail/canonical evidence and all local work. An identity being synthetic never authorizes server deletion, bulk logout, profile purge or destruction of audit evidence. Record cleanup failure and actual preservation checks; do not claim unrelated profiles/databases were inspected. The helper's self-test deletes only its own random test folder; it does not delete the operator store.

Missing authorization/configuration/credentials, uncertain ownership/classification/preservation/isolation, unavailable human channel or tool-policy limits are **YELLOW/BLOCKED**. Record the exact missing prerequisite/owner/next action, diagnose non-destructively, and stop dependent actions rather than guessing. Confirmed leaks, unsafe writes or helper/product defects are **RED**: contain safely, remediate in scope and validate under AGENTS.md. **GREEN** requires required real case evidence, closed findings, verified cleanup/preservation, applicable gates and synchronized knowledge. No unresolved YELLOW/RED may commit/push. Governance changes still require section 14's separate reviewed finalization authorization.

## Tool validation

Run `powershell -NoProfile -File scripts/manual-qa/Test-Operator.ps1` (also verified with `pwsh`). Tests generate only ephemeral synthetic credential records under ignored `/.manual-qa/selftest-<random>/`, use DPAPI/ACL validation, and perform no network/database/browser/phase execution. A module READY check is not an executed MT case. Validate ignore/untracked/graph exclusions, documentation links, parser, whitespace and source/history secret scans. Manually review PowerShell secret handling, authority and preservation because the existing Semgrep OWASP rules do not cover PowerShell; never claim zero-finding app scans prove this helper safe. Application suites/audits/contracts and full-app security baseline remain applicable until their inputs/guarantees change under AGENTS.md invalidation policy; CI's full security scan remains unchanged.
