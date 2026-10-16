# COMPAT-01 B1 — Frozen legacy and isolated preservation harness

## Accepted qualification and controlled finalization — 2026-10-16

The stakeholder accepts B1 reproducibility, isolation, Chrome/WebKit preservation and security evidence, and explicitly authorizes one exact ten-file commit and normal push to `origin/feat/mvp-foundation`. Subject: `test: establish frozen legacy compatibility harness B1`; parent/frozen legacy identity: `9c30def911bb59ae02ecfd3fa291607f141b8c68`. No implementation/test/configuration change is introduced during finalization; only this report and the three current-knowledge records receive approval/status updates.

Exact publication SHA, committed inventory, Git synchronization and post-push Web/API/Security outcomes resolve through Git and `.git/msprout-compat-b1-20261016/publication-20261016/final.json`; exact-SHA workflow links are recorded in the adjacent `hosted.json`. Hosted qualification is pending at commit preparation, never presumed successful. **B1 GREEN** requires successful required hosted checks and verified synchronization. It does not mean overall COMPAT-01 completion. A failed required check preserves the commit and stops without a second corrective commit.

Unchanged local results and encrypted-work evidence below remain valid by exact source/asset hashes. Finalization revalidates the approved inventory, full diff, references/anchors, whitespace, current-source secrets, frozen artifacts, preservation and remote state. B2–B6, compatibility protocol/server rules/cursors/retention recovery/forced upgrades/Late remain unauthorized. Genuine old/new transitions and retention recovery remain **NOT TESTED**. Stop after B1; no merge, deployment, migration or real user-data operation.

## Pre-finalization scope and status — historical review record

Stage A is the stakeholder-accepted analysis baseline. Only B1 is selected: genuine frozen three-state assets and test-only preservation infrastructure. This candidate remains unstaged, uncommitted and unpushed for separate review/finalization. B2–B6, capability/error contracts, cursor/retention recovery and Late activation are not authorized.

