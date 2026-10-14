# UX-08 / Pack 05 attendance and temporary guests visual review

## Explicit stakeholder visual approval and final delivery checkpoint — 2026-10-14

Explicit stakeholder authorization states: **“Stakeholder visual approval for UX-08 — Attendance & Temporary Guests is GRANTED.”** All UX-08 visual findings are closed. The accepted candidate includes 1440/1024 desktop, 768 tablet, 390/320 phone, approved MSprout branding/light surfaces/navy headings/blue primary actions, emerald #087754 Present, pale-amber Absent, softly rounded unified filters/actions, wider paired controls, divider-only rows, readable names and two-row controls at narrow widths, compact Add guest/Finalize with full accessible names, roster-first phones and all documented accessibility/security/responsive adaptations. Safe Start/Resume, guest and finalization workflows remain accepted. No further visual redesign is authorized without a newly established blocking issue.

Task identity: `feat: finalize attendance and temporary guests UX-08`, parent approved UX-07 `85795a004d7b30a142e70734662540ca0dd7b40c`, on `feat/mvp-foundation`. The exact commit SHA and normal feature-branch push resolve through Git history and `.git/msprout-ux08-finalization-20261014/finalization.json`. UX-08 is GREEN only after successful commit/push verification: clean worktree/staging, matching local/upstream/live remote HEAD, ahead/behind 0/0, unchanged local/origin/live main and intact protected work. Earlier YELLOW/pending statements are historical. STOP after verified UX-08 delivery; no UX-09, Packs 06–12 implementation, merge or deployment.

Qualified production/test inputs match `.git/msprout-ux08-geometry-20261014/final-preservation.json` exactly. Reuse valid 740/79 frontend, refreshed 80/6 focused attendance/profile, final 17 affected browser cases, native five-width accessibility/response/state evidence, 36 approved-screen comparisons, build/TypeScript/lint and relevant OWASP/security evidence. Backend 306/3626, contracts, Pint, structure and dependency checks retain valid guarantees by unchanged inputs/effect. Documentation-only approval records do not invalidate those application gates. Fresh finalization proof covers source equality, complete diff review, source-secret coverage, whitespace/links, exact staging/commit scope, original bodies, protected stash/backups/private data and Git synchronization; no diagnostic failure is relabeled as a pass.

The only production changes in the task are AttendanceScreen presentation/status wording and its scoped CSS; five test paths provide regression/evidence updates. All domain/save/guest/finalization/authentication handlers remain identical to the approved parent; backend/API/schema/contracts/dependencies/navigation/tokens/offline engines remain intact. Protected stash `1e104f06fbe3091b54e3916f612668b93f0107b4`, nine original QA/environment blobs, ten backups, private environment/SQLite, encrypted profile/attendance/sync work and approved UX-03–UX-07 are preserved. Screenshots, traces, temporary scripts/evidence, backups and credentials remain ignored and excluded from the task commit. Final review has 0 BLOCKING / 0 SHOULD FIX findings.

Exact reviewed final scope (13 paths):

- `apps/web/e2e/offline-attendance-sync.spec.ts`
- `apps/web/e2e/offline-guest-lifecycle.spec.ts`
- `apps/web/e2e/ui-attendance.spec.ts`
- `apps/web/src/features/attendance/AttendanceLifecycle.test.tsx`
- `apps/web/src/features/attendance/AttendanceScreen.test.tsx`
- `apps/web/src/features/attendance/AttendanceScreen.tsx`
- `apps/web/src/styles/attendance-lifecycle.css`
- `docs/qa/ux-08-attendance-guests-visual-review.md`
- `knowledge/CHANGELOG.md`
- `knowledge/CURRENT_STATE.md`
- `knowledge/README.md`
- `knowledge/ROADMAP_STATUS.md`
- `knowledge/TESTING_ENVIRONMENT.md`

Finalization adds this approval entry and five knowledge records; all prior review bodies, native captures, measurements, failed diagnostics and qualified source/test snapshots remain preserved. The latest measured component review below defines the accepted implementation and justified artwork adaptations. GREEN is assigned only by the verified delivery receipt after commit and push.



## Latest component geometry and visual fidelity correction — 2026-10-14

**YELLOW — visual approval explicitly withheld; stakeholder review pending.** This component-level correction supersedes the superficial 8px-corner candidate and its earlier acceptance wording below. Original Pack 05 and all prior snapshots/screenshots/reports remain preserved. No finalization, deployment or UX-09.

### Measured comparison and corrections

The original native artwork has approximate solid-fill extents of **159×39 raster pixels** for desktop Present (aspect 4.08) and **87×33** for mobile Present (aspect 2.64). These are painted raster bounds, not designer CSS or a claimed equivalent CSS viewport. [Native artwork measurements](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-geometry-20261014/artwork-measurements.json>) bind source hash and pixel regions. Entry native CSS controls were 87×44px desktop/tablet (aspect 1.98) and 66×44px phone (1.50), with 6px/4px pair gaps. At 320px the fixed controls left names only 72px, wrapping the four normal synthetic names onto two lines. Increasing the radius alone left those proportions and nested frames intact.

