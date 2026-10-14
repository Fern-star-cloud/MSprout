# MSprout Unified Modernization Roadmap

2026-10-14 (Asia/Taipei). Canonical transcription of the stakeholder-approved revised master-plan planning/sequencing baseline. [Index](../../INDEX.md) · [Design specification](../specs/2026-10-14-unified-modernization-design.md) · [Supersession register](../../history/SUPERSESSION_REGISTER.md).

## 1. Checkpoint, permission and status

Verified starting branch `feat/mvp-foundation`, HEAD `5e87610265afeae1557aa6abb561d55fcf0fa221` (UX-08), upstream `origin/feat/mvp-foundation`, local ahead/behind 0/0. This is local tracking evidence, not a fresh live-remote observation. DOC-GOV-01 began with clean worktree/staging. Eleven stashes, nine original protected blobs, ten backups, private environment/SQLite and existing local QA data are preservation boundaries.

**Task selection and delivery status:** read [CURRENT_STATE](../../../knowledge/CURRENT_STATE.md) and [ROADMAP_STATUS](../../../knowledge/ROADMAP_STATUS.md), together with the current explicit user permission. The stakeholder separately approved finalization of DOC-GOV-01's exact 20-file documentation/governance scope, including durable status cleanup and one commit/normal feature push after local checks. That approval does not select any later task or authorize historical moves/deletion, application/UI/backend/offline changes, CI repair/workflow edits, data operations, merge or deployment.

APPROVED = explicit stakeholder direction; VERIFIED = evidenced fact; PROPOSED = awaits approval; DEFERRED = excluded pending scope; BLOCKED = missing prerequisite, never a pass. Later-task status is **NOT AUTHORIZED / NOT STARTED**, not an application-capability claim: many underlying features already exist.

## 2. Dependency and task register

| Order / task | Prerequisite | Deliverable and exact boundary |
|---|---|---|
| 1. DOC-GOV-01 | Approved planning baseline; separate section 14 finalization authorization recorded | Canonical index, design, roadmap, supersession, corrected pointers/current knowledge, reviewed AGENTS amendments, validation and review. Publication evidence belongs in current knowledge and the finalization receipt. |
| 2. CI-01 | Separate selection; permitted failing-job evidence | Diagnose actual API failure; repair only supported root cause; qualify candidate locally and on hosted CI. No speculative workflow change. |
| 3. UX-F1 | Accepted design; resolved CI baseline; separate selection | Shared foundation/primitives only; affected-consumer browser proof; no silent product-wide retrofit. |
| 4. UX-F2 | Accepted UX-F1; separate selection | Entry, shell, Home, navigation and profile presentation retrofits. |
| 5. UX-F3 | Accepted UX-F2; separate selection | Preparation, Sync and attendance presentation retrofits; no Late implementation. |
| 6. COMPAT-01 | Separate selection and explicit compatibility decisions | Old/new-client preservation qualification and only the approved necessary compatibility changes. Late unavailable until exit. |
| 7. UX-09 / Pack 06 | Accepted foundations/preceding selected tasks | Church Account & Application presentation. |
| 8. UX-10 / Pack 07 | Accepted UX-09/shared patterns | People Management presentation. |
| 9. UX-11 / Pack 08 | Accepted People patterns | Student Import presentation. |
| 10. ATT-LATE-01 | Passed COMPAT-01; explicit counting/guest/bulk/color decisions; separate functional authorization | Fourth-state functional enhancement with preservation and contract proof. |
| 11. UX-12 / Pack 09 | Accepted Late/reporting decisions and functional result | Review & History presentation. |
| 12. UX-13 / Pack 10 | Accepted foundations/preceding tasks | Birthdays & Activity presentation. |
| 13. UX-14 / Pack 11 | Accepted foundations/preceding tasks | Separate Platform Administration presentation. |
| 14. UX-15 / Pack 12 | Accepted pack tasks and relevant compatibility proof | Shared-state/accessibility closure; no unqualified update strategy. |
| 15. QUAL-01 | Accepted preceding tasks | Cross-product journey, preservation, visual, security/accessibility and exact-SHA hosted qualification. No deployment. |

