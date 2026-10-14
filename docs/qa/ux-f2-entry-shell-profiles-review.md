# UX-F2 — Entry, shell, Home and device profiles review

## Accepted stakeholder review and authorized finalization — 2026-10-15

**Stakeholder visual approval is GRANTED.** The user explicitly accepts the shown Owner three-card Home, Teacher layout/reduced status duplication, light desktop/tablet navigation and phone More, Sign in/secondary session continuation, compact private profile picker, branding/density and supported compact CAPTCHA. No further UX-F2 visual redesign is requested. Zero BLOCKING / zero SHOULD FIX findings remain.

The separate UX-F2 Finalization Authorization permits only the exact reviewed 22 paths, one commit **feat: unify entry home navigation and profiles UX-F2**, parent UX-F1 `c0e4a8f967b92e4028b9ea475760b06fdff1a3c0`, and a normal push to the existing feature tracking branch after final checks. Actual commit SHA, synchronization and separate Web/API/Security outcomes resolve through Git and the ignored [finalization receipt](<../../.git/msprout-uxf2-20261015/finalization/final.json>). GREEN delivery requires all exact-SHA hosted checks to pass. A failed hosted check preserves the commit and stops; this approval authorizes no second correction commit.

All approved application/test/style bytes and screenshot evidence remain unchanged. Finalization edits only this report and the three existing knowledge files, preserving their earlier bodies. Existing full frontend/API/browser/PWA/build/accessibility/security guarantees remain valid; fresh checks cover document links/anchors/whitespace/secrets, exact scope/diff, source/evidence hashes and protected Git/data resources. CAPTCHA verification, server-side validation, error/expiry handling and accessibility remain required; live evidence proves layout only. The historical holds below describe the pre-approval review, not a new hold after this explicit approval.

**STOP after UX-F2 delivery.** UX-F3, COMPAT-01, Late, remaining packs and all other tasks stay untouched. No merge, deployment or application-data operation.

## Preserved pre-finalization review


2026-10-15 (Asia/Taipei). **YELLOW — stakeholder visual review pending. Unstaged, uncommitted and unpushed.** Selected scope is UX-F2 only, from accepted UX-F1 `c0e4a8f967b92e4028b9ea475760b06fdff1a3c0` on `feat/mvp-foundation`. This report requests review of the actual candidate; it does not grant finalization or select UX-F3.

## Presentation changes and preserved ownership

| Surface | Current candidate | Preserved behavior / adapter boundary |
|---|---|---|
| Church entry/auth | Focused 640px maximum; 24px navy title; aligned 14px labels, 16px inputs, compact links; Sign in retains the blue gradient; explicit session continuation is outlined secondary | Existing form submission, duplicate-submit protection, field-linked safe errors/focus, secret clearing, MFA/recovery/invitations/session discovery are unchanged. No automatic session probe was added to login. `AuthForm.variant` defaults to primary, so platform consumers retain their existing treatment. |
| Owner Home | Canonical light canvas, 24px title, up to 1152px content, three compact white 12px-radius cards, 44px icon tiles, 48px route action | Exactly Device status / Prepare your ministry / Needs review; genuine existing destinations, no invented counts/status, no attendance created by navigation. Three columns from 768px, stacked on phones. |
| Teacher Home | Actual assigned ministries remain central; compact names/disclosure and existing attendance/Recent sessions actions; one informational unchecked-Sync panel | Removes the redundant lower Open Sync row. An unchecked state uses blue information rather than suggesting an amber problem. No verified unlocked/pending/synchronized claim, invented history or ministry preselection. Existing requests, filters, cancellation, empty/error states and routes remain. |
| Church shell/navigation | One shared font/chrome owner across Home and other church destinations; 224px light sidebar; canonical 16/20/24px content gutters and 1152px bound; shared 3px/3px focus | People/More grouping, active states, role destinations, URL church context, native links/history and mandatory route authorization remain. Removed competing Home-specific chrome and obsolete dark drawer declarations; no authorization caching or boundary rewrite. |
| Profiles | 24px picker heading; compact 40px icon tiles and 12px cards; consistent secondary route anchor; PIN action announced as “Unlock Profile 1,” including its visible “Unlock” label | Generic pre-unlock identity; masked numeric 6–12 digit string PIN including leading zeros; accepted Back/connectivity/MSprout mobile header; one connectivity announcement and no footer; retry/lock/expiry/recovery/removal and all crypto/storage/lease/sync controllers unchanged. |
| Church Application CAPTCHA | Vendor-supported `size: 'compact'` only | Same site key, action, callbacks/revocation, lifecycle and server verification; no clipping, CSS scaling, synthetic proof in the live check, challenge interaction or submission. Application layout/domain otherwise unchanged. |

