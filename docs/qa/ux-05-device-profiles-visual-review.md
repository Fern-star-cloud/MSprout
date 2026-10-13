# UX-05 - Encrypted device profiles: accepted stakeholder review

## Final stakeholder approval and authorized delivery — 2026-10-13

**Stakeholder visual approval is GRANTED. All UX-05 visual findings are closed.** The user explicitly approved the corrected Pack 02 desktop and mobile implementations, compact one-row mobile header, exactly one connectivity indicator and removal of redundant profile footer navigation. All documented functional/accessibility/truthful-state adaptations and remaining artwork differences are accepted. Earlier YELLOW/pending entries below are historical; they impose no new approval requirement.

Approval evidence is the user's current **“MSprout — UX-05 Finalization Authorization”**: “Stakeholder visual approval for UX-05 is GRANTED.” The same instruction authorizes UX-05 finalization only, one commit `feat: finalize encrypted device profiles UX-05`, and normal push to `origin/feat/mvp-foundation`. No UX-06/07/08, merge or deployment is authorized. This records the explicit scope; it changes no governance or security policy.

Qualification and final review confirm the same application/test bytes as the latest successful checkpoints. There are **0 BLOCKING / 0 SHOULD FIX / 0 unresolved visual findings**. Generic pre-unlock identities, masked 6–12 digit string PIN/leading zeros, actual retry deadline, lease distinctions, background/five-minute locking, safe removal, verified preparation, direct recovery and profile-switch sign-out remain qualified. UX-03/UX-04 identity/navigation, backend authorization, encrypted storage and synchronization engines/contracts are preserved.

Retained validation: frontend **719/79**, focused **121/6**, affected route/profile **43/2** and final 25-test copy closure; original **77 unique browser outcomes** retained by effect with the later four-target footer/header checks and picker/screenshot closures replacing affected evidence. No combined fresh aggregate count is claimed. Latest build/TypeScript/lint, responsive 320/360/390/768/1024/1440, keyboard/live-region/axe, scoped OWASP/audits/Pint/structure and unchanged backend **306/3626**/contract guarantees remain applicable. Every accepted browser result passed without a skipped/flaky/retry outcome. Exact gate and source-hash verification: `.git/msprout-ux05-finalization-20261013/qualification.json`.

This finalization changes documents/knowledge only. Required additional checks cover finalized document/link integrity, current tracked/new source secret scanning, whitespace, exact reviewed staging, protected work and Git synchronization. Application/backend suites and dependency/security scans whose guarantees remain valid are not repeated. Final qualification does not imply production commissioning or deployment.

The reviewed task commit is identified by subject `feat: finalize encrypted device profiles UX-05`, parent `d7c7236a7b23cc392ba6373f51004e474f8067ec`, and branch `feat/mvp-foundation`. Its exact SHA and delivery result resolve through Git history and `.git/msprout-ux05-finalization-20261013/finalization.json`. **UX-05 is marked GREEN only after that receipt verifies the successful commit/normal push, clean worktree, matching local/upstream/live feature HEAD and 0/0, with main unchanged.** This avoids placing an invented self-referential commit SHA or an unverified push result in the task commit.

Protected stash `1e104f06fbe3091b54e3916f612668b93f0107b4`, nine original QA/environment blobs and ten backups remain preserved. Only the 23 reviewed UX-05 source/test/document paths belong to this task commit. `.git` screenshots/comparisons/runner outputs, private environment/SQLite, protected files/backups and unrelated work are excluded. Current actual visual evidence remains linked below for local review.

**STOP after verified UX-05 delivery. UX-06, UX-07 and UX-08 remain unstarted; no merge or deployment.**

## Accepted one-row mobile header correction (2026-10-13)

**Accepted visual implementation evidence.** These captures and measurements were recorded at the prior YELLOW checkpoint; the final stakeholder approval above closes that condition. This correction supersedes the earlier mobile second-row geometry and screenshots. Previous correction evidence below remains historical or retained for unchanged guarantees.

Production changes are confined to `apps/web/src/styles/device-profiles.css`: remove the forced 100% connectivity row; use flex alignment/order **Back to Profiles → connectivity → approved MSprout brand** only in headers containing Back; keep the status word unbroken; use 8px minimum horizontal gaps, reduced to 4px below 360px. The brand wrapper uses flex alignment, removing its inline baseline space. The picker preserves its previous brand-before-status order. Existing 12px/16px header padding, 44px Back target, 40×32 logo, 23px wordmark, colors and type remain unchanged. Full Online/Offline words fit at 320/360/390px, so no icon-only status, branding shrinkage, absolute positioning or overlap is necessary. Header height decreases from 87px to 57px.