- **Present/Absent:** the paired column now ranges from 224 to 268px desktop/tablet and is 168px at 390px, with an 8px gap. State controls use 12px corners, centered icon/label with a 4px gap and 8px vertical padding. Desktop/tablet labels remain 13px; phone labels improve from 12 to 13px. The result is wider coherent choices rather than narrow utility rectangles, while retaining 44px height and truthful pressed/disabled state.
- **Filters:** content-sized desktop controls replace four stretched equal cells; a smaller search flex basis allows search and filters to share one line at 1024px. Filters share light #f8fbff fill, 14px corners, a 52px minimum width and 6px gaps, with the unchanged blue gradient for selection. Phones retain a four-column group with a 52px All and sufficient Unmarked width. Corners remain below the 22px half-height, rather than full pills.
- **Rows:** the roster's enclosing border and rounded frame are removed. Avatars, full names and state badges remain, separated by light 1px row dividers; no individual row boxes are introduced. Removing horizontal row padding recovers useful width, while 6px vertical padding preserves compact desktop/390px density.
- **320px:** below 360px, each normal student has an avatar/name/state line followed by a full-width control pair. Name width becomes 226px; all four normal synthetic names occupy one line. Rows become 90–91px rather than 68–69px: a deliberate readability/target adaptation, not vertical stretching. Long names wrap without truncation. Guest names retain full width and their explicit Temporary guest / Present label. The action footer flows below this two-row roster so it cannot cover the last student's choices; 390px and wider retain the existing sticky/compact behavior.
- **Actions:** the nested boxed footer becomes a simple top divider, without side borders or shadow. Visible actions are **Add guest** and **Finalize**, each remaining one line and 44px high on phones. Full wording and confirmation/explanations remain: accessible names are `Add guest — Add temporary guest` and `Finalize attendance`. Retaining the former full phrase while beginning with the short visible label preserves speech-input compatibility and existing browser selectors. [W3C Label in Name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html) supports including visible text in the accessible name. No handler, disabled predicate, confirmation or domain operation changed.

| CSS viewport | Present width before → corrected, height | Name column before → corrected | Current row height | All / Present / Absent / Unmarked widths | Action area height / positioning |
|---|---|---|---|---|---|
| 1440 | 87 → 130 × 44px | 608 → 538px | 56–57px | 52, 66.8125, 62.4844, 81.9688px × 44px | 57px / sticky |
| 1024 | 87 → 108.625 × 44px | 240 → 212.734px | 56–57px | 52, 66.8125, 62.4844, 81.9688px × 44px | 57px / sticky |
| 768 | 87 → 108 × 44px | 436 → 410px | 56–57px | 52, 66.8125, 62.4844, 81.9688px × 44px | 57px / sticky |
| 390 | 66 → 80 × 44px | 142 → 120px | 56–57px | 52, 81.875, 81.875, 98.25px × 44px | 104.234px / sticky |
| 320 | 66 → 127 × 44px | 72 → 226px | 90–91px | 52, 60, 60, 72px × 44px | 104.234px / static |

All outer panel x/width and roster-start values remain entry-exact at the five viewports; both desktop panel tops remain exact. Tablet/phone session context naturally follows the corrected roster/footer height: the 1152px workflow cap, sidebar/header proportions and white/light composition are unchanged. Panel content height changes only with the documented controls/footer/reflow. At 1440px, Present now has aspect 2.95; at 390px 1.82, and at 320px 2.89. Exact raster ratios are intentionally adapted to available production width and 44px targets. No screen enlargement, filler, heavy background or card stretching.

Emerald Present remains **#087754 / white, 5.56:1**. Absent retains pale #fff0c2→#ffdf92 with dark #493503 (9.04–10.31:1); actions/navigation remain blue, headings navy, cards white, canvas light. Selected/save/read-only colors, border colors and opacity are measured unchanged. Focus remains 3px blue with 3px offset, including hovered keyboard focus; pointer hover/pressed remains distinct and forced colors retain system styling and the 2px selected border. Rounded corners, widths and uncluttered separators are evaluated together.

### Actual native before/corrected comparisons

- [Before 1440](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-geometry-20261014/visuals/before-1440.png>) / [Corrected 1440](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-geometry-20261014/visuals/corrected-1440.png>)
- [Before 1024](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-geometry-20261014/visuals/before-1024.png>) / [Corrected 1024](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-geometry-20261014/visuals/corrected-1024.png>)
- [Before 768](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-geometry-20261014/visuals/before-768.png>) / [Corrected 768](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-geometry-20261014/visuals/corrected-768.png>)
- [Before 390](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-geometry-20261014/visuals/before-390.png>) / [Corrected 390](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-geometry-20261014/visuals/corrected-390.png>)
- [Before 320](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-geometry-20261014/visuals/before-320.png>) / [Corrected 320](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-geometry-20261014/visuals/corrected-320.png>)

[Native comparison viewer](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-geometry-20261014/native-comparison.html>) keeps the original artwork and equal-viewport before/corrected pairs at their natural dimensions; horizontal scrolling replaces image rescaling. Every screenshot is a production render at the named CSS width × 900px, DPR 1, scale:css, unedited. [Computed CSS](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-geometry-20261014/computed-css.json>), [component measurements](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-geometry-20261014/component-comparison.json>) and [capture provenance](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-geometry-20261014/capture-provenance.json>) record actual rectangles, typography, spacing, radii, colors and hashes.

