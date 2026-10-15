# UX-F3 — Device Preparation, Synchronization and Attendance review

## Stakeholder-approved UX-F3 finalization — 2026-10-16

The stakeholder explicitly approves the final Device Preparation, Synchronization/Recovery, Attendance/Temporary Guest visuals and both accessibility corrections: **F3-FINAL-01 Attendance roster-search focus and F3-FINAL-02 Sync PIN focus**. The accepted native WebKit390×420/200% comparison keeps the full PIN outline above expanded navigation and preserves manual scrolling. Earlier unchanged-screen approvals remain valid. Controlled publication of the exact **17 paths:15 modified/two new** is separately authorized. Earlier review/finalization holds below are preserved dated records, superseded for this candidate by this approval.

Task identity: **feat: unify preparation sync and attendance UX-F3**, parent UX-F2 **c09e40f4ec5ec08cf63eb0c509ee17f1d5b17061**, branch **feat/mvp-foundation**, tracking **origin/feat/mvp-foundation**. The exact committed SHA, normal feature push, synchronization and hosted Web/API/Security results resolve through Git and ignored .git/msprout-uxf3-20261015/publication-20261016/final.json. Pending/failed hosted checks never establish GREEN delivery; publication evidence is distinct from local qualification and this approval. No merge, deployment or later task follows.

### Final source, visual and validation review

All thirteen application/test/style paths match the final qualified hashes. The full273-pair screenshot manifest, representative desktop/tablet/phone boards and targeted Attendance/Sync comparisons remain unchanged and match the stakeholder-approved candidate. No visual, functional, API, shared-navigation or storage edit is part of finalization. Only this report and three current knowledge records receive final approval/status information.

Retain the valid initial comprehensive frontend744 tests/79 files, isolated API306 tests/3,626 assertions, PWA8/8, contract/structure/Pint/Composer/dependency/build/security results, plus final37 Sync tests,46 Attendance tests and their affected qualification. The30 Sync/workflow browser cases,12 retained Attendance cases,8 unchanged original phone probes,2 matched native visual cases and2 enlarged native visual cases retain exact case/evidence provenance. Chrome/native WebKit320/390px normal and420px heights,200% text, Tab/Shift+Tab, dialog/unlock/relock focus, label/hint/error/button reachability, full outlines, scrolling and encrypted-work preservation remain qualified. Four strengthened cases prove enlarged error feedback and successful retry. Document-only approval records do not invalidate these application guarantees; no expensive suite is repeated without an input change.

Timing failures are retained, not erased: the30-case attempt had29 passes and one intercepted account response taking8,261.63ms against the unchanged5,000ms assertion; the stronger four-case attempt had two390px passes and two320px setup timeouts before Sync; the original10-case probe/visual attempt had nine passes and one390px WebKit navigation timeout with pending local CSS. Only those failed cases were rerun serially, unchanged, and passed. No timeout, activation, persistence, synchronization, authorization, security or visibility assertion was weakened. The reviewed evidence establishes no unresolved reproducible UX-F3 product failure. Native physical-device/IME and third-party CAPTCHA behavior are not claimed validated. Raw Windows CRLF contract behavior and historical parser-warning limitations remain accurately documented, not repaired or reclassified.

Finalization checks cover exact diff/inventory, source/screenshot hashes, references/anchors/whitespace/secrets, protected resources, a fresh read-only39-table development PostgreSQL/runtime-role fingerprint, and safe Git refs/staging. These actual results are recorded in the publication receipts. Security coverage retains the applicable scoped OWASP scans and checks current source text; workflows, dependencies and protected work remain unchanged. Final review has **zero BLOCKING and zero SHOULD FIX** findings. All original screenshots, traces, failed attempts, diagnostic helpers, private resources, stashes, backups and Git history remain preserved; ignored diagnostic artifacts are excluded from the commit.

### Informational follow-up: possible UX-15 accessibility refinement

At390×420px and200% text, the fixed phone navigation wraps into two rows and measures about169.78px high (top250.22px). The accepted Sync correction accounts for that actual obstruction and keeps controls usable, with context reachable through normal scrolling. Record navigation density/usable-height refinement as a **possible UX-15 accessibility item**, requiring separate task selection and visual review. This is an informational observation, not an unresolved UX-F3 defect or authorization to redesign navigation now.

Preserve genuine three-stage Preparation, truthful upload/download/recovery state, Present/Absent/Unmarked attendance, guests/finalization, encrypted drafts/outbox/receipts/cursors, authorization and leases. Late/counting/guest/bulk/color/compatibility proposals remain unimplemented. **STOP after UX-F3 publication and exact-SHA hosted verification.** No COMPAT-01, Late, Packs06–12, CI-02, production activation, storage migration, destructive cleanup, merge, deployment or other task is authorized.

## Preserved qualification and pre-finalization records


## F3-FINAL-02 Sync PIN correction — 2026-10-16

**Technically qualified, unstaged UX-F3 review candidate. F3-FINAL-01 is stakeholder-accepted as resolved; F3-FINAL-02 is corrected and ready for targeted visual review. Zero remaining BLOCKING / SHOULD FIX findings.** No staging, commit or push is authorized. Existing unchanged Preparation, Sync and Attendance visual approvals remain valid. This entry supersedes earlier open-finding/scope statements below, which remain preserved historical records. No later task is selected.

### Confirmed mechanism and equivalent baseline

Fresh equivalent native WebKit traces on the preserved UX-F2 build and the held candidate reproduce the same PIN obstruction at320/390×420. The focused input is initially below the viewport. Native reveal occurs after the first animation frame; the second frame sees the settled but obstructed input. HTML/document owns scrolling; all intermediate ancestors have zero scrollTop and visible overflow. The header is in normal flow. Layout and visual viewport both measure420px high at scale1/offsetTop0. Existing shared input scroll margin8px/112px does not make native input reveal account for the fixed navigation. Its actual top is355px, bottom420px, height65px including existing safe-area spacing. No independent nested scroll or altered focus identity causes the failure. The remaining390px/200% trace additionally proves late font/text reflow changes navigation top from291px to250.22px (169.78px tall, two rows). Observing its rendered size from Sync catches this geometry change without changing shared navigation. No shared-navigation defect or ownership expansion is needed.

