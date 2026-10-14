# UX-07 / Pack 04 synchronization and recovery visual review

## Final stakeholder acceptance and authorized delivery — 2026-10-14

The user explicitly grants **“Stakeholder visual approval for UX-07 — Synchronization & Recovery is GRANTED.”** The corrected wider desktop composition, typography, buttons, cards, spacing, colors, MSprout branding, existing mobile/tablet layouts, approved church-workspace header with right-aligned connectivity, Pack 04 status/recovery presentation and documented security/accessibility/truthful-state adaptations are accepted. All UX-07 visual findings are closed; 0 BLOCKING / 0 SHOULD FIX remain.

This acceptance supersedes all YELLOW/pending-approval and no-finalization statements below; those entries remain historical evidence. The approved four application/test/CSS files are byte-exact to the qualified cross-screen checkpoint. Finalization adds approval records only. Synchronization status/count accuracy, read-only observations, original-profile recovery, authorization/encryption, receipts/cursors and role boundaries remain unchanged.

Authorized task identity: `feat: finalize synchronization and recovery UX-07`, parent approved UX-06 `19e07ee4814ceb11d8cad3a6cc4abf6cb238aea0`, on `feat/mvp-foundation`. The exact commit SHA and normal feature-branch push resolve through Git history and `.git/msprout-ux07-finalization-20261014/finalization.json`. UX-07 is GREEN only after successful commit and push, a clean working tree, matching local/upstream/live remote HEAD, ahead/behind 0/0 and unchanged local/origin/live main. The user authorizes exactly one commit and normal push to `origin/feat/mvp-foundation`. STOP after UX-07; no UX-08, merge or deployment.

The final reviewed scope is exactly ten paths: `apps/web/e2e/ui-sync.spec.ts`, `apps/web/src/features/synchronization/SyncScreen.test.tsx`, `apps/web/src/features/synchronization/SyncScreen.tsx`, `apps/web/src/styles/synchronization.css`, this report and knowledge CURRENT_STATE, README, ROADMAP_STATUS, TESTING_ENVIRONMENT and CHANGELOG. Earlier nine-path lists describe the qualified implementation; CHANGELOG is the approved final milestone addition.

Retained qualification: initial frontend 736 tests/79 files; isolated backend 306 tests/3,626 assertions; final focused 84/5 and copy closure 22; 44 unique initial qualified browser cases and 16 affected consistency cases (final 8 replace their earlier results); native production comparisons at 1024/1440/768/390/320 plus 1548, 24 pixel-identical approved-screen pairs and 6 identical mobile/tablet geometry pairs. Types/lint/build, contract drift, Pint, strict Composer validation, structure, dependency audits and zero-finding OWASP scans remain valid by exact inputs/effects. Final affected OWASP proof is 76 rules/2 inputs, zero findings/errors/timeouts. These are retained executions, not newly rerun suites.

Documentation-only finalization invalidates no application, backend, dependency or security-policy gate under AGENTS.md Section 3. Fresh complete tracked/new-source secret scanning, added-document links/whitespace, exact staging/commit scope, preservation and live Git checks are recorded in ignored `qualification.json` and `finalization.json` under `.git/msprout-ux07-finalization-20261014/`. No unrun check is claimed as a fresh pass. The qualified final source review and its closed remediation queue remain valid; finalization additionally reviews the approval records and exact staged diff.

Protected stash `1e104f06fbe3091b54e3916f612668b93f0107b4`, nine original QA/environment blobs, ten backups, private environment/SQLite and all unrelated source remain preserved. Temporary evidence, screenshots, traces, credentials and backups are excluded from staging. Completed UX-03 through UX-06 source and presentation remain intact. No human/live browser or PostgreSQL operation is required.



## Current cross-screen consistency correction — 2026-10-14

**YELLOW — stakeholder visual approval pending.** The Pack04 concept/functionality is directionally accepted; this entry closes the targeted cross-screen findings for review. It supersedes the earlier desktop720px composition and separate message/guidance screenshots below. Earlier qualification, valid functional/security evidence and historical captures remain preserved. No final visual approval, staging, commit, push, merge, deployment or UX-08.