The router, profile TSX, ConnectivityStatus, all security/crypto/lease/PIN/removal/sync code and approved UX-03/UX-04 branding/navigation are byte-exact with the previous checkpoint. The accepted profile footer stays absent; there is exactly one polite atomic browser-connectivity indicator with its existing server/sign-in caveat. No links move into the four-item rail. Existing sign-in/preparation/Sync/Help and post-unlock routes remain qualified.

Additional affected paths: `apps/web/e2e/ux-device-profiles.spec.ts` adds compact-header center/alignment/no-overlap/44px assertions and 360px coverage; this report and `knowledge/CURRENT_STATE.md`, `knowledge/README.md`, `knowledge/TESTING_ENVIRONMENT.md` record the result. Exactly six current-correction paths; complete UX-05 candidate remains the same 22 unstaged paths.

### Fresh actual 390px screenshot and Pack 02 comparison

![Actual mobile unlock, one-row header, 390 × 900 CSS pixels](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-header-20261013/mobile-unlock-390.png>)

![Approved Pack 02 mobile panel versus actual compact-header unlock](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-header-20261013/compare-mobile-pin-current.png>)

The raw production capture is 390×900 CSS pixels / DPR 1 and copied byte-exact. The comparison pastes the declared original Pack 02 crop and full actual screenshot at native scale 1; no actual crop, masking, retouching or resampling. [Provenance](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-header-20261013/comparison-provenance.json>) and [measured CSS](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-header-20261013/computed-css.json>).

| Width | Header | Actual frame | Online/offline geometry |
|---|---|---|---|
| 320px | 57px | 288 × 690.56 | Single row; full Online and Offline words; no overlap/overflow |
| 360px | 57px | 328 × 690.56 | Single row; full Online and Offline words; no overlap/overflow |
| 390px | 57px | 358 × 690.56 | Single row; full Online and Offline words; no overlap/overflow |
| 768px | 57px | 440 × 667.56 | Single row; full Online and Offline words; no overlap/overflow |

Desktop picker/header computed geometry, typography, paint and spacing at 1024/1440px match the preceding qualified values exactly. At 200% text enlargement, safe flex reflow is retained so readable controls are not clipped; normal-width single-row assertions apply at the six comparison widths.

### Relevant focused qualification and review

- TDD observed the intended geometry failure against the existing production checkpoint: **87px header versus ≤62px requirement**. No valid assertion was weakened.
- **8/8 targeted native browser cases PASS**, Chrome desktop/mobile and native WebKit phone/tablet, workers 1/retries 0, no skip/flaky result. Online and Offline header alignment at 320/360/390/768px, desktop regressions at 1024/1440px, no footer, one status, full textual offline meaning, live-region semantics, 44px Back target, keyboard Enter/focus return, private generic ARIA tree, masked PIN, stored-row preservation, and sign-in/preparation/Help/Sync/genuine-PIN Attendance transitions pass. 200% text/reduced motion/forced colors/no horizontal overflow and axe serious/critical checks pass. Accessibility evidence is browser semantics/tree analysis; no human screen-reader session is claimed. [Native results](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-header-20261013/browser-final-results.json>).
- Review narrowed flex ordering to headers containing Back, preserving the picker's prior order. PIN/locked styles are identical in effect, retaining the eight native safety/layout results. **4/4 focused native picker-order checks PASS** at 320/360/390/768px online/offline; **1 duplicate Chrome closure PASS** recaptures final production unlock at 390px and repeats keyboard/retained routes. [Picker closure](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-header-20261013/picker-results.json>) and [Final screenshot closure](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-header-20261013/browser-closure-results.json>). This is not a fresh 13-case aggregate; the duplicate replaces its corresponding earlier outcome.
- Final production build (including TypeScript build check) and focused E2E-input ESLint PASS; 14 static PWA precache entries. Focused OWASP **76 rules / 3 targets (two changed application inputs plus empty ignore), zero findings/errors/timeouts, approximately 100% parsed**. Current final source secret scan, preservation/whitespace and cleanup checks resolve in the receipt below.
- Reuse qualified **43/2 affected unit tests**, earlier frontend719/79 and focused121/6, backend306/3626, contract/dependency/Pint/structure and broader security evidence only for unchanged guarantees. This CSS-only correction invalidated layout/build/accessibility proof, now replaced above; it cannot change authorization, storage, encryption, synchronization, API or domain behavior. No aggregate unit/backend/full security rerun is claimed.