UX-F1 primitives/tokens are reused. Existing Home route anchors and profile route anchors remain narrow presentation adapters preserving native links; no new shared component framework, duplicate token palette or router is introduced. Platform authentication/admin is excluded. Preparation, Sync, attendance and all other church screens consume the shared chrome/gutters only; their feature internals are retained for their own tasks.

## Browser visual evidence

Actual immutable production builds and equivalent isolated synthetic workflow states are compared at **1440, 1024, 768, 390 and 320px**, Chrome native desktop and WebKit phone/tablet engine coverage. Browser emulation is not physical-device or screen-reader certification. API fixtures intercept local requests; no real account, live API or existing user browser profile is used.

[All 105 shared-consumer screenshot pairs](<../../.git/msprout-uxf2-20261015/screenshot-pairs.json>) cover 21 views at five widths. [Measured pixel/dimension manifest](<../../.git/msprout-uxf2-20261015/review/visual-metrics.json>) and seven contact sheets record the whole-consumer review. Four separate platform views at all five widths are pixel-identical. The additional **33 paired** entry/Home/profile captures cover long names, tablet drawer, phone More, field errors/focus, actual encrypted picker/PIN, offline entry, and distinct Teacher empty/error states at equivalent before/after states.

Representative comparisons are rendered directly below: **before left / candidate right within each pair**. Originals remain unchanged; HTML contact sheets only arrange actual screenshots.

![Owner Home and desktop navigation](../../.git/msprout-uxf2-20261015/review/owner-desktop.png)

![Teacher Home and phone navigation](../../.git/msprout-uxf2-20261015/review/teacher-phone.png)

![Public Sign in and device profiles](../../.git/msprout-uxf2-20261015/review/entry-profiles.png)

![Tablet drawer](../../.git/msprout-uxf2-20261015/review/tablet-navigation.png)

[PIN comparison](<../../.git/msprout-uxf2-20261015/review/pin-phone.png>) preserves the accepted compact header and masked field. [Representative source manifest](<../../.git/msprout-uxf2-20261015/review/representative-manifest.json>) identifies original paths. Runner output/screenshots/traces, immutable builds and diagnostic helpers remain ignored and excluded from staging.

Observed changes: Home is smaller in title/icon scale, Owner content uses available width, Teacher removes redundant recovery chrome, and entry/profile cards are denser. The light canvas now continues beneath Home rather than switching to a white page. Navy/blue/light identity and responsive compositions remain consistent. Other feature screens retain their inner adapters; their shared gutter/font changes are included in the full consumer review. No new page overflow was observed in qualified matrices.

## CAPTCHA diagnosis and limits

The same live Cloudflare widget was measured on baseline and candidate without a fixed test clock, synthetic widget, challenge interaction or application submission. Baseline at 320px renders a **300×65px** frame starting at x33 and overflows the document. Candidate renders **150×140px** at x33 and fits; 390/768/1440px checks also fit. Compact mode is deliberately retained at every width, including resizing, so responsive reflow does not tear down a challenge or revoke/reissue proof merely because a breakpoint changed.

[Official widget sizing](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/) documents normal 300px, flexible minimum 300px, and compact 150×140px. Flexible mode cannot solve this constrained container. Vendor compact mode preserves challenge UI rather than manipulating its contents. The diagnostic's initial iframe selector could not enter the vendor's closed shadow tree; browser frame handles and actual screenshots established dimensions. Initial failed harness outputs remain preserved.