### Measured diagnosis and correction

Current production pages and original Packs01–04 were inspected at native scale. The root cause was an extra `.sync-screen { max-width:720px; margin-inline:auto }` nested inside the already bounded shared `#main-content`. At1440 it added216px of left offset relative to Preparation. At1024 it added8px. The shared parent, sidebar and header were already correct and remain untouched. The same-control comparison identified Sync button weight400 versus approved Preparation600, despite matching14px type,18.2px line height,44px targets,6px radii and110-degree blue gradient.

Only justified UX-07 corrections:

- At≥1024px, use Preparation's existing1152px page cap. Sync fills the shared main's available width and aligns its heading/panel with Preparation; no global layout change.
- Match the approved local-workflow action weight600 across sizes. Preserve button dimensions, gradient, label sizes, spacing, icons and actions. This is the specific comparison-supported phone/tablet visual correction; their layout rectangles remain exact.
- Group the live informational message and native recovery disclosure in one white8px support surface on desktop. Retain separate red alert presentation, every message and guidance link, live-region roles and keyboard order. Below1024, the neutral wrapper uses `display:contents` to retain the existing layout.
- Bound desktop summary/message/guidance copy at80ch and transfer copy at60ch. Full text wraps without clipping; cards use natural height. Remove the inaccurate word “below” from the transfer message, since status cards are above it.

No taller fixed panels, increased padding/gaps, decorative filler, heavy navy background, new workflow, transfer/status logic, authorization, encryption, receipt/cursor, lease, API/backend/schema/dependency or approved UX-03–UX-06 source change.

### Equivalent-viewport production comparisons

All actual captures use DPR1, `scale:css`,1024×900/1440×900/768×900/390×900/320×900 plus1548×1016. Before/after use the same synthetic identity, actual encrypted profile and genuine unknown/complete/interrupted/resumed-durable-download states. They are viewport screenshots of frozen production builds, never image-viewer zoom screenshots, retouched images or mockups. No actual capture is resized or cropped.

- [Current versus corrected desktop —1024×900](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-consistency-20261014/visuals/current-versus-corrected-1024.png>)
- [Current versus corrected desktop —1440×900](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-consistency-20261014/visuals/current-versus-corrected-1440.png>)
- [Original/current/corrected —1024 actual viewports](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-consistency-20261014/visuals/original-current-corrected-1024.png>)
- [Original/current/corrected —1440 actual viewports](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-consistency-20261014/visuals/original-current-corrected-1440.png>)
- [Original/current/corrected —1548×1016 native comparison](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-consistency-20261014/visuals/original-current-corrected-native.png>)
- [Approved Home/Preparation/corrected Sync —1024×900](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-consistency-20261014/visuals/cross-screen-1024.png>)
- [Approved Home/Preparation/corrected Sync —1440×900](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-consistency-20261014/visuals/cross-screen-1440.png>)
- [Corrected tablet —768×900](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-consistency-20261014/visuals/after-current-sync-incomplete-768.png>) / [Phone —390×900](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-consistency-20261014/visuals/after-current-sync-incomplete-390.png>) / [Phone —320×900](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-consistency-20261014/visuals/after-current-sync-incomplete-320.png>)

The original Pack04 is its unscaled1548×1016 embedded raster. It depicts multiple miniature viewports and supplies no exact CSS viewport/font metadata.1024/1440 sheets explicitly pair that untouched reference with matching-sized actual before/after views; they do not falsely label the artwork as a1024/1440 CSS capture. The native sheet uses1548×1016 for all three full images. Source Packs01–04 are preserved under this correction's ignored artwork files, pages15–18 of the attached master PDF. Existing stakeholder artwork/density rules remain authoritative.

| Viewport | Entry x / width | Corrected x / width | Heading y | Main card natural height | Corrected transfer tile |
|---|---|---|---|---|---|
| 1024px | 264 / 720 | 256 / 736 | 89px | 480.88 → 480.88px | 341.00 × 84.88px |
| 1440px | 472 / 720 | 256 / 1152 | 89px | 480.88 → 462.03px | 549.00 × 66.03px |
| 768px | 24 / 720 | 24 / 720 | 85px | 480.88 → 480.88px | 333.00 × 84.88px |
| 390px | 16 / 358 | 16 / 358 | 77px | 619.95 → 619.95px | 160.00 × 120.88px |
| 320px | 16 / 288 | 16 / 288 | 77px | 705.78 → 705.78px | 125.00 × 139.72px |