Additional evidence: [320px action/focus/navigation clearance](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-geometry-20261014/visuals/geometry-actions-320.png>) / [390px action/focus/navigation clearance](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-geometry-20261014/visuals/geometry-actions-390.png>) / [Guest dialog](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-geometry-20261014/visuals/geometry-guest-dialog-320.png>) / [Durably saved guest](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-geometry-20261014/visuals/geometry-saved-guest-320.png>) / [Pending encrypted save](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-geometry-20261014/visuals/saving-disabled-present-320.png>) / [Finalized read-only](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-geometry-20261014/visuals/readonly-disabled-present-320.png>) / [Forced colors](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-geometry-20261014/visuals/forced-colors-320.png>). At 320px the initial viewport prioritizes readable roster choices; scroll to the footer for its complete actions. Neither the footer nor bottom navigation covers an attendance choice, and focused actions are clear of navigation. Screenshots use only synthetic data in isolated browser contexts with intercepted HTTP and real WebCrypto/IndexedDB; no live/human profile or database work.

### Validation, review and preservation

**17 unique affected browser cases PASS:** native component/state proof plus Chrome phone and WebKit tablet variants, with two independent WebKit phone layout/state cases (5), and unchanged repository filter/mark/finalization, guest quota/cancel/encrypted restart, and long-name/dialog reflow cases across four targets (12). No failed/unrun case is relabeled as a pass. Checks cover five native widths, 320/390 label fit, wider paired proportions, no state/footer intersection, 44px controls, one-line action text, keyboard/hover/pressed/focus, disabled/read-only, guest dialog and finalization focus containment/return, long names, enlarged text, forced colors and no serious/critical WCAG 2/2.1 A/AA Axe findings.

The real-save probe holds WebCrypto before the encrypted transaction commits: the previous durable Present remains selected and disabled, Absent remains false, Saved success is absent, and all stores/outbox remain exact. Release selects the actual committed Absent with one event. Actual guest save adds one event and raw name is absent from encrypted records; cancellation writes nothing. Finalization remains read-only/Pending Sync, independent from server acceptance. Existing filters/counts/guest/recovery/authorization/encryption engines remain unchanged.

**80/6 focused attendance/profile tests, production build/TypeScript and lint PASS** after final corrections. New unit assertions prove short visible text plus full accessible names and label-in-name. Entry geometry and short-label assertions failed before correction as expected. A probe-only DOMRectList filtering mistake and an editing-helper Windows-encoding mistake were diagnosed and corrected; failed logs/traces are preserved separately and actual passing closures control this report. The combined WebKit phone probe exhausted its cumulative 90-second budget twice near finalization; its final snapshot showed the bulk save committed with 0 unmarked students. Every assertion was then retained in two independently prepared phone cases: layout/accessibility and actual encrypted save/guest/finalization/forced colors. Both completed with the original 90-second timeout. The matrix's two original passing cases are retained; failed phone attempts remain diagnostic failures and the split cases provide actual replacement coverage. Source files validate UTF-8. The intermediate 320px sticky-footer overlap was eliminated by the scoped static-footer rule and explicit no-overlap assertion. No assertion, timeout or security rule was weakened.

Prior full frontend 740/79 (with its affected attendance/profile portion refreshed here), other initial browser/contract/backend 306/3626/Pint/structure/dependency/security evidence remains valid by exact inputs and effect. Prior 36 approved-screen pairs are retained: CSS selectors and the single rendered action line affect Attendance only; shared navigation/tokens/router and approved UX-03–UX-07 inputs remain entry-exact. Full backend/dependency/OWASP scans are not repeated for label/layout changes with unchanged trust boundaries. Fresh source-secret, diff/links, final source/test review, preservation and Git checks bind closure. Reviewer queue: **0 BLOCKING / 0 SHOULD FIX**.

This correction changes exactly eight paths: scoped CSS, AttendanceScreen rendered action line, AttendanceScreen.test presentation assertions/guest name, AttendanceLifecycle.test exact guest accessible-name queries, this report, CURRENT_STATE, README and TESTING_ENVIRONMENT. Existing browser tests and all other inputs are entry-exact; tests retain their assertions. Overall candidate remains the existing twelve unstaged paths; ROADMAP_STATUS is unchanged YELLOW. Protected stash `1e104f06fbe3091b54e3916f612668b93f0107b4`, nine original blobs, ten backups, private environment/SQLite, approved UX-03–UX-07 and prior document bodies remain preserved. HEAD `85795a004d7b30a142e70734662540ca0dd7b40c`, feature branch 0/0 and main unchanged. Owned static fixture servers are stopped at closure. No staging/commit/push/merge/deployment/UX-09.

Exact designer CSS/font metadata and physical-device/human screen-reader certification remain outside synthetic evidence. All original-artwork adaptations above are justified by production context, readable names, truthful information and accessible interaction. **STOP at YELLOW for stakeholder visual approval.**



## Latest attendance button shape correction — 2026-10-14

**YELLOW — stakeholder visual approval pending.** This entry supersedes the button-corner geometry in earlier color screenshots below. Earlier reports, source snapshots, screenshots and failed diagnostic traces remain preserved. This is the requested shape refinement only; no finalization or UX-09.

The original native Pack 05 artwork remains the reference: its mobile filters have softer outlines and its state/action controls have rounded corners with a compact body. Raster artwork does not establish an exact CSS radius. Entry computed CSS was **6px** for all four roster filters and attendance `.ui-button` actions, and **5px** for per-student Present/Absent. The controls now consistently use existing `var(--radius-small)`, resolving to **8px** on all four corners. This is a moderate rounded rectangle, well below the 22px half-height of a 44px control, and avoids a fully pill-shaped treatment. Start/Resume, bulk marking and guest/finalization dialog buttons inherit the same attendance-scoped refinement; shared components and completed screens remain unchanged.

