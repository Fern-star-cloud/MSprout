# UX-03 Home visual review - 2026-10-12


## Final stakeholder approval — 2026-10-13

**APPROVED / GREEN for UX-03.** The stakeholder reviewed the latest original/production logo comparison, Owner desktop, Teacher phone and favicon/PWA previews and explicitly accepted the supplied green-and-blue sprout, MSprout wordmark, Pack01 blue/navy styling, Owner three-card Home, Teacher assigned-ministry layout and mobile navigation. The raster-embedded SVG is accepted for UX-03; genuine vectorization is an optional future improvement, not an outstanding requirement.

Preserve the approved50-character compact church-name presentation, responsive overflow/focus protections, complete stored values, accessibility, truthful synchronization/device state and all security invariants. Project-wide decisions: displayed brand MSprout; supplied sprout identity approved; original approved mockup artwork governs visual fidelity across **all12 packs** for subsequently authorized UX tasks, subject to actual functionality, accessibility, security and truthful data representation. This does not authorize future task implementation.

The user explicitly authorizes one reviewed UX-03 commit and normal push to feat/mvp-foundation after outstanding checks. No merge/deployment or UX-04–UX-08. Technical evidence remains valid: frontend706/77, focused79/6, current browser36/36 plus12 unaffected retained cases, TypeScript/build/lint, complete reviewed OWASP coverage and secret checks. Initial scanner timeouts were closed by an exact-input serial rerun. Final documentation/index/preservation checks and Git commit/push synchronization are recorded in the ignored finalization receipt and Git history. Pre-existing human QA/environment changes are excluded from the task commit and preserved in a named local stash to meet the requested clean-tree boundary.

Earlier pending/rejected review sections below are historical; this approval supersedes their finalization prohibition. Stop after UX-03.


## Current branding/text continuation — 2026-10-13

The supplied sprout PNG and MSprout displayed name are now approved. [Current review](ux-03-branding-text-review.md) provides the faithful production logo comparison, fresh Owner/Teacher and long-text screenshots, field rules and validation. Project-wide artwork authority is recorded in [the stakeholder addendum](../superpowers/specs/2026-10-13-stakeholder-visual-clarification.md). This supersedes the unavailable-logo/full-MinistrySprout mismatch and earlier Home-only source restriction below; the detailed historical discrepancy audit/evidence remains intact. Screens remain YELLOW pending renewed visual review; no commit/push/merge/deploy or UX-04–UX-08 work.

## Pack 01 artwork clarification — current candidate, 2026-10-13

**YELLOW — stakeholder visual approval withdrawn and still pending.** This section supersedes the historical green-token correction and first blue pass retained below. The latest explicit instruction selects page 4, Pack 01 artwork, as UX-03 Home's visual/composition authority, subject to truthful state, accessibility and existing functional/security boundaries. Nothing is staged, committed, pushed, merged or deployed. UX-04–UX-08 remain untouched.

### Source conflict and measurement method

The master PDF is internally inconsistent: page 2 names blue #1565D8, navy #102C46 and blue-white #EAF3FE/#F1F6FC; page 4 visibly uses blue actions/navigation, navy headings and pale blue-white surfaces. Pages 31–32 and 56–62 instead prescribe green #1F5B43/#153D2C, warm canvas #F3F6F1 and green active surfaces. The stakeholder's newest direction explicitly resolves this conflict **for UX-03 Home only**. Global tokens, other screen specifications, the PDF and governance remain unchanged. The decision is recorded in knowledge/DECISIONS.md. Earlier directional acceptance is not current visual approval.

The original page-4 embedded image was extracted losslessly: 1548×1016 pixels. Native Owner crop is1018×492; Teacher431×515; three-card crop727×224. These are drawing pixels, not CSS viewport dimensions. The PDF does not expose the raster UI's font name, font weights, CSS geometry or original vector icons. DejaVuSans used by surrounding PDF text does not identify the embedded UI font. Exact source CSS cannot honestly be recovered from the bitmap.

Actual production-bundle screenshots use fresh DPR1 browser contexts, isolated synthetic session/membership/API responses and the existing application. They do not establish live authentication or physical-device acceptance. Source crops and screenshots are pasted into comparison sheets **at scale1 without resizing, repainting, screenshot-content editing or font replacement**. Caption text is outside each image. The viewer may scale previews; downloadable files retain full resolution. Fixtures show Sample Community Church / Sunday Explorers Ministry, not the artwork's fictional Willowbrook Chapel / Sunday Explorers.

### Detailed original-versus-actual discrepancy audit

Before means the actual green-token implementation captured at entry; corrected values below are production getComputedStyle/DOMRect measurements, not assumptions from declarations. Source estimates are explicitly raster observations.