| Approved screen |1024px page start / width |1440px page start / width |
|---|---|---|
| UX-03/04 Owner Home | x256, width736 | x392, width880 |
| UX-03/04 Teacher Home | x304, width640 | x512, width640 |
| UX-05 private profiles | x244, width760 | x452, width760 |
| UX-06 preparation | x256, width736 | x256, width1152 |

The approved Home640/880px bounds are intentional: a single Teacher ministry focus and Owner three-card task surface. The private Profile page760px cap lives inside its separate1080px privacy-entry frame. Preparation's1152px page accommodates the multi-stage device workflow. Sync's paired transfers/account/review/recovery composition now follows that device-workflow bound rather than adding another narrow nested cap. These screens need coherent controls and hierarchy, not identical arrangements.

The unchanged common church rail is224px and header57px, with32px desktop content padding. Home's approved hero starts4px higher (28px top padding), with36px Owner/32px Teacher headings and48px attendance targets; Preparation and Sync use24px/30px page headings and44px controls. Profiles use28px page heading and a56px standalone entry header. Arial/Helvetica, navy/blue hierarchy, white/light-blue surfaces, restrained borders and status icons remain coherent. The Home primary gradient differs from the approved local-workflow gradient; Sync continues to match Preparation exactly. These are retained approved differences, not changes to prior screens.

Sync retains20px desktop/14px phone card padding,12px desktop/8px phone transfer gaps,8px panel and7px status/tile radii,40px status circles/24px glyphs and32px/20px phone tile icons. The existing1px radius differences from some peer cards are minor workflow styling; uniformizing every token would expand scope. Full computed border/padding/gap/type/color/gradient/icon rectangles and image provenance are linked below.

**Preservation proof:**24/24 approved Home Owner/Teacher, Preparation and Profiles screenshot pairs are pixel-identical across all six viewports. Sync's page/heading/panel/banner/transfer/action/review/guidance rectangles are exactly equal before/after at768,390 and320px in both complete and incomplete-download states (6/6 comparisons). Only matching button glyph weight and position-neutral message wording change there. No responsive arrangement, card sizing, shared header or navigation change.

[Entry computed measurements](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-consistency-20261014/before-css.json>) · [Corrected computed measurements](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-consistency-20261014/after-css.json>) · [Native capture hashes and pixel/geometry proof](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-consistency-20261014/comparison-provenance.json>)

### Affected verification, review and finalization boundary

- Initial affected screen/status/recovery/shared-sync/profile unit proof:84 tests/5 files PASS. Final direction-neutral copy closure:22 screen tests PASS.
- Production build/TypeScript and lint PASS; final source build and affected lint include the matching weight and final wording.
- Targeted four-project Sync matrix:16/16 PASS. Final font/copy/reflow/keyboard/progress closure:8/8 PASS, replacing the corresponding8 earlier cases;8 unchanged cursor/review cases are retained. Actual source stores remain unchanged on status reads; interrupted pulls preserve durable cursors; review/quarantine survives reload; no false completion while downloads wait.
- Fresh cross-screen native audit and corrected audit PASS. Corrected Sync Axe has no serious/critical WCAG2/2.1 A/AA issue at all six viewports, including complete and incomplete downloads; existing320px/200% root-text, forced-colors/reduced-motion, sequential Tab/Enter and unlock-focus proofs pass in the affected matrix. Browser/device emulation is not physical-device or human screen-reader certification.
- Scoped current full-screen/CSS OWASP:76 rules/2 inputs, zero findings/errors/timeouts, ~100% parsing. Complete current tracked/new-source Gitleaks plus lockfile alias and whitespace/preservation checks PASS at closure.
- Prior736/79 frontend,306/3626 backend, unchanged contract/Pint/structure/strict Composer/dependency audits and remaining sync/security evidence are retained by exact inputs/effect. No redundant backend/database/audit or aggregate run is claimed. Initial comprehensive UX-07 validation remains valid for guarantees this presentation correction cannot affect.