[Live baseline metrics](<../../.git/msprout-uxf2-20261015/before/captcha-final/captcha-real-Cloudflare-la-1bab2-n-or-application-submission/captcha-metrics.json>) / [live candidate metrics](<../../.git/msprout-uxf2-20261015/after/captcha-final/captcha-real-Cloudflare-la-1bab2-n-or-application-submission/captcha-metrics.json>). This qualifies **live widget layout only**. Human challenge completion, third-party reliability and real server token validation are not claimed. Unit/backend checks preserve action, expired/error token revocation and fail-closed validation. Synthetic-widget consumer screenshots qualify form presentation only.

## Accessibility, progress and navigation review

- Native links, logical Owner/Teacher destinations and active grouping remain; no new authorization request or workspace cache. Baseline and candidate navigation each issue exactly one session read and one scoped membership read per destination, preserve church selection and show no newly added workspace-loading flash. Existing focus/visibility/security rechecks remain mandatory.
- Real-browser coverage includes 44px controls/targets, 48px primary/input geometry, page overflow, two-line long ministry names with complete accessible disclosure, church-name disclosure, keyboard drawer containment/Escape/return, navigation/history, role denial, field-summary focus/links and preserved secret clearing.
- Enlarged text, forced colors, reduced motion, offline/connectivity, empty/error and dialogs are covered by the retained functional browser cases and current affected runs. Serious/critical axe checks run on relevant states and all 21 consumers at 390px. No blanket WCAG certification is claimed.
- Computed entry proof verifies 24px navy title, 14px labels, 16px inputs, 8px input radius, 12px button radius and actual UX-F1 gradient; Home/navigation/profile geometry is asserted in the corresponding browser suites. Shared contrast tests verify token combinations. Meaning remains textual, not color-only.
- Busy feedback reflects real pending submission, keeps duplicate submission protection, exposes `aria-busy`, and shows contextual “Please wait…” without fabricated progress/estimates. No progress bars or decorative steps are introduced on entry, Home or Profiles. Existing truthful Preparation/Import step and PWA behavior remain.

## Validation and final-review evidence

Fresh local results: focused **52/52 tests**, complete frontend **744/79**, serial isolated API **306/3,626 assertions**, typecheck, lint, production build, Pint, strict Composer validation, Composer/pnpm audits, structure and whitespace pass. The known raw Windows CRLF `api:check` limitation reproduces; the same unchanged contract/generated contents pass in an ignored LF-normalized mirror. No contract or line-ending “repair” was made. Root `pnpm run verify` is not claimed separately executed; its applicable component commands ran.

**89 distinct browser cases qualify: 55 Chrome screen cases, 26 WebKit screen cases, and 8 PWA cases (4 per engine), with zero retries/skips.** This combines retained valid passing cases with focused closures; the initial 54-case Chrome run was 47 passed/7 failed, its 18-case closure was 17 passed/1 failed, and the final two-case Chrome closure passed. The WebKit screen run was 25 passed/1 fixture failure; a two-engine navigation closure passed both and replaces that test result. No failed aggregate is described as a fully passing command. The baseline 28-case equivalent-evidence run passed. Current machine outputs are under `.git/msprout-uxf2-20261015/`. Failed exploratory/aggregate runs remain historical failures, not renamed passes. Initial frontend resource contention produced existing five-second test timeouts; the successful full 744-test run uses four workers with unchanged assertions/timeouts. Browser closures correct fixture response fields and explicit action selectors after the approved accessible-name change; they do not weaken security/state assertions.

Initial OWASP Semgrep: **76 rules / 27 changed or directly relevant inputs, zero findings**, including auth transport/session, application challenge/form, church boundary/router and shared primitives. One partial parser warning is the unchanged type-only Vitest mock import expression in AuthScreen.test; the full affected code/diff is manually reviewed. No production parse gap. Prior full application baseline remains valid outside this presentation scope; final changed-test closure ensures later test edits are scanned. Gitleaks covers all tracked/new nonignored source plus explicit lockfile text aliases; ignored credentials/dependencies/runtime/build/evidence are excluded deliberately.

No source changes to authorization, tenancy, API/contracts, database, encryption, offline profile policy, drafts/outbox/conflicts/cursors, synchronization engines, service-worker activation policy, dependencies or CI/governance. Existing PWA assertions continue to require exact worker activation/controller identity/revision, notice removal, safe deferred activation, protected cache boundaries and byte-exact encrypted pending work.

## Exact candidate inventory