| Element | Pack 01 artwork | Actual BEFORE | Corrected actual / remaining difference |
|---|---|---|---|
| Primary actions | Blue with subtle vertical shading | Flat #1F5B43 | Gradient180deg #1565D8→#0B5AD0; hover#104FA9. Source pixel samples vary with shading/antialiasing; original gradient stops unknown. |
| Links / active navigation | Blue links; pale blue selected Home | Green links/#E4EFE8 | Links#1565D8; active#D4E8FF/#104FA9; phone active blue underline3px. |
| Headings | Very dark navy, visually bold | Green-toned#17382D | H1/H2#081731; navigation/main#102C46. Raster exact source paint varies; not claimed identical source CSS. |
| Supporting type | Blue-gray | #52645A | #405C78 on white, body16px/24px; context/captions≥14px. |
| Canvas / surfaces | White main/header/cards; lightly shaded blue-white sidebar and illustration backdrop | Warm#F3F6F1 | Home canvas token#F1F6FC, white content/header/cards; sidebar100deg #FFFFFF→#EFF7FF; thin#DCE8F5 borders. Source outside the window belongs to the design board, not application canvas. |
| Font family | Raster UI face not identified | Segoe UI/system fallback | Installed Arial, Helvetica, sans-serif selected for closer shapes; exact original face unavailable. No downloaded or invented font. |
| Font weights | Bold title/card labels/actions; regular body | 700 heading/600 actions | Computed700 H1/H2,600 actions/nav-active/links,400 body. Raster weight numbers cannot be verified. |
| Heading sizes | Owner drawn Home~36px, Teacher~32px at native embedded scale | Owner32px; phone28px | Owner36px/43.2px; Teacher/phone32px/38.4px; letter spacing−.02em. These reproduce apparent hierarchy, not inferred source CSS. |
| Card headings | Compact bold navy |20px/27px |18px/24.3px,700,−.025em; body16px/24px. Long real names wrap rather than clip. |
| Owner card group | Three aligned, near-square cards; approx235×222 drawing pixels, gap~14px |1440:330.67×281px; gap24px |1440:282.66×270.30px, gap16px, common top175.19px; width/height1.046 vs raster~1.05. At1024:234.66×270.30px; taller than artwork to retain three separate44px link targets. |
| Owner placement | Heading/action row, then three cards, then divided information row | Main area too broad; larger card padding | Main max880px; desktop padding28px32px; card padding16px/gap16px. At1440 card x392;1024 x256. Actual responsive centered max-width creates more side whitespace than the fixed drawing. |
| Owner attendance CTA | Blue rounded right-aligned calendar action | Green48px | Blue48px high,16px/24px600, horizontal padding16px,20px icon/gap12px; aligns opposite heading. At phone width CTA becomes full width. |
| Radii | Soft rounded cards and controls | Cards12px/buttons8px | Cards12px/buttons8px retained from explicit accessible component contract. Exact radius source CSS unknown. |
| Icon circles | Device blue / people green / review amber; about60px |48px earlier first pass, green correction retained smaller circles |60px circle/30px glyph; blue#DFEDFF, green#DEF4EC, amber#FFF0CF. Home/people/review use filled treatment closer to drawing; other local SVG strokes remain approximations. |
| Owner sidebar | Light sidebar; compact top-level destinations; Sync/Account below divider | People sub-destinations always expanded, duplicate connectivity/Sync chrome |224px light sidebar;44px destination targets; Home-only People children behind an accessible44px disclosure. All four existing child URLs retained. Reports & history / Activity visible and accessible labels match. Added disclosure chevron differs from drawing to preserve discoverability. |
| Header | Logo, verified church/role, online dot, conditional church selector | Duplicate status and Sync chrome | One header connectivity indicator; verified context/role retained. Online reflects browser network availability, not server synchronization. No decorative church selector when only one eligible workspace exists. Long real church names can wrap. |
| Teacher hierarchy | Home; upper amber sync panel; assigned ministry; attendance/recent sessions; device row | Assigned ministry plus lower generic information; no upper notice | Same order as artwork; upper68px amber gradient notice; actual assigned ministry card; full-width blue48px attendance and44px outlined Recent sessions; lower44px device row. No extra My ministries link after a ready card; link remains for loading/error/empty and in ordinary navigation. |
| Teacher card geometry | Approx390×198 drawing pixels |390viewport:358×209px |390viewport:358×214px atx16,y207.39;430viewport:398×214px.16px padding/12px action gap;60px icon; heading gap16px. Source card starts earlier; actual heading spacing/readable type account for vertical differences. |
| Teacher notice content | “3 changes waiting to sync” + cloud/count | No authoritative count available | “Sync status not checked” + Open Sync in the same amber placement. It does not claim pending work or completed downloads; no extra storage/API read/count is fabricated. Outline cloud differs from source's filled cloud. |
| Teacher device row | Green lock “Device profile unlocked” | Generic lower information | Blue informational “Device status not checked · Open Sync”; info icon instead of green lock. Home has no verified profile lease/unlock evidence; green success claim would be false.44px real target exceeds source's approx36px row. |
| Phone navigation | Home/Attendance/Sync/More, blue active underline; count badge only in synthetic drawing | Green active treatment | Same four Teacher destinations; navy inactive icons/type, blue Home and3px underline;64px bar +safe area,14px labels. Source illustrated footer is shorter. No synthetic count badge. Owner keeps five existing destinations and discoverable Sync. |
| Responsive layout | Owner desktop, Teacher phone/tablet illustrations; percentages describe board width | Existing adaptive shell |Owner three cols≥768px and stack below; existing tablet drawer preserved; both roles tested320/390/768/1024/1440. Teacher max640px;320card288×230.59px;768card640×214px. Narrow names wrap;200% text reflows without clipping. Fixed footer clearance88px+safe area. |
| Logo / wordmark | Unboxed blue/green two-leaf sprout; “MSprout” two-tone wordmark | Existing official files retained; first pass showed M mark | Existing /icons/sprout-192.svg reused in Home at28px, green rounded-square/white sprout; full MinistrySprout wordmark remains. Both production SVG files are byte-exact; no replacement artwork created. Exact approved multicolor vectors are unavailable. |
| Date and synthetic data | Sun,11Oct; Willowbrook; count3; unlocked state | No unsupported date/count/status |No date without supported church-calendar context. Current actual names/permissions determine wrapping/content. Multiple real assigned ministries render multiple cards; loading/error/empty states remain. These intentional content differences cannot be painted away. |
| Outer frame / height | Rounded presentation-window crop,492px Owner/515px Teacher | Real app viewport |Real min100vh application has no fake window frame;1440×900,1024×700,390×900 and430×550 captures retain their viewport proportions and blank lower space. |