Only two `border-radius` values changed in production CSS. Width, height, min-height, padding, font, border width/color, gaps, placement, sticky behavior and responsive rules are entry-exact. Emerald Present remains #087754 with white text (5.56:1); pale-amber Absent and blue primary/filter actions are unchanged. Saving/disabled/read-only selections retain opacity 1 and their truthful durable state. The prior 3px keyboard ring remains intact even when hovered, and forced colors retain system colors, automatic adjustment, clear labels and the 2px selected border.

### Actual geometry and refreshed production captures

| CSS viewport | Roster panel width | Row height range | Selected Present width × height | All / Present / Absent / Unmarked widths × height |
|---|---|---|---|---|
| 1024 | 524px | 56–57px | 87×44px | 118, 118, 118, 118px × 44px |
| 1440 | 892px | 56–57px | 87×44px | 104.25, 104.25, 104.25, 104.25px × 44px |
| 768 | 720px | 56–57px | 87×44px | 82.75, 82.75, 82.75, 82.75px × 44px |
| 390 | 358px | 56–57px | 66×44px | 44, 84.375, 84.375, 101.25px × 44px |
| 320 | 288px | 68.1719–69.1719px | 66×44px | 44, 62.5, 62.5, 75px × 44px |

All recorded roster/context/filter/state/action rectangles match the preceding color checkpoint exactly at these five widths. Only corner clipping changes. No padding/fit workaround or enlargement was necessary; labels remain legible at 320/390px, Unmarked stays whole, and Add temporary guest retains the validated two-line phone label. All attendance marking/filter/action controls retain at least 44px interaction height. Existing long-name/enlarged-text checks cover taller rows without clipping or changes to saved work.

- [Desktop 1440](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-shape-20261014/visuals/rounded-active-1440.png>) / [Desktop 1024](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-shape-20261014/visuals/rounded-active-1024.png>) / [Tablet 768](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-shape-20261014/visuals/rounded-active-768.png>)
- [Mobile 390](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-shape-20261014/visuals/rounded-active-390.png>) / [Mobile 320](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-shape-20261014/visuals/rounded-active-320.png>)
- [Guest dialog 320](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-shape-20261014/visuals/rounded-guest-dialog-320.png>) / [Saving selection 320](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-shape-20261014/visuals/saving-disabled-present-320.png>) / [Finalized selection 320](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-shape-20261014/visuals/readonly-disabled-present-320.png>) / [Forced colors 320](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-shape-20261014/visuals/forced-colors-320.png>)

Screenshots are native production renders at DPR 1 and scale:css, with 900px CSS height. They are unedited and use disposable synthetic identities and intercepted HTTP, with real encrypted IndexedDB/WebCrypto. [Computed CSS](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-shape-20261014/computed-css.json>) and [geometry/capture provenance](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-shape-20261014/capture-provenance.json>) bind the colors, radii, dimensions and screenshot hashes. Original artwork and preceding native screenshots remain linked in historical sections for equivalent-viewport comparisons.

### Affected validation, review and preservation

**12/12 affected browser cases PASS, without skips/retries/flaky results:** one new native geometry/state probe plus three Chrome phone/WebKit phone/tablet variants, and eight unchanged repository marking/filter/finalization and long-name/dialog reflow cases across four browser targets. The native shape assertion failed against the entry production build at the expected 5/6px corners, then passed after the two CSS changes. Diagnostic evidence remains preserved. Checks include 320/390 text fit, all five viewport layouts, 44px targets, keyboard focus/hover/pressed, guest-dialog focus/return, finalization dialog focus containment/return, sticky actions/bottom navigation, enlarged text and forced-colors Axe checks with no serious/critical WCAG 2/2.1 A/AA findings.

The inherited real-save probe still holds WebCrypto before the transaction commits: the previous durable Present remains selected/disabled, Absent remains unselected and all stores/outbox remain exact. On release, the committed selection changes with its actual event. Guest cancellation and visual probes preserve saved work; finalized selections remain disabled and readable. No handler, count, guest/finalized logic, authorization, encryption, persistence or synchronization input changed.

Production build/TypeScript PASS. Prior 740/79 frontend, 80/6 focused, 84 unique browser qualification, 36 pixel-identical approved-screen pairs, backend 306/3626, contract, lint, structure, dependency and OWASP security evidence remains valid by exact inputs and effect. Radius-only selectors scoped within `.attendance-screen` invalidate local visual/reflow/accessibility proof and the CSS build; they do not affect unrelated screens or trust boundaries. Fresh source-secret, whitespace/link, source-hash, preservation and Git checks qualify closure. Screenshots/traces/build outputs remain ignored under `.git/msprout-ux08-shape-20261014/`.

This correction changes exactly attendance-lifecycle.css, this review report, CURRENT_STATE, README and TESTING_ENVIRONMENT. All other source/tests are byte-exact to entry. ROADMAP_STATUS stays YELLOW and unchanged. The overall candidate still contains exactly twelve unstaged paths at `85795a004d7b30a142e70734662540ca0dd7b40c` on `feat/mvp-foundation`, feature 0/0, main unchanged. Protected stash `1e104f06fbe3091b54e3916f612668b93f0107b4`, nine original blobs, ten backups, private environment/SQLite, approved UX-03–UX-07 and every prior review/knowledge body remain preserved. Owned fixture servers are stopped at closure; no human browser or database was used.