**22 paths: 19 modified, 3 new.** No governance, workflow, backend, dependency, contract or unrelated paths.

| Path | Change |
|---|---|
| `apps/web/e2e/ux-device-profiles.spec.ts` | Exact Unlock/Lock selectors; all existing protection assertions retained |
| `apps/web/e2e/ux-home.spec.ts` | Approved canonical canvas, gradient and radius expectations |
| `apps/web/e2e/ux-entry-shell.spec.ts` (new) | Equivalent five-width entry/Home/navigation/encrypted-profile evidence, safe errors, empty/error, navigation request/flash and measured busy/token proof |
| `apps/web/src/app/HomeScreen.test.tsx` | One contextual Teacher Sync recovery expectation |
| `apps/web/src/app/HomeScreen.tsx` | Remove redundant lower Teacher Sync row only |
| `apps/web/src/features/applications/CaptchaChallenge.test.tsx` | Compact vendor option, preserving action/token/lifecycle assertions |
| `apps/web/src/features/applications/CaptchaChallenge.tsx` | Vendor size option and type only |
| `apps/web/src/features/auth/AuthForm.tsx` | Default-preserving presentation variant |
| `apps/web/src/features/auth/AuthScreen.test.tsx` | Primary/secondary hierarchy and explicit discovery proof |
| `apps/web/src/features/auth/AuthScreen.tsx` | Scoped church auth class, links and secondary continuation |
| `apps/web/src/features/device-profiles/DeviceProfilesScreen.test.tsx` | Exact PIN accessible-name expectations; safety assertions retained |
| `apps/web/src/features/device-profiles/DeviceProfilesScreen.tsx` | Unlock accessible-name correction only |
| `apps/web/src/styles/auth-entry.css` (new) | Scoped entry geometry and hierarchy |
| `apps/web/src/styles/branding-text.css` | Remove competing Home chrome; preserve separate platform branding |
| `apps/web/src/styles/device-profiles.css` | Compact profile cards/icons/title and consistent route anchor |
| `apps/web/src/styles/home.css` | Canonical Home adapter; shared chrome declarations consolidated |
| `apps/web/src/styles/navigation.css` | Remove obsolete Home rules/dark drawer conflict |
| `apps/web/src/styles/shared-navigation.css` | One church chrome/gutter/focus owner |
| `docs/qa/ux-f2-entry-shell-profiles-review.md` (new) | This review and evidence |
| `knowledge/CURRENT_STATE.md` | Add current held UX-F2 handoff; preserve earlier bodies |
| `knowledge/ROADMAP_STATUS.md` | Record UX-F2 review status; no next-task selection |
| `knowledge/TESTING_ENVIRONMENT.md` | Actual current qualification and limitations |

## Findings, preservation and stop boundary

The complete final diff/source and affected-consumer review is closed with **zero BLOCKING / zero SHOULD FIX findings**. Current qualification, final scanner/link checks and preservation proof are recorded in the ignored [final receipt](<../../.git/msprout-uxf2-20261015/final.json>). Stakeholder visual acceptance remains outstanding for the revised Home canvas/width/type/icon scale, informational Teacher notice, navigation and compact entry/profiles. Technical passes cannot grant that acceptance.

Preservation checks compare all unrelated tracked bytes, empty staging/index, HEAD/tracking/main refs, 11 stashes, nine original protected blobs, ten backups, two private files, 30 local QA files and a read-only 39-table/runtime-role development PostgreSQL fingerprint. Existing human browser profiles and encrypted work are never opened. Browser tests use individually owned disposable contexts and isolated synthetic fixtures; API tests use the guarded separate PostgreSQL test database/runtime role. No development reset, key replacement or destructive cleanup occurs. Previous ignored diagnostic evidence is preserved; generated preview output is snapshotted before refreshing it for current PWA proof.

**STOP for stakeholder visual review. No stage, commit, push, merge or deployment.** Hosted results for this unpublished candidate are pending, not passed; predecessor UX-F1 hosted GREEN is historical evidence only. UX-F3, COMPAT-01, Late and all later tasks remain untouched. Future UX-F3 may harmonize its existing internal preparation/Sync/attendance adapters and transfer/recovery layouts after separate selection; no engine, progress telemetry or domain work is implied here.