| Native WebKit,420px height | PIN top | PIN bottom | Navigation top |
| --- | ---: | ---: | ---: |
| UX-F2,320px | 388.86 | 433.53 | 355 |
| UX-F2,390px | 389.17 | 433.84 | 355 |
| Held candidate before correction,both widths | 384.78 | 433.16 | 355 |
| Corrected candidate,both widths | 298.78 | 347.16 | 355 |

This is a demonstrated pre-existing presentation defect, not an encryption, authorization or sync-engine defect. It is distinct from Attendance's above-viewport obstruction: copying Attendance's start alignment would unnecessarily lose PIN label/context. The Sync correction uses the field group's bounds and the measured available viewport.

### Narrow correction and exact source diff

Only SyncScreen adds a root ref and a presentation effect. It checks the actual active descendant after two animation frames, bounds the usable area using visualViewport offset/height and the horizontally overlapping fixed navigation rectangle, reserves8px for the existing3px outline plus3px offset, and scrolls the document by only the required difference. The complete Field group includes label, hint and inline error when it fits. If enlarged text makes that group taller than the available area, it keeps the focused control visible and leaves normal scrolling available for its context. Focus, viewport resize, observed screen/navigation size changes and changed PIN error trigger measurement; cancellation and listener cleanup are explicit. Pointer-down guards prevent shifting a pressed control before release; release only rechecks when that press changed focus, preserving manual scroll gestures. ResizeObserver watches geometry, with explicit cleanup; there is no scroll listener. No focus replacement, interception of Tab, timeout, navigation/shared CSS change or domain operation is added.

All existing account verification, actor/church binding, PIN rules/masking, retry logic, unlock/lock, offline/lease restrictions, recovery, receipts, events and persistence code remain byte-equivalent after excluding this isolated presentation addition. No shared navigation, CSS, crypto, storage, auth, sync engine, backend, API, dependency, governance or workflow file changes in this correction.

```diff
diff --git a/.git/msprout-uxf3-20261015/sync-focus-correction/before/apps/web/src/features/synchronization/SyncScreen.tsx b/apps/web/src/features/synchronization/SyncScreen.tsx
index dea0365..b81dae2 100644
--- a/.git/msprout-uxf3-20261015/sync-focus-correction/before/apps/web/src/features/synchronization/SyncScreen.tsx
+++ b/apps/web/src/features/synchronization/SyncScreen.tsx
@@ -54,0 +55 @@ export function SyncScreen({ store = profileStore, recovery = syncRecovery, stat
+  const screen = useRef<HTMLElement>(null)
@@ -163,0 +165,53 @@ export function SyncScreen({ store = profileStore, recovery = syncRecovery, stat
+  useEffect(() => {
+    const root = screen.current
+    if (!root) return
+    let frame = 0, pointerDown = false, pointerFocus = false
+    const reveal = () => {
+      cancelAnimationFrame(frame)
+      // Native WebKit reveals inputs after the first frame. Measure the settled
+      // visual viewport and actual navigation, rather than assuming its height.
+      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => {
+        const control = document.activeElement
+        if (pointerDown || !(control instanceof HTMLElement) || !root.contains(control)) return
+        const rect = control.getBoundingClientRect()
+        if (!rect.width || !rect.height) return
+        const viewport = window.visualViewport, top = (viewport?.offsetTop ?? 0) + 8
+        let bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 8
+        const nav = document.querySelector('.phone-navigation')?.getBoundingClientRect()
+        if (nav?.height && nav.left < rect.right && nav.right > rect.left && nav.bottom > top) bottom = Math.min(bottom, nav.top - 8)
+        const field = control.closest('.ui-field')?.getBoundingClientRect()
+        // Keep the label, hint and validation together when they fit. At extreme
+        // magnification keep the control reachable without trapping native scroll.
+        const area = field && field.height <= bottom - top ? field : rect
+        const delta = area.top < top ? area.top - top : area.bottom > bottom ? area.bottom - bottom : 0
+        if (delta) window.scrollBy({ top: delta, behavior: 'instant' })
+      }) })
+    }
+    const focus = () => { pointerFocus = pointerDown; reveal() }
+    const press = () => { pointerDown = true }
+    const release = () => { pointerDown = false; if (pointerFocus) { pointerFocus = false; reveal() } }
+    // Text/font reflow can change the navigation's row count after focus settles.
+    // Observe size, never scrolling: users must still be able to read tall context.
+    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(reveal)
+    observer?.observe(root)
+    const navigation = document.querySelector('.phone-navigation')
+    if (navigation) observer?.observe(navigation)
+    root.addEventListener('focusin', focus)
+    root.addEventListener('pointerdown', press)
+    window.addEventListener('pointerup', release)
+    window.addEventListener('pointercancel', release)
+    window.addEventListener('resize', reveal)
+    window.visualViewport?.addEventListener('resize', reveal)
+    reveal()
+    return () => {
+      cancelAnimationFrame(frame)
+      observer?.disconnect()
+      root.removeEventListener('focusin', focus)
+      root.removeEventListener('pointerdown', press)
+      window.removeEventListener('pointerup', release)
+      window.removeEventListener('pointercancel', release)
+      window.removeEventListener('resize', reveal)
+      window.visualViewport?.removeEventListener('resize', reveal)
+    }
+  }, [pinError])
+
@@ -262 +316 @@ export function SyncScreen({ store = profileStore, recovery = syncRecovery, stat
-  return <section className="sync-screen" aria-labelledby="sync-title">
+  return <section ref={screen} className="sync-screen" aria-labelledby="sync-title">
```