Complete current correction/direct-interaction review: **0 BLOCKING / 0 SHOULD FIX**. The picker-order scope finding was closed with the scoped selectors and native/build closure. Accepted footer removal and prior work are preserved. Receipt: `.git/msprout-ux05-header-20261013/final-preservation.json`. HEAD/local/tracking/live feature remains `d7c7236a7b23cc392ba6373f51004e474f8067ec`, 0/0; main unchanged. Protected stash, nine original blobs, ten backups, previous knowledge bodies, private environment/SQLite and unrelated source remain exact. Run-owned synthetic loopback server is stopped after evidence capture; no human browser or PostgreSQL data was operated on.

**YELLOW — stakeholder visual approval pending.** No staging, commit, push, merge, deployment or UX-06.

## Previous footer/connectivity correction (footer accepted; mobile geometry superseded)

**YELLOW — stakeholder visual approval pending.** This correction supersedes the earlier profile footer acceptance proposal and all earlier profile screenshots wherever the footer/header differs. Earlier screenshots below remain historical evidence; preparation and unchanged functional/security evidence are retained. Nothing is staged, committed, pushed, merged or deployed. UX-06 is untouched.

The actual local `AppRouter` still contained the committed shared public footer; `DeviceProfilesScreen` separately showed Online/Offline on desktop and its CSS hid that header indicator for mobile PIN/locked views. `ConnectivityStatus` reads `navigator.onLine` and browser online/offline events; it does not query a server or establish authenticated access. Its shared implementation remains unchanged.

The smallest production correction is:

- `apps/web/src/app/router.tsx`: render the existing public footer only when the resolved route ID is not `profiles`. This covers `/profiles`, `/`, `/account/profiles` and existing trailing-slash resolution throughout picker/PIN/locked/management flow. Other public pages keep their footer; church/device/platform branches, route URLs and authorization boundaries are unchanged.
- `apps/web/src/features/device-profiles/DeviceProfilesScreen.tsx`: retain the existing header indicator, make it one polite, atomic status announcement, and explicitly identify browser connectivity in screen-reader text and its tooltip. “Online” does not confirm server availability or signed-in access. Use a named device-label class instead of the generic first-child selector.
- `apps/web/src/styles/device-profiles.css`: keep that indicator visible on mobile PIN/locked headers in a compact 21px row below the brand/back controls, with 4px row spacing. A narrowly scoped override prevents the global `[role="status"]` banner padding/background from expanding this header. Desktop geometry is preserved.

The four device links remain **Use this device, Prepare device, Sync & device, Help**. The five application links are not moved into the device rail. Online sign-in remains in the PIN form; preparation, Sync, Help, keyboard return to profiles and valid-PIN Attendance transition remain reachable. Account/Attendance/platform destinations keep their established public sign-in or authorized navigation contexts. No PIN, lease, encryption, removal, synchronization, private-identity or backend behavior changes.

Correction-specific affected paths are the three production files above, `apps/web/src/app/navigation.test.tsx`, `apps/web/src/features/device-profiles/DeviceProfilesScreen.test.tsx`, `apps/web/e2e/ux-device-profiles.spec.ts`, this report, and `knowledge/CURRENT_STATE.md`, `knowledge/README.md`, `knowledge/TESTING_ENVIRONMENT.md`. Prior UX-05 changes are preserved. The only newly dirty path is `router.tsx`; the complete UX-05 candidate now has 22 paths.

### Refreshed actual screenshots and original-artwork comparisons

Captures use the existing approved comparison viewports: desktop **1024 × 900 CSS px**, phone **390 × 900 CSS px**, DPR 1. They show the actual frozen production build, synthetic isolated profiles and real local cryptography. Actual screenshot files are copied byte-exact, without crop, masking, retouching or scaling. Comparison sheets paste the original declared artwork panel crop and full actual screenshot at native scale 1. [Provenance and screenshot hashes](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-footer-20261013/comparison-provenance.json>) and [computed CSS](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-footer-20261013/computed-css.json>) record sources and measurements.