Complete correction/source/diff/interaction review has0 BLOCKING/0 SHOULD FIX. The nested-width, lighter-control-weight, fragmented-support and directional-copy findings are closed with measurements, actual captures and focused proof. The remaining reference-versus-production differences above await stakeholder visual acceptance; previously completed screens remain untouched. Existing UX-07 tests, engines, protected work and historical evidence are preserved.

Correction-only changed paths: `apps/web/src/features/synchronization/SyncScreen.tsx`, `apps/web/src/styles/synchronization.css`, this report, `knowledge/CURRENT_STATE.md`, `knowledge/README.md`, `knowledge/TESTING_ENVIRONMENT.md`. The three other inherited candidate paths (screen unit test, browser test, ROADMAP_STATUS) remain byte-exact to the entry YELLOW candidate. The overall candidate still contains exactly the nine paths listed in the original scope below. ROADMAP_STATUS is not edited again because task status remains YELLOW. No authority/security-policy change.

HEAD/local/tracking/live feature remains `19e07ee4814ceb11d8cad3a6cc4abf6cb238aea0`,0/0; staging empty; local/main refs unchanged. Protected stash `1e104f06fbe3091b54e3916f612668b93f0107b4`, nine original blobs, ten backups, private environment/SQLite and all unrelated tracked bytes match entry hashes. Individually owned loopback fixture servers are stopped at closure; no human browser/profile/development PostgreSQL was operated on. Final receipt: `.git/msprout-ux07-consistency-20261014/final-preservation.json`.

**STOP at YELLOW — stakeholder visual approval pending. No staging, commit, push, merge, deployment or UX-08.**

### Earlier UX-07 implementation/qualification (historical desktop composition)

2026-10-14, Asia/Taipei. **YELLOW — STAKEHOLDER VISUAL APPROVAL PENDING.** UX-07 alone is implemented and technically qualified. Staging is empty; no commit, push, merge or deployment. UX-08 is untouched. Explicit visual approval is required by the current task prompt before finalization.

## Checkpoint and exact scope

Expected/current HEAD `19e07ee4814ceb11d8cad3a6cc4abf6cb238aea0`, `feat/mvp-foundation`, tracking `origin/feat/mvp-foundation`, 0/0. Live feature/main were verified at entry and final closure. `origin/main` remains `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f`; the distinct pre-existing local main remains `d6c66694a8acc252815a088ada3ef8703340b038`. UX-03–UX-06 are preserved. The original nine blobs in protected stash `1e104f06fbe3091b54e3916f612668b93f0107b4`, all ten backups and entry private environment/SQLite hashes are byte-exact. No human browser, account, saved profile or attendance was operated on. Backend tests use the existing guarded isolated PostgreSQL test database, serially.

Exactly nine changed paths, all unstaged:

- [apps/web/src/features/synchronization/SyncScreen.tsx](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/apps/web/src/features/synchronization/SyncScreen.tsx>)
- [apps/web/src/styles/synchronization.css](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/apps/web/src/styles/synchronization.css>)
- [apps/web/src/features/synchronization/SyncScreen.test.tsx](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/apps/web/src/features/synchronization/SyncScreen.test.tsx>)
- [apps/web/e2e/ui-sync.spec.ts](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/apps/web/e2e/ui-sync.spec.ts>)
- [docs/qa/ux-07-sync-recovery-visual-review.md](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/docs/qa/ux-07-sync-recovery-visual-review.md>)
- [knowledge/README.md](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/knowledge/README.md>)
- [knowledge/CURRENT_STATE.md](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/knowledge/CURRENT_STATE.md>)
- [knowledge/ROADMAP_STATUS.md](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/knowledge/ROADMAP_STATUS.md>)
- [knowledge/TESTING_ENVIRONMENT.md](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/knowledge/TESTING_ENVIRONMENT.md>)

## Implementation and preserved state contracts