This targeted correction changes seven already-listed paths: SyncScreen.tsx, SyncScreen.test.tsx, ui-sync.spec.ts, this report and the three current knowledge files. **No added path; overall UX-F3 inventory remains17:15 modified/two new.** The full targeted source/test patch is retained as ignored local evidence under sync-focus-correction/targeted.diff.

### Fresh qualification and retained evidence

- Red proof: both fresh baseline and held-candidate native WebKit diagnostics fail at the original PIN obstruction. New width-specific tests also fail on the uncorrected candidate; Chrome's stronger context check additionally exposes enlarged-text overflow of the combined field group. Original assertions and original probe files are preserved, without disabled controls, skipped cases, larger timeouts or safety-policy changes.
- **37/37** Sync screen/status/recovery unit tests in three files pass. The new positive-geometry unit case exercises measured navigation, a nonzero visual viewport offset/resize, an observed two-row navigation resize and observer cleanup, retains active-element identity/masking and proves no unlock/transfer occurs. A draft visual-viewport scroll listener was removed after reflow testing showed it could pull the view back while reading tall context. Focus/resize/error and element-size checks remain; manual scrolling is explicitly tested. The new context-scroll fixture originally aligned to zero, where integer scroll rounding could leave a subpixel clipped edge; its target now has8px inset while the exact complete-visibility assertions stay unchanged. Focus geometry is sampled after native/scheduled frames, strengthening it against transient pre-scroll passes; no polling timeout is enlarged. An initial EventTarget test-helper TypeScript mismatch is corrected by dispatching its event directly; typecheck and lint pass.
- **30/30** affected Chrome/native WebKit Sync/workflow cases qualify (26 existing cases from the full run plus the strengthened four final focused cases); **12/12 Attendance cases** passed in the immediately preceding correction run and remain valid after removal of a Sync-only scroll listener: all Sync and both Owner/Teacher device workflows in each engine, with accepted F3-FINAL-01 Attendance retained unchanged. Coverage includes320/390×420 and×900, forward/backward Tab, PIN return after navigation and relock, successful unlock's existing Continue focus, wrong-PIN inline feedback at normal and200% text, full outlines, fixed navigation, scroll reachability, no horizontal overflow,200% text, system colors/reduced motion and zero serious/critical axe findings. Sync has no dialog of its own; Attendance guest/finalization dialog return remains exercised. The four focused cases are strengthened once more to prove200% text error-feedback scroll reachability, refocus visibility and successful retry without changing any original assertion; all four pass on final source. The other26 existing-case results remain valid (including the one isolated unchanged retry) because only this added test block changes. No physical phone/IME keyboard claim is made.
- Both **unchanged original direct and Tab/Shift+Tab probes qualify4/4 each** in Chrome/native WebKit. One direct390px WebKit run timed out at page.goto before the PIN assertion, with a pending local CSS request (another CSS load took60.23s). That failed case is rerun alone with identical assertions and120s test timeout and passes; the original9-pass/one-timeout run remains preserved and is not described as a clean10-case pass. All original Preparation, Attendance and Sync visibility/safety assertions remain intact. Their prior failures and traces remain preserved. The30-case run reports29 passes and one Chrome quarantine-case account check timeout: sanitized trace proves the intercepted auth response took8261.63ms against the unchanged5000ms assertion. The stronger four-case run reports two390px passes and two320px fixture-setup timeouts before Sync. Only those three failed cases are rerun serially and pass with identical assertions/timeouts. qualification-final.json merges exact case keys and source receipts; it does not erase or label those raw attempts clean passes. No timeout, test, auth or product behavior is changed to address runtime scheduling.
- Matched native WebKit visual proof **2/2** and enlarged-text native visual cases **2/2** pass. Both320/390×420 captures retain label and hint with a fully visible PIN/outlining above navigation. Comparison manifest hashes, before/after screenshots and numeric geometry are preserved locally. No redesign or CSS alteration occurs. At390px with200% text, the final PIN is147.58–242.36px above navigation top250.22px; the existing6px outline extent is fully visible. At320px with200% text, the field group is324px high while navigation begins284px; simultaneous display is physically impossible. The test proves full focused-control visibility and independently scrolls the label/hint fully into view instead of asserting fabricated fit.
- Current typecheck, lint and fresh isolated Vite production build pass. Original complete frontend744/79-files, API306/3,626 assertions, PWA8/8, contract/structure/Pint/Composer/dependency results remain valid by Section3 effect-based invalidation: the correction only measures/scrolls a mounted Sync screen and cannot change backend, SW activation/cache/update safety, contracts, bootstrap, persistence or dependency guarantees. Affected browser/unit/accessibility/build guarantees are requalified; expensive unaffected suites are not repeated. The raw Windows CRLF contract limitation and unchanged historical parser-warning context are retained accurately, not claimed fixed.
- Final scoped OWASP and repository-source secret scanning, documentation links/anchors, whitespace, exact inventory, preservation and Git receipts are recorded by the final verification helper. Security snapshots include current changed/new source and directly relevant trust-boundary code; ignored credentials/runtime/diagnostics remain excluded. No relevant source or valid assertion is excluded to obtain a pass.

### Exact current candidate inventory

- `apps/web/e2e/ui-attendance.spec.ts`
- `apps/web/e2e/ui-preparation.spec.ts`
- `apps/web/e2e/ui-sync.spec.ts`
- `apps/web/e2e/ui-device-workflows.spec.ts`
- `apps/web/src/features/attendance/AttendanceScreen.test.tsx`
- `apps/web/src/features/attendance/AttendanceScreen.tsx`
- `apps/web/src/features/device-profiles/DevicePreparationScreen.test.tsx`
- `apps/web/src/features/device-profiles/DevicePreparationScreen.tsx`
- `apps/web/src/features/synchronization/SyncScreen.test.tsx`
- `apps/web/src/features/synchronization/SyncScreen.tsx`
- `apps/web/src/styles/attendance-lifecycle.css`
- `apps/web/src/styles/preparation.css`
- `apps/web/src/styles/synchronization.css`
- `docs/qa/ux-f3-device-workflows-review.md`
- `knowledge/CURRENT_STATE.md`
- `knowledge/ROADMAP_STATUS.md`
- `knowledge/TESTING_ENVIRONMENT.md`