CI-01 read-only reconnaissance requires explicit permission; DOC-GOV-01 finalization does not grant it. Optional CI-02 follows CI-01 under separate authorization for broader gate parity/protection changes; it is not part of root-cause repair. A held Late decision holds dependent work. Resequencing needs explicit roadmap amendment. One selected task per run; stop after it.

## 3. DOC-GOV-01 and governance proposal

Affected surfaces: root AGENTS/README; docs index, new spec/roadmap/register/review; notices in old specifications/plans/system handoff/manual roadmap; current entries in task-relevant knowledge. Original bodies, QA evidence and approval history remain in place. Do not change application scripts, dependencies, contracts, workflows or data.

Acceptance: distinguish current versus historical authority; keep proposals labeled; preserve all sources; validate links/anchors and documentation coverage; review complete diff; verify exact allowed inventory, protected hashes and safe Git state. Record actual results in the review and testing knowledge. Section 14 requires separate governance finalization review; the stakeholder granted it for the reviewed DOC-GOV-01 scope. Later governance changes still require their own review.

The reviewed AGENTS clarifications are limited to canonical routing, approval labels, actual browser visual acceptance, pre-commit GREEN versus post-push hosted evidence, and preservation of section 14. They do not authorize themselves or reduce required validation/security, RED/YELLOW handling, task boundaries or Git safety.

## 4. CI diagnosis and delivery sequencing