**0 BLOCKING / 0 SHOULD FIX remain.** Exact designer corner metadata and physical-device/human screen-reader certification are outside this synthetic evidence. STOP at YELLOW for stakeholder visual approval; no stage, commit, push, merge, deployment or UX-09.



## Latest attendance color consistency review — 2026-10-14

**YELLOW — stakeholder visual approval pending.** Stakeholder accepts the overall desktop/390/320 attendance presentation; the remaining requested color audit is complete. This entry supersedes the selected teal fill and associated screenshots below. All earlier implementation/qualification bodies and diagnostic evidence remain preserved; no finalization or UX-09.

### Measured color decision

Actual qualified computed CSS used white text with `linear-gradient(110deg, #005c63, #004b51)` and #004b51 border. The original Pack 05 raster also depicts a dark teal Present fill; its sampled pixels and native source hash are recorded in [color audit](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-color-20261014/color-audit.json>). Thus the earlier choice followed the artwork rather than the established emerald token. Root `--color-success`, Home, Preparation and Sync use #087754. The stakeholder's current preference justifies substituting the shared token for selected Present while preserving the board's white-on-green selection, pale-amber Absent and blue action/navigation hierarchy.

Selected Present now uses solid `var(--color-success)` for background and border, resolving to **rgb(8,119,84), #087754**; text/icon remain white and weight 600. Blue primary actions and white unselected controls remain exact. Absent remains #fff0c2→#ffdf92 with #493503 text and #e5c779 border. These are ordinary attendance selections, not server-success/error classifications. No dimension, typography, spacing, layout, behavior, persistence or data-state change.

| Contrast/state | Actual result |
|---|---|
| White text on selected emerald | **5.56:1**, including saving/read-only disabled selection, opacity 1 |
| Earlier white-on-teal reference gradient | 7.75–9.88:1; both treatments pass normal-text AA |
| Dark text on pale-amber Absent | 9.04–10.31:1 across the gradient |
| Blue keyboard focus against white / light canvas |5.41:1 / 4.98:1; 3px ring with3px offset |
| Pointer hover / active | Selected emerald stays exact; pointer-only 1px blue hover outline remains |
| Keyboard focus plus hover | **3px ring/3px offset retained**; focused hover no longer overrides it |
| Forced colors | System colors/automatic adjustment, 2px Highlight selected border, visible labels and unchanged aria-pressed |

The audit reproduced an existing cascade defect: the more-specific hover outline shrank a keyboard-focused control's ring to 1px. A focused real-browser failing check verified this; CSS now applies the pointer-only hover rule only when `:focus-visible` is absent. The passing closure proves keyboard focus remains 3px even with the pointer over the control. This is the only change beyond the requested selected fill/border, and remains scoped to attendance marking controls.

### Actual current screenshots and states

- [Desktop 1440](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-color-20261014/visuals/emerald-active-1440.png>) / [Desktop 1024](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-color-20261014/visuals/emerald-active-1024.png>) / [Tablet 768](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-color-20261014/visuals/emerald-active-768.png>)
- [Mobile 390](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-color-20261014/visuals/emerald-active-390.png>) / [Mobile 320](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-color-20261014/visuals/emerald-active-320.png>)
- [Saving: previous durable Present stays selected and disabled](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-color-20261014/visuals/saving-disabled-present-320.png>)
- [Finalized/read-only: durable selection remains legible](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-color-20261014/visuals/readonly-disabled-present-320.png>)
- [Forced-colors selected state](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-color-20261014/visuals/forced-colors-320.png>)

Native actual production captures use DPR1, scale:css and equivalent 1024/1440/768/390/320×900 viewports. No image is resized, recolored or reconstructed. Roster/context/filter rectangles match the preceding qualified captures exactly at all five widths. Full actual normal/disabled/forced CSS and capture hashes: [computed colors](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-color-20261014/computed-css.json>) and [provenance/geometry](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-color-20261014/capture-provenance.json>). Existing Pack 05/reference comparisons below remain historical teal comparisons; the current screenshots above control this color review.

### Affected qualification and preservation

**8/8 affected browser cases PASS:** one native desktop color/state case, the same case in Chrome phone and WebKit phone/tablet, and four existing marking/filter/finalization/focus/enlarged-text regressions. Native checks exercise all five viewports and Axe with no serious/critical WCAG2/2.1 A/AA findings. They verify actual emerald/white/amber computed values, pointer hover/active, keyboard focus including hovered focus, 44px targets, saving and disabled states, forced colors and truthful pressed states.

The synthetic saving probe holds WebCrypto before the real encrypted transaction commits. Until release, Present remains the prior durable selection, Absent stays unselected, controls are disabled, Saving is shown, and all IndexedDB stores/outbox count are exact. After release, only the actual committed change selects Absent and adds its event. Local finalization still disables editing and retains correct selected colors; no CSS implies server acceptance.

The initial WebKit color-probe store comparison ran before its last setup mark committed. The corrected probe explicitly awaits each mark's actual pressed state and enabled control before taking its baseline; all original store-equality assertions remain. Passing closures supersede those diagnostic failures, whose logs/traces are preserved. No production data/save correction or weakened timeout/assertion was used.