The former six large cards become one bounded 720px summary panel, paired upload/download tiles, Continue/Lock actions, compact account/status controls and a distinct review section. Conditional original-PIN recovery remains in Sync. Native disclosure keeps preservation guidance and device-management/account links reachable without redundant footer navigation. Approved MSprout artwork/wordmark, UX-04 navigation and UX-05/06 phone header are unchanged.

The UI distinguishes durable local persistence, locally finalized pending attendance, confirmed server receipts, applied download pages and unresolved review. Unknown counts remain unknown. Locked/denied states hide protected counts. Offline retains work without implying loss; browser Online never confirms server/account health. The existing completion conditions remain authoritative. Transfers/review and uncertain responses remain separate; no invented percentage, Owner approval, conflict provenance or unsupported reset is introduced.

A browser-discovered read-only subscription correction observes the existing profile, cursor, outbox, conflict and draft tables before lease-bound WebCrypto leaves Dexie's live-query tracking. Projection reads refresh as acknowledged events leave the outbox during held downloads. Generation/unsubscribe guards reject stale reads after lock/profile/connection changes. This adapter writes no records and changes no engine, crypto, leases, retry policy, receipts, cursor, bootstrap authorization, backend, contracts, schema or dependencies.

The existing matching-account → original PIN → explicit Continue workflow, duplicate-action guard, persisted PIN delay, expiry/actor/church/device checks and exact event IDs remain intact. Status viewing and checking retain every store and dispatch zero attendance/push/pull/logout work. Accepted uploads with interrupted pagination resume the exact durable cursor without reupload; uncertain server receipts reconcile original events. Quarantined work and downloaded review sessions survive reload.

## Original artwork and actual captures

Primary authority: attached master PDF, Pack 04 page18, embedded original **1548 × 1016** raster, inspected along with the supplied board and master R06 (page53). The document's historical planning/approval instructions do not replace the user's explicit UX-07 authorization. Raster pixels establish visual comparison, not exact designer CSS/font metadata.

[original-versus-desktop.png](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-20261014/visuals/original-versus-desktop.png>) places the full unscaled original beside an actual **1548 × 1016 viewport**. [original-versus-mobile.png](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-20261014/visuals/original-versus-mobile.png>) compares the original phone crop at scale1 with actual **390 × 900**. Actual app images are never resized, retouched or reconstructed; only the illustration is cropped for the phone comparison. Full-page images are separately retained because error/recovery states can extend beyond the viewport. [Capture provenance/hashes](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-20261014/comparison-provenance.json>) records every source and unaltered screenshot. The artwork's alternative states are never rendered together in production.

| Actual state | Evidence |
|---|---|
| Pending upload | [pending-390-viewport.png](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-20261014/visuals/pending-390-viewport.png>) |
| Zero uploads / incomplete downloads | [incomplete-downloads-1548-viewport.png](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-20261014/visuals/incomplete-downloads-1548-viewport.png>) |
| Completed synchronization | [complete-390-viewport.png](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-20261014/visuals/complete-390-viewport.png>) |
| Offline retained work | [offline-pending-390-viewport.png](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-20261014/visuals/offline-pending-390-viewport.png>) |
| Uploading / waiting for receipts | [uploading-390-viewport.png](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-20261014/visuals/uploading-390-viewport.png>) |
| Downloading / waiting for pages | [downloading-390-viewport.png](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-20261014/visuals/downloading-390-viewport.png>) |
| Locked profile | [locked-390.png](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-20261014/visuals/locked-390.png>) |
| Expired account | [expired-account-390.png](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-20261014/visuals/expired-account-390.png>) |
| Interrupted / safe retry | [interrupted-incomplete-390.png](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-20261014/visuals/interrupted-incomplete-390.png>) |
| Uncertain server response | [uncertain-response-390.png](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-20261014/visuals/uncertain-response-390.png>) |
| Transfers complete / review remains | [review-remaining-390.png](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-20261014/visuals/review-remaining-390.png>) |
| Unknown server review | [server-review-unknown-390.png](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-20261014/visuals/server-review-unknown-390.png>) |
| Unknown storage | [storage-unknown-390.png](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-20261014/visuals/storage-unknown-390.png>) |
| Tablet adaptation | [incomplete-downloads-768-viewport.png](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-20261014/visuals/incomplete-downloads-768-viewport.png>) |

