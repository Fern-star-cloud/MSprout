# Development Changelog

Meaningful completed milestones only. This is a concise index, not a replacement for Git history or QA reports.

| Date | Milestone | Result | Commit |
|---|---|---|---|
| 2026-08-20 | Task 1 — independent monorepo and quality baseline | React/Laravel workspace, local PostgreSQL/Mailpit, CI/security workflows, initial contract and structure checks | `e351988d0cd309d91a2e555f7d344704ed8366f2` |
| 2026-08-20 | Task 2 — typed API contract | OpenAPI response conventions, generated TypeScript, typed transport, health endpoint and tests | `6642be93019019d8623d7f8fd9225d885d74cbe7` |
| 2026-08-20 | PostgreSQL 18 setup correction | Corrected local PostgreSQL 18 volume/configuration assumptions | `aeb40ad78cf044112109db71e22f0433482ce1ba` |
| 2026-08-20 | Task 3 — tenant schema and RLS | Church/membership schema, trusted tenant context, restricted runtime role, forced RLS and isolation tests | `2807089e6d4f9b1b399770c67cf679d75d030682` |
| 2026-09-21 | Task 4 — church/platform authentication | Fortify/Sanctum church flows, Owner MFA, isolated `sage.dev` guard/setup, frontend authentication flows | `fe52346d5740d5edd1aa95e73c799101a078b246` |
| 2026-09-21 | Task 5 — approval-gated church registration | Applicant lifecycle, CAPTCHA/limits, platform approval/rejection, transactional notification/audit, 30-day cleanup | `763bc93610ca44167a1800bd810edd643358620c` |
| 2026-09-22 | Task 6 — teacher membership management | Invitations, assignments, revocation, ownership transfer, session/device invalidation, UI and verification report | `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f` |
| 2026-09-27 | Task 7 — append-only audit, security, and correlation logging | Canonical immutable evidence, legacy preservation, transactional high-risk/auth auditing, denial telemetry, redaction, scoped viewers, frontend/contract, and complete validation | `32fad0a1735c0e2a677832252f72197252c8cd05` |
| 2026-09-28 | Task 8 — ministries, students, birthdates, avatars | Ministry/student/enrollment domain, canonical normalization, assignment-scoped roster, avatars, contract/UI, and complete validation | `dc3c13c6cd5e4909c644b0abe37d18875cbe248f` |
| 2026-09-28 | Task 9 — safe XLSX/CSV import | Strict workbook inspection, preview/mapping, locked idempotent commit, tenant RLS, audit integration, contract/UI, and complete validation | `fbe338f433c7432cc26c98ad8c2e258cf9502a79` |
| 2026-09-28 | Task 10 — responsive installable PWA shell | Manifest/icons, minimal offline shell precache, NetworkOnly API boundary, safety-gated updates, responsive accessible navigation, and browser coverage | `02090354a185d92be2655695fbfce77bf20bc53c` |
| 2026-09-28 | Task 11 — isolated local profiles, encryption, and offline lease | Profile-scoped encrypted IndexedDB, PIN key wrapping and auto-lock, shared-device picker, minimal assignment-scoped bootstrap, signed audited 14-day leases, and complete validation | `8cc055703198cc85d63f821762732dd542884d35` |
| 2026-09-28 | Task 12 — offline-ready attendance workflow | Tenant/RLS attendance records, assignment-scoped audited finalization, encrypted atomic local drafts/outbox, responsive marking UI, and complete validation | current Task 12 commit |

Tasks 1–12 are committed. Task 12 validation evidence is in [the Task 12 verification report](../docs/qa/task-12-verification.md); current handoff state is in [CURRENT_STATE.md](CURRENT_STATE.md).
