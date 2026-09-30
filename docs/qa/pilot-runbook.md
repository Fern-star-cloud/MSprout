# One-church pilot runbook and evidence

This runbook is the privacy-safe Task 18 pilot record. Do not record child names, birthdates, roster exports, contact details, cookies, tokens, push endpoints, raw requests, or production secrets here. Actual operator names and direct contact details belong in the approved private operations channel, not Git.

## Release roles and escalation

| Role | Responsibility | Contact route |
|---|---|---|
| Pilot church Owner | Confirms roster scope, manual attendance totals, corrections, and go/no-go for the church. | The approved private church-to-operator channel. Do not copy personal contact details into this repository. |
| Technical operator | Watches protected readiness, queue, scheduler, sync/conflict, storage, and backup signals and coordinates rollback. | The private deployment operations channel and provider consoles. |
| Security contact | Receives suspected tenant, privacy, authentication, or data-integrity issues. | The repository's private GitHub Security Advisory flow in `SECURITY.md`; never use a public issue for sensitive evidence. |

Incident containment, correlation-ID handling, revocation, evidence preservation, key rotation, and rollback are defined in `docs/operations/deployment.md`. Backup recovery is defined in `docs/operations/backup-restore.md`.

## Pilot preconditions

- Use exactly one approved church and synthetic or explicitly authorized pilot records.
- Confirm one active Owner, at least two active Teachers with explicit ministry assignments, and multiple encrypted PIN profiles on the shared device.
- Confirm production-like HTTPS, secure cookies, PostgreSQL-backed queues, scheduler, protected readiness, backup monitoring, and separate runtime/migration identities.
- Record the release commit, UTC window, browser/device, and safe correlation IDs in the private operations record.
- Verify each Teacher downloads only the assigned roster before taking attendance.

## Four-day procedure

1. On day one, Teacher A opens the installed PWA, refreshes authorization online, deliberately goes offline, marks the assigned roster, finalizes, and confirms Pending Sync without reconnecting.
2. Close the browser, reopen it, select Teacher A's profile, and enter the local PIN. Confirm the unexpired encrypted cached roster and pending work remain readable. Confirm synchronization does not start until Teacher A signs in and refreshes authorization online.
3. On day two, reconnect through a controlled temporary API/worker outage. Confirm queued events remain pending through bounded retries and converge once when service returns.
4. On day three, switch to Teacher B's PIN profile. Confirm Teacher A's cache is absent, the actor/roster match Teacher B, and another church remains undisclosed.
5. On day four, create a deliberate contradictory submission. Confirm the session enters Needs Owner Review, both immutable values remain visible only to the authorized Owner, and the Owner resolves it with a bounded reason.
6. Have the Owner compare manual Present/Absent totals with the revision-effective report. Record counts only, not student rows. Verify the correction link and audit event.
7. Exercise one valid-plus-duplicate import preview, one birthday in-app fallback, deliberate notification permission behavior, a service-worker update, and a storage-quota failure.
8. Confirm the outbox is empty, retries created no duplicate attendance, queue and scheduler are healthy, and no serious/critical accessibility or security finding remains.

## 2026-09-30 controlled qualification pilot

The release-candidate rehearsal used one synthetic approved church, two Teacher actor fixtures, two encrypted PIN profiles, four distinct calendar dates, and assignment-scoped synthetic rosters. All four attendance sessions were deliberately created offline, which is stricter than the minimum one offline day. No real child data or production credential was used.

| Observation | Result |
|---|---|
| Pending events before reconnect | 12 encrypted outbox events: draft creation, bulk mark, and finalization for each of four dates. |
| Temporary outage | Two deliberate `503` push responses preserved all queued work. The third attempt accepted 12 unique events. |
| Sync completion | Outbox reached zero within the 10-second convergence assertion window; accepted event count remained 12 after reload, with zero duplicates. |
| Browser closure/profile switch | Correct PIN reopened unexpired cached work after page closure; the other profile's roster stayed absent. Sync remained blocked until authenticated authorization refresh. |
| Conflict/correction | Existing Absent and incoming Present values remained side by side; Owner chose the incoming value with a bounded reason. Report showed 1 Present, 0 Absent, 100%, and one correction. |
| Import | One valid row committed once; one possible duplicate remained excluded and nonselectable. |
| Notification behavior | Authorized name/age detail stayed in-app; count-only push privacy copy remained visible; a deliberate denial was remembered without a second prompt. |
| Failure UX | Storage quota exhaustion produced a safe free-storage message and left finalization disabled. |
| Accessibility | Keyboard/reduced-motion/touch checks passed; axe found no serious or critical issue on the qualified surfaces. |

Qualification and final review exposed three real usability/security defects and all were remediated before sign-off: local PIN unlock had incorrectly hidden otherwise valid unexpired cached work after restart, the import preview scroll region was not keyboard focusable, and a denied online authorization refresh did not yet invalidate cached authorization projections. The final behavior keeps valid leased cache readable after PIN unlock while requiring same-actor online authorization refresh before synchronization; a `401/403` denial removes cached roster/ministry/authorization projections without discarding encrypted drafts or outbox work.

## Backup and restore evidence

The production-like drill used representative PostgreSQL 18 test data, a custom-format logical backup encrypted at rest with an ephemeral AES-256-GCM key, and an isolated database with no application, worker, scheduler, mail, push, or public route attached.

- Drill ID: `b67eabf9-ba1b-4ffb-b7f7-a2da895a15a4`
- Verified UTC: `2026-09-29T22:25:45.8087294Z`
- Encrypted backup SHA-256: `fa4ac5e815e949da3ba7a539440ada67c7fd3e00b488db380ac82cb5c10d3e07`
- Restored counts: churches 1; memberships 3; students 2; finalized/revised attendance sessions 1; attendance revisions 1; audit events 6; sync receipts 5.
- Source and restore deterministic JSONB aggregates matched exactly:
  - churches: `1|108ab1d4c88bb51a51571d079403bfac`
  - church memberships: `3|2f71d1ba296ccc2024f79d02cbf975f9`
  - students: `2|d4edae100b90635544bef716c03d8c8a`
  - finalized attendance: `1|6660331428b0444b307f79d69d53dd24`
  - attendance revisions: `1|2b4c28705d295bca3673a102a01a9094`
  - audit events: `6|2b72e99498766e785ece13d4c886969b`
  - sync receipts: `5|7a49bce99a51371902ed9caab1e90ec2`
- The runtime role remained `NOSUPERUSER` and `NOBYPASSRLS`.
- The isolated restore database and all plaintext/decrypted and encrypted temporary backup artifacts were destroyed. The encryption key was never printed, persisted, or committed.

## Pilot sign-off

The controlled automated qualification pilot is **PASS**. The Owner-role report assertion matched the known manual fixture count, all recorded errors were deliberate/recovered, and no child PII appears in this record. A real deployment must still follow the preconditions and keep named human contacts/signatures in the private operations record; this repository evidence does not claim a production deployment or access to real church data.