Measured color/contrast receipt: heading17.84:1, supporting text6.95:1, white on both primary gradient endpoints5.41:1/6.20:1, hover7.74:1, active navigation6.19:1, blue on pale information4.83:1. Focus3px outline with2px offset. Native Chrome and WebKit, axe, keyboard disclosure/drawer, reduced motion, forced colors,200% text and no overflow/covered controls pass. Forced colors intentionally adapts colors for accessibility.

### Full-resolution comparisons and responsive captures

- Original versus entry actual: [Owner discrepancy sheet](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-pack01-20261012/audit-before-owner.png>) / [Teacher discrepancy sheet](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-pack01-20261012/audit-before-teacher.png>).
- Corrected original versus actual: [Owner1440](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-pack01-20261012/compare-owner-1440.png>) / [Owner1024 at similar reference width](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-pack01-20261012/compare-owner-1024.png>) / [three-card proportions](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-pack01-20261012/compare-owner-cards.png>).
- Corrected Teacher: [390px phone](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-pack01-20261012/compare-teacher-390.png>) / [430px at similar reference width](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-pack01-20261012/compare-teacher-430.png>).
- Uncomposited captures: [Owner1440](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-pack01-20261012/after-owner-1440.png>), [Owner1024](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-pack01-20261012/after-owner-1024.png>), [Teacher390](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-pack01-20261012/after-teacher-390.png>), [Teacher430](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-pack01-20261012/after-teacher-430.png>), [Teacher768 tablet](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-pack01-20261012/after-teacher-768.png>), [Teacher320 narrow phone](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-pack01-20261012/after-teacher-320.png>), [Owner390 phone](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-pack01-20261012/after-owner-390.png>).
- [Computed CSS and rectangles](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-pack01-20261012/after-geometry.json>), [BEFORE measurements](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-pack01-20261012/before-geometry.json>), [contrast](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-pack01-20261012/contrast.json>), [native-pixel provenance](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-pack01-20261012/comparison-provenance.json>).

Remaining differences are explicit in the table: unavailable raster font/vector artwork, local icon geometry, canonical blue stops versus unknown raster paint, accessible typography/44–48px controls/64px footer and resulting vertical geometry, adaptive viewport/max-width/no fake frame, existing official logo/full wordmark, real context and legitimate conditional states, omitted unsupported date/count/unlock claims and extra People disclosure. No pixel-perfect or visual-approval claim is made. Stakeholder must review this candidate before finalization.

### Scope, validation and review

This correction changes exactly eight application/test inputs: Home CSS, HomeScreen, ChurchShell, HomeIcon, HomeScreen.test, navigation.test, ux-home.spec and navigation-support. Existing main.tsx and ui-navigation.spec changes are from the earlier uncommitted UX-03 work and are preserved. No API/generated contract/backend/migration/dependency/global-style/offline-security/synchronization implementation is changed. The Teacher roster request, active/assignment filters, cancellation, error/empty states and all route destinations remain. Shell changes are opt-in for Home; non-Home rendering is unchanged.