Principal legacy source: `9c30def911bb59ae02ecfd3fa291607f141b8c68`, tree `0ed71b5a8cec330dd2f74eb0e1c62e636306a29f`. The frozen application is UX-F3, not a simulated older application. [Current compatibility constraints](../superpowers/specs/2026-10-14-unified-modernization-design.md#6-compatibility-proposal-and-mandatory-proof) and [roadmap gates](../superpowers/plans/2026-10-14-unified-modernization-roadmap.md#7-compat-01-att-late-01-and-unresolved-decisions) remain binding.

## Exact candidate inventory

Six new paths:

- `scripts/compatibility/freeze-legacy.mjs`
- `scripts/compatibility/server.mjs`
- `scripts/compatibility/harness.test.mjs`
- `apps/web/playwright.compat.config.ts`
- `apps/web/e2e/compatibility/legacy.spec.ts`
- `docs/qa/compat-01-b1-frozen-legacy-harness.md`

Four modified paths:

- `apps/web/playwright.config.ts`: exclude only the new standalone compatibility directory from ordinary discovery; no existing test is excluded or changed.
- `knowledge/CURRENT_STATE.md`
- `knowledge/ROADMAP_STATUS.md`
- `knowledge/TESTING_ENVIRONMENT.md`

No production source, dependency, workflow, contract, schema, encryption, synchronization, authorization or update-policy change. Raw assets, browser profiles, encrypted snapshots, traces, integrity probes and scanner copies remain ignored under `.git/msprout-compat-b1-20261016/`.

## Frozen build and identity

The freezer uses `git archive` of the fixed commit, extracts tracked web/build inputs into a new ignored directory and builds there with existing lock-matched dependencies. It never checks out another branch, copies Git history, reads private environment files or installs dependencies. Git's normal clean filters compare dependency inputs, accommodating Windows CRLF without editing the originals. The archive retains canonical Git bytes.

The builder rejects reused output directories and paths outside the B1 task directory. Vite variables inherited from the host are removed; the only supplied Vite value is the public synthetic Turnstile test site key. The build runs in production mode. This key does not qualify a third-party widget or CAPTCHA verification.

Runtime: Node `24.19.0`, Vite `8.2.2`, vite-plugin-pwa `1.3.0`, Workbox build `7.4.1`. This uses the existing installation; it is not a claim of a newly downloaded hermetic toolchain.

Two independent outputs, `frozen-01` and `frozen-02`, have identical archive, source-file and all 16 asset hashes. Full path/hash inventories are in their `manifest.json` files. Key SHA-256 values:

| Input/output | SHA-256 |
|---|---|
| Source archive | `6aa6a1d361a94ee4af6225ce67c34c1e8ee96d88ea53ef021438e257f380cdc4` |
| `index.html` | `5848cfcafeb48848ba6b99dbde8707e424f1bc227e09e9658c0c6e090ae07ae6` |
| `assets/index-Ditgf202.js` | `d93a0484bea91e4880875dcc8b3a953bde0592524061f53e40af7172fcfc8df3` |
| `assets/index-BmXKj8C9.css` | `7848429fa7ec88729e4bcf97435c4005a9840c302eff3af1834f6a616d80d22a` |
| `service-worker.js` | `fa2c7fcddaa63accedcb4c3e3e5c336c6eb21d8bc9b182ec0cd5fb0af2ee2b41` |

The browser checks the served source identity, exact index/application/worker hashes and loaded application resource. No mutable working-tree application source is served.

## Isolation and synthetic fixtures

The server binds an ephemeral port on `127.0.0.1`, validates Host, has no proxy/upstream implementation, and serves only identified assets and explicitly supported SPA routes. Unrecognized APIs and sync requests fail closed. Browser-context routing rejects external page requests. The unchanged worker precaches only the pinned local assets; no external worker resource or live API is configured.

Synthetic GET fixtures expose one Teacher, one church, one ministry and two anonymous B1 students. Bootstrap binds its synthetic 14-day lease to the device UUID supplied by the actual application and starts the cursor at `0`. Its signature is test material, not a production authorization proof. The only permitted POST fixture is CSRF-checked local logout, required by the existing online profile-switch flow; it changes only the fixture's account-availability boolean. There are no accepted sync receipts or backend writes.

Every engine launches a new persistent browser directory inside the guarded, ignored B1 output. The same directory and unchanged origin are used for close/relaunch. The coordinator refuses to reuse nonempty output before Playwright can clear it. Previous runs, failed contexts and evidence remain preserved. No existing browser profile or IndexedDB database is opened.

PIN `184629` is a public, synthetic local-only fixture value. Profile creation, PBKDF2/AES-GCM encryption, starting attendance and marking Present/Absent occur through the pinned UI. Read-only inspection verifies encrypted store records, then independently unwraps the original key inside the disposable browser to compare meaningful draft/event data. Keys are not exported to evidence; raw temporary key bytes are zeroed after import. No plaintext replacement records are seeded.

Online profile switching legitimately sets `requiresReauthentication` to true. The assertions permit exactly this documented metadata change and require all other profile fields and every encrypted store/cursor record to remain identical. Decrypted intent and original event identities are also compared. These scenarios contain no legitimate draft rewrite after the baseline, so ciphertext equality is appropriate; future legitimate encrypted rewrites require semantic/provenance comparisons instead.

## Qualification and evidence boundaries

The browser case covers saved drafts and three pending events; locked/unlocked views; original-PIN/profile resume; persistent browser relaunch; cached reload against an unreachable origin; browser-offline unlock; unsafe waiting-update refusal; a second tab; denied account access; restored synthetic account/PIN readiness without transfer; and an actual write refused after the client clock exceeds lease expiry. It checks unchanged pending intent and zero push/pull requests.

The waiting-worker stimulus appends a comment to the exact production worker. This is explicitly a **same-application lifecycle probe**, not a different application or capable-reader transition. It never sends `SKIP_WAITING` or bypasses the application's unsafe-work check. Closing all contexts can permit ordinary browser lifecycle activation, but no different-build upgrade claim follows.

For offline qualification, first make the origin unreachable and require a real service-worker document response. Then enable browser-offline emulation after the cached profile page is loaded. This respects the existing WebKit offline-document limitation and exercises the real `navigator.onLine` profile-switch branch. An unreachable origin while that flag remains online cannot satisfy mandatory online logout; that refusal is not repaired in production.

The expiry probe changes client time and attempts an existing authorization-checked write. It proves refusal and preservation, not that a previously scheduled real-time lease timer fired. Account restoration is synthetic readiness only; no live sign-in, real lease renewal, server acceptance or completed synchronization is claimed.

Initial failures remain in `expected-red.log`, `build-01.log`, `harness-tests.log`, `browser-01` through `browser-05`, `browser-final`, and command/type diagnostics. They document missing-module TDD, CRLF comparison, test URL/config/selector/fixture mistakes, online-hint versus unreachable-origin behavior, and clock/navigation assumptions. No assertions/timeouts were relaxed to manufacture a pass. Corrected locators use real supported UI flows. `browser-06` passed both engines before the additional account-restoration assertion; its valid evidence remains preserved.

## Final applicable validation

| Check | Actual result |
|---|---|
| Independent pinned production builds | 2 passed; identical16 asset hashes |
| Harness guard/integrity tests | 4 passed;0 skipped |
| Final browser workflows | 2 passed;0 retries/skips;12 checkpoints per engine |
| Chrome | `155.0.8059.80`; persistent disposable profile |
| Native WebKit | Existing build2336, reported version26.6; persistent disposable profile |
| Full frontend | 745 tests/79 files passed |
| Web TypeScript and standalone harness TypeScript | Passed; harness check includes DOM iterable types and JS module inference |
| ESLint | Passed |
| Ordinary browser discovery | 804 cases/38 files; standalone B1 excluded, all original cases remain discoverable |
| Node syntax and repository structure | Passed |
| Affected OWASP | 77 rules/11 inputs;0 findings/errors; ~100% parsed |
| Current-source secret scan | Gitleaks passed;640 tracked/new inputs plus reviewed lockfile text aliases;0 leaks |
| Documentation | 229 local references/8 anchors checked;0 broken; whitespace/structure passed |

Final source-secret, link/anchor, exact inventory and preservation receipts are recorded under the same ignored task directory before handoff. No new hosted result exists because publication is held. This is technical B1 qualification, not GREEN delivery of COMPAT-01.

Final `browser-qualified` evidence passes Chrome and WebKit with all12 checkpoints per engine, including the added restored-account readiness check. Each retains one profile, one draft, three original pending events and cursor0. Actual browser versions are Chrome155.0.8059.80 and WebKit26.6/build2336. The final output guard was subsequently narrowed to fresh direct-child paths; normal browser-test inputs are unchanged, so browser results remain valid by effect. Its refusal tests, standalone types, lint and security checks were rerun. No second expensive application suite is needed for that isolated harness guard or documentation synchronization.

Unchanged UX-F3 production guarantees retain API306/3,626 assertions, original PWA8, contract drift qualification, Pint/Composer/dependency audits and prior security evidence. B1 changes no inputs to those guarantees. They are not represented as freshly executed. Existing Windows CRLF contract limitation remains unchanged. New test source is covered by the standalone harness, types/lint and current security checks rather than relying on a production baseline for new coverage.

## Review and preservation

No BLOCKING or SHOULD FIX finding remains within B1 after harness corrections. INFORMATIONAL boundaries are the future capable reader, actual distinct-build transition, installed-device coverage, production authorization and Stage A cursor/retention risks. None is represented as a B1 pass or silently implemented.

The index stays empty and HEAD stays at the pinned UX-F3 commit. Final byte comparisons cover630 unrelated tracked files, private environment/SQLite,11 stashes,10 backups and30 local-QA files; original application/security/data files remain unchanged. Historical knowledge bodies and all earlier task evidence are retained. Database preservation uses file checksums only: no database connection/query, mutation or real browser profile operation occurs. Local/tracking/live feature is9c30def with ahead/behind0/0; unchanged local main isd6c66694a8acc252815a088ada3ef8703340b038 and origin/live main is5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f. Their pre-existing difference is preserved. No history or reference is rewritten. Generated archives, synthetic browser stores and all diagnostics are preserved outside the candidate inventory.

## Reproduction commands

Use the documented process-scoped Node/pnpm environment; do not install or globally reconfigure tools. From the repository root:

```powershell
node scripts/compatibility/freeze-legacy.mjs .git/msprout-compat-b1-20261016/frozen-NEW
$env:COMPAT_B1_MANIFEST = (Resolve-Path '.git/msprout-compat-b1-20261016/frozen-NEW/manifest.json').Path
node --test scripts/compatibility/harness.test.mjs
$env:COMPAT_B1_OUTPUT = Join-Path (Get-Location) '.git/msprout-compat-b1-20261016/browser-NEW'
# On this host only: use the existing native WebKit executable, no installation.
$env:PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH = Join-Path $env:LOCALAPPDATA 'ms-playwright/webkit-2336/Playwright.exe'
pnpm --dir apps/web exec playwright test --config playwright.compat.config.ts
```

Use a new output name each time. Keep retained browser profiles/evidence; no cleanup/reset command is part of this procedure. Building uses Git and tar plus the existing dependency installation. The current lock/dependency inputs must still match the pinned commit; a future dependency change requires separately qualifying a pinned build environment rather than bypassing the guard.

## Missing proofs and next-stage boundary

**NOT AVAILABLE / NOT TESTED:** future capable reader and real distinct-build substitution. The harness provides a same-origin substitution slot that checks build identity and refuses same-source or unchanged application JS. Its guards are tested; a genuine capable-reader substitution is not.

**NOT TESTED:** interrupted distinct-build installation, physical installed-device windows, mixed-version concurrent writes, Late/unknown-state cursor protection, accepted/lost-response replay, pruned feed, expired receipts, full bootstrap reconciliation, actual lease renewal, production authorization/RLS and recovery. They require separately approved implementation/fixtures and cannot be inferred from B1.

Stage A's unknown-state/cursor and retention/bootstrap findings remain open architecture prerequisites. Neither served cursor nor this synthetic lease proves readiness for Late. B1 authorizes no feature header/status, cursor acknowledgment protocol, recovery endpoint, storage version change, forced restart or Late writes.

B1 stakeholder acceptance and controlled finalization are separately authorized as recorded above. B2 still requires explicit authorization of its bounded scope; no protocol decision or implementation follows from B1 acceptance. No merge/deployment or later task follows automatically.