The two new paths remain ui-device-workflows.spec.ts and this review report; the other15 are modified. Diagnostic helpers, traces, screenshots, isolated build output and receipts stay ignored under .git/msprout-uxf3-20261015/sync-focus-correction/. Nothing is staged.

### Preservation, findings and stop

Final preservation receipt verifies unchanged HEAD/tracking/live feature branch at c09e40f4ec5ec08cf63eb0c509ee17f1d5b17061,0/0 ahead/behind, unchanged local/remote main, unchanged index and empty staging;617 unrelated tracked files,11 stashes,9 protected original blobs,10 backups,2 private files,30 local-QA files and39 development table/runtime-role fingerprints remain exact. Original273 screenshot pairs and the accepted Attendance correction/evidence remain preserved. Browser tests use fresh isolated contexts and intercepted local synthetic API fixtures only; retry metadata changes are confined to disposable test profiles, with encrypted work/key and nonprofile stores preserved.

No BLOCKING or SHOULD FIX item remains after targeted review. Remaining acceptable limits: physical mobile keyboard/IME and third-party CAPTCHA behavior are not validated by these fixtures; pre-existing Windows CRLF limitation remains; hosted checks for this unpublished candidate are pending, not passed. Existing CAPTCHA/action-hierarchy and future-task findings remain historical/later-task items. This is local technical qualification, not GREEN delivery or finalization. **STOP for stakeholder review of F3-FINAL-02 and separate UX-F3 finalization authorization. No stage/commit/push, COMPAT-01, Late, Packs06–12, other task, merge or deployment.**


## Targeted F3-FINAL-01 correction — 2026-10-15

**Attendance focus-clearance finding RESOLVED in the unstaged candidate.** The stakeholder separately authorizes this narrow correction, affected testing and reporting only. **No staging, commit or push.** Prior visual acceptance remains valid for unchanged presentation. Overall finalization remains YELLOW because the unchanged original probes now reach a separate Sync PIN obstruction (F3-FINAL-02 below). This current entry supersedes earlier open F3-FINAL-01/zero-findings handoffs while preserving their history.

### Actual cause and scope

Instrumented native WebKit focus/scroll timelines show HTML/document owns scrolling; no ancestor has a separate scroll offset. The old handler runs in a microtask before WebKit completes input focus scrolling. The first animation frame also precedes that native scroll; the second observes the settled border box. At320px the box moves from−99.70px to−12.70px; at390px from−104.70px to−12.70px. The old handler checks overlay intersections only, so it does not repair a box above the viewport when neither overlay intersects it.

Layout and visual viewport bounds coincide in these scale1 fixtures (offsetTop0, heights900/420). The header is in normal flow. Phone navigation is fixed, with top835px/355px respectively, and includes its existing safe-area padding. Computed input scroll margin is8px top/112px bottom, inherited from existing scoped shell CSS; document scroll padding is auto. Native focus did not reveal the complete control despite that margin. No nested-container, hidden input, replacement node, focus-order change or CSS/global-navigation workaround is needed.

The correction stays inside the existing Attendance keepFocusedControlVisible handler: inspect after two animation frames; recheck pointer focus, connectivity and actual active element; ignore nonrendered zero-area targets; include visual viewport bounds and8px clearance for the existing3px outline plus3px offset; retain overlay checks with that clearance, excluding an overlay containing the focused control; use instant scrollIntoView with the existing scoped scroll margin. No persistent listener, timer, focus suppression, new infrastructure, authorization or data operation is introduced.

### Exact changes relative to the halted candidate

The **overall inventory remains17 paths:15 modified/two new**. No path is added. This correction changes only:

- [AttendanceScreen.tsx](../../apps/web/src/features/attendance/AttendanceScreen.tsx): existing focus handler only; all other source in the screen matches the halted candidate after excluding this function.
- [AttendanceScreen.test.tsx](../../apps/web/src/features/attendance/AttendanceScreen.test.tsx): positive-area clipped-field regression assertion confirms scrolling without marking attendance. Real browsers prove geometry; jsdom supplies no layout.
- [ui-attendance.spec.ts](../../apps/web/e2e/ui-attendance.spec.ts): two new width-specific regressions preserve existing cases and add full control/outline visibility, Tab/Shift+Tab, input identity/value, dialog focus return,420px viewport,200% text/system colors/reduced motion, no overflow and encrypted-record equality assertions.
- This report and CURRENT_STATE, ROADMAP_STATUS, TESTING_ENVIRONMENT: current evidence, resolved finding, remaining scope boundary and historical preservation.

Production diff (the complete targeted source/test diff is retained as ignored focus-correction/targeted.diff):