![Corrected desktop profile-selection screenshot, 1024 × 900](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-footer-20261013/desktop-picker-1024.png>)

![Original Pack 02 desktop versus corrected actual profile selection](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-footer-20261013/compare-desktop-picker-current.png>)

![Corrected mobile unlock screenshot, 390 × 900](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-footer-20261013/mobile-unlock-390.png>)

![Original Pack 02 mobile versus corrected actual unlock](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-footer-20261013/compare-mobile-pin-current.png>)

| Current scene | Verified actual geometry |
|---|---|
| Desktop 1024 | Frame 992 × 610.39; rail 224; header 56; row 712 × 76; unchanged from previous candidate |
| Phone PIN 390 | Frame 358 × 720.56; header 87; connectivity row 324 × 21 with zero padding; input 324 × 48.38; action 324 × 50 |
| Phone PIN 320 | Frame 288 × 720.56; input 254 × 48.38; action 254 × 50; no horizontal overflow |
| Tablet PIN 768 | Frame 440 × 697.56; input 390 × 48.38; action 390 × 50 |

The mobile panel gains 25px for the accessible in-header connectivity row; its footer is removed. Brand, back target, readable supporting type, field/action sizing, surfaces and private generic labels are preserved. A transient missing back-label raster in the first loop capture was recaptured after a real offline→online event; DOM visibility, keyboard action and computed 44px back target passed, and the selected actual capture visibly includes the back label. No image was repaired or application behavior changed to obtain that screenshot.

### Focused validation and retained evidence

- TDD observed four expected failing new cases before implementation (footer removal on three aliases and connectivity semantics); the assertions were refined to distinguish connectivity announcements from existing legitimate profile/queue status announcements. **43 tests / 2 files PASS**: navigation and DeviceProfilesScreen, including existing role/private/removal/recovery expectations.
- **8 targeted cases PASS** across Chrome desktop/mobile and native WebKit phone/tablet, workers 1, retries 0, no skipped/flaky outcome. Both picker/PIN reflow and online/offline/navigation cases run on the final compact-header build. Widths 1440/1024/768/390/320, 200% text, reduced motion/forced colors, no horizontal overflow, axe serious/critical checks, one visible connectivity indicator, no footer, masked PIN focus, keyboard Enter/back focus return, online/offline events, generic private ARIA tree and byte-exact encrypted-row preservation passed. Sign-in, preparation, Help, Sync and genuine valid-PIN Attendance transitions passed. [Final native result](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-footer-20261013/browser-final-results.json>).
- A separate Chrome screenshot recapture repeats the real online/offline and navigation case: **1 PASS**, used for the current 390px actual screenshot and back/status computed geometry. This is a duplicate evidence closure, not a ninth distinct qualified case. [Recapture result](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-footer-20261013/capture-results.json>).
- Accessibility evidence verifies live-region semantics and browser accessibility trees; no human assistive-technology session is claimed. Browser connectivity changes are truthful even though the fixture uses intercepted synthetic API responses; they are not evidence of production server availability or authentication.
- Typecheck, lint, final production build and final E2E-input lint **PASS**; 14 static PWA precache entries. The final CSS-only override invalidated layout/build proof, which was rerun; it did not invalidate unit behavior proof. Only disposable ignored capture tooling was subsequently adjusted to limit discovery to its one synthetic probe.
- Scoped OWASP: **76 rules / 11 targets (10 correction/direct-interaction inputs plus empty ignore file), zero findings/errors/timeouts, approximately 100% parsed**. Coverage includes router, route map, church/platform boundaries, unchanged ConnectivityStatus, profile source/styles and affected tests. No relevant input is excluded. Current source secret scanning and whitespace checks are recorded by the correction receipt.
- Reuse the previous **719/79 frontend aggregate, 121/6 focused qualification and 77 browser outcome ledger only for unchanged guarantees**. The current 43 affected unit tests and eight native layout/navigation outcomes supersede corresponding affected proof. Backend 306/3626, contracts, audits, Pint, structure and unchanged crypto/storage/lease/removal/sync/dependency/security baselines remain applicable by exact input/effect review. No full-suite rerun, fresh backend run or new aggregate count is claimed.