Focused TDD first produced1 expected new Home-state failure with4 existing passes. Final focused Home/navigation/workspace69/69 tests in3 files pass. Because the Home-only People disclosure changes shared-shell presentation behavior, one new full frontend run was appropriate:703/703 tests in76 files pass. Full lint passes; subsequent affected lint and production build including TypeScript pass. Initial production browser40/40 cases across Chrome desktop/mobile and native WebKit phone/tablet pass; later geometry16/16 and final accessible-name/Owner delta8/8 pass without retries/skips. Each role/five-width visual case covers the same five widths; these are not claimed independent physical-device runs.

Late geometry/official-image/accessible-label corrections do not alter routes, authorization, domain/persistence/bootstrap/dependencies. Targeted Home/navigation proof, relevant browser assertions, lint/build and security delta re-establish their invalidated guarantees; the703-test aggregate remains valid under AGENTS.md §3. Previously green backend306/3626, contract/structure and UI-16 dependency/full-security/PWA baseline results remain valid for unchanged inputs and are not claimed newly executed. No backend suites, dependency audits or UX-01M measurement rerun was required.

OWASP76 rules/13 relevant inputs:0 findings/errors/timeouts; final CSS-only delta5 applicable rules/1 file:0; final changed CSS/shell/test/helper delta76 rules/5 inputs:0 with approximately100% parsing. Relevant tests explicitly included. Final documentation-inclusive Gitleaks and byte preservation are recorded in the final receipt. No security control or valid assertion was weakened.

Complete source/diff review closed the remediation queue: TypeScript typing/Testing Library option defects corrected; comparison captions wrap outside native image content; accessible Reports & history name corrected to match visible text; Owner information icon remains navy. Corrected portions and direct interactions reviewed. No known BLOCKING/SHOULD FIX issue remains; listed source/adaptation differences are reviewable limitations, not silently accepted fidelity.

Entry/current branch feat/mvp-foundation;HEAD ecebfdad03b4241b2c5f55270445d0e5c42469e1 (`perf: batch student enrollment projections`, UX-02B). No UX-03 commit exists; completed history preserved. Staging is empty; local/tracking/live feature0/0; origin/main unchanged. Human QA/environment/manual artifacts, private files, databases/profiles and previous evidence are preserved. Ignored receipts/screenshots remain under .git/msprout-ux03-pack01-20261012. Stop for renewed stakeholder review.

---

## Historical reports — superseded visual directions, retained evidence

## Stakeholder correction - current review candidate

**YELLOW: renewed visual approval pending.** The stakeholder directionally accepted the Owner desktop/Teacher phone compositions and required green-token corrections. No commit/push/merge/deploy or UX-04 work is authorized. The first-pass report below is historical: its blue palette and measurements are superseded by this section. Existing evidence and source bodies are retained.

The PDF contains both green and later blue directions. Pages 31-32, 56-57 and 62 explicitly specify green primary/strong/soft, warm canvas, 16px body/14px supporting text, 8px controls and 12px cards. Your latest instruction selects those tokens while preserving Pack 01's accepted three-card Owner and assigned-ministry Teacher compositions. Those pages were extracted and rendered; artwork scaling was not interpreted as CSS pixels.

| Element | Previous UX-03 | Current computed CSS | Compliance |
|---|---|---|---|
| Primary action / links | Blue #1565D8 | #1F5B43 | MATCH |
| Hover / focus | Blue #104FA9 / #1565D8 | #153D2C; 3px outline, 2px offset | MATCH |
| Active navigation surface | #D4E8FF | #E4EFE8; green active text/underline | MATCH |
| Canvas / light sidebar | White content / pale blue sidebar | #F3F6F1; header/cards remain #FFFFFF | MATCH |
| Main / supporting text | Navy / blue-gray | #17382D / #52645A | MATCH |
| Information | Bright blue role badge | #1E4D72 on #EDF5FC; informational icon blue | MATCH; blue reserved for information |
| Decorative borders | #DCE8F5 | #C3CEC5 | MATCH |
| Card radius | 8px | 12px | MATCH |
| Button radius | 6px | 8px | MATCH |
| Attendance / secondary heights | 44px / 44px | 48px / 44px | MATCH |
| Owner card padding / gap | 20px / 20px | 24px / 24px | MATCH |
| Teacher card padding / action gap | 16px / 10px | 16px / 12px | MATCH |
| Body / card heading | 15px / 18px | 16px/24px line height; 20px/27px heading | MATCH |
| Phone/context supporting type | 12-13px | 14px minimum; full labels may wrap at 320px | MATCH |
| Title / family | 32px desktop, 28px phone; Segoe UI | Retained installed Segoe UI/Arial/sans-serif | MATCH to local-font/24-32px rule; exact raster font unverified |
| Logo assets / layout / behavior | Existing production files and accepted composition | Assets byte-exact; three Owner cards, actual Teacher assignments and destination behavior retained | PRESERVED |