```diff
diff --git a/.git/msprout-uxf3-20261015/focus-correction/before/apps/web/src/features/attendance/AttendanceScreen.tsx b/apps/web/src/features/attendance/AttendanceScreen.tsx
index 278ca88..d240d8d 100644
--- a/.git/msprout-uxf3-20261015/focus-correction/before/apps/web/src/features/attendance/AttendanceScreen.tsx
+++ b/apps/web/src/features/attendance/AttendanceScreen.tsx
@@ -347,18 +347,21 @@ export function AttendanceScreen({
     const target = event.target, root = event.currentTarget
     // Never move a pointer target between press and release, which can cancel its click.
     if (pointerFocus.current || !target.closest('.attendance-layout')) return
-    // Native focus scrolling does not account for the sticky actions or navigation.
-    // Inspect after the browser's focus step; scrolling changes no attendance state.
-    queueMicrotask(() => {
-      if (!target.isConnected || document.activeElement !== target) return
+    // WebKit can finish native input-focus scrolling after the first frame.
+    // Check the settled viewport as well as overlays, leaving the outline visible.
+    requestAnimationFrame(() => requestAnimationFrame(() => {
+      if (pointerFocus.current || !target.isConnected || document.activeElement !== target) return
       const rect = target.getBoundingClientRect()
+      if (!rect.width || !rect.height) return
+      const viewport = window.visualViewport
+      const top = viewport?.offsetTop ?? 0, bottom = top + (viewport?.height ?? window.innerHeight)
       const overlays = [root.querySelector('.attendance-finalize-bar'), document.querySelector('.phone-navigation')]
-      if (overlays.some(overlay => {
+      if (rect.top < top + 8 || rect.bottom > bottom - 8 || overlays.some(overlay => {
         if (!overlay) return false
         const cover = overlay.getBoundingClientRect()
-        return cover.height > 0 && cover.left < rect.right && cover.right > rect.left && cover.top < rect.bottom && cover.bottom > rect.top
-      })) target.scrollIntoView({ block: 'start', inline: 'nearest' })
-    })
+        return !overlay.contains(target) && cover.height > 0 && cover.left < rect.right && cover.right > rect.left && cover.top < rect.bottom + 8 && cover.bottom > rect.top - 8
+      })) target.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' })
+    }))
   }
   async function confirm() {
     if (!draft || !editable || draft.entries.some(entry => entry.state === 'unmarked') || operating.current) return
```

### Actual requalification

| Check | Result |
|---|---|
| Focused browser TDD before correction | Chrome2 pass, WebKit2 expected failures at search visibility; saved red evidence uses immutable pre-correction candidate build. |
| Affected Attendance/Owner/Teacher browser suite | **16/16 PASS** across Chrome/native WebKit: six Attendance and two authorized-role workflow cases per engine, including the four new focus cases. No retries/skips/timeouts increased. |
| Focused Attendance unit/domain/lifecycle tests | **46/46 across five files PASS**, zero unhandled errors. |
| Typecheck, lint, fresh clean production build | PASS. |
| Accessibility/reflow | Full-outline assertions,900/420px heights,320/390px widths, both keyboard directions, guest/finalize focus restoration, retained input node/value,200% text, forced colors/reduced motion, no horizontal overflow and no serious/critical axe findings PASS in the affected suite. |
| Matched visual capture | **2/2 native WebKit cases PASS**, four width/height captures. Corrected search top8.296875px, bottom56.296875px,3px outline/3px offset at both widths and both heights. |
| Risk-scoped OWASP | **25 current changed/directly relevant inputs;76 applicable rules; zero findings/parser errors**. |
| Retained guarantees | Full frontend744/79, isolated API306/3,626 assertions and PWA8/8 remain valid for unaffected guarantees. Only a local focus handler changes: no shared bootstrap/component, controller/domain persistence, API, encryption, sync, service worker/cache/activation or dependency inputs change. No unnecessary aggregate/PWA/backend rerun; fresh46 tests and affected browser/type/lint/build/security proof cover this presentation correction. |

Original finalization direct-focus and keyboard probes are rerun **without changing any assertion**. Each now passes all Preparation and Attendance checks (including search, both dialogs, saved-record equality and both heights) before reaching Sync; each complete four-case run remains Chrome2 pass/WebKit2 fail at Existing local PIN. Do not count those complete probes as green. This new reachable failure does not reopen the corrected Attendance assertion.

Initial jsdom closure exposed two unhandled calls for zero-area controls; the handler now ignores nonrendered targets, with a positive-size regression separately proving the real scroll call. A new test's assumption that WebKit tabs to a preceding link was corrected to test the actual search/filter Tab/Shift+Tab round trip, without removing any old assertion or any new full-visibility check. All failed logs remain preserved.

Ignored evidence root: .git/msprout-uxf3-20261015/focus-correction/. It contains before/source snapshots, timeline.json and timeline320/390 attachments, browser-red-actual.log, browser-qualified.log/JSON, attendance-qualified.log, typecheck/lint/build logs, original-direct/original-keyboard failures, geometry.json, visual captures, targeted.diff and scan receipts. The actual before/after focus board is focus-comparison.png with comparison-manifest.json. The original273 approved pairs remain byte-preserved; styles/layout/branding/components and Preparation/Sync source remain unchanged from the halted candidate. Newly captured focus positions are the intended behavior change. No physical-device/native mobile IME qualification is claimed;420px is a shortened desktop browser viewport simulation.

### Remaining finding and stop boundary

**F3-FINAL-02 — SHOULD FIX, separate Sync scope:** equivalent isolated native WebKit cases at320×420 and390×420 reproduce on UX-F2 and the corrected candidate. The active Sync Existing local PIN is partly below the viewport and behind fixed phone navigation (nav top355px). Candidate box top384.78125px/bottom433.15625px at both widths; baseline top388.859375px/bottom433.53125px at320px and top389.171875px/bottom433.84375px at390px. All assertions remain intact. Logs/geometry/traces are in sync-baseline and sync-candidate; Sync source is entry-exact and no correction is attempted. This requires separate authorization before expanding beyond Attendance.

F3-FINAL-01 has zero remaining BLOCKING/SHOULD FIX items within its corrected Attendance scope. Overall UX-F3 publication still has **one SHOULD FIX: F3-FINAL-02**. Stop for stakeholder review of the targeted correction and direction on that separate finding. No shared navigation/CSS, later task, staging, commit, push, merge, deployment or protected data operation is authorized. Raw Windows CRLF contract limitation remains unchanged; ignored LF-only mirror pass is retained.

## Preserved finalization and review history


## Finalization halted — phone focus-clearance finding — 2026-10-15