## Measured geometry and visual decisions

Computed browser CSS and rectangles: [Full measured evidence](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux07-20261014/computed-css.json>). Measurements below are CSS pixels at DPR1 Chrome desktop; emulated browser/device records remain separate.

| State / viewport width | Main panel | Active summary | Upload / download tile | Primary action height |
|---|---|---|---|---|
| incomplete-downloads, 1548px | 720.0 × 480.9 | 678.0 × 68.6 | 333.0 × 84.9 / 333.0 × 84.9 | 44.0px |
| incomplete-downloads, 768px | 720.0 × 480.9 | 678.0 × 68.6 | 333.0 × 84.9 / 333.0 × 84.9 | 44.0px |
| pending, 390px | 358.0 × 601.1 | 328.0 × 106.3 | 160.0 × 102.0 / 160.0 × 102.0 | 44.0px |
| pending, 320px | 288.0 × 707.7 | 258.0 × 146.0 | 125.0 × 120.9 / 125.0 × 120.9 | 44.0px |

Typography uses the approved shared Arial/Helvetica/system fallback: h1 24px/30px, 700; active summary 16px/20.8px, 700; tile titles14px/18.2px, 700; tile/summary text13px/18.85px; detail12px/17.4px. Panel padding20px desktop/tablet and14px phone; tile padding12px desktop/10px phone; gaps12px desktop/8px paired phone tiles; panel radius8px, tile/banner radius7px, control radius6px. Primary controls and the profile selector retain at least44px targets. Status circles40px desktop and32px in phone tiles; stroke icons accompany full labels. Native source desktop banner is approximately713×80 raster pixels and transfer tiles351×88; its composite/drawn viewport has no proven CSS scale, so those values are not asserted as CSS tokens.

Navy `#102c46`, muted text `#405c78`, primary gradient `#0768ed → #0054dc`, white/light-blue surface and `#dce8f5` borders reproduce Pack04's language. Amber `#fff7e3/#9b5900`, green `#f0fbf7/#087754`, blue `#f2f8ff/#005bdc`, and red `#fff3f5/#b4233d` combine icons and text with semantic status. Hover darkens primary and tints secondary; focus uses an explicit3px blue outline/3px offset; disabled controls remain readable and visibly unavailable. No animated progress is needed; reduced-motion overrides and forced-color borders/focus are scoped.

**Justified differences awaiting visual acceptance:** production renders one active state in the existing approved shell; it includes actual account/unlock qualifiers, independent local/server review evidence and read-only checks absent from the small illustration. Original PIN and unknown/expired states require additional copy and scrolling. Phone controls stack for44px keyboard/touch access, while paired transfer tiles remain compact. Typography uses the accepted system family and local SVG status icons rather than claiming exact raster font or icon metadata. Existing shared navigation/identity, generic private profile labels and truthful counts take precedence over sample church/profile/count values. Continue synchronization retains the existing supported action label. The original has a smaller illustrative mobile surface; actual layouts accommodate full security/recovery text instead of clipping it. There are no unreviewed competing states or unrelated dashboard cards.

## Qualification and valid evidence

| Gate | Actual result |
|---|---|
| Focused unit regression | **84 tests / 5 files PASS**, final screen/status/recovery/shared sync/profile proof |
| Initial comprehensive frontend | **736 tests / 79 files PASS**; two additional review tests fail before correction and pass in final84 |
| Serial isolated backend | **306 tests / 3,626 assertions PASS** |
| Types/lint/production PWA build | PASS; final84 build includes TypeScript; final lint covers current tests/source |
| API contract drift | Actual `api:check` PASS; only temporary CRLF normalization, original generated bytes/hash restored exactly |
| Pint / strict Composer validation | PASS |
| Composer / pnpm high audits | PASS, zero known advisories after process-scoped trusted CA setup; TLS remains enabled |
| Repository structure / whitespace | PASS |
| Browser matrix | Initial **40/40 PASS**, final affected closure **20/20 PASS** plus **4/4 keyboard closure PASS**, **44 unique qualified cases** across desktop Chrome, Pixel7 Chrome, iPhone13 WebKit and iPad WebKit |
| OWASP security | Initial relevant scope **98 rules /14 targets /0 findings**, ~100% parsing; final complete screen **76/1** and changed tests/style **76/3**, zero findings/errors/timeouts |
| Secret scan | Final complete tracked/new source plus explicit lockfile alias, zero leaks; ignored credentials/dependencies/runtime/build output excluded |