Complete correction diff and direct-interaction review: **0 BLOCKING / 0 SHOULD FIX**. The global status-style interaction was corrected and the affected production build/reflow/accessibility/screenshots rerun. Unrelated source, UX-03/UX-04 navigation/branding, private environment/SQLite, protected stash/original blobs/backups and prior evidence remain preserved. Final evidence resolves in `.git/msprout-ux05-footer-20261013/final-preservation.json`.

Stop remains **YELLOW — stakeholder visual approval pending**. HEAD and live feature remain `d7c7236a7b23cc392ba6373f51004e474f8067ec`; main remains `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f`. No finalization or later UX task is authorized.

## Exact scope and files

DeviceProfilesScreen, DevicePreparationScreen, their scoped styles and the profile-only public-footer condition in AppRouter change production behavior/presentation. The profile screen uses the existing Brand, HomeIcon, Button, Field and native accessible Dialog primitives. Existing routes, church navigation, Home, authentication UI, API/server contracts, encrypted store, crypto/key separation, lease/retry policy, synchronization, removal transactions, dependencies and branding assets stay intact. Test changes adapt the picker step/Prepare this device caption, preserve all behavioral assertions, add PIN/privacy/failure coverage, and repair UX-04's ambiguous ministry text selector by selecting its heading. No human manual-QA file is included.

Exact intended modified/new paths:

- `apps/web/e2e/offline-guest-lifecycle.spec.ts`
- `apps/web/e2e/offline-restart-sync.spec.ts`
- `apps/web/e2e/online-profile-recovery.spec.ts`
- `apps/web/e2e/shared-device.spec.ts`
- `apps/web/e2e/support.ts`
- `apps/web/e2e/sync-pull-authentication.spec.ts`
- `apps/web/e2e/ui-attendance.spec.ts`
- `apps/web/e2e/ui-preparation.spec.ts`
- `apps/web/e2e/ui-profiles.spec.ts`
- `apps/web/e2e/ux-device-profiles.spec.ts`
- `apps/web/src/app/navigation.test.tsx`
- `apps/web/src/app/router.tsx`
- `apps/web/src/features/device-profiles/DevicePreparationScreen.tsx`
- `apps/web/src/features/device-profiles/DeviceProfilesScreen.test.tsx`
- `apps/web/src/features/device-profiles/DeviceProfilesScreen.tsx`
- `apps/web/src/styles/device-profiles.css`
- `apps/web/src/styles/preparation.css`
- `docs/qa/ux-05-device-profiles-visual-review.md`
- `knowledge/CHANGELOG.md`
- `knowledge/CURRENT_STATE.md`
- `knowledge/README.md`
- `knowledge/ROADMAP_STATUS.md`
- `knowledge/TESTING_ENVIRONMENT.md`

## Source and comparison method

Authority is the actual original Pack 02 artwork on page 5 of the 107-page `MSprout_Master_UIUX_Specification.pdf`, interpreted with the approved UX-03 identity, UX-04 shared navigation and 2026-10-13 stakeholder visual clarification. The PDF's conditional-draft cover is not implementation authorization; the user's current request provides that authorization.

The page's embedded artwork was extracted losslessly at **1548 x 1016 native pixels**. Original board SHA256: `c4c38bd8491b3b997a2bb516a42fba81b6df40efd3ec226b26c9d63da16253f4`. PDF SHA256: `c4b16a7f7a8aa7cfe0e0e5da8508900379e698cb10fba8b982b1d40ae130d661`. The entire board and extraction provenance are retained. Source raster pixels do not reveal the original CSS viewport, exact font metadata or vector geometry. The tablet source is the board's explicit same-centered-panel note; it is not a separate tablet artwork panel.

Screenshots are unaltered full-page captures of the built production application in fresh isolated Playwright contexts with synthetic intercepted responses and real local encryption. Desktop Chrome comparison captures use native DPR1 at the stated CSS viewport. Separate Chrome phone and native WebKit phone/tablet emulations retain their original device DPR and raw resolution. No live backend, human account/profile or existing browser storage was used. Full-page dialog capture naturally includes the page outside the current fixed-backdrop viewport; it has not been masked or repainted.

Comparison sheets place declared crops of the original board beside the **entire** production screenshot, at scale 1:1. No screenshot cropping, resizing, repainting or masking is used. Raw images, complete original artwork, crop rectangles, hashes and computed CSS are retained in ignored `.git/msprout-ux05-20261013/`. Runner artifacts are not commit candidates.

![Complete original Pack 02 artwork](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-20261013/pack02-original.png>)

