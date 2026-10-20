# P2-2 disposable server snapshot qualification

This opt-in harness qualifies server snapshots only. It never reconstructs an
installed client's IndexedDB, acknowledges original events, grants applied
cursor/receipt credit, or enables production recovery. The application entry is
default-disabled and additionally restricted to the testing environment.

Run from the repository root on the pinned published BDE parent and feature
branch. The runner refuses staged changes or unexpected web/workflow inputs.

```sh
node scripts/compatibility/snapshots/run.mjs prepare
node scripts/compatibility/snapshots/run.mjs test tests/Compatibility/RecoverySnapshotTest.php tests/Compatibility/RecoverySnapshotSecurityTest.php tests/Compatibility/RecoverySnapshotConcurrencyTest.php
node scripts/compatibility/snapshots/run.mjs test tests/Compatibility/RecoverySnapshotWorkloadTest.php
```

`prepare` is a one-time, separately identified disposable-environment operation;
do not repeat it when resuming existing evidence. It creates an internal network,
fresh PostgreSQL 18 volume, isolated database and restricted runtime/independent
maintenance identities. No database port is published. PHP uses a tmpfs copy of
public source and existing read-only dependency bytes. Credentials and the test
application key are generated locally, remain disposable, and are not printed.
Preparation checks distinct container, volume and PostgreSQL system identity.
Subsequent tests verify the exact recorded system identity **before** Laravel or
database reconstruction. No protected environment or private configuration is
mounted. Never run backend tests or browser probes concurrently against this
database. Activation and credential rotation inside these fixtures apply only
to the guarded disposable target.

Each attempt retains a source SHA-256 seal, exit status and log under ignored
`.git/msprout-compat-b4-p2-2-20261019/`. Failed attempts are historical evidence;
a later closure does not rewrite them. Generated database state, browser profiles,
screenshots and receipts must remain ignored and unstaged.

The opt-in `apps/web/playwright.snapshots.config.ts` requires the recorded
`COMPAT_SNAPSHOTS_API` container, public built assets beneath the evidence root
(`COMPAT_SNAPSHOTS_ASSETS`) and a fresh direct-child output directory
(`COMPAT_SNAPSHOTS_OUTPUT`). The loopback broker authenticates synthetic browser
sessions through the real HTTP kernel with CSRF enforced; credentials/cookies
stay in memory, traces are disabled, and external requests are blocked. It checks
unchanged encrypted local work across snapshot retries, refusal and expiry. It
does not apply snapshots or claim genuine installed-client interoperability.

Workload receipts separate measured construction, memory, page counts and byte
sizes from modeled transfer at explicit rates. Four hours and configured quotas
are bounded qualification candidates, not an approved production retention or
performance promise. Maintenance logically expires and atomically audits/purges
eligible ciphertext; physical purge timing still depends on separately qualified
scheduling, outage handling and target deployment.

See the [consolidated report](../../../docs/qa/compat-01-b4-p2-2-server-recovery-snapshots.md)
for the exact inventory, results, original failures and remaining prerequisites.