Latest production build/TypeScript PASS. Prior 740/79 frontend, 80/6 focused, 84 unique browser qualification, 36 identical approved-screen pairs, backend 306/3626, contracts, lint, structure, audits and OWASP security remain valid by unchanged inputs/effect. This isolated color/focus selector change does not affect trust boundaries or invalidate backend/unit/contract/dependency scans. Fresh final document/source-secret, whitespace/link, source/hash and protected-work checks bind this correction; detailed receipts remain ignored under `.git/msprout-ux08-color-20261014/`. No expensive suite is unnecessarily repeated; failed diagnostic evidence is retained.

Correction-only paths: attendance-lifecycle.css, this report, CURRENT_STATE, README and TESTING_ENVIRONMENT. All attendance TypeScript/tests/handlers/engines/counts/guest/finalized logic are byte-exact to the entry checkpoint. ROADMAP_STATUS remains entry-exact because status stays YELLOW. Approved UX-03–UX-07, all unrelated source, stash `1e104f06fbe3091b54e3916f612668b93f0107b4`, nine original blobs, ten backups and private environment/SQLite remain preserved. The overall candidate still has exactly twelve paths. HEAD remains `85795a004d7b30a142e70734662540ca0dd7b40c`, staging empty, feature 0/0 and main unchanged. All owned fixture servers are stopped at closure; no human browser or development database operation.

**0 BLOCKING/0 SHOULD FIX remain.** Solid emerald is a deliberate small adaptation from the board's teal to improve the established application palette, while retaining readable white-on-green, pale amber and blue hierarchy. Physical devices/human screen-reader certification remain outside synthetic evidence. STOP at YELLOW for explicit stakeholder visual approval; no stage, commit, push, merge, deployment or UX-09.


2026-10-14, Asia/Taipei. **YELLOW — stakeholder visual approval pending.** UX-08 alone is implemented and technically qualified, unstaged/uncommitted/unpushed at approved UX-07 `85795a004d7b30a142e70734662540ca0dd7b40c` on `feat/mvp-foundation`. STOP here; no later UX task, merge or deployment.

## Authority, exact scope and preservation

The explicit pasted UX-08 request selects this task. The attached master PDF's historical planning/approval text is source context, not operational authorization. Its original Pack 05, page19, contains the unscaled1548×1016 board inspected for this task. The latest stakeholder visual/branding/density addendum governs original-artwork fidelity; approved architecture, existing UI-08 verification and real security/data/accessibility semantics remain authoritative. No nested AGENTS was found.

Exactly twelve changed paths:

- `apps/web/src/features/attendance/AttendanceScreen.tsx`
- `apps/web/src/styles/attendance-lifecycle.css`
- `apps/web/src/features/attendance/AttendanceLifecycle.test.tsx`
- `apps/web/src/features/attendance/AttendanceScreen.test.tsx`
- `apps/web/e2e/ui-attendance.spec.ts`
- `apps/web/e2e/offline-guest-lifecycle.spec.ts`
- `apps/web/e2e/offline-attendance-sync.spec.ts`
- `docs/qa/ux-08-attendance-guests-visual-review.md`
- `knowledge/CURRENT_STATE.md`
- `knowledge/README.md`
- `knowledge/ROADMAP_STATUS.md`
- `knowledge/TESTING_ENVIRONMENT.md`

Only AttendanceScreen and its scoped CSS change production. Start/Resume, selection/save generations, duplicate-action guards, guest normalization, repository calls, confirmation and all authorization/lock/refresh handlers remain byte-exact. No shared navigation, approved UX-03–UX-07 module, API/backend/schema, storage/crypto/profile/sync engine, dependency, contract, CI or governance change.

Protected stash `1e104f06fbe3091b54e3916f612668b93f0107b4`, nine original QA/environment blobs, ten backups, private environment/SQLite and unrelated tracked source match entry hashes. All fixtures use disposable contexts, intercepted HTTP and synthetic identities with actual encrypted IndexedDB/WebCrypto. No human browser/profile, live account, development PostgreSQL or private record operation. Browser/server output and screenshots remain ignored under `.git/msprout-ux08-20261014/`.

## Implementation and design decisions

- Desktop≥1024 uses the available shared workspace with a1152px cap, a200–248px session context and a comfortably wide roster. At1440, page x256/width1152 matches Preparation and Sync. At1024, page x256/width736 retains two useful areas instead of deferring them to1280. No extra nested narrow cap or vertical filler.
- Active tablet/phone sessions show the roster first; complete session selectors, truthful status, regular/guest totals and preserved bulk actions follow immediately. Before Start/Resume, selection comes first. Actual DOM order follows the active single-column workflow; desktop uses explicit grid placement. No hidden or duplicated controls.
- Compact bordered rows use supported gender avatars, full stored/accessibility labels, explicit state badges and pressed marking controls. Teal Present and amber Absent match the board's ordinary attendance states; absence has no destructive/error semantics. Search and four filters retain their read-only behavior and full-scope finalization blocking.
- Finalize/Add guest and complete totals sit inside the roster card. This avoids a tall sidebar creating an empty gap before actions. Existing measured sticky/short/enlarged-viewport and keyboard-focus safeguards remain intact; controls clear the fixed phone navigation.
- The shared church header remains unchanged with right-aligned connectivity. Attendance's status now names upload counts and incomplete/unverified downloads rather than repeating Online or implying empty outbox means synchronized. Offline explains device-local retention. Saved feedback appears only after the existing durable save; locally finalized stays read-only and Pending Sync.
- Guest/finalization dialogs reuse the native Dialog, focus entry/trap/Escape/return, original validation and supported fields. Scoped400px/16px/8px geometry keeps them compact. Guest failures retain input, cancellation writes nothing, and successful writes followed by unknown counts do not invite duplication.