Historical planning evidence: [CI run 38519442523](https://github.com/Fern-star-cloud/MSprout/actions/runs/38519442523) at UX-08 SHA completed with web success and API failure at `php apps/api/artisan test`. The read-only job-log request returned HTTP 403. [Security run 38519442524](https://github.com/Fern-star-cloud/MSprout/actions/runs/38519442524) was reported passing in prior audit evidence. These are dated observations, not fresh DOC-GOV-01 runs. API root cause remains unverified.

CI-01 must obtain permitted logs/annotations, identify the first substantive error, compare actual workflow/bootstrap/runtime inputs, reproduce with isolated resources if feasible, and repair only the demonstrated cause. Missing log access blocks repair, not a license to guess. Do not weaken assertions, tenancy/runtime roles or security controls. Do not install/reconfigure host runtimes globally. No CI-01 action is authorized now.

For future ordinary tasks, technical checks, stakeholder visual acceptance, Git synchronization and hosted results are distinct evidence:

1. Complete selected scope, applicable gates/security, review and accurate knowledge.
2. Obtain explicit visual acceptance when required. Technical passes alone do not close that hold.
3. Establish pre-finalization GREEN under the approved operating contract; only then use authorized automatic commit/push. Explicit task holds and section 14 override automatic finalization.
4. Report the exact pushed SHA's required hosted checks as pending until completed; no delivery-GREEN claim before actual passes and safe Git verification.
5. Preserve any failed commit, diagnose within authorized scope, and select a follow-up if another commit is required. Never amend completed history or start the next task automatically.

An existing required hosted failure remains unresolved. The stakeholder's DOC-GOV-01 Finalization Authorization explicitly permits this documentation-only publication despite that known baseline after all local checks pass; it does not declare hosted CI green or authorize repair. If CI-01 later needs a reviewed candidate commit/push to obtain hosted proof while its baseline is failing, request separate explicit authorization identifying that candidate and known failure. Governance-changing publication also needs section 14 review. Publication does not waive tests/security or authorize subsequent fixes/commits automatically.

## 5. Bounded foundations and retrofit specifications

| Task | Preserve | Change / acceptance / exclusions |
|---|---|---|
| UX-F1 | Working primitives, routes, domain and existing screens | Canonical tokens and shared action/feedback conventions. Narrow representative compositions with adapters as needed. Test every materially affected consumer; no global unreviewed visual switch. No domain/dependency rewrite. |
| UX-F2 | Auth/session discovery, secret handling, route/context behavior, role destinations, profile/PIN identity | Consistent action hierarchy, typography, compact Home/navigation/profile cards, accessible names and keyboard flow. UX-03 Home/branding and UX-04 navigation remain distinct historical checkpoints. No profile-removal policy change. |
| UX-F3 | Preparation continuation, leases, crypto, drafts/outbox/receipts/cursors, Start/Resume, guests and finalization | Shared steps/errors, compact Sync transfers/recovery, roster/filter geometry and phone controls. No persistence/sync engine change or fourth-state implementation. |

Affected code, when separately authorized, is the existing shared styles/primitives and relevant feature screens. Each task must identify exact paths before implementation. Shared styles require affected-consumer regression proof, including screens outside the example composition. No task auto-advances; each requires visual acceptance and its own finalization.

### Progress-indicator ownership and acceptance

The stakeholder's DOC-GOV-01 review correction adds the [canonical progress-indicator standard](../specs/2026-10-14-unified-modernization-design.md#31-progress-indicators). This is a documentation requirement for future selected tasks, not permission to implement components now.

| Owner / task | Future responsibility |
|---|---|
| UX-F1 / shared primitives | Reuse or extend existing loading/step primitives where practical; own compact styling, accessible naming/descriptions, determinate/indeterminate semantics and reduced motion. Add a shared abstraction only where warranted by actual reuse. |
| UX-F3 / Preparation and Sync | Supply real stages and verified progress values from unchanged workflow/persistence/sync behavior. Apply preparation step and independent upload/download conventions; never invent percentages, completion or new telemetry. |
| UX-11 / Student Import | Apply genuine wizard position and contextual loading; expose determinate byte/row progress only where reliable existing measurements support it. Preserve partial results and same-batch recovery. |
| Other selected pack tasks / feature owners | Choose an indicator only where useful; supply meaningful visible context and actual state. Do not expand task scope to manufacture progress infrastructure. |
| UX-15 and QUAL-01 | Close cross-workflow consistency and accessibility gaps, then verify the accepted progress behavior as part of final journeys. |

Future acceptance must demonstrate: accurate measured values/ranges when determinate; no percentage/current value when unknown; truthful step completion and no step-number-derived percentage; accessible names/descriptions and correct progress/step semantics; clear paused/offline/error/partial/unknown/retry states; no premature Ready, synchronized or all-imported claim; restrained announcements/animation; and readable 320px, enlarged-text and reduced-motion presentation. Use focused semantic/state tests and actual browser visual acceptance in the selected implementation task. Preserve domain, encryption, lease, receipt, cursor and authorization guarantees. No new tests/components or behavior are implemented in DOC-GOV-01.

## 6. Pack task specifications

| Task / existing area | Proposed presentation work | Proof, exclusions and risk boundary |
|---|---|---|
| UX-09 / applications and account/auth screens | Shared fields, assurance/status panels, explicit submission and recovery hierarchy | Applicant/account states, validation, pending/stale/unknown outcomes, access boundaries, phones. No unsupported public registration or new account workflow. |
| UX-10 / ministries, students, teachers, invitations | Consistent lists/details, filters, archive/restore, dialogs and protected-operation presentation | Owner/Teacher/ministry scope, empty versus filtered, narrow tables/cards, confirmations and errors. No expanded bulk permissions or destructive policy. |
| UX-11 / imports | Upload → Review/map → Confirm selected → Results using real sequential stepper and row feedback | Invalid files, existing limits/formats, mapping/selection, partial results, retry and same-batch reconciliation. Preserve batch identity; no row editor, new format or duplicate policy. |
| UX-12 / conflicts, guest review, reports | Distinct queues, explicit unselected choice, reason/confirmation, consistent filters/totals/export feedback | Stale revisions, effective/corrected state, Late totals, N/A and authorization. No new session/revision detail editor or correction workflow. |
| UX-13 / birthdays and church activity/audit | Consistent date/timezone/provenance, filters and states | Scope, offline cache behavior, existing notification consent, date wording. No upcoming periods or new channels. |
| UX-14 / platform auth/admin/audit | Consistent separate platform identity, application decisions, aggregate health and sanitized audit | Assurance, denial, stale/unknown decisions, safe audit and responsiveness. No ordinary child-data access or invented settings. |
| UX-15 / shared states | Close documented loading/empty/denied/offline/pending/recovery/accessibility inconsistencies | All affected consumers; reuse approved COMPAT-01 evidence. No new restart mechanism, storage purge or unqualified brand assets. |

Every task uses the design system and existing supported functionality. Packs are references, not exact-copy or API authority. Record exact affected files, prerequisites, before/after browser state evidence, focused and applicable comprehensive validation, review findings, stakeholder acceptance, knowledge and final Git/CI evidence. Discovery of necessary domain expansion stops the affected work for separate scope.

## 7. COMPAT-01, ATT-LATE-01 and unresolved decisions

The [design compatibility specification](../specs/2026-10-14-unified-modernization-design.md#6-compatibility-proposal-and-mandatory-proof) defines the comparison and preservation matrix. Deliver actual legacy/new application tests, not same-build worker revision tests. Cover encrypted saved drafts, pending events, locked profiles, all windows/tabs, offline restart, failed assets, replay, unknown states, cursor atomicity, lost responses, retention and full bootstrap. No storage reset or forced unsafe activation. Late creation remains disabled during qualification; activation and restart strategies remain proposed until approved.

ATT-LATE-01 affects the current attendance domain/schema constraints, contracts/generated types, offline records/events, server synchronization, conflict/correction handling, reports/history/CSV and marking UI. Preserve immutable finalized originals, correction provenance, transaction/audit/RLS/role boundaries, event identities and existing encrypted data. Adding an enum does not itself require a crypto or database-version migration. No arrival time.

| Stakeholder gate | Recommendation / approval status | Required before |
|---|---|---|
| Late counting | Present + Late numerator; Present + Late + Absent denominator; separate counts; Unmarked excluded | ATT-LATE-01 |
| Guest rules | Preserve current behavior/separate totals; no implicit guest Late or rate extension | ATT-LATE-01 |
| Bulk Late | No addition initially | ATT-LATE-01 |
| Late color | Compare accessible purple clock treatment; final color not approved | ATT-LATE-01 visual specification |
| Compatibility mechanism/error | Staged reader plus narrow feature declaration/non-settling error; no blanket protocol v2 or default 426 | COMPAT-01 |
| Restart and activation | Only approve after demonstrated old/new preservation; no unsafe-work bypass | COMPAT-01 exit |
| Governance wording/finalization | DOC-GOV-01 wording and separate publication authorization accepted; preserve the exact reviewed amendments. Future governance changes require separate review. | Recorded DOC-GOV-01 approval; future governance changes remain gated |
| CI access/publication | Actual logs first; exact candidate separately approved if necessary | CI-01 repair/publication |
| Broader CI controls | Optional separately selected CI-02 | CI-02 |

N/A for no finalized records is approved display direction. Other denominator rules and nullable wire representation are not implied approvals. All unresolved Late counting, guest, bulk, color, compatibility, restart and activation choices remain PROPOSED despite master-plan and DOC-GOV-01 finalization approval.

## 8. Validation, qualification and stopping

Follow current AGENTS.md and [testing knowledge](../../../knowledge/TESTING_ENVIRONMENT.md). Run focused failing/passing proof for behavior changes and one applicable comprehensive phase: frontend/backend tests, types/lint/build, contract/structure/Pint/Composer validation, dependency audits, secret scanning, risk-appropriate Semgrep and whitespace. Apply effect-based reruns; do not run shared-database backend suites concurrently or claim an old pass newly executed.

DOC-GOV-01 changes documentation/agent instructions only. Its applicable checks are source/link/anchor/authority validation, read-only structure, secret scan of changed existing and new text, full diff/scope review and preservation/Git checks. It does not alter scripts that consume docs, runtime/build inputs, scanner settings or CI workflows; unrelated application tests/builds/audits and native visual tests are not rerun or claimed fresh. Existing hosted failure remains reported separately. If the diff expands into executable validation/security inputs, reassess affected gates before proceeding.

QUAL-01 covers real role journeys, retained offline work and interruption/recovery, approved Late/reporting/export rules, responsive and keyboard/accessibility behavior, visual acceptance, security and required hosted results at the exact final SHA. Optional manual cases retain actual PASS/FAIL/BLOCKED/NOT_RUN statuses. No merge, deployment or external-service mutation follows automatically.

At each stop, report selected task/status, exact paths, actual checks, review findings, preservation, knowledge, finalization/hosted status and unresolved risks. The next task remains untouched.
