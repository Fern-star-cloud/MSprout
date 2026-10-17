# COMPAT-01 B4-P2-1A isolated foundation qualification

Explicit qualification at parent `739e321124411fc1aee1c4198e4a8faa5295d1b8`, branch `feat/mvp-foundation`, with an empty index. This is not a production bootstrap, deployment command or permission to apply the migration to an existing database.

Use existing Node24, Docker, `postgres:18-alpine`, `msprout-api:task18` and the retained B3 vendor archive source. No host runtime or global trust change is needed.

```text
node scripts/compatibility/foundations/run.mjs prepare
node scripts/compatibility/foundations/run.mjs test tests/Compatibility/RecoveryFoundationSchemaTest.php tests/Compatibility/ChurchCoordinationTest.php
node scripts/compatibility/foundations/run.mjs test
```

Run sequentially, never concurrently against the same environment. `prepare` creates a fresh labelled internal network, volume, PostgreSQL18 cluster and PHP namespace, unique setup/runtime/database identities and a generated disposable APP_KEY. It verifies separation from the protected cluster/volume, publishes no database port and copies only tracked/new API source. Private environment files, SQLite, browser data and credentials are not copied. Dependencies are archived read-only from the retained B3 container; protected container configuration is unchanged.

`bootstrap.php` verifies explicit isolation markers, loopback, database identities, absent connection strings and the independent PostgreSQL system identifier **before** the repository test bootstrap can create databases or rotate roles. The only allowed `/work/.env` is an empty, non-symlink fixture generated after successful identity verification; it contains no settings or credentials and avoids dotenv missing-file warnings. No private environment is mounted. Worker processes recheck the guard and inherit the initialized restricted runtime; they never run the database bootstrap again.

The new tests are explicitly invoked from `tests/Compatibility`, outside ordinary PHPUnit suite discovery. No existing suite/configuration/test is skipped or changed. This keeps the guarded local proof separate from hosted CI; a hosted CI pass alone will not qualify these new foundation proofs. The unmodified ordinary API suite is additionally run through the same guard. Future CI integration needs separately authorized ownership.

The helper has no production callers. Tests use IPC barriers and `pg_blocking_pids`, real independent restricted-runtime connections, a deliberately induced domain-lock inversion, a bounded lock-timeout probe and separate whole-operation retries. No helper-level automatic retry is introduced. Factories/refresh and the legacy migration experiment operate only in the verified disposable database. The worker's designated synthetic session is not production HTTP/CSRF/MFA qualification.

`ChurchCoordination::run()` is qualified only for its authenticated, verified, active-member context with the existing applicable Owner assurance. P2-1B must separately design and qualify signed-proof invitation acceptance before membership creation and trusted system/maintenance operations. Neither can be assumed to fit this authenticated-member helper. Existing Owner assurance requirements remain binding; no flow is integrated or redesigned here.

Receipt admission remains unsupported: new device rows must start with unknown coverage, and recorded coverage starts cannot move backward. The RC-02 test seeds hypothetical pre-existing complete metadata with the isolated migration identity while briefly disabling only this fixture's device guard inside a transaction. The guard is reenabled before restricted-role SQL. This fixture is not verified event-acceptance evidence, an application admission path or permission to bypass production safeguards.

Evidence, sanitized isolation receipts, input hashes and all failed attempts remain under ignored `.git/msprout-compat-b4-p2-1a-20261016/`. Preserve previous runs and protected resources. No automatic cleanup of those clusters/volumes is performed.

Recovery run limits are required per-run storage budgets, not approved production settings. Tests use small synthetic limits and opaque fixture strings; they do not claim to exercise future snapshot encryption or choose a lifetime. Storage transitions do not validate a complete application manifest, build snapshots, authorize a client or prove local application.

See [the stage report](../../../docs/qa/compat-01-b4-p2-1a-foundations.md). All five B4-P1 witnesses remain unchanged and unresolved. No P2-1B integration, retention changes, recovery API, local reconstruction, cutover, B5/B6, Late, publication or deployment is authorized by these commands.