The stakeholder explicitly approves the supplied UX-F3 visuals and conditionally authorizes exact17-path finalization. **Publication has not occurred: one SHOULD FIX accessibility finding prevents the required zero-findings qualification. No staging, commit or push.** The accepted visual direction is preserved; no additional application, test or stylesheet edits are made during finalization. Earlier zero-findings/visual-pending statements below describe the preserved review checkpoint and are superseded by this verification result.

Fresh ignored browser probes use real encrypted storage and synthetic intercepted APIs in disposable Chrome/native WebKit contexts at320px and390px,900px and shortened420px heights. Initial direct-focus probe: Chrome2/2 pass, WebKit2/2 fail. Equivalent Tab/Shift+Tab round trips retain the same full-visibility assertion: Chrome2/2 pass, WebKit2/2 fail at roster search. Preparation PIN/submit and Attendance marking/guest/finalize triggers reached before that assertion pass; later dialog/short-viewport/Sync checks in the failed cases are not claimed completed. No native mobile IME or physical-device coverage is claimed.

**SHOULD FIX F3-FINAL-01:** after scrolling through Attendance actions and returning focus to Search roster, its focused input is partly clipped above the viewport in this native WebKit runtime. Direct-focus candidate geometry is top−12.703125px,height48px at both320×900 and390×900. Unchanged UX-F2 baseline reproduces the underlying behavior at320×900 (top−13.390625px,height44px), and390×420 (top−13.6875px,height44px). The baseline390px sequence gets further before failing; do not claim complete regression equivalence at390×900. Keyboard round-trip failures independently identify the same search control, while those numeric measurements come from the direct-focus diagnostic.

Source evidence: AttendanceScreen's unchanged keepFocusedControlVisible handler only adjusts for intersection with the action bar or phone navigation; it does not correct a control clipped above the viewport when neither overlay intersects it. Traces, accessibility snapshots, numeric geometry and a viewport screenshot are preserved under ignored .git/msprout-uxf3-20261015/finalization/phone-browser,phone-diagnostic-candidate,phone-diagnostic-baseline andphone-keyboard, with raw logs/JSON alongside. No assertion is removed, timeout increased, source modified or failure reclassified as a pass.

Smallest proposed follow-up: separately authorize a narrowly scoped viewport/focus-clearance correction in the existing Attendance presentation handler, preserving pointer-click stability and all domain/storage behavior; add focused failing/passing regression coverage, rerun affected browser/ARIA/type/lint/build/security guarantees, and re-review the changed geometry before resuming finalization. No correction is implemented under this finalization-only instruction.

The original62-case browser/PWA and frontend/API/security results remain valid for their exercised guarantees; they do not override this additional failed gate. All13 reviewed application/test/style paths and273 screenshot pairs remain accepted-review-exact. The four documentation files record this stop, preserving their earlier bodies. No new commit means no new exact-SHA hosted checks; predecessor results are not candidate qualification. The Windows CRLF limitation remains unchanged. Protected resources and safe Git state remain preserved. STOP after this diagnosis; no later task, merge, deployment or application-data operation.

## Preserved accepted visual-review checkpoint


## Scope and delivery boundary

Selected task: **UX-F3 only**, explicitly authorized by the stakeholder and resumed after interruption. Verified predecessor: UX-F2 **GREEN**, `c09e40f4ec5ec08cf63eb0c509ee17f1d5b17061`, on `feat/mvp-foundation`, tracking `origin/feat/mvp-foundation`. The predecessor receipt records its exact-SHA Web/API/Security success. The interruption left reconnaissance and preservation evidence, with no application edits; recovery checked the worktree and staging before continuing.

**UNSTAGED REVIEW CANDIDATE. Stakeholder visual approval and separate finalization authorization are required. No staging, commit or push.** **VISUAL APPROVAL PENDING** following completed local technical qualification. A predecessor hosted pass is not a hosted pass for this candidate.

Authority: [documentation index](../INDEX.md), [approved design](../superpowers/specs/2026-10-14-unified-modernization-design.md), [roadmap](../superpowers/plans/2026-10-14-unified-modernization-roadmap.md), and the selected stakeholder request. The historical master PDF is HISTORY ONLY. Existing UX-06/07/08 and UX-F1/F2 behavior and acceptance records remain preserved. This task does not select compatibility, Late attendance, Packs 06–12, CI-02, another retrofit, merge or deployment.

## Exact candidate inventory

**17 paths: 15 modified, two new.** Runner helpers, images, traces, build snapshots, receipts and raw logs are ignored under `.git/msprout-uxf3-20261015/` and are not candidate files.