## Previous checkpoint desktop profile picker (historical screenshot)

Generic Profile 1/Profile 2 rows, mint device circles, navy hierarchy, blue Use profile actions, outlined Prepare this device, light surfaces and a compact generic device rail follow Pack 02. The selected radio remains a keyboard-accessible control. Opening PIN entry does not itself sign out or unlock; submitting through the existing switchProfile preserves normal online switching sign-out. No saved name, church name, membership, roster, prior attendance, identifier or queue count is disclosed before unlock.

![Original desktop picker versus actual production at 1024 CSS pixels](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-20261013/compare-desktop-picker.png>)

## Previous checkpoint phone and tablet PIN (historical screenshots)

The separate centered PIN panel uses one masked input, numeric keyboard hint, exact ASCII 6-12 digit string validation and leading-zero preservation. Client validation is inline and announced; incorrect PIN clears the field. The existing PIN verification/retry controls remain authoritative. Entering and returning from this panel preserve stored records; focus enters the input and returns to the selected recreated Use profile button. The local PIN is explicitly separate from the online church password.

![Original mobile PIN versus actual 390 CSS pixel production capture](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-20261013/compare-mobile-pin.png>)

![Same centered original panel versus actual 768 CSS pixel tablet layout](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-20261013/compare-tablet-pin.png>)

## Preparation sequence

Online account sign-in -> verified church/access -> local PIN and confirmation -> encrypted persistence and checks -> Ready. Existing verified membership, current-session Owner MFA and Teacher assignments are reused. Routine preparation has no raw Church ID field. Interrupted/uncertain creation preserves the original actor/church/device/key and existing work; retry continues the same profile. Readiness still requires real durable encrypted bootstrap, valid authorization and reverified access, and creates no attendance draft or outbox event. Locked/offline/denied/stale completions suppress success. The four-stage strip is two columns on phones, four on wider layouts; it shows Ready only after the existing checks succeed.

![Production: verified preparation access at 390 CSS pixels](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-20261013/browser-density/ux-device-profiles-prepara-48bde--truthful-unavailable-state-chromium-desktop/prepare-access-390.png>)

![Production: local PIN and confirmation at 320 CSS pixels](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-20261013/browser-density/ux-device-profiles-prepara-48bde--truthful-unavailable-state-chromium-desktop/prepare-pin.png>)

![Original preparation strip versus actual durably Ready screen](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-20261013/compare-preparation-ready.png>)

## Locked, incorrect PIN, retry and online reauthentication

Profile locked clears/hides protected presentation while retaining every encrypted record. The existing five-minute idle timer and background signal enforce locking. Encrypted data is not deleted by locking or sign-out. The original existing-profile recovery path remains independent of normal profile switching. A correct local PIN with an expired/unverifiable lease stays on Profiles, shows Online sign-in required and cannot navigate into protected Attendance. PIN entry alone never renews online authority.

PIN not accepted uses the actual error, a single visible inline message plus an accessible announcement, cleared input and the stored retry deadline. The synthetic sixth failed attempt exercises the actual 32-second policy; the source's illustrative 00:24 is not copied. Reloading preserves enforcement, and unlock/recovery stay disabled during the enforced delay.

![Original locked state versus actual production](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-20261013/compare-locked.png>)

![Original illustrative retry versus actual enforced retry](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-20261013/compare-retry.png>)

![Original online authentication state versus actual expired-lease handling](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-20261013/compare-online-required.png>)

An unavailable upload count is independently unknown. It does not become zero or falsely imply an expired verified lease. A focused failing regression identified that distinction; the corrected state preserves the verified lease, displays count unavailable and retains the existing removal safety checks.

![Production: unavailable queue count with a verified lease](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-20261013/browser-last-queue/ux-device-profiles-an-unav-195b1-ith-an-online-sign-in-claim-chromium-desktop/queue-unavailable-verified-lease.png>)

## Guarded removal and forgotten PIN

Blocked/unknown/unreadable removal assessment presents This profile cannot be removed, privacy-safe risk guidance, Open Sync and Cancel. Cancel is the initial focus; Escape/Tab containment/focus return work and cancellation writes nothing. There is no destructive override. The existing store's full seven-store, lease/key, synchronization, draft/outbox/quarantine and mutation-time concurrency/rollback guard was reviewed and retained. Safe removal still requires explicit generic-label confirmation and rechecks in the deletion transaction. Isolated tests prove concurrent/uncertain work prevents deletion and another profile/church remains byte-for-byte unchanged.

