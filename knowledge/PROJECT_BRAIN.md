# Project Brain

## Current terminology and authority — 2026-10-14

The displayed identity is **MSprout**, with approved sprout/wordmark provenance; internal MinistrySprout identifiers remain unchanged. Use the [current index](../docs/INDEX.md), [modernization design](../docs/superpowers/specs/2026-10-14-unified-modernization-design.md) and [roadmap](../docs/superpowers/plans/2026-10-14-unified-modernization-roadmap.md) for visual/task direction. CURRENT_STATE and ROADMAP_STATUS hold the latest task/checkpoint/publication evidence; the MVP sources below retain unsuperseded architecture/security requirements.

PWA/offline/synchronization capabilities already exist at UX-08; older future-tense descriptions below are historical. Fourth-state Late and N/A reporting are approved direction requiring selected implementation; detailed Late/compatibility choices remain PROPOSED. The [supersession register](../docs/history/SUPERSESSION_REGISTER.md) scopes replacements. DOC-GOV-01 establishes approved documentation/governance and future progress-indicator conventions; its separate publication authorization does not implement product behavior or select the next task.

## Preserved original product record

The body below is retained for history; its old display-name, future-tense and implementation-order pointers are not the current modernization handoff.


## Product

MinistrySprout is a secure, multi-church children's-ministry attendance system. The browser application is intended to become an installable, responsive PWA that supports deliberately limited offline attendance and safe synchronization. The API and PostgreSQL database remain authoritative for acknowledged data.

- Full name: **MinistrySprout**
- PWA short name: **Sprout**
- Tagline: **Children's ministry, ready anywhere.**
- Approved scope and acceptance criteria: [product and architecture design](../docs/superpowers/specs/2026-08-20-ministry-sprout-design.md)
- Implementation order: [approved roadmap](../docs/superpowers/plans/2026-08-20-ministry-sprout-implementation-roadmap.md)

## Roles and tenancy

- `sage.dev` is an isolated, online-only platform administrator stored separately from church users. It requires verified recovery email, MFA, recovery-code acknowledgement, and a separate session/guard.
- A Church Owner administers one church. Owner MFA is mandatory. Each church has exactly one active Owner in the MVP.
- Teachers are invite-only and limited to assigned ministries. They cannot grant roles, self-assign, transfer ownership, or perform Owner-only corrections.
- Applicants remain tenantless until platform approval atomically creates a church and active Owner membership.
- UI visibility is never authorization. Every server operation rechecks authentication, active membership, tenant, role, and ministry assignment as applicable.

## Stable security and privacy invariants

- Every tenant-owned server record has a trusted UUID `church_id` and is protected by application authorization plus forced PostgreSQL RLS.
- Runtime and migration database roles are separate. Request code uses the restricted, non-owner runtime role.
- Passwords, tokens, cookies, invitation proofs, MFA material, child names, birthdates, guardian data, raw request bodies, and production secrets must not enter logs or Git.
- Audit evidence is append-only. A required audit failure rolls back its high-risk action; telemetry for an already-denied request must not change the denial response.
- Correlation IDs connect safe errors, jobs, audit records, security records, and sanitized technical logs.
- Rejected application PII is purged after 30 days while minimal non-PII decision evidence remains.
- Offline data is minimal, encrypted, isolated per local profile, and authorized for at most 14 days. API responses are never service-worker cached.
- Contradictory attendance is never resolved by silent last-write-wins. Owner review and immutable revisions preserve provenance.
- Birthday pushes contain counts only. Full birthdates are not cached offline; authorized offline projections contain only the next month/day and turning age.

## MVP boundaries

The MVP includes approval, accounts, ministries, students, imports, birthdays, offline attendance, synchronization, reports, conflicts, audit, and operations. It excludes points, Market Day, photos, guardian/contact records, messaging, billing, advanced analytics, native mobile binaries, and automatic Expo-data migration.

The legacy Expo repository is read-only behavioral reference only. It must not be added here as a remote, submodule, history source, or deployment source.