Actual 1440px Owner cards now measure approximately 330.67x281px with equal tops/heights and 24px gaps (previous 333.33x272.30px). At 1024px they are approximately 229.33x308px, still three equal-height cards. Teacher 390px card is 358x209px (previous 358x196px), with 324x48px primary and 324x44px secondary actions. Teacher 320px card is 288x236px with 254px-wide actions; tablet card is 640x209px with 606px-wide actions. Header dimensions remain adaptive to real names and larger text. The accepted 224px sidebar and three-column composition are retained under the latest explicit scope despite older alternative layout directions in the PDF.

Measured contrast: primary white/green 7.97:1; hover white/strong 12.10:1; main text/canvas 11.75:1; supporting text/white 6.31:1; selected nav 10.26:1; information 8.08:1. Actual production hover/focus/secondary-hover and information colors were checked, rather than inferring compliance from declarations alone.

Only application file changed in this correction: apps/web/src/styles/home.css. Updated focused assertions in apps/web/e2e/ux-home.spec.ts and apps/web/e2e/ui-navigation.spec.ts. The earlier one-line phone-caption expectation is legitimately superseded by the PDF's 14px minimum: bounded two-line wrapping is allowed, with new no-clipping/overflow and minimum-type assertions. No role/content/route/auth/profile/offline/sync code, global token file, dependency or production asset is changed. Metadata-only changes add this revision and additive CURRENT_STATE/TESTING_ENVIRONMENT/ROADMAP_STATUS sections.

Actual validation: two new token regressions fail on the retained old production bundle; corrected production28/28 affected cases across Chrome desktop/mobile and native WebKit phone/tablet pass without retries/skips. Both roles at320/390/768/1024/1440, axe, focus/drawer/return, 200% text, reduced motion/forced colors, fixed-bar clearance and Home-only scope pass. Build (including tsc) and affected-test lint pass. One lint invocation accidentally selected the bundled pnpm fallback and aborted its automatic install attempt before module replacement; the documented process-scoped pnpm resolves it with exit0, without purge/install/configuration changes. Changed-source Gitleaks and OWASP76 rules/3 inputs pass, with zero findings/errors/timeouts and full parsing. Documentation-inclusive secret and preservation results are recorded in the final receipt.

Retained evidence: previous701 frontend tests/76 files, focused67, unaffected browser behavior, contract/structure, backend/security/dependency and PWA baselines remain valid for unchanged inputs. No aggregate frontend/backend, audits, contract regeneration or UX-01M measurement rerun was needed. Geometry/color/accessibility/build/lint and changed-input security guarantees were re-established. Complete correction review found no remaining BLOCKING/SHOULD FIX issue; visual acceptance remains a stakeholder decision.

Full-resolution current captures and computed CSS receipts are ignored under .git/msprout-ux03-correction-20261012/. They are actual production UI in fresh synthetic intercepted-response contexts, not live authentication claims. All prior artifacts remain retained. Links:

- [Owner BEFORE](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-correction-20261012/before-owner-1440.png>) / [AFTER](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-correction-20261012/after-owner-1440.png>)
- [Teacher BEFORE](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-correction-20261012/before-teacher-390.png>) / [AFTER](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-correction-20261012/after-teacher-390.png>)
- [Tablet](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-correction-20261012/after-teacher-768.png>), [320px phone](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-correction-20261012/after-teacher-320.png>), [Owner phone](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-correction-20261012/after-owner-390.png>), [1024px Owner](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-correction-20261012/after-owner-1024.png>)

Remaining limits: approved replacement logo artwork remains unavailable and is not fabricated; broader navigation consistency remains UX-04; conditional pending/unlocked claims remain absent without verified data. Branch/HEAD remain feat/mvp-foundation/ecebfdad03b4241b2c5f55270445d0e5c42469e1; staging empty; original human/private work preserved. Stop for renewed stakeholder approval.

## Historical first-pass report - superseded visual tokens

UX-03 only. Implementation is unstaged and uncommitted; stakeholder visual approval is pending. No merge, deployment, or UX-04 through UX-08 execution is authorized. The latest supplied UX-03 request supersedes historical dark-navigation instructions for Home.

Entry: `feat/mvp-foundation`, HEAD/tracking/live feature `ecebfdad03b4241b2c5f55270445d0e5c42469e1`, ahead/behind 0/0. Live/tracking `origin/main` remains `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f`. UX-02A/02B finalization receipts agree with Git. Staging was empty.

