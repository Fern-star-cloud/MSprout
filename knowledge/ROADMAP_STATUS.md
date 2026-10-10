# Roadmap Status

## Harmonized UI/UX redesign

Separate [approved UI-01–UI-16 sequence](../docs/superpowers/plans/2026-10-09-uiux-implementation-roadmap.md); MVP task numbering and evidence below are preserved.

| Task | Status | Evidence |
|---|---|---|
| UI-01 — Shared visual foundations and accessible primitives | GREEN / COMMITTED / PUSHED | `38bf11dc025fc898cbd1c2f8d4be8499c0f1a178`; [verification](../docs/qa/ui-01-foundations-verification.md); synchronized at UI-02 entry |
| UI-02 — Explicit routes, role navigation and church Home | GREEN / COMMITTED / PUSHED | `32b41c29d983fad1da43b5c0c11016c0e1c37bec`; [verification](../docs/qa/ui-02-navigation-verification.md); synchronized at UI-03 entry |
| UI-03 — Safe profile management and locked-state privacy | GREEN / COMMITTED / PUSHED | `7332b1a6236f6efa79f1f0a03aac428395dce33d`; [verification](../docs/qa/ui-03-profile-management-verification.md); synchronized at UI-04 entry |
| UI-04 — Church Account, assurance and application | GREEN / COMMITTED / PUSHED | `abd1ee9c27f8e8b5b3c446d86b1b4485c0379d88`; [verification](../docs/qa/ui-04-account-application-verification.md); synchronized at UI-05 entry |
| UI-05 — Separate Platform shell and session lifecycle | GREEN / COMMITTED / PUSHED | `24988e254867940d5acacfe0a5d2bd296256079f`; [verification](../docs/qa/ui-05-platform-shell-verification.md); synchronized at UI-06 entry |
| UI-06 — Guided encrypted device preparation | GREEN / COMMITTED / PUSHED | `0d9ef2b46a8884a84ad4284f3b780f260f4a2104`; [verification](../docs/qa/ui-06-device-preparation-verification.md); synchronized at UI-07 entry |
| UI-07 — Discoverable Synchronization & Recovery | GREEN / COMMITTED / PUSHED | `0724e92d8766a4dcdad048ba80ed2908be182c39`; [verification](../docs/qa/ui-07-sync-recovery-verification.md); synchronized at UI-08 entry |
| UI-08 — Explicit Attendance Lifecycle & Temporary Guests | GREEN / COMMITTED / PUSHED | `3d330ca247726416950941f597b571535bb5321f`; [verification](../docs/qa/ui-08-attendance-lifecycle-verification.md); synchronized at UI-09 entry |
| UI-09 — People Lists, Details & Protected Management | COMPLETE / VALIDATED (pre-finalization receipt) | [Verification](../docs/qa/ui-09-people-management-verification.md); reviewed subject `feat: add scoped people management and protected actions` resolves finalization through Git |
| UI-10–UI-16 | NOT STARTED | Stop after UI-09; further authorization required |


Manual QA policy effective 2026-10-07: implementation Tasks 1–18 remain complete with their existing commit evidence. MT-00…MT-22 are optional risk-based references; 211-case sequential completion is not a development, merge, deployment or release requirement. MT-00/01 PASS and partial MT-02 results/blockers remain preserved in [manual knowledge](MANUAL_TESTING.md). Applicable automated/security/CI/deployment requirements and unresolved release-critical defects remain release criteria. No implementation task or manual phase is started by this governance update.

Source of truth: [approved implementation roadmap](../docs/superpowers/plans/2026-08-20-ministry-sprout-implementation-roadmap.md). Status is based on commits, diffs, tests, verification reports, and current source—not file existence alone.

