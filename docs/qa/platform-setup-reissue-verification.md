# Pending platform administrator setup recovery

2026-10-07. Authorized scope: repair stranded pending `sage.dev` setup without account recreation, direct live data edits, security bypasses, invitation issuance or activation during development. Work starts at `0416c2f3d0785e82afd497e214fd948bf0015bee` in an isolated `codex/pending-platform-setup` checkout tracking the existing `origin/feat/mvp-foundation`. Original uncommitted work remains preserved in the Desktop checkout.

## Implementation and review

- New console-only `platform:reissue-admin-setup --handle=sage.dev`; no identity/password/email override. Missing, active, disabled and previously activated identities fail. Delivery uses only the stored recovery email and a private transport.
- Additive migration adds generation, redeemed-at and issued-at metadata. Reissue locks the row and enforces a persistent five-minute cooldown. Invitation lifetime is bounded to 1–30 minutes. No identity, password, email verification or MFA material changes during issuance.
- Signed links and setup sessions bind to the current generation. Redemption runs under a lock, happens once and replaces unfinished password/encrypted TOTP/recovery material. Activation still requires the same generation/session, unexpired deadline, valid TOTP and recovery acknowledgement. Generation 1 retains the original null-password gate to protect pre-migration unfinished setup.
- Mail snapshots generation/expiry independently of model rehydration. Older links, used links, stale sessions and pre-upgrade queued messages fail closed.
- Issuance, canonical platform/security success evidence and the PostgreSQL database queue insert share one transaction. Both audit failure and an actual queue insert failure roll back issuance and evidence. System actor, target administrator and correlation UUID are recorded without PII/secrets. Queued payload carries the same correlation UUID. Nontransactional queue configuration and nonprivate transports are refused.
- One complete source/diff review covered command eligibility, generation/replay/locking, queue/serialization, transaction/audit/privacy, guard/CSRF/throttle boundaries, additive migration/rollback, contract/client compatibility, dependency delta, test integrity, scope and preservation. The rollout password-gate finding was reproduced and corrected; corrected source and direct interactions were reviewed. No BLOCKING/SHOULD FIX item remains. The dependency delta is only source-map-js 1.2.1 → 1.2.2 for [the high-severity advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q); persistent supply-chain controls are unchanged.

## Verified gates

| Gate | Actual result |
|---|---|
| Focused backend recovery proof | 21 passed / 122 assertions |
| Final complete backend regression | 244 passed / 1,498 assertions |
| Focused frontend platform/transport | 15 passed / 2 files |
| Complete frontend regression | 136 passed / 34 files |
| Frontend typecheck / lint / production build / OpenAPI drift | Passed |
| Pint / Composer strict validation / Composer audit | Passed; no vulnerability advisories |
| Frozen pnpm install / pnpm high-level audit | Passed; no known vulnerabilities |
| Repository structure / whitespace | Passed with existing Git Bash / `git diff --check` |
| Initial current-source Gitleaks | Zero leaks; tracked/new source snapshot, ignored credentials/runtime/dependencies excluded, lockfile text alias included |
| Comprehensive Semgrep OWASP | 108 rules / 326 targets / ~99.9% parsed / zero findings |
| Supplemental Semgrep with empty ignore file | 126 rules / 21 targets / ~99.9% parsed / zero findings; new tests/worker explicitly covered |

Full-scan partial parsing is confined to five pre-existing generic Vitest mock expressions; supplemental parsing has the same pre-existing expression in the platform auth test. All changed production PHP parsed. Supplemental scanning closes default backend-test exclusions; no relevant new source is excluded. After the final controller correction, focused backend proof and the complete backend suite were rerun. Frontend/build/contract/audit guarantees were unaffected by that backend-only correction. Documentation-only handoff edits do not invalidate application gates; final focused documentation/secret checks are performed before staging.

## Operational handoff

Follow [the deployment recovery procedure](../operations/deployment.md#recovering-an-unfinished-platform-setup). Serve the matching API/web code, apply pending migrations through the migration connection, and restart the matching queue worker before running from `apps/api`:

```text
php artisan platform:reissue-admin-setup --handle=sage.dev
```

On the known Windows host, use the existing PHP 8.3 runtime and external extension scan directory documented in [testing knowledge](../../knowledge/TESTING_ENVIRONMENT.md). Wait five minutes between issues; complete the newest private link within its lifetime. Do not rerun bootstrap, change the stored mailbox, edit timestamps directly or reuse old enrollment material. Prefer forward fixes; rollback must retain generation revocation and evidence.

Live migration, mail delivery, administrator reissue/activation, browser manual testing and deployment are NOT RUN. Original services/data/configuration/browser/offline work are preserved. This evidence precedes the single authorized fix commit/push; resolve its final SHA and synchronization from Git, with subject `fix: recover stranded pending platform administrator setup`. Tasks 1–18 and manual history remain intact; no next feature or phase is started.