| Status | Path | Purpose |
|---|---|---|
| Modified | [AttendanceScreen.tsx](../../apps/web/src/features/attendance/AttendanceScreen.tsx) | Present check / Absent circle-minus SVGs; success Present and neutral Unmarked badges. |
| Modified | [AttendanceScreen.test.tsx](../../apps/web/src/features/attendance/AttendanceScreen.test.tsx) | Add requested icon and neutral-state expectations without replacing functional assertions. |
| Modified | [DevicePreparationScreen.tsx](../../apps/web/src/features/device-profiles/DevicePreparationScreen.tsx) | Truthful third-stage label; consistent Back-before-Continue/submit grouping. |
| Modified | [DevicePreparationScreen.test.tsx](../../apps/web/src/features/device-profiles/DevicePreparationScreen.test.tsx) | Save securely during unresolved durable persistence; Ready only after verified completion. |
| Modified | [SyncScreen.tsx](../../apps/web/src/features/synchronization/SyncScreen.tsx) | Shared contextual LoadingState; one busy message; no busy ancestor deferring that live region. |
| Modified | [SyncScreen.test.tsx](../../apps/web/src/features/synchronization/SyncScreen.test.tsx) | Named indeterminate loading, no invented progressbar, live-region ancestry and retained completion-safety proof. |
| Modified | [preparation.css](../../apps/web/src/styles/preparation.css) | Shared tokens/controls; one active panel with supporting context; compact visible phone steps. |
| Modified | [synchronization.css](../../apps/web/src/styles/synchronization.css) | Paired transfers, aligned recovery, shared typography/fields/feedback treatment. |
| Modified | [attendance-lifecycle.css](../../apps/web/src/styles/attendance-lifecycle.css) | Shared typography/controls, readable phone rows, semantic badges and consistent dialogs. |
| Modified | [ui-preparation.spec.ts](../../apps/web/e2e/ui-preparation.spec.ts) | Correct stale post-PIN Unlock locator to the UX-F2 accessible name. |
| Modified | [ui-sync.spec.ts](../../apps/web/e2e/ui-sync.spec.ts) | Extend capture helper to all five requested widths while retaining legacy extra widths. |
| Modified | [ui-attendance.spec.ts](../../apps/web/e2e/ui-attendance.spec.ts) | Five-width captures and the same confirmed Unlock locator correction. |
| New | [ui-device-workflows.spec.ts](../../apps/web/e2e/ui-device-workflows.spec.ts) | Owner/Teacher authorization fixtures, real pending encrypted save, empty filter, selected/offline states, guest/finalize dialogs and computed geometry at five widths. |
| New | This review | Scope, inventory, actual qualification, visual evidence and preservation. |
| Modified | [CURRENT_STATE.md](../../knowledge/CURRENT_STATE.md) | Current UX-F3 checkpoint and explicit review/finalization hold. |
| Modified | [ROADMAP_STATUS.md](../../knowledge/ROADMAP_STATUS.md) | UX-F3 selected; future tasks unselected; prior milestone history preserved. |
| Modified | [TESTING_ENVIRONMENT.md](../../knowledge/TESTING_ENVIRONMENT.md) | Actual task results, environment limitations and evidence provenance. |

## Presentation changes and retained adapters

Preparation replaces three competing desktop instructional columns and repeated navy bars with one dominant active stage and one relevant supporting panel. Existing profile access and PIN explanations remain in the active workflow; redundant Ready/PIN previews are hidden. The genuine three-step list stays visible at 320px. Its third label is **Save securely** until the existing durable-save/lease checks actually establish **Ready**. Back precedes Continue or submit in both stages. Numeric masked PINs, leading zeros, field-linked errors and interrupted continuation remain unchanged.

Sync retains the paired upload/download layout and its actual status projection. Shared LoadingState describes the current operation without an invented percentage, total, estimate, step or new telemetry. The lower copy of the same busy message is omitted while the summary announces it. Final review caught and removed a newly introduced `aria-busy` ancestor that could defer this announcement; focused failing/passing proof covers that correction. Completion still requires existing applied-download evidence, and zero queued uploads, Online, server acceptance or a served cursor do not independently establish full synchronization. Recovery prerequisites, original-PIN unlock, unknown counts, conflict quarantine and expired-access explanations remain available.

Attendance retains the desktop context/roster composition, existing filters, action order, bulk actions and finalization bar behavior. Phones through 600px place the two marking controls beneath the student's name to preserve readable names and comfortable targets. Present uses a check, Absent a circle-minus, and Unmarked a neutral badge. State labels and `aria-pressed` continue to identify meaning independently of color. Existing immediate local-save status remains; no per-mark toast or new save policy is introduced. Guest/finalize dialogs reuse the existing accessible dialog, focus handling and confirmation rules.

All three screens now inherit the UX-F1 font, palette, borders, radii, button states and blue primary treatment instead of redeclaring competing local tokens and generic button variants. White panels, navy headings and the UX-F2 shell/logo/navigation remain. Retained screen adapters own only layout, contextual fields, PIN toggles, transfer panels, roster marking controls, status layout and dialog sizing. Their unique selectors are consumed by these three routed screens, including existing device-only entry and the Preparation-to-Attendance destination. No shared component implementation, root token, shell, router or navigation file changes.

## Validation and fixture diagnosis

Evidence root: ignored `.git/msprout-uxf3-20261015/`. Raw failed attempts are retained; later proof supersedes the specific failed cases without erasing them.

| Gate | Actual evidence |
|---|---|
| Focused TDD | Three requested expectations fail before implementation (51 pass / three fail), then all **54** workflow tests pass. |
| Final accessibility TDD | The added no-busy-ancestor expectation fails with 21 passing tests; removing the ancestor produces **22/22 Sync tests passing**. |
| Full frontend | **744 tests / 79 files pass**, four workers. |
| Full API | **306 tests / 3,626 assertions pass**, serially on guarded isolated PostgreSQL test resources. |
| Typecheck, lint, production build | Pass, including refreshed typecheck/lint and a clean final production build after the isolated accessibility correction. |
| Browser workflow qualification | Chrome **26** and native WebKit **26** workflow cases pass; final **22/22** both-engine Sync closure passes. Together with navigation and PWA this is **62 distinct outcomes**, no failing/skipped cases or retries. |
| Navigation performance | **2/2 pass** across Chrome/WebKit: retained context, no duplicate authorization calls or new loading flash. |
| Real production PWA | **8/8 pass** across Chrome/WebKit. The clean final-build rerun also passes **8/8**. Assertions retain real worker activation, controller identity, notice removal, deferred activation, encrypted pending-work preservation and protected-cache behavior. |
| Pint / strict Composer validation | Pass. |
| Composer / pnpm dependency audits | Pass; no known advisories reported at the configured threshold. |
| API contract | Raw Windows `api:check` reproduces the unchanged CRLF limitation. The contract/generated files are unchanged; equivalent LF-only normalization in ignored copies passes `openapi-typescript --check`. Original bytes are preserved. |
| Structure | Pass. Root `verify` is not separately claimed run; its frontend/type/build/API constituents are qualified individually. |
| Secrets | Full tracked/new-source Gitleaks snapshot (**634 paths**) passes, including lockfile aliases; final documentation refresh passes. Ignored credentials, runtime data, dependencies and runner output are excluded. |
| OWASP | Risk-scoped scan of **25 changed/directly relevant application inputs**, **76 applicable rules**, zero findings and zero parser errors. Final changed-source refresh passes with the same complete relevant scope. |
| Whitespace / links / preservation | Final checks pass after report/knowledge synchronization; exact inventory, links/anchors, whitespace, protected resources and Git hold are verified. |