The supplied 107-page PDF was opened locally; pages 4-8 were rendered and their original embedded 1548x1016 design-board images inspected. Pack 01 is the Home authority; Packs 02-05 establish supporting light surfaces, borders, icon circles, buttons and status roles. The outer PDF text fonts do not identify the font baked into the raster boards. No exact font identification or source-to-CSS pixel equivalence is claimed.

## Exact task files

| File | Change |
|---|---|
| `apps/web/src/app/HomeScreen.tsx` | Owner's three semantic card groups; Teacher's actual active assigned ministry cards and existing attendance/report destinations; compact supporting row |
| `apps/web/src/app/layouts/ChurchShell.tsx` | Home-only light-shell marker, local navigation icons and verified-context presentation; existing routes and authorization source retained |
| `apps/web/src/main.tsx` | Load opt-in Home CSS after existing shell styles |
| `apps/web/src/styles/home.css` | Reusable opt-in light typography, palette, geometry, navigation and action contract |
| `apps/web/src/components/ui/HomeIcon.tsx` | Local decorative SVGs; no icon/font dependency or invented brand asset |
| `apps/web/src/app/HomeScreen.test.tsx` | Four focused presentation, assignment, failure and supported-action regressions |
| `apps/web/e2e/ux-home.spec.ts` | Four browser cases covering two-role/five-width composition, accessibility, navigation isolation, drawer and enlarged text |
| `docs/qa/ux-03-home-visual-review.md` | This acceptance report |
| `knowledge/CURRENT_STATE.md` | Separate additive UX-03 handoff |
| `knowledge/TESTING_ENVIRONMENT.md` | Separate additive actual validation/evidence entry |
| `knowledge/ROADMAP_STATUS.md` | Separate UX-03 visual-approval-pending status; historical task evidence retained |

All pre-existing QA/environment modifications and untracked manual-run documents remain outside UX-03. Original knowledge bodies are preserved beneath separately added sections. Disposable screenshots, scanner snapshots, logs, frozen builds and preservation receipts remain ignored under `.git/msprout-ux03-20261012/`.

## Visual fidelity matrix

MATCH describes composition/visual roles, not pixel-perfect equivalence. Adaptations and mismatches require stakeholder review.

| Element | Reference | Implemented | Assessment | Explanation |
|---|---|---|---|---|
| Desktop sidebar surface | Pale blue/white | `#F5F9FE`, subtle right border | MATCH | Home-scoped; dark treatment removed from Home |
| Active navigation | Pale blue row, blue icon/text | `#D4E8FF`, 6px radius, navy/blue text | MATCH | Small local icons and compact rows |
| Navigation hierarchy | Compact Owner top-level list | Existing People child links remain expanded | MISMATCH | Preserves existing navigation/qualification. Global regrouping belongs to UX-04 |
| Context header | Slim white, verified church and role | White 56px minimum header, verified icon, actual name, rectangular role badge | MATCH | Long real names wrap; no clipping |
| Header connectivity | Small dot and Online | Existing browser connectivity state, small dot and label | ACCEPTABLE ADAPTATION | Network state is not claimed as server synchronization or authenticated access |
| Home title | Bold compact Home | 32px desktop/tablet, 28px phone, 700 weight | MATCH | Clear heading/supporting hierarchy |
| Typeface | Sans serif baked into raster | Installed Segoe UI; Arial/sans-serif fallback | ACCEPTABLE ADAPTATION | Source does not establish a font name. No download/dependency added |
| Owner subtitle | Ready for Sunday | Same supporting copy | MATCH | No unsupported date or metric |
| Owner attendance action | Blue, heading-aligned, calendar icon | 44px minimum, blue local calendar action | MATCH | Existing attendance route; navigation creates no attendance |
| Owner card placement | Three horizontal equal-height cards | Device status / Prepare your ministry / Needs review, three columns at 768px+ | MATCH | Single-column phone adaptation; no stretched desktop dashboard panels |
| Owner card treatment | Thin light border, restrained space | 1px `#DCE8F5`, 8px radius, 20px padding, no heavy shadow | MATCH | Adaptive equal heights accommodate 44px links |
| Icon circles | Blue / green / amber circles | 52px circles, 28px SVGs, pale semantic backgrounds | MATCH | Color/container placement matches |
| Icon artwork | Mixed illustrated/filled symbols | Consistent local outline SVGs, 1.8 viewBox stroke | ACCEPTABLE ADAPTATION | Approved original icon files unavailable; no new dependency |
| Preparation card links | Students / Ministries / Teachers | Same three existing permitted destinations | MATCH | Import remains available through existing navigation |
| Device counter | Synthetic pending-device count | Truthful instruction to inspect Sync | ACCEPTABLE ADAPTATION | Home has no verified count projection; no guessed zero/pending/success |
| Owner supporting row | Thin divider and sync information | Compact info icon and matching supporting sentence | MATCH | Removes the oversized explanatory banner |
| Teacher primary card | Actual assigned ministry + two actions | One card per actual active assigned ministry, blue attendance and outlined Recent sessions | MATCH | Uses current authorized membership/assignment-filtered ministry response |
| Teacher sync-attention notice | Conditional actual pending count | Omitted when Home lacks verified pending state | ACCEPTABLE ADAPTATION | Mockup's synthetic count is never hardcoded |
| Teacher device status | Verified unlocked state | Link to inspect Sync, no unlocked/success assertion | ACCEPTABLE ADAPTATION | No new encrypted-profile read or identity projection introduced |
| Teacher supporting access | Card and verified status | Retained My ministries and Open Sync links | ACCEPTABLE ADAPTATION | Existing recovery destinations remain available |
| Teacher phone navigation | Home / Attendance / Sync / More | Same four items; white bar, small icons, blue active underline | MATCH | 64px targets and safe-area clearance |
| Owner phone navigation | Home / Attendance / Review / People / More | Same five items with persistent header Sync access | MATCH | No horizontal navigation scrolling |
| Tablet composition | Compact menu/drawer and task-first card | Existing 768-1023 drawer, light Home surface, bounded Teacher card | ACCEPTABLE ADAPTATION | Closed drawer preserves working space; supported keyboard containment/return |
| Narrow phone | Readable content without overflow | Wrapping church/ministry names; stacked cards/actions | ACCEPTABLE ADAPTATION | Accessibility/real names take priority over scaled board density |
| Date | Synthetic example date | Omitted | ACCEPTABLE ADAPTATION | No Home church-calendar/date contract is invented |
| Logo | Approved sprout/MSprout artwork | Existing M mark and full MinistrySprout wordmark; compact mark on phone | MISMATCH | Approved A2 production exports remain unavailable; no fabricated production asset |
| Other screens | Future harmonization stages | Existing presentation retained after leaving Home | ACCEPTABLE ADAPTATION | Explicit UX-03 scope boundary; later global shell consistency remains UX-04 work |

