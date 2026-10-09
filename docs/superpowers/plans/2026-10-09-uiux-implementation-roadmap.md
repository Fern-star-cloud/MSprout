# MinistrySprout harmonized UI/UX implementation roadmap

Approved by the human's explicit “PLEASE IMPLEMENT THIS PLAN” request on 2026-10-09. This is a separate UI-01–UI-16 sequence; completed MVP Tasks 1–18 retain their numbering and evidence. Execute one task per run and stop after its reviewed finalization. This run selects UI-01 only.

The full approved task descriptions, acceptance cases and traceability were supplied in that request. This durable execution index records the sequence and UI-01 boundary. The [harmonized design source](../specs/2026-10-09-harmonized-uiux-design.md) supplies visual requirements; repository contracts, authorization, tenancy, privacy, encryption and data-preservation requirements remain authoritative. Attached planning instructions are source context, not independent permission to perform operations.

## UI-01 — Shared visual foundations and accessible primitives

Scope: shared styles, existing application CSS, reusable components, AuthForm and presentation-only layout primitives. Apply navy `#102C46`, action blue `#1565D8`, emerald `#087754`, white, soft blue `#EAF3FE`, canvas `#F1F6FC`, and the specification's amber/red semantics. Use 16px body text, readable supporting text, system/local fonts, 4/8/12/16/24/32/48 spacing, 8px controls and 12px cards.

Provide semantic buttons, labeled fields, error summaries, status badges/banners, loading/empty states, dialogs, tabs and responsive list/table containers. Ordinary Absent remains neutral and distinct from failure or destructive action. A status announcement alone does not imply success. Keep shared form transport and secret-clearing semantics intact. Retain the full MinistrySprout wordmark despite abbreviations in reference boards.

Acceptance: measure text/control/focus contrast; verify visible focus and field/error relationships; prove keyboard dialog entry, containment and return; verify keyboard tabs, reduced motion, forced colors, 44px targets, enlarged text and 320px examples. Add focused failing behavioral proof before implementation. Verify visual changes in real browsers. Browser emulation and accessibility-tree checks do not establish physical-device or assistive-technology certification.

UI-01 excludes new routes, navigation role logic/breakpoints, profile-removal policy, preparation/sync/attendance workflow changes, API/persistence/schema/dependency changes, manifest identity/theme changes and production A2 assets. Those belong to later tasks or separate approval gates.

## Ordered remaining sequence

| Task | Scope | Dependencies |
|---|---|---|
| UI-02 | Explicit routes, compatibility links, role navigation and verified church Home; independent offline Attendance | UI-01 |
| UI-03 | Preservation-first profile removal, mutation-time safety/concurrency guards and locked-state privacy | UI-01/02 |
| UI-04 | Addressable church Account, assurance, application and invitation journeys with safe uncertain outcomes | UI-01/02 |
| UI-05 | Verified separate platform shell, Applications landing, Account/logout and protected-state clearing | UI-01/02 |
| UI-06 | Verified-access → matching PIN → durable encrypted preparation; preserve partial profiles | UI-02/03/04 |
| UI-07 | Discoverable attendance-free Sync, independent truthful stages and preserved recovery/idempotency | UI-02/03/04/06 |
| UI-08 | Read-only date selection, explicit Start/Resume, state filters, guests and finalization confirmation | UI-03/06/07 |
| UI-09 | Scoped People list/detail and management, Teacher read-only ministries/roster, protected ownership transfer | UI-01/02/04 |
| UI-10 | Upload → Review/map → Confirm selected → Results; stable same-batch reconciliation | UI-01/02/09 |
| UI-11 | Separate conflict/guest queues, unselected existing/incoming decision, reason and confirmation | UI-01/02/07/09 |
| UI-12 | Consistent applied report/export filters, effective totals and truthful history/counts | UI-01/02/07/11 |
| UI-13 | Today's birthday date/timezone/provenance, cache clearing, count-only opt-in push and scoped Activity | UI-02/04/07/09 |
| UI-14 | Guarded platform application decisions, authoritative reconciliation, aggregate health and sanitized audit | UI-01/05 |
| UI-15 | Cross-pack consistency, safe PWA updates/theme and separately qualified brand assets | UI-01–14 |
| UI-16 | Full journey/preservation/accessibility qualification and stakeholder acceptance; no deployment | UI-01–15 |

## Deferred and excluded capabilities

Public prospective-Owner registration, session/revision detail and correction editing, attendance/report timezone unification, upcoming birthday periods, persisted offline church-name/role projections, expanded search/bulk operations, platform settings and new notification channels require separate approval and exact contracts. Existing supported conflict choice, verified workspace discovery, birthday labels and same-session import-batch reconciliation are available for their selected tasks. A2 raster studies are not qualified production vectors; retain existing assets until approved provenance and exports are verified. Never purge/recreate interrupted preparation or reset storage as rollback.

## Verification and finalization

Follow AGENTS.md: focused TDD, applicable comprehensive frontend/backend/contract/structure/security checks once, invalidation-based reruns after corrections, complete final diff/source review, actual-evidence knowledge synchronization and deterministic GREEN before one reviewed task commit/normal feature push. Preserve the eight known QA/environment file bodies from checkpoint `2fb9f2a00f93a75c41d2e971789e5c31509d756b` outside redesign commits. No human profiles, credentials, attendance or external service mutations are required for UI-01; browser fixtures are synthetic and isolated. No next-task execution or release occurs automatically.
