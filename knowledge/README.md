# MinistrySprout Knowledge Index

MT-00…MT-22 are optional risk-based QA references; sequential completion of 211 cases is not required for development, merging, deployment or release. Preserve results and blockers without promoting deferred coverage to PASS. Applicable automated/security/authorization/CI/deployment gates and unresolved release-critical defects remain release criteria; see [AGENTS.md](../AGENTS.md) section 16.

Always begin with [CURRENT_STATE.md](CURRENT_STATE.md). Then read only what the task needs:

| Need | Document |
|---|---|
| Current MVP operation, preserved fixtures/evidence, optional QA policy and defects | [Canonical system handoff](../docs/qa/MSPROUT_SYSTEM_HANDOFF.md) |
| Optional risk-based manual QA references and evidence rules | [Manual testing roadmap](../docs/qa/MANUAL_TESTING_ROADMAP.md) |
| Recorded manual results, deferred coverage, observed issues and blockers | [MANUAL_TESTING.md](MANUAL_TESTING.md) |
| Autonomous synthetic local QA, private store, approved probes and human takeover | [Local operator protocol](../docs/qa/AUTONOMOUS_LOCAL_OPERATOR.md) |
| Scoped local graph tooling, installation, verification and rollback | [CODEBASE_MEMORY.md](CODEBASE_MEMORY.md) |
| Product purpose, terminology, business or security invariants | [PROJECT_BRAIN.md](PROJECT_BRAIN.md) |
| System boundaries, data flow, authentication, tenancy, audit design | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Roadmap implementation or task selection | [ROADMAP_STATUS.md](ROADMAP_STATUS.md) and the [approved roadmap](../docs/superpowers/plans/2026-08-20-ministry-sprout-implementation-roadmap.md) |
| Architectural, security, data-model, or workflow rationale | [DECISIONS.md](DECISIONS.md) |
| Local setup, tests, checks, or environment problems | [TESTING_ENVIRONMENT.md](TESTING_ENVIRONMENT.md) |
| Completed milestone history | [CHANGELOG.md](CHANGELOG.md) |

The approved [product and architecture design](../docs/superpowers/specs/2026-08-20-ministry-sprout-design.md), roadmap, repository, migrations, contract, and tests remain authoritative. Update stale knowledge instead of following it blindly.