## CSS visual contract

These are actual implementation choices inferred from the board, not measured source CSS. Root text scaling remains supported.

| Property | Implemented measurement |
|---|---|
| Font stack | `Segoe UI, Arial, sans-serif` |
| Home heading | 32px/1.2, 700, -0.04em; phone 28px |
| Card heading | 18px/1.35, 700, -0.025em |
| Body / card supporting text | 16px/1.5; 15px/1.45 |
| Nav / secondary nav / context | 15px/1.4; 13px; 13px |
| Role / connection / phone captions | 12px; phone captions remain labeled |
| Button text | 16px/1.35, 600 |
| Text / action / success | `#102C46` / `#1565D8` / `#087754` |
| Supporting text | `#405C78`; existing muted `#526C81` for connectivity |
| Canvas / content / sidebar | `#F1F6FC` / white / `#F5F9FE` |
| Soft blue / active nav / border | `#EAF3FE` / `#D4E8FF` / `#DCE8F5` |
| Icon blue / green / amber surfaces | `#DFEDFF` / `#DEF4EC` / `#FFF0CF` |
| Sidebar / header | 224px; header 56px minimum, grows for long names/large text |
| Main padding | Phone 20px top/16px sides; tablet 28px; desktop 32px |
| Content maxima | Owner 1040px; Teacher 640px |
| Cards | 20px Owner/16px Teacher padding; 8px radius; 1px border; Owner 248px minimum at 768px+ |
| Gaps | 20px Owner cards; 12px Teacher cards; 10px Teacher actions |
| Icon circles / navigation / action SVGs | 52px/28px; 20px; 20px |
| Buttons | 44px minimum; 10px vertical/16px horizontal padding; 6px radius; 1px border |
| Action links | 44px minimum; blue underlined text; 16px arrow |
| Phone bar | 64px minimum links + safe-area inset; 3px active underline; `0 -2px 8px rgb(16 44 70 / 3%)` shadow |
| Phone clearance | 88px bottom content padding + safe-area inset |
| Focus | Existing 3px blue outline with 3px offset; forced-colors highlights retained |
| Breakpoints | Phone <768px; tablet drawer 768-1023px; persistent sidebar >=1024px |

## Evidence and validation

BEFORE screenshots were captured before implementation from the actual application in six fresh synthetic browser contexts. AFTER screenshots render the frozen production build with isolated synthetic intercepted session/membership/ministry responses. They are actual application renders, not drawn mockups or proof of live backend authentication. The fixture server cannot proxy a backend; protected requests without a fixture receive 503. No real credentials, server fixture creation, human browser profiles, encrypted data or attendance work were used. Each owned context is closed.