## Native production evidence

Frozen original/current builds were captured at equivalent CSS viewports:320/360/390/768/1024/1440×900, plus1548×1016; native comparison captures use DPR1 and scale:css. Full-page evidence is explicitly separate. No actual screenshot is resized, retouched or reconstructed.

- [Original/before/UX-08 desktop —1024](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/visuals/original-before-current-1024.png>)
- [Original/before/UX-08 desktop —1440](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/visuals/original-before-current-1440.png>)
- [Pack05 versus actual native1548 desktop](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/visuals/pack05-native-desktop.png>)
- [Pack05 versus actual390 phone](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/visuals/pack05-mobile.png>)
- [Actual phone390](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/visuals/native-final-active-roster-390.png>) / [Phone320](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/visuals/native-final-active-roster-320.png>) / [Phone360](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/visuals/native-final-active-roster-360.png>) / [Tablet768](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/visuals/native-final-active-roster-768.png>)
- [Before Start](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/visuals/native-final-no-draft-390.png>) / [Saved draft/Resume](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/visuals/native-final-saved-draft-390.png>)
- [Guest dialog](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/visuals/native-final-guest-dialog-390.png>) / [Guest dialog320](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/visuals/native-final-guest-dialog-320.png>)
- [Finalize confirmation](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/visuals/native-final-finalize-dialog-390.png>) / [Unmarked finalization blocked](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/visuals/native-final-active-roster-390.png>)
- [Local finalization/Pending Sync](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/visuals/native-final-finalized-pending-390.png>) / [Offline retained work](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/visuals/native-final-offline-390.png>)
- [Recoverable guest write failure — full page](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/visuals/guest-write-failure-390.png>) / [Unknown saved-work status](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/visuals/native-final-unknown-discovery-390.png>)
- [Locked profile](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/visuals/native-final-locked-390.png>) / [Actual expired lease](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/visuals/native-final-expired-profile-390.png>) / [Long ministry/enlarged text — full page](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/visuals/long-names-enlarged.png>)

The board is a composite of miniature desktop/mobile and alternative states, with no exact CSS viewport/font metadata. Its1548×1016 raster is kept unscaled on the comparison sheets; it is not falsely labeled a1024/1440 CSS screenshot. Production shows only the actual state, supported avatar assets and synthetic sample identities, never artwork names/counts as real data.

## Computed geometry and cross-screen consistency

All dimensions below are actual CSS pixels in the four-regular-student active scenario. Heights grow naturally for wrapped names and text; no fixed-height stretching. The first three phone widths and tablet are single-column; their context panel follows the active roster.

| Width | Page x / width | Context / roster width | Regular row height | Mark control | Action area height |
|---|---|---|---|---|---|
| 320 | 16 / 288 | 288 / 288 | 68.17–69.17 | 66 × 44 | 137.91 |
| 360 | 16 / 328 | 328 / 328 | 56.00–57.00 | 66 × 44 | 121.02 |
| 390 | 16 / 358 | 358 / 358 | 56.00–57.00 | 66 × 44 | 121.02 |
| 768 | 24 / 720 | 720 / 720 | 56.00–57.00 | 87 × 44 | 66.00 |
| 1024 | 256 / 736 | 200 / 524 | 56.00–57.00 | 87 × 44 | 118.00 |
| 1440 | 256 / 1152 | 248 / 892 | 56.00–57.00 | 87 × 44 | 66.00 |
| 1548 | 310 / 1152 | 248 / 892 | 56.00–57.00 | 87 × 44 | 66.00 |

Arial/Helvetica typography matches the approved device workflows: page24px/30px/700, ministry20px/25px/700, normal14px/20.3px, control13–14px and phone12px marking/filter labels with44px targets, dialog18px/23.4px. Full supporting values, fonts, weights, line heights, positions, padding, gaps, borders, gradients and colors are in [computed CSS](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/computed-css.json>). Desktop cards16px padding and8px radius, phone cards12px padding, compact row6px vertical padding,12px panel gaps,6px primary radii and5px marking radii retain the artwork's density while adapting touch targets.

Navy#102c46, muted#405c78, white/light-blue cards and#dce8f5 borders remain consistent. Primary110-degree#0768ed→#0054dc gradient matches Preparation/Sync; secondary is white/blue outlined. Selected Present#005c63→#004b51 and selected Absent#fff0c2→#ffdf92 are ordinary marking affordances. Text/icons/pressed states identify status independently of color. Focus3px and forced-color selected borders remain visible; reduced motion is scoped.

[Approved Home/Preparation/Sync/Attendance —1024](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/visuals/cross-screen-1024.png>) and [Same native comparison —1440](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/visuals/cross-screen-1440.png>) show shared page/header/rail alignment. Approved Home deliberately retains640/880px task-focused bounds and Profiles its760px private-entry frame; Attendance uses1152px for data entry alongside bounded context. Different arrangements are accepted workflow differences, not global restyling.

**36/36 approved-screen pairs are pixel-identical** (Owner/Teacher Home, Profiles, Preparation and both Sync states at six equivalent viewports). The first Sync1024 pair included unsettled review/hover presentation; that single pair was recaptured after controls/review settled with the pointer outside controls. No application correction or image edit was used. Full capture hashes/source provenance: [comparison receipt](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux08-20261014/comparison-provenance.json>).

