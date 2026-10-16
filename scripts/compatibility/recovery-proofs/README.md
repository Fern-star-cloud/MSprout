# COMPAT-01 B4-P1 baseline safety proofs

Explicit test-only execution for B3 checkpoint `7ace0096d3a8baceaeb698ea47b398a2bbc4ea8f` on `feat/mvp-foundation`. This directory is outside PHPUnit/Vitest/Playwright default test discovery. No application route, ordinary workflow, dependency or production configuration invokes it.

Prerequisites: existing Node 24, Docker, local `postgres:18-alpine` and `msprout-api:task18` images, installed web dependencies/Chrome, and the retained B3 container `msprout-compat-b3-native` with its existing vendor directory. The latter is read only to archive dependencies; no protected environment file is copied. On this Windows host, set `PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH` process-locally to the existing WebKit2336 `Playwright.exe`. No installation, global setup or TLS bypass is needed.

```text
node scripts/compatibility/recovery-proofs/run.mjs
```

The runner refuses an unexpected branch, HEAD or staged content. Every invocation creates a fresh labelled internal network, PostgreSQL container/volume, PHP namespace and unique disposable identities. Container/system identifiers, mounts, source hashes and runtime/RLS checks are recorded under a fresh `.git/msprout-compat-b4-p1-20261016/<nonce>/`. Existing outputs are never reused or removed. The runner verifies separation from `msprout-postgres-1`; it has no fallback database.

`server.php` verifies the independent PostgreSQL system identifier and setup connection before loading the existing test bootstrap. Only then does that bootstrap create/prepare the isolated baseline test schema and runtime role. No proposed recovery migration is included. Concurrent workers inherit the verified, initialized runtime configuration and never rerun test bootstrap. `worker.php` is stdin-only and accepts only fixture churches. Test requests use the real Laravel kernel in testing mode with a designated synthetic Teacher; this is not live-session, CSRF, CAPTCHA or production HTTP qualification.

The browser bundle imports current unchanged application modules. Fresh nonpersistent Chrome/native WebKit contexts exercise real IndexedDB and PBKDF2/AES-GCM. B4-05 uses independent IndexedDB connections, not a physical installed-window transition. No service worker is registered or update policy changed. The transport bridge invokes actual isolated Laravel synchronization/bootstrap handlers; it does not fabricate acceptance receipts. Each independent server scenario clears only its own asserted in-memory array cache, preserving rate-limit values.

The five safety assertions deliberately fail on the unchanged baseline. `invariant.mjs` runs each assertion in a separate Node process; retained `*-failing-before.log` files and `actualExitStatus: 1` establish real failing-before results. A runner exit0 means witness/control collection succeeded, **not** that the product safety assertions passed or that B4 is GREEN. A setup error or failed control is not a reproduced product defect.

Outputs include original event identities, synthetic-only evidence, screenshots, source/fixture manifests, cutoff controls, measured browser staging workloads and modelled link times. Credentials, keys and tokens must never be printed or committed. Retain prior attempts. Generated builds, dependency archives, test data and receipts are ignored artifacts, excluded from the tracked candidate.

The workload measures JSON encoding, real encryption and IndexedDB staging. It does not measure the unimplemented snapshot SQL, a physical mobile device or actual throttled network. A future candidate must qualify those separately before selecting an expiry.

See [the P1 report](../../../docs/qa/compat-01-b4-p1-recovery-safety-design.md). P1 changes no production behavior. Do not stage, commit, push, migrate protected resources or start P2/B5/B6/Late.
