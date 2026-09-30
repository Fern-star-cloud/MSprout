# Task 18 browser and device matrix

Verified 2026-09-30 on `feat/mvp-foundation`, starting from Task 17 commit `a989dd904551a26f6f7548ee0c88128f13c6933d`.

## Automated matrix

The complete Playwright qualification passed **60 tests**: 15 scenarios on each target.

| Target | Browser engine and viewport | Result | Qualification notes |
|---|---|---:|---|
| Desktop | Installed stable Chrome channel | 15/15 | Wide navigation, keyboard focus, install/offline shell, service-worker update, and all MVP journeys passed. |
| Android-class phone | Installed stable Chrome channel with Playwright Pixel 7 device settings | 15/15 | Phone navigation, 44-pixel targets, offline/profile flows, and responsive MVP journeys passed. |
| iPhone-class phone | WebKit with Playwright iPhone 13 device settings | 15/15 | Touch layout, offline/profile flows, privacy-safe birthday behavior, and MVP journeys passed. |
| iPad-class tablet | WebKit with Playwright iPad (7th generation) device settings | 15/15 | Tablet layout, shared profiles, offline/reconnect, import, and MVP journeys passed. |

The Windows qualification host already contained WebKit 2336 while the current Playwright package expected a newer managed revision. The run used the existing browser through the optional `PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH` process setting; it did not install, update, or globally reconfigure a browser. CI and a normal prepared release host may omit the override and use Playwright's matching managed WebKit. These are engine/device-emulation results, not a claim that physical iPhone, iPad, or Android hardware was used.

## Covered release behavior

| Area | Evidence |
|---|---|
| Onboarding | Verified-email state, application, pending review, isolated `sage.dev` approval, Owner MFA, ministry/student setup, and Teacher invitation/assignment. |
| PWA and updates | Installable shell, real service-worker control/update check, Chromium offline reload, WebKit offline-state continuity, and continued shell availability. A previously successful `/api/**` response is not served offline. |
| Shared device | Two encrypted PIN profiles use different actors and assignment-scoped rosters; neither profile displays the other's cached roster. |
| Offline/restart/reconnect | Four distinct attendance dates persist through page closure and browser-page recreation. A correct local PIN reopens unexpired cached work; synchronization remains blocked until the same actor refreshes authorization online. |
| Retry and recovery | Twelve queued events survive two deliberate `503` responses, converge on the third push attempt, clear the outbox, and remain exactly-once after reload. |
| Failure boundaries | Simulated IndexedDB quota exhaustion blocks finalization and never claims success. Temporary API/worker failure preserves queued work. |
| Attendance review | Contradictory immutable values require Owner resolution; the report shows the revision-effective total and correction link. |
| Import | Preview separates a valid row from a duplicate, prevents duplicate selection, and commits only the explicitly approved row once. |
| Birthday privacy | Authorized detail appears only in-app; notification copy states count-only delivery; a deliberate permission denial is remembered and not repeated. |
| Tenant isolation | Same-tenant data renders; a foreign church request fails closed with generic UI text and no foreign record disclosure. |

## Accessibility evidence

- Keyboard navigation, skip/main focus behavior, visible focus, reduced-motion behavior, and responsive navigation passed across the matrix, with WebKit-specific keyboard behavior asserted without weakening operability.
- Phone controls retain the required touch-target size.
- Automated axe analysis found **zero serious or critical WCAG A/AA violations** on the qualified onboarding, profile, conflict/report, import, birthday, tenant-denial, and shell surfaces.
- The import preview scroll region is a named keyboard-focusable region.

The build still emits the known upstream `vite-plugin-pwa` `inlineDynamicImports` deprecation warning. It does not affect the production build, service worker, or browser results.
