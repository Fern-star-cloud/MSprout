# UI-09 — People lists, details and protected management

Qualified on 2026-10-11; this is the reviewed pre-finalization record. One task commit/push is authorized only after all remaining finalization guards pass. Its Git subject is `feat: add scoped people management and protected actions`; final commit evidence resolves through Git and the ignored finalization receipt. UI-10–UI-16 remain NOT STARTED.

## Authority and checkpoint

Followed root [AGENTS.md](../../AGENTS.md), the [approved UI roadmap](../superpowers/plans/2026-10-09-uiux-implementation-roadmap.md), and [harmonized specifications](../superpowers/specs/2026-10-09-harmonized-uiux-design.md). Packs 01–05 remain the visual authority; Pack 07 sections 3.1–3.7/B06–B13 guide People workflow only. The archived Pack 07 board and design source were inspected read-only. No archived workflow expands the approved contracts.

Entry HEAD, tracking and live `origin/feat/mvp-foundation` matched UI-08 `3d330ca247726416950941f597b571535bb5321f` at 0/0. Staging was empty. Local/live main remained `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f`. Prior UI-01–UI-08 GREEN records and the UI-08 finalization receipt were verified; the stale UI-08 roadmap row is updated to its actual commit.

All eight original file bodies were compared with the UI-08 receipt and retained by SHA-256 before changes: apps/web/.env.example; docs/qa/MSPROUT_SYSTEM_HANDOFF.md; docs/qa/shared-workspace-context-verification.md; knowledge/CURRENT_STATE.md; knowledge/MANUAL_TESTING.md; knowledge/TESTING_ENVIRONMENT.md; docs/qa/manual-runs/MTQA-20261001-01/MT-02.md; and MT-APP-001-SECOND-ATTEMPT-PROCEDURE.md in that same manual-run directory. Six tracked deltas and two untracked bodies belong to prior QA work. Only separate additive UI-09 sections in CURRENT_STATE/TESTING are staged through filtered HEAD-based blobs. Original QA bodies stay out of this task commit and are restored exactly after clean commit/push finalization.

## Implemented behavior and preserved boundaries

Existing approved People navigation now leads to list-first Students, Ministries and Teachers, with explicit View, Add and Edit modes. Desktop tables use available width, wide detail splits with the list, tablet detail stacks, and phone detail replaces the list with a named Back action. Status words, captions, labels, safe loading/error/empty guidance, native dialogs and focus restoration are exposed without depending on color.

Owner Students support existing fields, authorized ministry/status filtering, server-backed detail, creation, detail editing, explicit enrollment replacement, archival and restoration. Detail PUT omits ministry_ids so ordinary editing preserves all enrollment links, including archived ones. A named enrollment dialog explains replacement and active-ministry validation. Archive/restore confirmations name the student and preserve attendance/audit history. Ministries expose existing name Add/Edit and named archive/restore confirmations. No unsupported student fields, family management or bulk operations were added.

Teacher My ministries and assigned roster stay read-only. Teacher detail projects permitted birthday month/day and excludes full birthdate/external reference even if an overbroad fixture supplies them. Owner management, import and transfer controls are absent. A ministry URL hint must appear in authorized choices before any filtered student request. A changed church or same-church ministry hint remounts the scoped view; assignment/access invalidation clears old presentation and suppresses late reads. No assignment is distinct from an assigned empty roster.

Teacher management uses existing paginated Teacher/invitation contracts, has_more and independent page navigation. Search explicitly covers only currently loaded authorized records/page; no global-search or total-count claim is invented. Existing can_invite/can_manage and invitation statuses gate presentation. Inviting reviews the named email/ministry selection before submission; pending invitation revocation and Teacher revocation require named confirmation. Identity-bound invitation acceptance/expiration remains the unchanged server workflow.

Ownership transfer remains a separate protected region and named confirmation, with current password, fresh authenticator code and deliberate acknowledgement. The form clears assurance material before awaiting any result. Server recent-MFA/password validation, locking, transaction/audit behavior and exactly-one-Owner invariants are unchanged. Existing successful-transfer invalidation removes protected controls and requires sign-in/MFA; browser mock proof qualifies presentation only, while actual backend tests prove assurance and concurrency.

Verified workspace context replaces routine Church ID entry. Online-only, ephemeral projections preflight current active membership and Owner MFA, preserve existing root workspace activation/coalescing, and never use a local profile as server authority. Duplicate mutation actions coalesce through a synchronous guard. Recoverable validation retains ordinary form input with allowlisted field feedback; no arbitrary server text is reflected. Authorization/network interruption clears protected presentation. Uncertain mutation outcomes require refresh/check before another action rather than inviting a blind repeat. No API, schema, audit history, encryption, lease, synchronization event/idempotency, receipt/cursor, profile or attendance-storage implementation changed. No human record/profile was operated.

## Actual validation