The two initial browser failures reproduce on the preserved UX-F2 build and the candidate: after entering the original PIN, the tests still seek **Use profile 1**, while the actual UX-F2 button is **Unlock Profile 1**. Retained traces and accessibility snapshots identify that exact mismatch. Only the post-PIN locator changes. Leading-zero PIN recovery, profile/key/device identity, encrypted drafts/blobs/outbox/conflicts, read-only Resume and no-attendance-during-preparation assertions remain intact. Both cases pass on baseline and candidate after correction; no product unlock policy is changed.

New fixture development also exposed two harness assumptions: role is not a plaintext profile field, and the offline status includes the words “saving on this device.” The fixture now verifies the actual authorized role in Preparation and original profile/actor/church binding, then targets the exact pending-save announcement. A real `crypto.subtle.encrypt` call is gated only inside the disposable browser page and released before the normal durable write; no timer, fabricated UI state or product code is substituted. Pending outbox count stays unchanged until save completion. These harness corrections do not remove or weaken pre-existing assertions.

The full frontend/API results remain valid after the final isolated ARIA correction: controllers, persistence, domain logic, authorization, contracts, dependencies and bootstrap are unchanged. Focused Sync tests, type/lint/build, both-engine Sync browser proof, current-build PWA and relevant security scans cover the affected guarantees. Documentation-only synchronization does not invalidate application suites. A reused ignored output directory initially retained an obsolete bundle, so final production/PWA qualification uses a fresh output directory (14 precache entries). All earlier generated output is preserved; no application or cache policy is changed. Existing large-chunk Vite advice is informational; it is not a new build failure or a bundling change in this task.

## Actual visual evidence and accessibility

The preserved UX-F2 production build and candidate use equivalent synthetic API fixtures in fresh owned contexts, with real WebCrypto/IndexedDB. Required matrices cover **1440, 1024, 768, 390 and 320px**, plus retained historical extra widths and enlarged/short viewport cases. They are desktop browser viewport simulations, not physical-device or live-backend evidence.

The final manifest has **273 matched pairs**: Preparation 40, Sync 158, Attendance 75, with zero unmatched images. Sync includes both full-page and viewport captures. Thirteen contact sheets group the full-page comparisons; originals, SHA-256 hashes, computed-style attachments and source provenance are retained. Final Sync closure refreshes only the affected screenshots; all other valid visual evidence is retained. Full-page screenshots show the fixed phone navigation at its viewport location while also including scrollable content below it; this is not a second navigation bar or evidence that an action cannot be scrolled/focused into view.

Separate actual comparison boards in `review/`:

- `preparation-comparison.png`: desktop access, tablet PIN and 320px verified Ready.
- `synchronization-comparison.png`: desktop pending, tablet completed transfer, 320px locked-profile recovery and 390px unknown download completion.
- `attendance-comparison.png`: Teacher desktop selected marks, Owner tablet guest dialog, 390px offline marking and 320px finalization dialog.

The full matrix additionally covers invalid/mismatched PIN, no assignment, Owner MFA, access checking, interrupted durable writes, expiry/auth loss, offline preparation, upload/download waits, lost responses, applied-cursor continuation, unknown storage/review, quarantine, empty attendance filters, pending local encryption, guest quota recovery/restart and finalization. Long-name geometry is checked at seven widths; enlarged long-name screenshots, 200% text, reduced motion, forced colors, short viewports, keyboard focus/traps/restoration and 44px marking targets remain exercised. Automated axe checks find no serious/critical WCAG A/AA violations in exercised states; no manual screen-reader or complete WCAG certification is claimed.

Reviewed visual changes are intentional: removal of repeated heavy bars/columns, larger readable supporting text, visible phone steps, token-consistent fields/buttons/panels, paired transfer hierarchy and wider phone marking controls. Some narrow views become taller to preserve readability and targets. Existing scrolling and focused-action clearance checks pass. No significant unexplained visual departure or horizontal overflow is identified in the reviewed matrix; stakeholder acceptance of the new candidate is still required.

No CAPTCHA code or behavior changes. This task does not claim human challenge completion, vendor behavior, real token acceptance or new third-party verification coverage; UX-F2's documented live-widget layout evidence remains historical.

## Preservation, review and open boundaries

Source review and exact prefix comparison confirm all pre-render workflow controller logic is unchanged (apart from importing the existing LoadingState). Original storage, crypto, sync/recovery/client/status algorithms, attendance repository/domain, guards, API contracts/backend, CI/security workflows, dependencies, service worker and update policy remain entry-exact. Present/Absent/Unmarked is the only attendance model. Late counting/guest/bulk/color and compatibility/protocol/restart decisions remain PROPOSED and unimplemented.

Read-only development database/runtime-role fingerprints cover 39 tables and match entry evidence. Protected keys/private files, encrypted user work, profiles, pending outbox/cursors/conflicts, existing browser profiles, 11 stashes, nine protected originals, ten backups, 30 local QA files and previous task evidence remain preserved. Existing human browser profiles were not opened; test contexts are fresh. No database reset, replacement key, user-data cleanup or historical-document move/deletion occurs.

Final review: **zero BLOCKING, zero SHOULD FIX**. The live-region issue and fixture defects are closed with focused proof, affected validation and direct interaction review. Exact inventory/link/secret/Git/preservation checks pass. Publication remains prohibited. Hosted checks for this unpublished candidate are **not run / pending publication**, not passed. The required next action is stakeholder visual review, followed by a separate explicit UX-F3 finalization instruction if accepted. Stop at UX-F3.