Forgotten PIN guidance states that church password reset/sign-in cannot decrypt the old local key, reset its PIN or justify deletion/recreation. It preserves browser storage and directs only legitimate account-access/authorization refresh with the existing PIN.

![Original removal-blocked state versus actual guarded modal](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-20261013/compare-blocked-removal.png>)

## Previous checkpoint computed CSS and responsive evidence (historical profile headers/footer)

Measurements below are `getBoundingClientRect` and `getComputedStyle` from the real production browser, in CSS pixels, not estimates from the raster artwork. Complete position/size/font/line-height/paint/gradient/padding/radius/gap records are linked below.

| Scene | Actual bounds / spacing |
|---|---|
| Desktop picker 1440 | Frame 1080 x 610.39; rail 224 wide; row 712 x 76, 12px/16px padding, 16px gap, 8px radius |
| Desktop picker 1024 | Frame 992 x 610.39; rail 224; profile content 760 x 552.39 with 24px padding; header 56 high |
| Phone PIN 390 | Frame 358 x 695.56; content 356 wide with 16px padding; input 324 x 48.38; primary action 324 x 50 |
| Phone PIN 320 | Frame 288 x 695.56; content 286 wide with 16px padding; input 254 x 48.38; primary action 254 x 50 |
| Tablet PIN 768 | Centered frame 440 x 672.56; input 390 x 48.38; primary action 390 x 50 |
| Removal-blocked modal | 512 x 398.69 at desktop, 24px padding, 12px radius; native viewport-centered modal, scrollable on small/enlarged views |
| Preparation at 320 | Four stage rows reduced from 160px to 102px (access/Ready) or 116px (PIN) in two columns; no authority/field/data change |
| Typography / paint | Body 16px; supporting 14px; PIN heading 24px / 31.19px line-height; navy rgb(16,44,70); blue action rgb(21,101,216), white text |

Computed font stack remains the established Inter/ui-sans-serif/system-ui/Segoe UI stack; this does not claim that a downloaded Inter font or the bitmap's original font was identified. Button/card radii stay 8px/12px; primary PIN action is 50px high, links/summaries/cancel targets at least 44px. Initial rail contrast 4.47:1 was corrected to the existing lighter blue surface and verified with axe. No fixed card heights or new whitespace spacers were introduced. Longer explanatory states and fields wrap; complete stored values are retained.

320/390/768/1024/1440, 200% text, reduced motion, forced colors, horizontal reflow, keyboard entry/return, dialog containment/Cancel/Escape, and no private pre-unlock DOM/accessibility-tree disclosures are qualified. Browser emulation and a controlled visibility signal are not physical-device or human-assistive-technology certification. The actual store timer is advanced through five minutes for idle proof; actual visibility-handler invocation clears protected views and preserves bytes.

[Complete computed CSS](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-20261013/computed-css.json>) | [Native image provenance](<C:/Users/MARYJANE S. ATILLO/OneDrive/Desktop/MSprout/.git/msprout-ux05-20261013/comparison-provenance.json>)

## Remaining visual differences and reasons

- The original raster is a design illustration, not an executable CSS/font export. Shared approved fonts, actual viewport widths and 44px accessible interactions govern the production geometry; exact drawing-pixel equivalence is not claimed.
- The existing Choose a device profile route heading, native radio selection, sign-out note and supported recovery/management/forgotten-PIN disclosures remain. Those functional rows make the complete phone PIN panel taller than the source's unlock-only illustration; they are compact closed 44px disclosures before unlock, not fixed-height whitespace.
- The profile-only public footer is removed by the stakeholder correction above. Other public routes retain supported destinations. The four device rail links remain unchanged; phone/tablet retain the centered generic panel with one accessible header connectivity indicator.
- PIN values are cleared on error and stay masked; no new reveal/reset/deletion shortcut was added to reproduce the source's eye icon or populated error field.
- Retry duration, connectivity and authority states come from actual controls. Offline is never hard-coded and does not imply an online session. Uncertain counts and incomplete downloads never imply success.
- The blocked state uses the existing native accessible modal and safety explanation, not an unsafe removal override. Full-page capture retains the viewport backdrop exactly as the browser renders it. The original tablet note has no separate tablet mockup to compare pixel-for-pixel.

These differences are explicitly submitted for stakeholder review. Technical validation does not grant visual acceptance.