The root verify components were executed independently once; no duplicate root `pnpm run verify` pass is claimed. Initial comprehensive checks cover frontend/backend, types/lint/build, contract, formatting, structure, audits and security. Later corrections are isolated Sync presentation/projection observations and synthetic evidence. Final focused/browser/types/lint/build/security prove affected guarantees. Unchanged backend/RLS/crypto/engine/contracts/dependencies and unrelated aggregate behavior retain their current-run results by effect. The final20 replaces the corresponding16 earlier browser results and adds4 actual unknown-status cases; a final4-keyboard closure refreshes the pending/progress scenario across all projects.24 unaffected cases are retained. No failed/unrun case is relabeled PASS. All earlier failed logs remain diagnostic evidence.

The browser matrix exercises320/360/390/768/1024/1440 plus native1548×1016 (and975px width), no page overflow, 320px/200% root text, reduced motion/forced colors, original-PIN focus return, sequential Tab navigation through the profile selector/Continue/Lock/Verify/status/guidance controls, Enter disclosure, meaningful polite/atomic announcements, lock privacy and Axe with no serious/critical WCAG2/2.1 A/AA violation. Unknown storage is a read-only fault injected only in a disposable browser; restoration and byte-exact store comparison are asserted. Unknown server review uses synthetic503, without claiming completion. HTTP is intercepted; genuine WebCrypto/IndexedDB/application rendering are used. This is engine/device emulation, not physical-device, actual400% browser zoom, human screen-reader or live Laravel browser certification. Existing offline/PWA regression guarantees are preserved; fixture service workers are blocked solely to keep HTTP interception isolated, and no production caching boundary changes.

Detailed browser ledger, logs, security results and preserved runner artifacts live under ignored `.git/msprout-ux07-20261014/`. All task-owned fixture servers are stopped at final closure. No host runtime/dependency/global trust change was made. Initial TLS failures were environmental and closed by existing trusted roots; the full-scope taint warning was reviewed and closed by the current complete-file zero-timeout scan. The initial preview process ended with its launching tool session; the successful matrix uses a dedicated persistent local server with no backend proxy.

## Complete final review and remediation queue

One complete final source/diff review covered the four application/test paths, direct profile/status/recovery/transport/authorization interactions, CSS/controls, contract preservation, all state/completion/privacy guards, scanner scope, screenshots and protected work. Corrected portions and direct interactions were re-reviewed after focused remediation.

| Finding | Classification | Closure |
|---|---|---|
| Stale pending upload projection while downloads wait | SHOULD FIX | Actual held-response failing browser case → observed encrypted-table subscription → passing real browser projection |
| Inherited selector width/margins increase card spacing | SHOULD FIX | Scoped auto width/zero margins; final geometry and captures |
| Locked screenshot captured in enlarged unlocked case | SHOULD FIX | Capture moved to actual locked case; refreshed project evidence |
| Unknown upload count described as finished | SHOULD FIX | Focused failing partial-unknown case; explicit known-zero condition; passing proof |
| New attempt reuses prior completed-download styling | SHOULD FIX | Focused failing held new attempt; progress icon/tone precedence; passing proof |
| Artwork alternatives, security text, system fonts/icons and44px adaptations | INFORMATIONAL / ACCEPTABLE | Explicitly disclosed above for stakeholder visual review |

**0 BLOCKING /0 SHOULD FIX remain.** No weakened assertion, scanner suppression, unrelated refactor, debug/source junk, backend/schema/contract/dependency/security-policy change or UX-08 work. Additive knowledge preserves every previous body and records validated/uncommitted reality. Final preservation/secret/whitespace/live-ref/cleanup receipt binds exact candidate paths and hashes. **STOP at YELLOW for stakeholder visual approval. Do not stage, commit, push, merge, deploy or begin UX-08.**