## Qualification and evidence retention

| Gate | Actual evidence |
|---|---|
| Focused TDD | Two new status/count cases failed before correction; existing19 lifecycle cases passed. Final affected attendance/profile proof80 tests/6 files PASS, serial closure |
| Full frontend |740 tests/79 files PASS; later corrections only scoped roster/context/action markup and CSS, closed by final80 and browser checks |
| Typecheck/lint/PWA build | PASS; latest roster build includes TypeScript; latest full lint covers all seven changed app/test paths |
| Browser matrix |84 unique cases qualified across Chrome desktop/Pixel7 and WebKit iPhone/iPad. Final20 attendance/valid-lease outcomes replace earlier cases; latest12 density/reflow/dialog outcomes refresh the corresponding12 after the last CSS correction. Screenshot closure refreshes the one affected Sync case |
| Native captures/accessibility | Latest lifecycle1 PASS plus retained unknown discovery/actual expiry1 PASS; refreshed seven viewport captures/Axe, prior cross-screen audit and corrected neutral pair PASS |
| OWASP | Relevant23-input scope76 rules,0 findings, complete parsing. Three fixpoint warnings in two files are closed by complete individual screen and unchanged sync-client scans76/1 each,0 findings/errors/timeouts. Final CSS-only closure also has0 findings/errors/timeouts |
| Retained backend/contracts/audits | Prior UX-07 backend306 tests/3,626 assertions, Pint, actual API drift with byte-exact restoration, strict Composer validation, dependency audits and unchanged security/CI baseline remain valid by exact inputs/effect |
| Final secret/structure/whitespace | Current tracked/new-source scan, structure, document links and preservation checks recorded in final receipt; no unrun check claimed as a fresh execution |

The final20 matrix and latest12 layout closure prove view/date/Resume/cancel store equality, deterministic repeated Start, marking/filter/search counts, unmarked blocking, explicit finalize/cancel/read-only, actual quota rollback and encrypted restart,44px marking, full long names,320/360/390/768/1024/1440/1548 reflow,320px/200% text, keyboard dialog entry/containment/Escape/return, visible focus/sticky clearance, forced colors, reduced motion and Axe without serious/critical WCAG2/2.1 A/AA findings. Final320px inspection corrected split Unmarked/temporary words using filter column allocation and13px/6px-padding phone action labels, retaining44px targets. This late change affects only two scoped CSS rules; final production build, native captures and12 relevant browser cases close it, while all TypeScript/unit/engine/backend/dependency evidence remains valid. Unit cases preserve uncertain-count guest behavior, lock/late-save invalidation and concurrency. Unknown discovery faults only a disposable read and compares every store; actual scheduled lease expiry clears plaintext without deleting draft/outbox/conflict/blob work.

The broad initial matrix retains failed diagnostic logs. Fixed historical lease dates were already expired on October14; its happy-path fixture now uses an explicit October1 synthetic clock, preserving expiry enforcement and every event/receipt assertion. A unit test exceeded its existing5-second timeout under concurrent browser load; serial80 passes close it without altered assertions/timeouts. One WebKit screenshot exceeded the existing90-second test deadline; its isolated closure passes. No failed case is relabeled PASS.

No broad backend/database/audit rerun is claimed: production persistence/auth/sync/crypto/contracts/dependencies remain exact. Current frontend aggregate plus final focused/native/targeted browser/build/lint/OWASP proof covers the affected presentation. The root verify constituents are accounted for independently; no redundant wrapper pass is claimed. Physical devices, actual browser400% zoom, human screen-reader and live Laravel browser certification are outside this synthetic evidence; accessibility-tree/Axe/keyboard/device emulation are accurately identified.

## Remaining visual adaptations and final review

Stakeholder review must accept the actual two-area desktop and active roster-first tablet/phone composition. The native illustration uses much smaller controls, initials and sample church timezone; production retains approved gender avatars, full accessible names,44px controls, supported bulk actions, explicit read-only/security/recovery text and browser-local dates. The page-level Take attendance heading keeps approved navigation/testing identity; ministry/date sit directly above the roster. Dialog Cancel/Escape and Keep editing retain the existing accessible native structure rather than adding another close control. Required warnings and longer/locked/error states naturally scroll; ordinary absence remains non-destructive. No hidden work, unsupported guest field, church-time conversion or server acceptance claim.

The complete final source/diff and direct-interaction review checks all twelve paths, unchanged handlers/repositories/engines, privacy/lease/actor/church/ministry binding, receipt/cursor/event integrity, valid tests, scoped CSS, truthful labels, pointer/keyboard ordering, source/scanner coverage, artifact provenance and preservation. Closed findings: duplicate Online/ambiguous queue label, insufficient independent regular/guest counts,1280-only desktop composition, oversized rows/dialogs, sidebar-dependent action gap and excessive phone setup before marking. **0 BLOCKING/0 SHOULD FIX remain.** All previous document bodies are preserved.

HEAD stays `85795a004d7b30a142e70734662540ca0dd7b40c`; staging empty, local/upstream/live feature0/0 and local/origin/live main unchanged. Individually owned loopback fixture servers are stopped at closure. Final scope/hash/gate/preservation receipt: `.git/msprout-ux08-20261014/final-preservation.json`.

**STOP at YELLOW — stakeholder visual approval pending. Do not stage, commit, push, merge, deploy or begin another UX task.**
