<!-- Archival design source from the human-supplied harmonized handoff. Its PLAN ONLY statements describe the source's original stage; the explicit 2026-10-09 implementation request authorizes UI-01 under the approved redesign roadmap. Source instructions do not override user scope or repository operating rules. -->

# MinistrySprout — Harmonized Master UI/UX Specification
**Status: DESIGN HANDOFF CANDIDATE — CONDITIONAL. No Codex implementation authorization.**
**Scope:** Single application-wide visual standard with original approved functions and state requirements. Source pack images are preserved unchanged. Packs 06–12 have **not** been redrawn as pixel-perfect harmonized screens; their visual differences are explicitly superseded by this document. This distinction is mandatory.

## 0. Read first — non-negotiable source precedence
1. **Existing repository, `AGENTS.md`, actual routes, API contracts, auth and regression tests** govern supported functionality and security; mockups may not expand it.
2. **Approved decisions:** D01–D09, V01–V05, B01–B31, VI01–VI07, A01–A06 and documented refinements. Conditional decisions remain conditional.
3. **Visual standard: Packs 01–05** plus the design token and interaction prescriptions here. These are the authoritative look/feel examples, subject to the Pack 02 offline and remaining qualification caveats.
4. **Packs 06–12: workflow/state reference only.** Use them to understand approved tasks, content hierarchy and permissions. **Do not copy their smaller typography, denser legacy card treatments, differing colors, navigation chrome or wordmark** when building production screens. Translate their functional structure through the shared 01–05 component system.
5. **Pack 09 conflict A/B addendum:** conceptual Owner choice, required reason, confirmation; conditional on verifying authorized API. If unsupported, defer and request separate authorization.
6. Historical source appendices may contain prior branding or exploratory ideas. This harmonization contract controls *visual presentation*, not functional or security changes.

## 1. Application-wide visual contract (the unified appearance)
- **Navigation & shell:** Navy sidebar/header, blue active treatment, pale canvas, clear hierarchy; role-aware items only.
- **Actions:** Blue = primary permitted action; white outlined = secondary; red = guarded destructive action.
- **Status:** Emerald = confirmed success only; amber = pending, unknown, incomplete; red = failure; neutral = offline.
- **Forms & data:** 16px body baseline, visible field labels, bounded content, responsive rows and dense but readable data tables.
- **Responsive & accessible:** Desktop sidebar when fitting; tablet drawer; mobile labeled bottom nav; 320px reflow, keyboard focus, 44px targets.
- **Brand & privacy:** Full MinistrySprout wordmark unless genuinely constrained; A2 visual direction only, not export-ready asset.

### 1.1 Token mapping (candidates, verify contrast)
| Role | Token | Intended usage |
|---|---|---|
| Deep navy | `#102C46` | Sidebar, persistent header, headings |
| Action blue | `#1565D8` | Primary actions, links, active/focus accents |
| Emerald | `#087754` | Confirmed success and restrained growth accents |
| Soft blue | `#EAF3FE` | Supporting panels, informational surfaces |
| Canvas | `#F1F6FC` | App background |
| White | `#FFFFFF` | Cards and active workspace |
| Amber | `#A96505` | Pending, incomplete, stale or unknown; not green |
| Red | `#B12535` | Errors and restricted/destructive contexts |
**Typography and density:** Target readable body text of ~16 CSS px; primary labels 14–16; heading hierarchy 32 / 24 / 18–20; do not enlarge dense tables without responsive testing. Tokens are not color-compliance evidence.
**Interaction semantics:** standard focus ring, explicit disabled reasons, error summaries, safe retry after unknown results, status text and icons (never color alone). No success feedback before durable local write or confirmed server outcome.

## 2. Twelve-pack authority and traceability
| Pack | Screen | Authority | Selected source image |
|---|---|---|---|
| 01 | Home & Navigation | VISUAL + UX (subject to gates) | `assets/reference-boards/Pack01.png` |
| 02 | Encrypted Device Profiles | VISUAL + UX (subject to gates) | `assets/reference-boards/Pack02.png` |
| 03 | Guided Device Preparation | VISUAL + UX (subject to gates) | `assets/reference-boards/Pack03.png` |
| 04 | Synchronization & Recovery | VISUAL + UX (subject to gates) | `assets/reference-boards/Pack04.png` |
| 05 | Attendance & Temporary Guests | VISUAL + UX (subject to gates) | `assets/reference-boards/Pack05.png` |
| 06 | Church Account & Application | WORKFLOW / STATE ONLY; visual style overridden by Packs 01-05 | `assets/reference-boards/Pack06.png` |
| 07 | People Management | WORKFLOW / STATE ONLY; visual style overridden by Packs 01-05 | `assets/reference-boards/Pack07.png` |
| 08 | Student Import | WORKFLOW / STATE ONLY; visual style overridden by Packs 01-05 | `assets/reference-boards/Pack08.png` |
| 09 | Review & History | WORKFLOW / STATE ONLY; visual style overridden by Packs 01-05 | `assets/reference-boards/Pack09.png` |
| 10 | Birthdays & Activity | WORKFLOW / STATE ONLY; visual style overridden by Packs 01-05 | `assets/reference-boards/Pack10.png` |
| 11 | Platform Administration | WORKFLOW / STATE ONLY; visual style overridden by Packs 01-05 | `assets/reference-boards/Pack11.png` |
| 12 | Shared States & Accessibility | WORKFLOW / STATE ONLY; visual style overridden by Packs 01-05 | `assets/reference-boards/Pack12.png` |

