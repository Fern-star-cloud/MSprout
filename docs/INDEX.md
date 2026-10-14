# MSprout Documentation Index

Established by stakeholder-approved DOC-GOV-01, 2026-10-14 (Asia/Taipei). This index routes the approved modernization planning baseline and preserved project evidence. Read [CURRENT_STATE](../knowledge/CURRENT_STATE.md) and [ROADMAP_STATUS](../knowledge/ROADMAP_STATUS.md) for the latest selected task, verified checkpoint, delivery status and outstanding permissions. This index does not authorize task execution, publication, deployment, data operations or historical-file relocation.

## Start here

1. Read the current explicit task permission and [AGENTS.md](../AGENTS.md). Governance changes require the separate review/finalization authorization defined there.
2. Read [current state](../knowledge/CURRENT_STATE.md) and [task status](../knowledge/ROADMAP_STATUS.md).
3. Select the authorized task in the [modernization roadmap](superpowers/plans/2026-10-14-unified-modernization-roadmap.md).
4. Read its relevant sections of the [unified design specification](superpowers/specs/2026-10-14-unified-modernization-design.md).
5. Check the [supersession register](history/SUPERSESSION_REGISTER.md) before treating an older instruction as current.

## Authority matrix

| Source | Authority and limits |
|---|---|
| System/platform rules and current explicit user scope | Permissions and current task boundaries. A planning approval does not authorize implementation of the roadmap. |
| Closest applicable approved AGENTS.md | Operating rules; root applies repository-wide. Governance drafts require separate review/finalization. |
| Approved current task and product/architecture specifications | Product requirements for the selected task. Approval status and exclusions remain binding. |
| Established architecture, security decisions, verified knowledge | Constraints and factual handoff, subject to documented supersession. |
| [OpenAPI](../contracts/openapi.yaml) and generated client | API contract authority. No API change is part of DOC-GOV-01. |
| Current implementation, migrations, tests | Evidence of implemented behavior; not permission to expand scope or override a newer approved requirement. |
| Packs 06–12 and earlier screen evidence | Design/workflow references and accepted checkpoint evidence, not exact-copy requirements or independent task authorization. |
| Historical PDF, superseded briefs and old plans | Historical context only for superseded subjects; see the register for retained architecture requirements. |

Recency alone does not override security, tenant isolation, privacy, preservation, or user permission. An unresolved material conflict is investigated and escalated under AGENTS.md.

## Current canonical documents

| Need | Canonical document |
|---|---|
| Approved design direction, proposed dimensions, interaction standards, ownership | [Unified modernization design](superpowers/specs/2026-10-14-unified-modernization-design.md) |
| Dependency order, individual task specifications, authorization gates | [Modernization roadmap](superpowers/plans/2026-10-14-unified-modernization-roadmap.md) |
| Current versus historical sources and exact supersession scope | [Supersession register](history/SUPERSESSION_REGISTER.md) |
| Verified checkpoint, selected work, preserved work, unresolved conditions | [CURRENT_STATE](../knowledge/CURRENT_STATE.md) |
| Task statuses and commit evidence | [ROADMAP_STATUS](../knowledge/ROADMAP_STATUS.md) |
| Knowledge routing | [Knowledge index](../knowledge/README.md) |
| Current topology and boundaries | [ARCHITECTURE](../knowledge/ARCHITECTURE.md) |
| Durable decisions and explicit approval record | [DECISIONS](../knowledge/DECISIONS.md) |
| Commands, environment facts and actual validation results | [TESTING_ENVIRONMENT](../knowledge/TESTING_ENVIRONMENT.md) |
| DOC-GOV-01 inventory, approved governance amendments and review evidence | [DOC-GOV-01 review](qa/doc-gov-01-authority-governance-review.md) |

## Architecture, operations, and historical evidence

- [MVP product/architecture design](superpowers/specs/2026-08-20-ministry-sprout-design.md): established architecture and security requirements remain applicable; superseded visual/task directions do not.
- [Deployment](operations/deployment.md), [backup/restore](operations/backup-restore.md), [threat model](security/threat-model.md), and [security policy](../SECURITY.md): retained references, not deployment authorization or fresh operational qualification.
- [System handoff](qa/MSPROUT_SYSTEM_HANDOFF.md): preserved runtime/QA history; use CURRENT_STATE for the active checkpoint. Dated live-readiness observations expire and must not be assumed current.
- [Manual testing roadmap](qa/MANUAL_TESTING_ROADMAP.md), [manual results](../knowledge/MANUAL_TESTING.md), and [local operator protocol](qa/AUTONOMOUS_LOCAL_OPERATOR.md): optional risk-based QA and narrowly scoped local operating rules. Existing results and blockers retain their actual status.
- [UX-03 Home](qa/ux-03-home-visual-review.md), [UX-03 branding](qa/ux-03-branding-text-review.md), [UX-04 navigation](qa/ux-04-shared-navigation-review.md), [UX-05 profiles](qa/ux-05-device-profiles-visual-review.md), [UX-06 preparation](qa/ux-06-device-preparation-visual-review.md), [UX-07 Sync](qa/ux-07-sync-recovery-visual-review.md), and [UX-08 attendance](qa/ux-08-attendance-guests-visual-review.md): preserve accepted checkpoint evidence. Future improvements require their own selected task and actual browser acceptance.

## Classification and maintenance

**APPROVED** means explicit stakeholder direction. **VERIFIED** means supported by actual evidence. **PROPOSED** means not yet approved. **DEFERRED** means excluded pending separate scope. **BLOCKED** identifies a missing prerequisite, not a pass.

Keep specifications, task status, and execution evidence distinct. Record actual results with their scope and date. Do not mark a proposal implemented, a held task finalized, an old test rerun, or hosted CI green without evidence. Preserve previous bodies and approval records; prefer notices and corrected links over movement or deletion.
