# UI-10 — Guarded student import wizard

Qualified on 2026-10-11. This is the reviewed pre-finalization evidence; the task commit resolves through Git subject `feat: add guarded student import wizard` and its ignored finalization receipt. UI-11–UI-16 remain NOT STARTED.

## Authority and starting checkpoint

Followed [AGENTS.md](../../AGENTS.md), the [approved UI roadmap](../superpowers/plans/2026-10-09-uiux-implementation-roadmap.md), and [harmonized specifications](../superpowers/specs/2026-10-09-harmonized-uiux-design.md). Packs 01–05 remain visual authority; Pack 08 sections 4.1–4.6 supply import workflow guidance. The archived Pack 08 design source and board were inspected read-only. Existing contracts remain authoritative for supported operations.

UI-09 HEAD, tracking and live feature branch matched `24c21f4f5b7650d67b2f6e6e43d476476d8e57e3` at 0/0. Staging was empty. Local/live main remained `5dcbfebdd5f9d6c04b71b684f13c9639c4c2cd6f`. UI-01–UI-09 GREEN records and the preceding finalization receipt were verified. The UI-09 roadmap row is updated to its actual finalized commit.

Eight pre-existing bodies were hash-checked and retained: apps/web/.env.example; docs/qa/MSPROUT_SYSTEM_HANDOFF.md; docs/qa/shared-workspace-context-verification.md; knowledge/CURRENT_STATE.md; knowledge/MANUAL_TESTING.md; knowledge/TESTING_ENVIRONMENT.md; and MT-02.md plus MT-APP-001-SECOND-ATTEMPT-PROCEDURE.md under docs/qa/manual-runs/MTQA-20261001-01/. The first six were tracked modifications, the latter two untracked. Original QA deltas stay outside the task commit. CURRENT_STATE and TESTING_ENVIRONMENT receive additive task sections only; stripping them reproduces the entry bytes.

## Implemented behavior

- Explicit Upload → Review and map → Confirm selected → Results stages, current-stage semantics, stage/error focus and verified church context. Teacher/inactive/non-MFA access is denied before ministry or import data requests.
- Existing CSV/XLSX-only, 5 MiB and 500-row constraints. The server performs authoritative parsing. Only fixed reviewed parser errors are reflected from preview HTTP 422; ordinary authentication responses retain generic field feedback.
- Total and server valid/invalid/duplicate/needs-mapping categories remain distinct from currently eligible and deliberately selected rows. Active same-church mappings are required; mapping does not select a row. Invalid and duplicate rows remain excluded. Selection/mapping changes invalidate confirmation.
- A named church and selected-row review precedes an unchecked create-first acknowledgement. No commit happens until explicit confirmation; zero selection blocks review. Access/actor and active ministries are rechecked before writes, and duplicate actions coalesce.
- One stable key per batch. Both accepted and uncertain submissions retrieve GET /api/imports/{batch} for authoritative row outcomes. Unknown status blocks retry and replacement upload. A verified previewed batch can be deliberately reviewed/retried with its same key and retained selection. Completed, expired and failed states are distinguished; accepted rows are never offered for replay.
- Same-tab recovery keeps only the verified actor identifier and church/batch/key UUIDs, selected row UUIDs and mapping indexes/ministry UUIDs. It stores no spreadsheet contents, child details, ministry names or authentication material. Owner verification precedes recovery; another actor/church cannot use the pointer. Reload reads the same batch without POST. Unavailable/malformed recovery storage blocks submission safely.
- Imported/skipped counts derive from completed row outcomes, never missing values treated as zero. The API has no failed-row outcome/count, so that count remains unavailable. Completed batches with incomplete outcomes block correction export and another upload until checked.
- Correction CSV retains approved headers and executable-prefix/quote/CRLF escaping. Results exports exclude committed rows, including accepted mapped rows. Back to Students uses the existing verified account route.
- Desktop scroll regions and mobile row inspection preserve table semantics, readable captions, 44-pixel selection targets, keyboard visibility above phone navigation, five widths and 200% text reflow. Viewing/recovering creates no attendance or synchronization work.

No backend production code, API/event formats, database schema, parser protections, encryption, leases, idempotency, audit, ownership or permissions changed. Backend additions are isolated synthetic contract/boundary tests only. No human records, profiles, credentials, SQLite or development data were operated.

## Validation and corrections

| Gate | Actual result |
|---|---|
| Focused frontend import/model/transport | 64 tests / 5 files PASS |
| Frontend aggregate | 527 tests / 57 files PASS |
| Focused backend import/mapping/concurrency | 18 tests / 109 assertions PASS |
| Backend aggregate | 273 tests / 1,935 assertions PASS; serial guarded separate PostgreSQL test database |
| Browser and accessibility | 52 unique cases across Chrome desktop/mobile and WebKit phone/tablet PASS: 48 valid retained cases plus 4 current requalified layout cases |
| Typecheck, lint and production PWA build | PASS on current source |
| Contract drift and structure | Actual api:check and complete read-only structure script PASS; generated client restored byte-for-byte |
| Pint / Composer validation / Composer audit / pnpm audit | PASS; no known vulnerability advisories |
| OWASP | 98 rules / 58 current scoped targets, zero findings and parse errors; complete relevant import/file/auth/tenant inputs |
| Secret and final diff gates | Complete tracked/new-source and 61-commit Git-history scans PASS with zero findings; git diff --check PASS |

Focused TDD first failed for missing stages/reconciliation and redacted parser messages, then passed. Existing assertions retain exclusions, selected payloads and stable keys while adopting approved explicit review/confirmation. The stale Teacher test expecting a ministry read now proves denial before that read. A full-suite 5-second timeout under concurrent runner load passed unchanged with a process-scoped two-worker aggregate; no timeout budgets were increased.

Visual review caught a collapsed mobile caption and crowded enlarged stepper; caption width assertions and responsive layout corrected them. Mobile row controls replace focus on an oversized table wrapper, desktop scrolling is bounded, and scroll margin prevents fractional WebKit top-edge clipping. Native focus/layout is allowed to settle while preserving the full viewport assertion. A transient existing Chrome drawer-focus failure passed unchanged in the fresh browser run; its load association is an inference. Historical failed receipts remain failed.

The initial comprehensive gates ran before qualification. Late corrections affect only scoped labels/CSS/focus presentation; current 64 focused tests, types/lint/build, four browser cases, geometry/caption/touch-target checks, visual review and current OWASP proof establish them. The 527-test aggregate and backend/contract/audit results retain their guarantees: no later state, authorization, transport, persistence, contract, backend, dependency or workflow change occurred. Root verify's frontend/type/build/backend components are evidenced individually without repeating its redundant wrapper. Configured CI still performs its complete application security scan; local scope does not narrow CI.

## Final review and qualification limits

Complete source/diff review covered the fourteen application/test paths, their auth/tenant/recovery interactions and verification/knowledge additions. Caption, keyboard clipping, touch targets, global session invalidation and incomplete-outcome recovery findings were corrected and reviewed with affected proof. No BLOCKING or SHOULD FIX finding remains. Review confirms no UI-11 leakage, weakened/skipped tests, unsupported import feature, raw child-data receipt, automatic replacement/replay, secrets or committed runner artifacts.

Physical-device use, human screen-reader testing, 400% browser zoom and host CI execution are not newly claimed. Existing operational/deployment qualifications remain applicable; synthetic intercepted browser tests are not live import/parser evidence, which is supplied separately by backend tests. Optional deferred manual QA retains its historical status. Finalization must recheck the branch, exact staged paths, live remote, original bodies and normal TLS-enabled push synchronization before reporting a commit.