## Prior implementation qualification and final review (retained by effect)

- Focused TDD: first picker/invalid-PIN additions fail as expected (5 fail/16 pass); later unavailable-count regression fails (1 fail/24 pass) before its root-cause correction.
- Complete frontend validation: **719 tests / 79 files PASS** in the successful serial run. The first aggregate's ambiguous existing UX-04 name selector was corrected to the heading; no assignment/role assertion was weakened.
- Latest focused profile/preparation/store/removal/navigation proof: **121 tests / 6 files PASS**. Final changed-input lint and production build/typecheck PASS; 14 static PWA precache entries; API responses still are not cached as static assets.
- Browser qualification: **64 native screen outcomes** across Chrome desktop/phone and native WebKit phone/tablet, plus **13 Chrome regression outcomes**, all qualified (77 unique). This is an explicitly documented union, not a fresh single 77-test invocation. Density and unavailable-count closures supersede affected prior outcomes; all remaining outcomes stay valid by effect. Every accepted outcome is passed, with no accepted skip/retry/flaky result.
- The first WebKit launch attempted absent build2359; the documented already-installed native2336 executable resolved it process-locally. Four later five-second observation failures showed actual crypto/IndexedDB operations still busy. Bounded 30-second encrypted-completion observation budgets match existing real-key setup; the same durable-completion, authorization and preservation assertions remain. Current focused native reruns close all four, without changing PIN retries, encryption iterations or product behavior.
- Regression coverage includes online switch sign-out then reauthentication, direct recovery without sign-out/Attendance creation, actual origin-only sync referrers and incomplete-download handling, replay convergence, background/private-view clearance, cross-profile roster isolation, quota/preservation, cancellation and concurrent-removal refusal. These flows use existing code, not new UX-06 functionality.
- Current pnpm high-level audit, Composer strict validation/audit, Pint and complete read-only structure script PASS. Initial audit TLS chain failures were resolved using process-scoped Windows system trust / a temporary trusted public CA bundle outside the repo; TLS verification remains enabled. No installation/global trust/security changes occurred.
- Unchanged backend **306 tests / 3626 assertions**, contract/generated-client drift and full application security/history/PWA baseline are retained from the approved predecessor under input/effect-based invalidation. No fresh backend suite or root `pnpm verify` invocation is claimed. Server, contract, migration, credentials, dependencies, crypto, storage and sync engine bytes remain exact.

Prior checkpoint OWASP scan: **76 applicable rules / 32 explicit changed and directly relevant targets / approximately 100% parsed / zero findings, errors or timeouts**. Empty snapshot ignore file includes relevant new source/tests. Full CI security scope is unchanged. That checkpoint's source Gitleaks and final document delta had zero findings. The current correction scan and preservation receipt are identified above; prior evidence is retained only for unchanged guarantees.

The complete diff/source review includes production files, every adapted/new test and directly relevant authorization/lease/removal/sync interactions. One remediation queue closed radio accessible naming, recreated-trigger focus return, truthful expired/unknown state separation, duplicate PIN error presentation, rail contrast, stage density and fixture compatibility/observation defects. Corrected portions/direct interactions were reviewed and validated. No remaining BLOCKING or SHOULD FIX implementation finding; documented visual differences remain stakeholder-owned acceptance items.

## Preservation, Git state and approval stop

Expected/local/tracking/live feature HEAD remains `d7c7236a7b23cc392ba6373f51004e474f8067ec`, ahead/behind 0/0; origin/main remains `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f`. Staging is empty. The protected stash `1e104f06fbe3091b54e3916f612668b93f0107b4`, all nine original blob identities and ten raw backup hashes remain exact. Unrelated source/assets/backend/contracts/dependencies and private environment/SQLite bytes are checked against entry hashes without revealing contents. Existing PostgreSQL, human browser/IndexedDB profiles, drafts/outbox/conflicts/cursors and prior evidence were not operated on. Run-owned loopback static servers have no backend proxy and are stopped after capture.

Knowledge adds the verified current UX-05 review checkpoint while preserving prior bodies and decision history. Exact preservation and source/gate/cleanup receipts resolve under `.git/msprout-ux05-20261013/final-preservation.json`. No commit, push, merge or deployment; UX-06-UX-08 are untouched. **Stop for explicit stakeholder visual acceptance; finalization remains separately authorized afterward.**
