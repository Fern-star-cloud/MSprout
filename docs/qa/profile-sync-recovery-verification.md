# Profile synchronization recovery — 2026-10-08

Scope: the explicitly authorized maintenance task from `feat/mvp-foundation` / `bb06620`. Tasks 1–18, the next feature, and application-wide UI/UX redesign remain untouched. Human Profile 1 pull completion remains **NOT RUN** by the agent.

## Confirmed root cause and correction

The former refresh action saved bootstrap, dispatched a synthetic `online` event, and called `onUnlocked`. The router's callback navigates to Attendance, whose initial ministry/date load automatically creates a missing draft and enqueues `attendance.draft_created`. Authorization recovery therefore coupled a sync attempt to an attendance mutation. The prior HTTP 401 transport correction remains intact; this task does not certify historical or current human pull success.

Bootstrap also returns the latest feed cursor. Replacing the local cursor during recovery could skip attendance projections not applied before an interrupted pull. Recovery now preserves the existing applied cursor while reusing the same actor/device/tenant/lease validation and assignment quarantine. Ordinary initial bootstrap retains its existing behavior.

`/profiles` now offers **Refresh authorization and sync**, explanatory guidance, pending-upload count, incomplete-download state, authorization guidance, and completion after the existing `SyncClient` finishes every pull page. It unlocks with the existing PIN, refreshes the existing device authorization, and awaits that client directly. It never calls the Attendance navigation callback or emits a synthetic connectivity event. Use profile and Add profile retain their established behavior, including online profile-selection logout.

Concurrent calls to the existing client coalesce by profile. Empty queues issue no push. Acknowledged entries remain removed; recovery resumes the last committed pull cursor. Nonadvancing pagination fails rather than looping. The original unlock instance and encrypted lease guard requests, retries, page application, and completion; locking/reunlocking cannot revive an earlier operation. A failed cache purge after bootstrap denial locks the key. Success means all pages were applied, with uploads/quarantined work reported separately.

## Changed application and regression files

- `apps/web/src/features/device-profiles/DeviceProfilesScreen.tsx` and its test: direct recovery, separate status, busy/retry controls, no Attendance callback, denial/PIN/actor boundaries and storage-failure locking.
- `apps/web/src/offline/profile-store.ts` and its test: recovery cursor preservation and captured unlock/lease guards using existing encryption and bootstrap authority.
- `apps/web/src/sync/sync-client.ts` and its test: shared-operation coalescing, guarded requests/transactions, pagination progress and retained incomplete state; accepted entries never re-created.
- `apps/web/e2e/sync-pull-authentication.spec.ts`: desktop/mobile cookies and origin-only referrers, paginated pull, 401 persistence, reload/repeated recovery, one existing draft/three accepted events/one push only, no logout/navigation and accessibility.
- `apps/web/e2e/offline-restart-sync.spec.ts`: updated recovery action locator, preserving the existing exactly-once restart/outage assertions.

## Security and preservation

No backend, API contract, migration, dependency, fixture, service-worker or security-policy change. Server authentication, MFA where required, CSRF, current active membership/assignment checks, trusted church context, forced RLS, device authorization, idempotency receipts and append-only audit remain authoritative. The client retains cookies, origin-only referrer, no-store and redirect rejection. Keys/PINs/payloads remain protected by the existing profile implementation; no secret or raw human data is logged.

All browser proof uses disposable Playwright contexts and intercepted endpoints. Real-cookie/backend proof uses the guarded separate PostgreSQL test database and runtime role; suites run serially. No human Chrome takeover, account authentication, live synchronization, Profile 1 read/write/removal/recreation, storage clearing, PIN reset, accepted-event replay, fixture change, migration/reset/reseed, or production/staging operation occurred. Existing QA evidence and unrelated tracked/untracked work are preserved separately and excluded from this task commit.

## Human verification using the existing Profile 1

1. Use the **original Chrome profile containing encrypted Profile 1**, at the existing local origin `http://127.0.0.1:5173`. Open `/profiles` directly and reload normally to load the updated code. Do not use Guest/Incognito, clear storage, reset the PIN, remove/add profiles, or visit Attendance for this test.
2. Dock DevTools in that window. In **Network**, enable recording and **Preserve log**, select **No throttling**, and keep the page foreground. Backgrounding intentionally locks the profile. Retain prior evidence; record only safe statuses/cursor/page metadata, never cookies, credentials, child data or an unsanitized HAR.
3. Choose **Sign in online** and authenticate as the **same existing authorized Teacher**. Complete any required verification/MFA. If login returns `409/already_authenticated`, use **Continue signed-in session** to verify the actor/church; it does not validate the newly submitted credentials. If it is another account, use normal sign-out and then sign in as the correct Teacher. Expect the actual session check to return 200. Do not select **Use profile 1** after sign-in: that remains the separate Attendance/online-switch workflow.
4. Return directly to `/profiles`. Select the **Profile 1 radio option** and verify **0 pending uploads** before proceeding. If pending uploads are nonzero or unavailable, stop this clean pull-only test and record the count; do not clear/replay/edit the queue to force it to zero. Enter the **existing local PIN**.
5. Click **Refresh authorization and sync** once. Stay on `/profiles` and wait for **Synchronization complete. All download pages applied.**, **0 pending uploads**, and **Downloads complete**. Attendance must not open. Zero uploads or bootstrap/push 200 alone is insufficient.
6. Inspect the new recovery requests using the table below. The pull starts at the last applied local cursor, which may be 0; do not edit or force the cursor. Each `has_more: true` page must be followed by another successful pull using its `next_cursor`, ending with `has_more: false`.
7. Optionally repeat the same recovery action with the existing PIN after the first completion. It must remain pull-only with zero uploads and no new attendance event. A normal reload locks the key and preserves the completion flag/cursor/outbox; reenter the existing PIN for another recovery. On an interrupted/server-failed pull, retry this same action. On 401/403, sign in/check access first, return directly here, and retry. Never reopen Attendance merely to finish recovery.

