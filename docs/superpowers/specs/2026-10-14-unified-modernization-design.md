# MSprout Unified Modernization Design Specification

2026-10-14 (Asia/Taipei). Stakeholder-approved canonical design specification established by DOC-GOV-01, including the approved progress-indicator correction. **Approval of the baseline does not approve unresolved proposals or authorize UI implementation.** Use current project knowledge through the documentation index for task selection and delivery status; future implementation requires its own authorization and acceptance. [Index](../../INDEX.md) · [Roadmap](../plans/2026-10-14-unified-modernization-roadmap.md) · [Supersession](../../history/SUPERSESSION_REGISTER.md).

## 1. Approved direction and preservation

One premium, minimalist, responsive MSprout system across existing and subsequently authorized screens. Preserve light blue-white surfaces, navy headings, approved MSprout branding/sprout provenance, blue primary actions, approved blue gradients as the starting point, green success semantics and compact balanced compositions. Preserve internal MinistrySprout identifiers, routes, cryptographic labels, cache identities and data structures.

UX-03–08 are completed engineering checkpoints and may be improved by separately selected retrofit tasks. Packs 06–12 are references, not exact mockups to copy. The 125-page master PDF is HISTORY ONLY. Existing behavior, accessibility, privacy, authorization, tenant isolation, encrypted work, synchronization and performance remain constraints; visual art cannot authorize unsupported functionality.

## 2. Proposed visual standards

These are the accepted planning baseline's proposed implementation standards, subject to task-specific browser acceptance. They are not a claim that current screens already use these values.

| Area | Standard |
|---|---|
| Typography | One system/local stack. Page title 24px; sections 20/18px; body 16px; controls/supporting text 14px. Do not hide essential information in tiny text. |
| Spacing | 4/8/12/16/20/24/32/48px. Content-driven spacing; no equal-height empty cards without purpose. |
| Content | Standard maximum 1152px; focused forms generally 640px. Preserve justified workflow exceptions. Gutters 24px desktop, 20px tablet, 16px phone. |
| Navigation | Preserve role destinations, context, and established 1024px desktop / 768px tablet boundaries; labeled phone navigation. Exact shell geometry requires browser approval. |
| Geometry | Inputs 8px radius; standard buttons/cards 12px; documented compact-control variants. Targets at least 44px. |
| Colors | Navy #102C46, blue #1565D8, emerald #087754, white, soft blue #EAF3FE, canvas #F1F6FC. Reuse current approved blue gradients initially. |
| Borders/focus | Functional boundaries and focus must meet applicable contrast requirements; pale decoration cannot be the sole input boundary. Existing #7C91A2 is a control-border starting point, not blanket compliance evidence. |
| Surface/motion | Restrained shadows; short meaningful transitions; respect reduced motion; no decorative loading delays. |

Absent, Unmarked and failure remain distinguishable. Existing accepted Absent treatment is the starting point; do not make ordinary absence equivalent to an error. Late uses a clock and text; **purple remains proposed**. Color cannot be the sole status cue.

## 3. Shared ownership and interaction contract

| Owner | Responsibility | Boundary |
|---|---|---|
| Tokens/foundational styles | Font, spacing, color, borders, focus and motion | One canonical system; temporary migration adapters must share it and have removal ownership. |
| Existing UI primitives | Buttons, fields, summaries, dialogs, tabs, badges, loading/empty states | Extend working primitives first. |
| Shared layout | Page headers, action toolbars, responsive containers, navigation presentation | Preserve routes, verified role/context and authorization. |
| Shared feedback | Toasts, banners, field feedback, announcements | Reflect actual durability and known outcomes. |
| Shared progress primitives | Appropriate progress bars, compact steppers and indeterminate loading presentation | Consume verified workflow state; feature owners supply measurable values, actual stage completion and contextual descriptions. Do not create a second source of progress truth. |
| Feature screens | Domain wording, permitted actions, workflow composition and states | No duplicate token systems or client-only authorization. |
| Domain/API/offline modules | Persistence, encryption, leases, sync, authorization and contracts | Outside presentation tasks except separately approved functional work. |