Evidence folder: `.git/msprout-ux03-20261012/`. Stable screenshots: `before-owner-1440.png`, `after-owner-1440.png`, `before-teacher-390.png`, `after-teacher-390.png`, `after-teacher-768.png`, `after-teacher-320.png`, `after-owner-390.png`, `after-owner-1024.png`. Additional native browser screenshots are in `browser/`; preservation, geometry and scanner receipts are retained separately. Full-page captures can show the fixed phone bar at the viewport boundary within a longer Owner page; scrolling/clearance checks verify reachable actions rather than treating that capture artifact as overlap.

Actual final Chromium measurements at 100% text: Owner cards at 1440px are approximately 333.33x272.30px with equal top/height and 20px gaps; at 1024px they are 232x272.30px. Teacher cards are 358x196px at 390px, 288x218.34px at 320px, and 640x196px at 768px. Teacher buttons are respectively 324px, 254px and 606px wide, all 44px high. Headers measure 57px desktop, 61px Teacher 390px, 93px Teacher 320px, 67px tablet and 113px Owner phone with its persistent Sync access. Adaptive wrapping is intentional; the 56px CSS value is a minimum, not an exact universal height. No page-level horizontal overflow was observed at the five required widths for either role.

| Validation | Actual result |
|---|---|
| Focused TDD | Initial three expected failures/one pass, then 67/67 Home/navigation/workspace tests pass |
| Full frontend | 701/701 tests in 76 files pass, single worker |
| Types / lint / production build | Pass; rebuilt after isolated touch-target correction; final changed browser-test lint also passes |
| Production browser qualification | Initial 36/36 across Chrome desktop/mobile and native WebKit phone/tablet; final 16/16 affected Home cases pass on the rebuilt frozen production bundle, no retries/skips |
| Responsive / accessibility | Both roles at 320/390/768/1024/1440; axe serious/critical checks clear; keyboard focus, drawer containment/return, 200% text, reduced motion, forced colors, bottom-bar clearance, Home-only style removal and existing destination behavior pass |
| Contrast | Heading 14.28:1; body 6.95:1; blue/white buttons 5.41:1; navy sidebar text 13.51:1; selected nav 6.19:1; context 5.50:1; Owner/Teacher badges 4.98:1/4.83:1 |
| API contract | Actual `api:check` pass; existing generated-client CRLF bytes restored exactly after the documented temporary normalization |
| Structure | Complete repository script passes via the existing read-only container equivalent |
| Secret scanning | Current tracked/new source scan passes; final knowledge/source refresh is separately recorded in the final receipt |
| OWASP | Initial 76 rules/17 explicitly relevant inputs and final 76 rules/2 changed inputs: zero findings/errors/timeouts, approximately 100% parsing; test defaults were overridden to include relevant tests |
| Diff / source review | No remaining BLOCKING/SHOULD FIX findings; mobile logo target correction reviewed with direct header/reflow interactions |

The isolated late correction changes only phone logo-link width from 28px to 44px plus a regression assertion. Relevant production/browser proof and build/lint were rerun. The current aggregate frontend result remains valid; no application logic, trust boundary, dependency or backend input changed. Initial contract/structure/OWASP application results remain valid. No full backend or UX-01M investigation was rerun, as instructed. UX-02B backend 306 tests/3,626 assertions and UI-16 backend/Pint/Composer validation/audits, pnpm audit, full OWASP/history-secret/PWA qualification remain cited baselines for unchanged inputs; these are retained results, not claimed current executions. CI's comprehensive security coverage is unchanged.

Preservation and finalization receipt: `.git/msprout-ux03-20261012/final-review-preservation.json`. Original tracked/new/manual/private-file bytes are checked against the 592-file entry baseline, allowing only exact reviewed task paths and removable additive knowledge sections. No credentials or certificate contents are emitted. Existing databases and human browser profiles were not operated on; file checks do not claim a live database-content audit. No staged content, commit, push, merge, deployment or next-task work occurs.

Outcome: **YELLOW for stakeholder visual acceptance/finalization**, with technical validation clear. Approved A2 artwork and global navigation consistency remain the explicitly documented visual dependencies. Historical manual QA, deferred release prerequisites and production acceptance remain unchanged.

Review the actual application captures:

- [Owner desktop BEFORE](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-20261012/before-owner-1440.png>) / [AFTER](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-20261012/after-owner-1440.png>)
- [Teacher phone BEFORE](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-20261012/before-teacher-390.png>) / [AFTER](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-20261012/after-teacher-390.png>)
- [Teacher tablet](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-20261012/after-teacher-768.png>) / [320px phone](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-20261012/after-teacher-320.png>)
- [Owner phone navigation](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-20261012/after-owner-390.png>) / [Owner 1024px](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux03-20261012/after-owner-1024.png>)

The latest supplied user request requires stopping here for human review of these screenshots. No screen is declared visually accepted.