| Task | Status | Evidence |
|---:|---|---|
| 1. Independent monorepo and quality baseline | COMPLETE / COMMITTED | `e351988d0cd309d91a2e555f7d344704ed8366f2` |
| 2. API contract and typed client | COMPLETE / COMMITTED | `6642be93019019d8623d7f8fd9225d885d74cbe7` |
| 3. Tenant schema and PostgreSQL RLS | COMPLETE / COMMITTED | `2807089e6d4f9b1b399770c67cf679d75d030682`; PostgreSQL 18 follow-up `aeb40ad78cf044112109db71e22f0433482ce1ba` |
| 4. Church authentication, MFA, and `sage.dev` | COMPLETE / COMMITTED | `fe52346d5740d5edd1aa95e73c799101a078b246` |
| 5. Church application and `sage.dev` approval | COMPLETE / COMMITTED | `763bc93610ca44167a1800bd810edd643358620c`; `docs/qa/task-5-verification.md` |
| 6. Teacher invitations, assignments, ownership transfer | COMPLETE / COMMITTED | `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f`; `docs/qa/task-6-verification.md` |
| 7. Append-only audit, security, correlation logging | COMPLETE / COMMITTED | `32fad0a1735c0e2a677832252f72197252c8cd05`; `docs/qa/task-7-verification.md` |
| 8. Ministries, students, birthdates, avatars | COMPLETE / COMMITTED | `dc3c13c6cd5e4909c644b0abe37d18875cbe248f` |
| 9. Safe XLSX/CSV import | COMPLETE / COMMITTED | `fbe338f433c7432cc26c98ad8c2e258cf9502a79`; all required implementation, test, contract, formatting, dependency, structure, and security gates passed; `docs/qa/task-9-verification.md` |
| 10. Responsive installable PWA shell | COMPLETE / COMMITTED | Installable manifest/icons, injectManifest service worker, NetworkOnly API boundary, deferred updates, responsive/accessibility shell, unit/Playwright coverage, and `docs/qa/task-10-verification.md` |
| 11. Isolated local profiles, encryption, offline lease | COMPLETE / COMMITTED | Profile-scoped Dexie schema, PBKDF2/AES-GCM key protection, locking/switching/purge, signed assignment-scoped 14-day bootstrap lease, contract/UI/tests, and `docs/qa/task-11-verification.md` |
| 12. Attendance domain, drafts, marking UI | COMPLETE / COMMITTED | Tenant/RLS attendance schema, assignment-scoped policy, atomic audited finalization, encrypted atomic local drafts/outbox, responsive marking UI, contract/tests, and `docs/qa/task-12-verification.md` |
| 13. Idempotent push/pull synchronization | COMPLETE / COMMITTED | Tenant/RLS replay receipts and ordered feed/cursors, atomic audited attendance push, assignment-scoped pull/tombstones, bounded encrypted-profile client loop, revocation quarantine/purge, reconnect convergence, contract/tests, and `docs/qa/task-13-verification.md` |
| 14. Conflicts, revisions, temporary guests | COMPLETE / COMMITTED | Field-aware conflict/dedupe/merge, immutable Owner revisions/corrections, tenant/RLS guest lifecycle and provenance, role-safe review UI, synchronized contract/tests, and `docs/qa/task-14-verification.md` |
| 15. Attendance history, reports, CSV export | COMPLETE / COMMITTED | Revision-effective filtered totals/history, separate pending work, Teacher assignment scope, Owner-only audited formula-safe CSV, responsive UI, synchronized contract/tests, and `docs/qa/task-15-verification.md` |
| 16. Privacy-safe birthday notifications | COMPLETE / COMMITTED | `a444e5fbb47b1c600e8496c36709ec9a3c3d5fa6`; timezone-local idempotent dispatch, forced-RLS deliveries, encrypted/revocable Web Push subscriptions, generic count-only notifications, assignment-scoped online/offline birthday projection, deliberate permission UX, synchronized contract/tests, and `docs/qa/task-16-verification.md` |
| 17. Operations, retention, deployment, hardening | COMPLETE / COMMITTED | `a989dd904551a26f6f7548ee0c88128f13c6933d`; split health surfaces, bounded forced-RLS-aware retention and full-resync enforcement, non-root multi-mode Railway image, Vercel hardening, operational/security runbooks, comprehensive Semgrep baseline, and `docs/qa/task-17-verification.md` |
| 18. MVP qualification and one-church pilot | COMPLETE / COMMITTED / PUSHED | `ffee8ebe9e87fe096c52e23f7a0d49da9c1c0202`; 60-case four-target browser matrix, four-day/two-Teacher/multi-profile controlled pilot, offline-security remediation, encrypted restore drill, all twelve acceptance criteria, zero-finding 322-target Semgrep baseline, release GO decision, and `docs/qa/task-18-verification.md` |

Tasks 1–18 are complete, committed, and pushed on `feat/mvp-foundation`. The later runtime qualification is maintenance/QA; current evidence and commissioning limits are in [the canonical system handoff](../docs/qa/MSPROUT_SYSTEM_HANDOFF.md). The approved roadmap ends at Task 18; no Task 19 is defined.