| Gate | Actual result |
|---|---|
| Focused People/Teacher/invitation/navigation/workspace tests | 96 tests / 5 files PASS; 43.47 s; includes 18 new People cases |
| Complete frontend suite | 494 tests / 55 files PASS; 30.46 s |
| Serial guarded isolated PostgreSQL backend | 270 tests / 1,917 assertions PASS; 137.79 s |
| Current browser matrix | 48/48 PASS across Chrome desktop/mobile and WebKit phone/tablet; zero skipped/flaky/global-error substitutions |
| Typecheck, ESLint, production PWA build | PASS; existing bundle-size advisory is informational |
| Actual api:check and generated-client preservation | PASS; generated client restored byte-for-byte, no contract diff |
| Strict complete structure script | PASS using repository LF body in read-only Alpine |
| Pint / strict Composer validation | PASS |
| Composer audit / pnpm high audit | PASS; zero known advisories |
| Initial relevant OWASP scan | 98 rules / 77 targets / 0 findings; all production parsed |
| Final changed/directly relevant OWASP scan | 98 rules / 50 targets / 0 findings / 0 errors; fully parsed |
| Gitleaks current tracked/new source and history | Final full-source scan and 60-commit history PASS; zero findings |
| Whitespace, local references, original-body preservation | PASS before staging; exact staged review/finalization guards required |

Root verify constituents were executed separately, without claiming the aggregate wrapper ran. Process-scoped Node 24/pnpm 10/PHP 8.3, trusted CA and WebKit 2336 setup follows TESTING_ENVIRONMENT. TLS stays enabled; no global host/security change occurred. Backend tests were serial against the guarded isolated test database.

Focused TDD observed failures for list-first modes, named confirmations, scoped projection, safe field feedback, ministry-hint remount and no-assignment guidance before their corrections. The first aggregate run exposed duplicate workspace activation checks; the shared boundary's existing coalescing behavior and its tests were preserved and the local hook corrected. Subsequent complete suites passed. Existing Teacher tests retain their valid assertions and now open details/review confirmations explicitly; can_manage denial is also verified inside detail. The navigation fixture matches the supported archived ministry query, avoiding an unintended loopback proxy request.

The current matrix includes 12 new UI-09 outcomes plus 36 fresh navigation/import regressions. It exercises actual browser keyboard focus, dialog trapping/Escape/return, named cancellation with zero mutations, supported request bodies, Owner/Teacher restrictions, wrong-church denial, revocation, invitation pagination/expiration, protected transfer failure/success presentation, Axe serious/critical thresholds, five widths (320/390/768/1024/1440), enlarged text, forced colors in supporting Chrome projects and reduced motion. Screenshots were visually reviewed. Earlier browser failures remain recorded: unused detail-column width, focus obscured by phone navigation and WebKit native-option paint overflow. Final scoped layout, focus handling and select paint containment close those failures; assertions were not disabled or relaxed. The initial matrix's 46 passes/two WebKit failures is retained and superseded by the current complete green matrix.

## Evidence reuse, review and qualification

The final 494-test aggregate follows the ministry-hint/access correction. Later changes are scoped CSS and an additional assertion in an existing Teacher test; current focused/type/lint/build/browser/scanner evidence proves those changes. They do not affect persistence, shared bootstrap/authorization, backend, contracts, dependencies or synchronization guarantees, so aggregate/backend/contract/audit results remain valid under AGENTS effect-based invalidation. Previous UI-01–UI-08 qualification remains applicable to unchanged profile, attendance, transfer and storage engines.

Unchanged server/cryptography/infrastructure comprehensive security evidence remains applicable. This run explicitly reviews People authorization, untrusted fields and protected mutation boundaries. The initial relevant scan has one partial generic mock parse span in unchanged AuthScreen.test.tsx line 9, reviewed against HEAD; no production parse failure is accepted. Final coverage includes every changed/new application input and directly relevant transport/workspace/UI/server-policy/action/model inputs with no parse errors or suppression. Gitleaks copies complete tracked/new source, including a text alias of the lockfile, while ignored credentials/runtime data/dependencies/build output are excluded. Runner/scanner receipts remain ignored under .git/msprout-ui09-20261011.

One complete source/diff review covers task scope, existing tests/work, authorized projections, stale generations, mutation coalescing, cancellation, field redaction, confirmation/focus, unchanged contracts/server tenant/RLS/MFA/audit/concurrency behavior, and absence of UI-10 work. The remediation queue is closed: no BLOCKING or SHOULD FIX finding remains. Current knowledge records verified behavior and distinguishes this pre-finalization record from the actual commit/push receipt.

Browser engines and emulated viewports are qualified. Physical devices, human screen-reader operation, actual 400% browser zoom, hosted CI and live human identities are not claimed. Existing brand/deployment qualifications remain unchanged. These limits do not waive applicable automated, security or deployment controls. Stop after the single authorized UI-09 commit and normal feature-branch push.