- One dominant action per context. Header actions on desktop; predictable wrapping on phones. Cancel before confirmation; Back before Continue. Keep destructive actions separated and consequence-specific.
- Primary, secondary, quiet, icon-only and destructive controls have consistent busy/disabled/focus behavior. Never silently drop duplicate-submit protection or idempotency.
- Visible field labels; linked errors; error-summary links/focus; preserve non-secret input. Validate at meaningful boundaries; do not erase progress on recoverable failure.
- Use wizards only for actual sequential work. Preserve Back progress; show current/completed/error steps and real prerequisites, not invented progress percentages.
- Brief deduplicated success/info toasts may follow verified outcomes; no focus theft. Persistent field errors, unknown outcomes, authorization problems and recovery requirements stay actionable. No child/private data in notifications.
- Distinguish saved locally, queued, uploaded and downloaded. Online does not mean synchronized; pending/unknown is not success.
- Dialogs require a reason, named target/consequences, accessible title, focus containment/restoration and safe Escape behavior. Do not confirm every routine action.
- Use breadcrumbs only for useful real hierarchies; preserve URLs, native modified clicks, history, focus/scroll and church context.
- Keep search/filter/reset/result counts consistent. Differentiate no data from no matching results. Use responsive tables/cards without losing relationships or actions.

| Meaning | Icon/text rule |
|---|---|
| Online / Offline | One deliberate connection indicator, accessible state; never substitute for sync progress. |
| Present / Absent / Late / Unmarked | Check / distinct absence symbol / clock / neutral unmarked symbol; discoverable labels and programmatic state. Late is separately gated. |
| Archive / Restore / Delete | Distinct icons and verbs; do not substitute destructive deletion for archive. |
| Edit / Search / Sync | Existing consistent icon family, contextual accessible names. |
| Warning / Error / Success | Wording plus symbol/shape, not color alone. |

Icon-only actions require 44px targets, visible focus, appropriate tooltip and touch discoverability. Keep meaningful safety-critical text. No new framework, router, table engine, dependency or generic capability infrastructure without demonstrated need and separate approval.

### 3.1 Progress indicators

**APPROVED documentation requirement:** the stakeholder's DOC-GOV-01 review correction establishes these conventions for future authorized UI work. No component or application behavior is implemented by this specification.