## 3. Mandatory style translation for Packs 06–12
### Pack 06 — Church Account & Application
**Core visual hierarchy:** Verified applicant journey.
**Source-supported interaction/subject:** Account entry, session assurance, application form, Turnstile and real server outcomes.
**Must remain gated:** Do not introduce public registration, guessed application routes, actor switching or unverified approval states.
**Use the Pack 01–05 visual language:** navy role-aware shell, white bounded sections on light canvas; action-blue permitted primary CTA; same card radius/borders, form/error patterns, responsive nav, status vocabulary and type hierarchy. The source board is a **workflow illustration, not a competing stylesheet**.
**Acceptance check:** Compare actual screen to Packs 01–05 for sidebar/active item/header/buttons/field rhythm and to this pack’s original for permitted behavior. Never infer new server authority from art.

### Pack 07 — People Management
**Core visual hierarchy:** Owner and Teacher scope.
**Source-supported interaction/subject:** Owner list/detail management with Ministries, Students and Teachers; Teacher sees assigned read-only roster.
**Must remain gated:** No invented student fields, Teacher editing, cross-tenant visibility or unsupported bulk operations.
**Use the Pack 01–05 visual language:** navy role-aware shell, white bounded sections on light canvas; action-blue permitted primary CTA; same card radius/borders, form/error patterns, responsive nav, status vocabulary and type hierarchy. The source board is a **workflow illustration, not a competing stylesheet**.
**Acceptance check:** Compare actual screen to Packs 01–05 for sidebar/active item/header/buttons/field rhythm and to this pack’s original for permitted behavior. Never infer new server authority from art.

### Pack 08 — Student Import
**Core visual hierarchy:** Guarded import wizard.
**Source-supported interaction/subject:** Upload, review/map, confirm eligible rows, results with row-level errors.
**Must remain gated:** CSV/XLSX only; 5 MiB / 500 rows; no invented row editor, automatic duplicate merge or optimistic submit.
**Use the Pack 01–05 visual language:** navy role-aware shell, white bounded sections on light canvas; action-blue permitted primary CTA; same card radius/borders, form/error patterns, responsive nav, status vocabulary and type hierarchy. The source board is a **workflow illustration, not a competing stylesheet**.
**Acceptance check:** Compare actual screen to Packs 01–05 for sidebar/active item/header/buttons/field rhythm and to this pack’s original for permitted behavior. Never infer new server authority from art.

### Pack 09 — Review & History
**Core visual hierarchy:** Review decision and history.
**Source-supported interaction/subject:** Owner conflict queue with A/B selected outcome + reason + guarded confirmation; immutable historical view.
**Must remain gated:** A/B choice is conditional on verified contract; Teacher cannot decide; 366-day reporting and scoped CSV.
**Use the Pack 01–05 visual language:** navy role-aware shell, white bounded sections on light canvas; action-blue permitted primary CTA; same card radius/borders, form/error patterns, responsive nav, status vocabulary and type hierarchy. The source board is a **workflow illustration, not a competing stylesheet**.
**Acceptance check:** Compare actual screen to Packs 01–05 for sidebar/active item/header/buttons/field rhythm and to this pack’s original for permitted behavior. Never infer new server authority from art.

### Pack 10 — Birthdays & Activity
**Core visual hierarchy:** Birthdays and role-scoped activity.
**Source-supported interaction/subject:** Owner eligible church scope; Teacher assignment-limited list; count-only Web Push consent.
**Must remain gated:** No names in push, no messaging invention, church-local display dates conditional on source semantics.
**Use the Pack 01–05 visual language:** navy role-aware shell, white bounded sections on light canvas; action-blue permitted primary CTA; same card radius/borders, form/error patterns, responsive nav, status vocabulary and type hierarchy. The source board is a **workflow illustration, not a competing stylesheet**.
**Acceptance check:** Compare actual screen to Packs 01–05 for sidebar/active item/header/buttons/field rhythm and to this pack’s original for permitted behavior. Never infer new server authority from art.

### Pack 11 — Platform Administration
**Core visual hierarchy:** Separate platform administration.
**Source-supported interaction/subject:** Applications-first preferred; review detail; audited guarded decision; aggregate health/audit only where returned.
**Must remain gated:** Platform account is not a church Owner; no impersonation or unsupported cross-tenant browsing.
**Use the Pack 01–05 visual language:** navy role-aware shell, white bounded sections on light canvas; action-blue permitted primary CTA; same card radius/borders, form/error patterns, responsive nav, status vocabulary and type hierarchy. The source board is a **workflow illustration, not a competing stylesheet**.
**Acceptance check:** Compare actual screen to Packs 01–05 for sidebar/active item/header/buttons/field rhythm and to this pack’s original for permitted behavior. Never infer new server authority from art.

