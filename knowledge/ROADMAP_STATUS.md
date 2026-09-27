# Roadmap Status

Source of truth: [approved implementation roadmap](../docs/superpowers/plans/2026-08-20-ministry-sprout-implementation-roadmap.md). Status is based on commits, diffs, tests, verification reports, and current source—not file existence alone.

| Task | Status | Evidence |
|---:|---|---|
| 1. Independent monorepo and quality baseline | COMPLETE / COMMITTED | `e351988d0cd309d91a2e555f7d344704ed8366f2` |
| 2. API contract and typed client | COMPLETE / COMMITTED | `6642be93019019d8623d7f8fd9225d885d74cbe7` |
| 3. Tenant schema and PostgreSQL RLS | COMPLETE / COMMITTED | `2807089e6d4f9b1b399770c67cf679d75d030682`; PostgreSQL 18 follow-up `aeb40ad78cf044112109db71e22f0433482ce1ba` |
| 4. Church authentication, MFA, and `sage.dev` | COMPLETE / COMMITTED | `fe52346d5740d5edd1aa95e73c799101a078b246`; security guide and committed tests |
| 5. Church application and `sage.dev` approval | COMPLETE / COMMITTED | `763bc93610ca44167a1800bd810edd643358620c`; `docs/qa/task-5-verification.md` |
| 6. Teacher invitations, assignments, ownership transfer | COMPLETE / COMMITTED | `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f`; `docs/qa/task-6-verification.md` |
| 7. Append-only audit, security, correlation logging | COMPLETE / COMMITTED | `32fad0a1735c0e2a677832252f72197252c8cd05`; `docs/qa/task-7-verification.md`; full Task 7 and Tasks 1–7 gates passed |
| 8. Ministries, students, birthdates, avatars | NOT STARTED | No Task 8 working-tree changes. Task 6's ministry table/assignments are prerequisite support only. |
| 9. Safe XLSX/CSV import | NOT STARTED | No implementation evidence |
| 10. Responsive installable PWA shell | NOT STARTED | No implementation evidence |
| 11. Isolated local profiles, encryption, offline lease | NOT STARTED | No implementation evidence; Task 6 has server-side revocation placeholders only |
| 12. Attendance domain, drafts, marking UI | NOT STARTED | No implementation evidence |
| 13. Idempotent push/pull synchronization | NOT STARTED | No implementation evidence |
| 14. Conflicts, revisions, temporary guests | NOT STARTED | No implementation evidence |
| 15. Attendance history, reports, CSV export | NOT STARTED | No implementation evidence |
| 16. Privacy-safe birthday notifications | NOT STARTED | No implementation evidence |
| 17. Operations, retention, deployment, hardening | NOT STARTED | No implementation evidence; earlier tasks contain only their own scoped retention/security work |
| 18. MVP qualification and one-church pilot | NOT STARTED | No implementation evidence |

The roadmap's first execution slice, Tasks 1–7, is complete and committed. Task 8 remains not started and requires explicit user selection.