## Expected DevTools requests and success criteria

| Stage | Request | Expected result |
|---|---|---|
| Sign-in, if needed | `GET /sanctum/csrf-cookie`, `POST /login`; applicable MFA requests | CSRF 204; ordinary login 200 or explicit existing-session 409 followed by verified continuation; no identity inferred from CSRF alone |
| Verify signed-in session | `GET /auth/session`, scoped `/api/me` where the account/workspace requests it | 200 for the intended verified Teacher/church; prior `/api/sync-conflicts` proof need not be repeated for this action |
| Recovery | `GET /api/offline/bootstrap?device_id=<existing device>` | 200; same actor/device/church, currently assigned projection and valid renewed lease |
| Upload phase with **0 pending uploads** | **No `POST /api/sync/push`** | Empty outbox is skipped; no upload CSRF initialization is needed by recovery |
| Download phase | `GET /api/sync/pull?cursor=<last applied cursor>&limit=100` | Every page 200; cookie credentials, `Accept: application/json`, matching `X-Church-Id` and `X-Device-Id`, origin-only `Referer` |
| Additional pages | Same pull with the preceding response's `page.next_cursor` | Continue until `page.has_more` is false; pages/cursor/lease applied transactionally before completion |
| Failure | Pull 401/403, network interruption or failed request | Incomplete state persists; authorization denial requires same Teacher authentication/access recovery; acknowledged events are not restored |

During the recovery action there must be no `/logout`, Attendance document/navigation, attendance-create request, or recreated draft/outbox event. The three original server-accepted events remain accepted at their existing versions; downloading their projections does not push or mutate those receipts. Automated isolated proof establishes this behavior; current human HTTP results and database outcome must be recorded by the human, not inferred from tests.

## Validation and review

GREEN for this scoped implementation. Initial TDD produced five expected failures; final focused frontend **56 tests/6 files**, guarded PostgreSQL sync/device **15 tests/138 assertions**, final desktop/mobile Chromium **8/8**, complete frontend **235 tests/37 files**, and serial complete backend **268 tests/1903 assertions** pass. Typecheck, lint, production/PWA build, full Pint, OpenAPI drift, structure, strict Composer validation, Composer/pnpm audits, Gitleaks and whitespace pass. No known dependency vulnerabilities.

Full OWASP scan of the complete tracked/new application snapshot: **108 rules/340 targets/zero findings/~99.9% parsed**. The five partial parses are the established unchanged Vitest generic-mock test syntax; production/changed source parsed. Explicit affected/relevant scan: **98 rules/39 targets/zero findings or parse errors/~100% parsed**, including sync/device PHP tests and every changed application/browser input, with an empty ignore file. Gitleaks **50 commits** plus complete tracked/new source and a reviewed lock text alias found no leaks; final documentation/knowledge are included. Ignored credentials/dependencies/runtime/build/runner data are excluded, not committed. Node24/pnpm10/PHP8.3 and existing trusted CA stay process-scoped; TLS remains verified.

Remediation closed: recovery cursor overwrite, concurrent duplicate client work, lock-during-pull/completion, nonadvancing pages, denied-cache-purge key locking and hovered recovery-button contrast. A browser assertion initially included the deliberately headerless control; corrected to assert trusted headers only for actual client requests. One unchanged Attendance test hit its existing five-second timeout during concurrent load; focused and complete frontend235 pass with two process-scoped workers and unchanged tests/timeouts. Initial full scanner live-tree enumeration was stopped; the complete manifest-backed snapshot scan above passed. OpenAPI check used the documented temporary LF normalization and restored exact original generated bytes; no contract drift exists.

The initial comprehensive verify established backend268 and all frontend guarantees. Later changes were confined to frontend profile/sync/UI source/tests; final complete frontend, types/lint/build, browser and security scans cover those inputs. Backend/Pint/contracts/dependencies/structure remain unchanged, so their green results retain validity under the effect-based invalidation policy. Documentation-only synchronization requires final secret/whitespace/link proof, not redundant application suites.

Complete source/diff/security review closes all BLOCKING/SHOULD FIX findings. No scope expansion, backend/schema/data mutation, weakened test, suppressed scanner finding, debug/generated junk, credential exposure or unexplained task file remains. Original unrelated tracked/untracked work is preserved with exact-byte receipts outside the task commit. The user request and repository contract authorize one reviewed commit/normal push to the existing feature tracking branch; this receipt records pre-finalization evidence and Git records the resulting SHA and synchronization. Human Profile1 verification remains **NOT RUN**, with no live sync/data/PIN/storage operation by the agent.