- Use a progress bar, stepper or loading indicator only when it helps explain a real operation. Use determinate bars only when reliable completed work and a meaningful total are measurable. Label the measured stage; a stage percentage is not overall workflow completion.
- Never fabricate percentages, step completion, estimates or progress derived from elapsed time. Do not convert the current step number into a completion percentage. Reaching the end of a transfer does not prove server acceptance, durable local application, authorization validity or overall success.
- Use compact accessible step indicators for genuine multistep workflows. Show the actual current step and verified completed steps; retain incomplete/error states and preserved Back/Resume behavior. Step count describes workflow position, not time remaining.
- Use indeterminate loading when completion percentage is unknown, with a visible contextual description such as “Downloading changes.” If work is paused, offline, failed or awaiting user action, show that state and its recovery action instead of implying continuous activity.
- Give every indicator an accessible name and visible contextual description. For progress bars, prefer native progress semantics where suitable; otherwise use `role="progressbar"`. Determinate bars expose accurate range/current values (`aria-valuemin`, `aria-valuemax`, `aria-valuenow` for custom bars); indeterminate bars omit `aria-valuenow` (and native progress omits `value`). Non-bar loading indicators use appropriate status semantics without fabricated range values. Associate explanatory text with the indicator and the busy region where appropriate. See [WAI-ARIA progressbar semantics](https://www.w3.org/TR/wai-aria-1.2/#progressbar).
- For a stepper, use a meaningful ordered sequence with `aria-current="step"` on the current step; convey completion/error with text, not color alone. A step list is not a percentage progress bar. Announce meaningful stage/status changes politely without stealing focus or repeatedly announcing every visual update. See [WAI multistep form guidance](https://www.w3.org/WAI/tutorials/forms/multi-page/).
- Match MSprout's compact typography, spacing, light surfaces and restrained blue treatment. Preserve contrast, keyboard operation of any actual controls, enlarged-text reflow and reduced-motion support. Avoid unnecessary animation, stacked indicators and redundant progress messages; one coherent indicator per active stage is normally sufficient.

| Workflow | Required future application |
|---|---|
| Device Preparation | Compact actual-step indicator; indeterminate activity for unknown-duration requests. Ready/completed derives from existing validated authorization and durable preparation state, not a timer or optimistic step advancement. |
| Synchronization | Keep upload and download stages distinct. Show measurable upload progress only from verified receipts with a reliable total for that stage; cursor pagination without a reliable total stays indeterminate. Complete download only after required pages apply durably. Never equate online, sent, or a served cursor with synchronization success. |
| Student Import | Compact Upload → Review/map → Confirm selected → Results indicator using actual stage state. Show byte/row progress only when reliably exposed for that operation; otherwise use contextual indeterminate loading. Reaching Results does not imply every selected row succeeded. Preserve partial/error outcomes and same-batch reconciliation. |
| Other appropriate workflows | Choose determinate, step-based, indeterminate or no indicator from the actual operation. Do not manufacture new stages, telemetry, endpoints or domain behavior merely to display progress. |

## 4. Responsive, state and visual acceptance

Cover initial loading, refresh, empty, filtered-empty, success, partial success, validation, denied, expired session/lease, offline, local pending, conflict, stale revision, server failure, retry and unknown outcome as applicable. Never infer permission or authoritative identity from a mockup.

Require actual browser evidence at desktop/tablet/390px/320px and affected intermediate widths, keyboard/focus/dialog behavior, enlarged text, relevant forced-colors/reduced-motion, and truthful offline/error/recovery states. Target applicable WCAG 2.2 AA requirements through measured tests; do not assert blanket compliance. Browser emulation is not physical-device or assistive-technology certification.

UX-F is split into **UX-F1 foundations**, **UX-F2 entry/shell/Home/profiles**, and **UX-F3 preparation/Sync/attendance**. Each needs separate selection, affected-consumer regression proof, stakeholder visual acceptance and finalization. A global style change invalidates every materially affected screen's visual evidence; one exemplar is insufficient. Avoid global switches that silently redesign unmigrated consumers.

## 5. Late: approved capability and unresolved proposals

**APPROVED:** fourth state Present / Absent / Late / Unmarked; clock and distinguishable treatment; separate functional authorization; preserve data and permissions; no invented arrival-time tracking. **APPROVED display direction:** N/A when there are no finalized records.

| Topic | PROPOSED, not separately approved |
|---|---|
| Preferred attendance reporting | Numerator Present + Late; denominator Present + Late + Absent; report all three separately; exclude Unmarked from the rate. |
| Other empty denominator | N/A with explanation when finalized records have no eligible marked denominator. All-Absent with a positive denominator remains valid 0%. |
| Guests | Preserve current behavior/separate totals initially; rate participation and guest Late need explicit decision. |
| Bulk | Keep existing supported operations; no added bulk Late without decision. |
| Styling | Compare an accessible purple clock treatment; no approved final Late color yet. |
| N/A implementation | Derive display from counts; current API zero for empty denominator is a legacy placeholder, not meaningful 0%. Nullable wire rate deferred unless justified/qualified. |

Loading/failure/unknown data is not an established empty denominator. Do not imply that Late or N/A display is already implemented.

## 6. Compatibility proposal and mandatory proof

The prior blanket protocol-v2/HTTP-426 proposal is not approved. Focused planning inspection found that the current reader can ignore unknown attendance states while advancing its cursor, saved drafts block in-app activation, and generic compatibility errors do not provide a proven upgrade path. The server cursor records served responses, not durable client acknowledgment; retention/recovery implications must be tested.

Recommended **PROPOSED** approach: staged Late-capable readers plus narrow feature declaration only on affected surfaces. No general capability endpoint, blanket API version requirement, encryption-version bump, IndexedDB rewrite or new acknowledgment protocol is selected. An illustrative feature header and typed non-settling 409 remain proposals pending explicit COMPAT-01 contract approval, not implementation instructions.

COMPAT-01 must compare: unsafe enum-only expansion; overbroad v2/426 enforcement; reader-first rollout without negotiation (safe only with demonstrated complete client coverage); and narrowly gated representations/operations. Qualify the least invasive approved mechanism through actual old/new builds.

Required safeguards and acceptance:

1. Never send Late-bearing data to an incapable reader; never translate/omit Late or pretend a page applied.
2. Fence unsupported pull before cursor advancement or replacement lease issuance. New readers validate the whole page before durable writes/cursor change.
3. Compatibility errors do not settle outbox events or masquerade as authentication denial. Validate safe legacy uploads; fence unsupported overwrite/conflict operations.
4. Preserve profile identity, keys, envelope, drafts, conflicts, outbox and event IDs. Settle only verified receipts; replay/interruption must remain safe.
5. Freeze the actual legacy application build. A service-worker revision change using the same build is insufficient proof.
6. Test waiting workers, multiple tabs/installed windows, offline reopening, interrupted installs/assets, locked profiles and existing saved/pending work.
7. Controlled close/reopen remains PROPOSED until preservation tests prove recovery. Never bypass unsafe-work checks, force mixed-version activation, reset storage or purge work.
8. Test lost responses, expired authorization, pruned feed, receipt-retention boundaries and full bootstrap while preserving pending work. Server cursor is not upgrade-readiness evidence.
9. Hold Late activation until proof and stakeholder gates pass. If a deeper protocol is genuinely necessary, stop for a separate architecture decision.
10. After Late records exist, keep Late-capable readers even if new Late writes are disabled. Do not roll back to a reader that ignores the state.

ATT-LATE-01 then covers domain/database validation, OpenAPI/generated types, selection, encrypted records, events, sync, corrections/conflicts, history, reports and exports, with tenant/role, transaction, idempotency and migration regression proof. It is not authorized by DOC-GOV-01.
