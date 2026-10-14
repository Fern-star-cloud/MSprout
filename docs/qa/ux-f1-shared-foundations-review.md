# UX-F1 — Shared UI/UX Foundations Review

2026-10-14 (Asia/Taipei). **Stakeholder-approved UX-F1 implementation, visual direction and controlled finalization.** Local technical qualification passes. The stakeholder explicitly authorized one commit and normal feature-branch push of the exact 24 reviewed paths after final checks. Commit identity: `feat: establish shared UI foundations UX-F1`, parent CI-01 below. Actual commit/push synchronization and separate exact-SHA web/API/Security results resolve through Git and ignored `.git/msprout-uxf1-20261014/finalization/final.json`. Pending or failed hosted checks are not GREEN delivery. Only UX-F1 is selected; no next task, merge or deployment is authorized.

Parent/checkpoint: CI-01 GREEN, `a91cdec5f9873eca99c24cde68d5486fea205935`, `feat/mvp-foundation`, tracking `origin/feat/mvp-foundation`. Task-entry local/tracking/live feature match at 0/0; worktree and staging were clean. Local main `d6c66694a8acc252815a088ada3ef8703340b038` and origin/live main `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f` are preservation targets.

[Design authority](../superpowers/specs/2026-10-14-unified-modernization-design.md) · [Selected task](../superpowers/plans/2026-10-14-unified-modernization-roadmap.md#5-bounded-foundations-and-retrofit-specifications) · [Component usage/adapter register](../../apps/web/src/components/ui/README.md) · [Current state](../../knowledge/CURRENT_STATE.md).

## Bounded implementation and regression radius

Reconnaissance found direct foundation imports in 28 production modules: public/church/platform authentication, application and invitation forms; shared shells, Home, routing and update notices; device profiles, Preparation, Sync and attendance; People, Import, review, reports, birthdays/notifications, church activity and platform operations/audit. `CompactNameHeading` also consumes the existing Button/Dialog. A source snapshot and exact consumer paths are retained under ignored `.git/msprout-uxf1-20261014/`.

The old entry stylesheet repeated the root font/reset/button defaults, while `App.css` owned native controls and repeated focus rules. Their applicable defaults are consolidated into `styles/global.css`, with existing native dimensions preserved. The old entry stylesheet retains its roster/import rules as an explicitly owned migration adapter. No stylesheet import, route, role destination, domain controller, stored record, API contract, framework or dependency is changed.

Shared primitives intentionally affect actual consumers: Button uses 14px control text, 12px radius, 44px minimum targets, the approved existing blue gradient, outlined secondary, quiet and destructive treatments, restrained 120ms color/border transitions and stable disabled hover. Busy remains disabled with `aria-busy`; it does not create duplicate spinners or optimistic success. Field labels are 14px/navy with the existing visible boundaries, input values, labels and linked hints/errors. LoadingState presents contextual text and a single static decorative indeterminate mark with atomic polite status semantics.

Preparation and Import now call the same `StepIndicator` using their unchanged stages and original CSS classes. It is an ordered named sequence with `aria-current="step"` and explicit current-stage text, never a percentage or inferred completion. This is markup ownership extraction; no stage transition, prerequisite, batch, focus controller, submission, encryption, lease, receipt or cursor logic changes. Existing workflow adapters preserve their screen geometry. One pre-existing Preparation primary-hover selector is restricted to enabled buttons to keep disabled actions visually stable.

## Canonical ownership and retained adapters

| Owner | Changes and boundaries |
|---|---|
| `styles/tokens.css` | Existing colors/spacing retained; semantic font/heading, gradient endpoints, control/button radii, focus, motion, icon and responsive content/gutter values added. Legacy heading sizes stay unchanged until separately accepted retrofits. |
| `styles/global.css` | Single native reset, typography, focus and form-control owner. Existing native input/select/textarea geometry preserved. |
| `styles/foundations.css` and `components/ui/Foundations.tsx` | Shared action variants, label treatment, feedback/loading and step semantics. Existing Dialog, ErrorSummary, Tabs, tables and list behavior retained. |
| Branding and Preparation/Sync/attendance adapters | Existing brand font and five exact gradient occurrences now reference canonical tokens with identical values. Accepted local layout, radius, font and status exceptions remain. |
| Feature owners | Supply real busy/current-stage state and truthful outcomes. No presentation component reads or writes domain data. |

Removed competing declarations: the old root/reset/global button/heading block in `index.css`; native field/label/control and duplicate focus declarations in `App.css`; repeated hardcoded brand-font and identical blue-gradient values in the narrowly identified adapters. Existing `.application-actions` and `.ui-dialog-actions` remain the layout conventions; no unused header/toolbar/toast framework is added. Existing `HomeIcon` remains the icon family. The component README documents action ordering, visible names and adapter removal ownership.

Retained deliberately: legacy 32/24/20px heading aliases; App role feedback/form widths/old feature layouts; old roster/import rules; scoped Home/navigation/profile/Preparation/Sync/attendance/pack styles and local token overrides. UX-F2 owns entry/shell/Home/profiles; UX-F3 owns Preparation/Sync/attendance; selected pack tasks own their screens; UX-15 closes remaining shared-state adapters. Removing these now would silently perform later retrofits.

The semantic 24/20/18px heading scale, 1152px content, 640px focused form and 24/20/16px gutters are available without globally resizing accepted compositions. Existing 768/1024px responsive breakpoints remain literal native media queries. MSprout/sprout branding, light navigation, blue-white surfaces, navy headings, approved gradient direction and green success/Present semantics remain intact. No heavy navy navigation is introduced.

## Progress and feedback acceptance

- Unknown-duration work uses a visible contextual status, no range/current value, fabricated percentage, estimate, elapsed-time progress or decorative delay. The static mark needs no animation; existing reduced-motion safeguards remain applicable.
- StepIndicator identifies only actual current position. Earlier steps are not presumed complete; future error/completion decoration needs verified feature state. Existing focus behavior announces the meaningful stage changes.
- No production consumer exposes a reliable overall measurable total. No unused determinate-bar component, new telemetry or API infrastructure is added. A future selected measured stage must supply reliable current/total values and a description with native progress or correct named ARIA range semantics.
- Sync retains its existing independent upload/download, pending/unknown and durable-application wording. Applying further shared progress composition belongs to UX-F3. Import preserves partial results and same-batch recovery. No new toast or persistence claim is introduced.

## Actual browser evidence

Browser qualification uses native installed Chrome rendering in fresh Playwright contexts against isolated production preview builds. API/session/role fixtures are intercepted; encrypted profile fixtures are created only inside test-owned ephemeral browser contexts. Existing user browser profiles and databases are not operated. The immutable pre-edit build and source snapshot are preserved. All evidence is machine-local, ignored runner output, not committed image assets.

The equivalent consumer matrix covers anonymous church/platform sign-in, password recovery, empty Device profiles, church application, Owner and Teacher Home, Preparation access, Sync status, locked attendance, Owner ministries/students/teachers, Import upload, empty review, reports, birthdays/activity, platform applications/health/audit. Each is captured at 1440, 1024, 768, 390 and 320px with the same route, fixture, identity, clock and viewport; the screenshot index below distinguishes states. These are actual supported views, not a claim that empty fixtures qualify loaded-data workflows.

The additional existing browser suites exercise loaded People/reports/review/platform data, PIN/lock states, all Preparation stages and actual busy/error states, synchronization interruption/unknown outcome, attendance marking/guest/finalization, Import review/confirmation/partial results, session/role revocation, keyboard focus/dialog restoration, long names, enlarged text, forced colors, reduced motion and preservation of ephemeral encrypted stores. The expanded isolated foundation fixture demonstrates action states and default step styling; it is excluded from the shipped build and is not presented as an equivalent product-screen pair.

Baseline and harness diagnostics are retained accurately. The old Teacher Home test matched a visible ministry heading and its hidden full-name copy; its assertion now targets the same named heading without removing any requirement. Initial consumer-matrix selectors were corrected to actual screen classes/IDs. The application baseline also loaded the unchanged third-party verification widget, whose fixed width overflowed at 320px; a documented existing synthetic Turnstile fixture now provides equivalent application-form comparison without operating a real challenge. **Live CAPTCHA sizing/security is not qualified by the fixture.** No production CAPTCHA option, protection or behavior was changed; responsive live-widget follow-up belongs to separately authorized UX-09.

Machine-local evidence: `.git/msprout-uxf1-20261014/visual-comparison.png` displays actual before/after desktop 1440px, tablet 768px and phone 320px. The preserved interactive `review.html` and `screenshot-pairs.json` locate all 105 original pairs. They are ignored runner artifacts, not product assets or committed images.

Observed changes: phone sign-in labels shrink from 16px to 14px and shared actions acquire the approved gradient, 14px/600 text and 12px corners; the form is about 12px shorter at 320px. Branding, input dimensions, light card/canvas and content order are retained. Preparation's tablet composition, focus ring and stage positions remain; its navigation button glyph follows the shared 20px icon sizing. Desktop Import at 1440px is byte-identical despite shared step markup. Across the matrix 24 PNG pairs are byte-identical and 81 differ; a byte difference alone is not proof of a visual defect. Existing native/template and feature-button differences remain in retained adapters rather than being silently redesigned.

| Consumer/state | Widths (px) | Byte-identical pairs |
|---|---|---|
| -2d6ae-count-platform-applications | 1440, 1024, 768, 390, 320 | None |
| -48b08-mous-account-platform-login | 1440, 1024, 768, 390, 320 | None |
| -49a19-ous-account-forgot-password | 1440, 1024, 768, 390, 320 | None |
| -7ab95-ount-platform-system-health | 1440, 1024, 768, 390, 320 | None |
| -e9c47-form-account-platform-audit | 1440, 1024, 768, 390, 320 | None |
| anonymous-account-login | 1440, 1024, 768, 390, 320 | None |
| anonymous-profiles | 1440, 1024, 768, 390, 320 | None |
| owner-account-application | 1440, 1024, 768, 390, 320 | None |
| owner-account-attendance | 1440, 1024, 768, 390, 320 | 1440, 1024, 390, 320 |
| owner-account-audit | 1440, 1024, 768, 390, 320 | None |
| owner-account-birthdays | 1440, 1024, 768, 390, 320 | None |
| owner-account-conflicts | 1440, 1024, 768, 390, 320 | None |
| owner-account-home | 1440, 1024, 768, 390, 320 | 1440, 1024, 390, 320 |
| owner-account-imports | 1440, 1024, 768, 390, 320 | 1440, 1024, 390, 320 |
| owner-account-ministries | 1440, 1024, 768, 390, 320 | None |
| owner-account-prepare | 1440, 1024, 768, 390, 320 | 1440, 1024, 390, 320 |
| owner-account-reports | 1440, 1024, 768, 390, 320 | None |
| owner-account-students | 1440, 1024, 768, 390, 320 | None |
| owner-account-sync | 1440, 1024, 768, 390, 320 | 1440, 1024, 390, 320 |
| owner-account-teachers | 1440, 1024, 768, 390, 320 | None |
| teacher-account-home | 1440, 1024, 768, 390, 320 | 1440, 1024, 390, 320 |

The shortened hashed case-directory names above match the screenshot manifest exactly. The route/role list in the preceding paragraph supplies their full presentation context. All 21 final matrix cases pass overflow and visible shared-button 44px target checks at all five widths; each case runs serious/critical axe checks at 390px. Separate shared-foundation tests cover labels, contrast, keyboard interaction and enlarged text. This does not qualify every native action, the live verification widget or loaded domain states merely from these matrix fixtures.

## Validation and review

Results retained from this UX-F1 run; unchanged inputs are not rerun merely for reassurance. Ignored evidence root: `.git/msprout-uxf1-20261014/`.

| Gate | Actual result and receipt |
|---|---|
| Focused TDD | Initial 3 expected primitive failures then 43 tests / 4 files pass; separate LoadingState naming and native-font failures corrected and requalified. `focused-red.log`, `focused-green.log`, `loading-name-red.log`, browser receipts. |
| Full web tests | **743 passed / 79 files**; `validation/frontend-final.log`, exit 0. |
| Full API tests | **306 passed / 3,626 assertions**; serial isolated PostgreSQL 18 resources, `validation/backend.log`, exit 0. |
| Typecheck and lint | Full commands pass; final PWA test-only edit passes focused ESLint. `typecheck-final`, `lint-final`, `lint-closure`, `lint-pwa-closure` receipts, exit 0; latest fixture closure `closure/lint-final.log`, exit 0. |
| Production build | Pass; final browser build `validation/build-qualified.log`, exit 0. Later browser-test/docs-only edits do not invalidate shipped output. |
| Pint, strict Composer validation | Both pass, exit 0. |
| Composer and pnpm dependency audits | Both pass, exit 0; no dependency/lockfile changes. |
| Contract drift | Raw Windows command fails on unchanged CRLF; identical LF-mirror command passes. Both results retained, no contract/client edits. |
| Structure and whitespace | Structure passes. Final exact inventory, Markdown files/references/anchors, new-file whitespace and `git diff --check` are checked by `final-verify.cjs` / `final-preservation.json`. |
| OWASP Semgrep | 76 active rules / 29 changed and directly relevant inputs: 0 findings, 0 parser errors. Final test-only PWA fixture edit rescanned separately: 76 rules / 1 input, 0 findings/errors. `validation/semgrep-review.json`, prior `semgrep-pwa-closure.json` and current `closure/semgrep-final.json`; unchanged complete CI-01 baseline retained for unaffected application inputs. |
| Gitleaks | Full 629-source candidate snapshot, including the two new unignored files and explicit lockfile text coverage; redacted result `validation/gitleaks-final.json`, with the previous two-document wording closure in `gitleaks-docs-closure.json` and current five-input closure in `closure/gitleaks.json`. Ignored credentials, dependencies, private runtime and runner output excluded. |
| Broad browser command | **149 passed, 4 failed / 153**, with worker-blocked harness; never claimed as a passing command. `after/browser.json`. |
| Earlier corrected relevant browser subset (historical failed command) | **33 passed, 1 failed / 34**: all 21 consumer views, shared foundations and Import recovery cases pass; public-to-Platform worker update fails. `after/qualified.json`. |
| Earlier PWA group (historical failed command) | **3 passed, 1 failed / 4**; `after/pwa-isolated.json`. This was the pre-closure 152/153 checkpoint, not the current qualification. |
| Current focused closure | **3/3 passed**: candidate Chrome, equivalent immutable baseline Chrome, candidate WebKit. `closure/final-focused.json`, exit 0. |
| Current complete PWA qualification | **9/9 passed**: Chrome 4/4, WebKit 4/4 and equivalent baseline update 1/1. `closure/final-suite.json`, exit 0, retries 0. All 153 distinct broad cases now have valid passing proof through retained results plus this closure; no claim that the earlier failing aggregate command passed. |
| Resume comparison | Pre-correction traces reproduce the waiting-worker condition on both builds. Corrected target-worker observation passes on both. Old logs remain failed evidence; `resume/` plus `closure/` retain the full sequence. |
| Aggregate / hosted | Root `pnpm run verify` was not separately repeated; its web/type/build/API commands ran individually. No candidate hosted CI/Security result exists before publication. CI-01 parent hosted GREEN is historical evidence only. |

The initial full frontend/backend/build/security phase is complete. The later restoration of native CSS inheritance and status-label correction invalidate presentation/build/accessibility proof and were covered by the final production build, 743-test final web run where applicable, consumer/foundation/Import browser closure, and scoped scanner refresh. Browser-test/docs-only changes do not invalidate backend, dependency, build or contract results. The PWA qualification finding is now closed by the current focused and complete suites. The stakeholder subsequently approved controlled finalization of this exact task; publication synchronization and hosted results remain separate from local technical passes.

### PWA root cause, correction and final qualification

**Classification: test-fixture/lifecycle-observation defect with Chromium scheduling sensitivity.** It was present against both preserved pre-edit and candidate assets; no product or UX-F1 regression was demonstrated. The original assertion repeatedly messaged `navigator.serviceWorker.controller` for its revision immediately after the deliberate update action. That controller can still be the outgoing worker. Native lifecycle/message traces show SKIP_WAITING reaching the installed worker, followed by the outgoing worker stopping and restarting when queried, while the new worker remains waiting. A current-controller version query is an active interaction, not a passive indication that the target worker has activated.

The first attempted passive registration lookup passed isolated comparisons but failed the complete Chrome suite. That mitigation is explicitly rejected as insufficient; it is not relabeled green. The final fixture captures the exact waiting-worker object before the action and observes that object's `activated` state and identity as the page controller. Only then does it send the original revision query. This removes registration lookups and old-worker messages from the handoff window, proves the intended worker rather than any current active registration, and retains the original single five-second revision assertion. Browser-internal scheduling details are not independently diagnosed; no upstream issue is asserted to be this exact bug.

The precise new test block is:

```ts
  const waitingWorker = await page.evaluateHandle(async () => (await navigator.serviceWorker.ready).waiting)
  await page.getByRole('button', { name: 'Update when safe' }).click()
  await expect.poll(async () => {
    const activated = await waitingWorker.evaluate(worker => worker?.state === 'activated'
      && navigator.serviceWorker.controller === worker)
    return activated ? version(page) : null
  }).toBe(revision)
  await expect(page.getByRole('region', { name: 'Application update' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Applications', exact: true })).toHaveCount(0)
  await expectNoSeriousAccessibilityIssues(page)
```

No existing intended assertion is deleted: exact revision, actual activation/control, notice removal, lack of account authority, protected-route non-caching, offline cache availability, keyboard/privacy/accessibility and exact seven-store preservation remain. There is no extra skipWaiting message, forced activation/reload, enlarged timeout, retry, disabled worker, test skip, storage reset or product instrumentation. The approved implementation inventory is still the same 24 paths. This closure changes only the existing PWA test plus this report and three current-knowledge prefixes; ignored diagnostic work remains separate.

Lifecycle/state review: application code sends SKIP_WAITING only after its unchanged fresh unsafe-local-work check. The controller publishes its existing checking then idle state after the registrar returns; that return itself is not proof of worker activation, so the browser test now proves activation independently. Native traces confirm the corrected waiting worker becomes activating then activated, controls the page and reports the requested revision; the notice is absent. Fresh-registration fixture navigation is an SPA route change, and no document reload was forced or observed in the instrumented fresh-registration comparisons. The installed Workbox registrar's existing `isUpdate` handling explains the fresh-registration path; this is not a new claim that updated application assets were reloaded, nor a qualification of every already-installed-client/compatibility/restart strategy. Those product decisions remain reserved and unchanged.

Actual final qualification: focused **3/3**, then complete **9/9** (Chrome 4/4 + WebKit 4/4 + baseline Chrome update 1/1), no retries, normal workers, unchanged five-second revision deadline. Current installed Chrome product version is 155.0.8059.40; WebKit uses the already-installed 2336 executable through process-scoped configuration. No browser/runtime was installed or globally changed. All **153/153 distinct UX-F1 cases have valid passing evidence**, combining unaffected previous passes with this closure, not rerunning or rewriting the earlier aggregate result.

Diagnostic history remains explicit: earlier blocked-worker harness and Windows path-normalization comparisons were invalid qualification; mixed ESM/CJS diagnostic loading failed before cases and was corrected only in ignored helpers. Additional CDP worker observation perturbed offline emulation and produced an Online/Offline assertion failure; that run is diagnostic, not a passing full suite. An uninstalled default Chromium 1243 launch failed; existing 1234 was used without installation, passed activation but failed its offline-hint assertion. None of these browser/tooling experiments substitutes for the passing final installed-Chrome/WebKit suites. Prior isolated passes alone did not close the blocker. Logs, console output, traces, lifecycle timelines and all rejected attempts remain under ignored `closure/` and `resume/`.

The [official Playwright activation guidance](https://playwright.dev/docs/service-workers#accessing-service-workers-and-waiting-for-activation) corroborates waiting for native activation before worker interaction; local equivalent-build traces and assertions are the evidence for this repository's correction. **The qualification blocker is closed.** No application update-safety or compatibility correction is proposed or implemented on this evidence. The stakeholder subsequently supplied final review acceptance and explicit 24-path commit/push authorization. No further application changes follow from that approval.

### Final source/accessibility review

Closed in-scope findings: native font inheritance was initially changed by a duplicate-reset consolidation and restored after a failing computed-style assertion; LoadingState's new mark initially left the status unnamed and now has an explicit visible-label relationship with focused failing/passing proof. A disabled-hover probe already passed before any correction and is not claimed as a red test. Existing unit and browser assertions remain intact; additions cover quiet/busy/disabled states, missing-current step IDs, exact linked field descriptions, gradient contrast, status naming, focus, enlarged text, forced colors and reduced motion. No redundant progress animation or range semantics are attached to unknown-duration work. New primitives remain presentation-only.

Review classification: the two in-scope findings above and the PWA qualification finding are closed. No BLOCKING or SHOULD FIX item remains within UX-F1. Screen-specific font/layout exceptions, live CAPTCHA sizing and physical-device/assistive-technology testing remain disclosed limitations. The stakeholder accepted the three shown visual comparisons as the shared-foundation direction; controlled finalization of the exact candidate was subsequently authorized. CSS consumer review covers shared primitives and the 28 direct screen/shell imports plus CompactNameHeading; Preparation/Import controllers differ only in import and step markup. No governance or source-authority amendment is included.

The Windows raw generated-client command retains its documented CRLF limitation. The same check against an ignored LF-normalized mirror passes; original contract/generated bytes are preserved. The two pre-existing Vitest mock-import partial-parser warnings in the comprehensive CI-01 baseline remain unchanged; the focused UX-F1 scan has no parser errors. No failed or incomplete diagnostic is relabeled as a pass. Pre-publication hosted CI/Security evidence belongs to the CI-01 parent. Exact new-commit results are recorded in the finalization receipt and final delivery report; local passes alone do not establish them.

## Exact changed-file inventory

**24 approved task paths: 22 modified, 2 new relative to the CI-01 parent.** The committed inventory must match this table exactly; actual publication and synchronization are verified separately.

| Status | Path |
|---|---|
| Modified | `apps/web/e2e/fixtures/ui-foundations.tsx` |
| Modified | `apps/web/e2e/ui-foundations.spec.ts` |
| Modified | `apps/web/e2e/ui-navigation.spec.ts` |
| Modified | `apps/web/e2e/ui-pwa-consistency.spec.ts` |
| New | `apps/web/e2e/ux-foundations.spec.ts` |
| Modified | `apps/web/src/App.css` |
| Modified | `apps/web/src/components/ui/Foundations.test.tsx` |
| Modified | `apps/web/src/components/ui/Foundations.tsx` |
| Modified | `apps/web/src/components/ui/README.md` |
| Modified | `apps/web/src/features/device-profiles/DevicePreparationScreen.tsx` |
| Modified | `apps/web/src/features/imports/ImportScreen.tsx` |
| Modified | `apps/web/src/index.css` |
| Modified | `apps/web/src/styles/attendance-lifecycle.css` |
| Modified | `apps/web/src/styles/branding-text.css` |
| Modified | `apps/web/src/styles/contrast.test.ts` |
| Modified | `apps/web/src/styles/foundations.css` |
| Modified | `apps/web/src/styles/global.css` |
| Modified | `apps/web/src/styles/preparation.css` |
| Modified | `apps/web/src/styles/synchronization.css` |
| Modified | `apps/web/src/styles/tokens.css` |
| New | `docs/qa/ux-f1-shared-foundations-review.md` |
| Modified | `knowledge/CURRENT_STATE.md` |
| Modified | `knowledge/ROADMAP_STATUS.md` |
| Modified | `knowledge/TESTING_ENVIRONMENT.md` |

The 24 paths include 12 presentation/component/style implementation files, 7 existing/new test files, 1 component usage register, 1 task review report and 3 required current-knowledge files. Application/API contracts, backend, workflows, dependency manifests, source authority, AGENTS and all other tracked files are excluded.

## Preservation, limitations and next approval

The qualification preservation receipt is `.git/msprout-uxf1-20261014/final-preservation.json`; finalization uses the separately retained `finalization/entry-preservation.json`, `prestage.json` and `postcheck.json` receipts under the same ignored evidence root. Hashes are scoped to the reviewed task and checked against the task-entry snapshot. It verifies the expected 24 paths, empty staging and byte-identical Git index, unchanged HEAD/upstream/main refs and all 605 unrelated entry-tracked files. It also verifies original bodies of the three amended knowledge files, 11 stashes, nine protected original blobs, 10 backups, two private files, 30 prior local-QA files, and unchanged development PostgreSQL fingerprints for 39 tables and its runtime role. A fresh read-only closure census in `database-closure.json` exactly matches the task-entry census; no table contents or credentials are printed. Development databases, application keys, existing browser profiles and unsynchronized work were not operated; browser writes were confined to ephemeral test contexts and backend writes to the guarded isolated test database.

Qualification-entry live remote verification found feature `a91cdec5f9873eca99c24cde68d5486fea205935` and main `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f`; local tracking remains 0/0. At qualification closure no fetch mutation, stage, commit, push, reset, clean, stash mutation, merge, deployment or historical-file relocation/deletion had occurred. The subsequent authorization allows only the reviewed task commit and normal feature push; their actual results belong to the finalization receipt. Local main remains `d6c66694a8acc252815a088ada3ef8703340b038`.

Ignored evidence/helpers remain separate under `.git/msprout-uxf1-20261014/`: source/build snapshots, fixtures/configs, read-only database receipts, scanner snapshots/logs, browser screenshots/traces, visual gallery and resumption probes. They must be preserved locally and excluded from any later staging. No generated demo/diagnostic route or fixture enters the shipped build.

Browser emulation is not physical-device or assistive-technology certification. Acceptance of the three shown comparisons is recorded; it is not acceptance or selection of every future retrofit. The subsequent finalization authorization is restricted to these 24 paths. Existing workflow adapters intentionally leave some font/geometry exceptions for future approved retrofits; no full-product uniformity or WCAG certification is claimed. Determinate progress awaits an actual measured consumer. Live third-party CAPTCHA sizing remains a known baseline follow-up, not a repaired or passing case. The competing Sign in / Continue signed-in-session primary-action hierarchy is also unchanged from the baseline and belongs to later authorized UX-F2 screen work. Shared font/gradient/radius refinement applies consistently to both; no authentication/controller or action-order change created this hierarchy.

Recommended UX-F2 follow-up: migrate semantic titles/content widths and remaining native auth actions deliberately; align entry/Home/profile/chrome density while preserving the accepted compositions and role destinations. Recommended UX-F3 follow-up: retire only proven workflow overrides, consume verified step/error/completion state and unify contextual Sync feedback while preserving separate transfers and every encrypted-work invariant. UX-09 should qualify the live verification widget at 320px without weakening verification. None of these tasks is implemented or selected here.

Late counting/guest/bulk/color and compatibility/restart decisions remain PROPOSED; no Late, N/A-reporting, compatibility, Pack 06–12, CI-02, governance or workflow change is included. Finalize only the explicitly approved UX-F1 inventory after the required checks. Stop after its one commit, normal feature push and hosted qualification. No later task, merge or deployment is authorized.

## Finalization authorization and complete visual-manifest review

The stakeholder reviewed technical qualification and representative desktop/tablet/phone evidence, accepted the shared-foundation direction, and explicitly authorized controlled finalization of these 24 paths. Earlier review/publication holds are preserved as historical task stages in the ignored receipts; they are superseded only for this exact one-commit/normal-push scope. No governance, CI workflow, dependency, domain, authorization, encryption, profile, synchronization, API or service-worker policy change is included.

Final review examined the complete 105-pair manifest (21 views × 1440/1024/768/390/320px), including all materially affected consumer compositions. Seven contact sheets and native pixel/dimension comparisons are retained under ignored `finalization/visual-sheet-*.png` and `visual-metrics.json`; original screenshots remain byte-preserved. 24 pairs are byte-identical. The other differences match shared button/field/icon styling and retained adapters. Across 41 full-page height changes, pages shrink by 3–18px with identical screenshot widths; pixel differences include the resulting vertical shifts and are not interpreted as defect percentages. No significant unapproved visual departure, new overflow or accessibility regression was found. The three stakeholder-reviewed examples remain representative; baseline platform navigation, feature layouts, live-CAPTCHA limitation and competing Sign in/Continue hierarchy remain preserved.

Finalization changes only this report and the three current-knowledge prefixes to record acceptance, explicit publication authority, reusable validated evidence and the stop boundary. These documentation-only edits do not invalidate the verified 153 distinct browser outcomes, nine PWA cases, frontend/API suites, production build or application/security scans. Refresh exact scope, documentation links/anchors, whitespace, changed-document secret scanning and Git/protected-state proof before staging. Zero BLOCKING / SHOULD FIX findings remain within UX-F1. No hosted success is claimed until it is observed for the exact resulting commit.