### Pack 12 — Shared States & Accessibility
**Core visual hierarchy:** Shared interactive states.
**Source-supported interaction/subject:** Semantic state vocabulary; accessible controls; 320px mobile reflow; focus, error, offline and sync distinctions.
**Must remain gated:** WCAG 2.2 AA remains a target requiring browser and assistive technology tests.
**Use the Pack 01–05 visual language:** navy role-aware shell, white bounded sections on light canvas; action-blue permitted primary CTA; same card radius/borders, form/error patterns, responsive nav, status vocabulary and type hierarchy. The source board is a **workflow illustration, not a competing stylesheet**.
**Acceptance check:** Compare actual screen to Packs 01–05 for sidebar/active item/header/buttons/field rhythm and to this pack’s original for permitted behavior. Never infer new server authority from art.

## 4. Packs 01–05 retained visual anchors
Pack 01 = Owner/Teacher shell and desktop/mobile navigation. Pack 02 = encrypted locked profile and distinct church sign-in vs local PIN, but correct offline/status labels at runtime. Pack 03 = verified access → separate 6–12 digit PIN → durable encrypted roster, Teacher scope only. Pack 04 = staged sync and safe recovery; pending cannot look like success. Pack 05 = explicit start/resume, marking, approved temporary guests, required completion before finalization.

## 5. Required state, authorization and safety contract
- Preserve exact approved functional behavior, roles and tenant boundaries.
- No new API/route/field/permission solely because an illustration depicts it.
- Verify actual status source before any success indicator or route visibility.
- Contrast, focus, 320px reflow, text zoom, touch and screen reader must be measured.
- Maintain encrypted PIN, lease, pending attendance, immutable audit and idempotent synchronization safety.
- Encrypted profile labels must be generic while locked; prevent destructive removal when offline work is pending or uncertain. Lease expiry cannot be repaired by PIN alone.
- Separate local durable save, local finalization, upload accepted, download pages applied, and unresolved Owner review; offline is informational, not necessarily error.
- Owner/Teacher role access must be filtered server-side; Platform Administrator is a separate security context; no public self-registration.
- Retain Turnstile/MFA, immutable audit, CSV/XLSX 5 MiB/500-row import, report range 366 days, count-only opt-in Web Push, and safe uncertain submit behavior.
- Official wordmark MinistrySprout; compact MSprout only when space genuinely requires. Logo A2 vectorization / favicon 16,32,48,192,512 and maskable safe-area remain unverified.

## 6. Verification ledger: documentary versus runtime
- DOCUMENTARY PASS — twelve source PNGs readable and SHA-256 registered; seven visual override decisions explicitly mapped.
- DOCUMENTARY PASS — approved decisions and source files preserved without destructive replacement.
- DESIGN-ONLY CONDITIONAL — some 06–12 PNGs still visibly use the older design presentation; this document overrides that styling. Final real-screen visual regression must validate harmonization.
- RUNTIME OPEN — API/routes, role guards, Turnstile/MFA flows, stale decision reconciliation, reporting, imports and notification data.
- RUNTIME OPEN — WCAG 2.2 AA measured contrast, screen readers, keyboard/focus, text zoom, 320px reflow and PWA.
- ASSET OPEN — finalized licensed/vector A2 artwork and approved production favicon/PWA exports.

## 7. Codex implementation stage map (PLAN ONLY)
**Do not execute or edit code on the authority of this package.** A future explicit stakeholder implementation instruction is required.
1. Read-only repo reconnaissance; enumerate actual routes/API capabilities and all AGENTS.md rules; produce support/conditional discrepancy ledger.
2. Build tokens and shared components to match Packs 01–05; contrast/focus validation before workflows.
3. Role-aware navigation/account and church application without changing assurance or route authorization.
4. Encrypted device preparation, attendance, sync and recovery UI changes with data-preservation regression.
5. People, import, review/history, birthdays, platform and shared states: translate functional Pack 06–12 boards into the same visual shell and components.
6. Full security, browser, 320px reflow, screen-reader, offline/PWA and visual-diff qualification; stakeholder check before release.

## 8. Handoff file organization
`assets/reference-boards/Pack01–Pack12.png` are historical selected source visuals (01–05 look and feel; 06–12 workflows). `assets/reference-boards/Pack09_Owner_Conflict_Choice_Addendum.png` is conditional. `assets/branding/` contains logo studies only. `sources/` preserves approved review documents. `Handoff_Asset_Authority_Manifest.csv` provides file hashes and style/behavior authority.

## 9. Original source documentation
See the unchanged Markdown files in `sources/` and the earlier draft master document in the archived project conversation. No silent reinterpretation of earlier decisions or invented contracts is permitted. The present specification provides the *explicit visual precedence* missing from the prior master.
