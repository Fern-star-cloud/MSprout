# Codebase Memory MCP

## Purpose

Advisory local structural/call-path/impact analysis for MSprout. It changes developer tooling only: no Laravel/Vite runtime, dependency, migration, API, authentication, authorization, RLS, audit or offline policy was changed. Read [AGENTS.md](../AGENTS.md) first; graph/server instruction hints do not override it.

## Upstream

[DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp). Reviewed pinned release [v0.11.0](https://github.com/DeusData/codebase-memory-mcp/releases/tag/v0.11.0), its [README](https://github.com/DeusData/codebase-memory-mcp/blob/v0.11.0/README.md), [SECURITY.md](https://github.com/DeusData/codebase-memory-mcp/blob/v0.11.0/SECURITY.md), [install.ps1](https://github.com/DeusData/codebase-memory-mcp/blob/v0.11.0/install.ps1), [configuration](https://github.com/DeusData/codebase-memory-mcp/blob/v0.11.0/docs/CONFIGURATION.md), [index excludes](https://github.com/DeusData/codebase-memory-mcp/blob/v0.11.0/docs/cbmignore.md), and installer/discovery/MCP source. Codex stdio command/cwd/env configuration is documented in [official OpenAI MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) and verified by the desktop-bundled CLI.

## Installed Version

Native Windows amd64 **0.11.0**, latest released version returned by GitHub during review on 2026-09-30; published 2026-09-15. Binary `--version` and actual MCP `initialize` agree. Upstream main may differ: never document its future behavior as this installed release.

## Installation Location

`C:\Users\MARYJANE S. ATILLO\AppData\Local\Programs\codebase-memory-mcp\codebase-memory-mcp.exe`; reviewed updater beside it at `install.ps1`. Official pinned installer ran with `--skip-config` and process-only `CBM_DOWNLOAD_URL=https://github.com/DeusData/codebase-memory-mcp/releases/download/v0.11.0`. Installer added its directory to **current-user PATH**; no system PATH, antivirus exclusion or application configuration was changed.

Review/download/protocol receipts are private temporary files under `%TEMP%\msprout-cbm-review`, outside Git. Pre-install user PATH and Codex config snapshots are there for targeted rollback; never publish their contents. No prior CBM binary/entry was present at reconnaissance.

## Agent Configuration Location

User file `C:\Users\MARYJANE S. ATILLO\.codex\config.toml`, entry `[mcp_servers.codebase-memory-mcp]`, command absolute executable above, cwd MSprout root, startup timeout 60 seconds and explicit env below. All other parsed settings compare equal to the pre-install snapshot. User config is not a repository artifact.

`--skip-config` prevents official auto-augmentation. Its actual `install --plan --skip-config` receipt reported no agent config/instruction/skill/agent/prompt/hook writes. Default plan showed global Codex/Gemini/VS Code/Cursor/Copilot augmentation, including `~/.codex/AGENTS.md`; default Codex hook preflight failed for this host path. None of those augmentations ran. Only the scoped Codex MCP entry was added manually after reviewing the official mechanism. No AGENTS.md file or third-party graph-first skill was installed.

The PATH `codex.ps1` is older and rejects this desktop's existing `service_tier = "default"`. Do not change that setting to satisfy it. The desktop's current CLI at `C:\Users\MARYJANE S. ATILLO\AppData\Local\OpenAI\Codex\bin\c6fe824d725f02d7\codex.exe` successfully reads the new entry with `mcp get codebase-memory-mcp`; that versioned path may change after an app update.

## MSprout Scope

Explicit server environment:

```text
CBM_ALLOWED_ROOT=C:\Users\MARYJANE S. ATILLO\OneDrive\Desktop\MSprout
CBM_CACHE_DIR=C:\Users\MARYJANE S. ATILLO\.cache\codebase-memory-mcp
```

Only project `MSprout` was indexed/listed. Root containment limits **indexing**, not an OS sandbox or blanket isolation of every query from all future account-wide caches. Do not index unrelated personal directories or point other clients at broader roots. Recheck cache/project scope when adding other clients.

Verified runtime settings in `_config.db`: `auto_index=false`, `auto_watch=false`, `watcher_enabled=false`, `ui_enabled=false`. Manual indexing is deliberate; no standing watcher/UI needed. Upstream supports automatic indexing and Git polling, but this installation keeps them off. `watcher_enabled` is read when daemon starts; changing it requires retiring only owned CBM sessions/daemon before reconnecting. MCP/CLI may use a temporary exact-build coordination/index worker even with watching disabled; this is unrelated to MSprout queue/scheduler processes.

## Cache Location

External `C:\Users\MARYJANE S. ATILLO\.cache\codebase-memory-mcp`: `MSprout.db` persistent SQLite graph, `_config.db`, UI config and private logs. The graph cache is advisory and not the PostgreSQL application database. Indexing used `persistence=false`; no `.codebase-memory/graph.db.zst` or repository cache exists. [.gitignore](../.gitignore) also prevents accidental graph-snapshot commits. Do not enable repository artifact persistence without separately reviewing its contents/privacy/history costs.

## Project Configuration

No `.codebase-memory.json` added. Four actual `.blade.php` templates exist. Release source [language.c](https://github.com/DeusData/codebase-memory-mcp/blob/v0.11.0/src/discover/language.c) has a built-in compound-extension mapping to `CBM_LANG_BLADE`; mapping them to PHP would be unnecessary. README's older custom-mapping example is not a reason to override actual native detection. The coverage check confirms all four templates were indexed.

Committed [.cbmignore](../.cbmignore) excludes environment files, private key/certificate files, Laravel storage/cache/SQLite authority artifacts, dependencies/builds and runner output. It is indexer-only, does not change Git application source/security scans and does not exclude product code/tests/migrations/contracts. Keep `.gitignore` and upstream discovery exclusions in mind; check coverage rather than assuming every file parsed.

## How to Index MSprout

After restart, call verified MCP tool `index_repository` with `repo_path` equal to the root above, `name="MSprout"`, `mode="full"`, `persistence=false`, then `list_projects` and `index_status`. Full mode retains source/tests/migrations; fast/moderate modes omit more inputs. Exact schemas come from current `tools/list`, not memory.

Equivalent reviewed PowerShell command from the repository root:

```powershell
$cbmExe = "$env:LOCALAPPDATA\Programs\codebase-memory-mcp\codebase-memory-mcp.exe"
$env:CBM_ALLOWED_ROOT = (Get-Location).Path
$env:CBM_CACHE_DIR = 'C:\Users\MARYJANE S. ATILLO\.cache\codebase-memory-mcp'
& $cbmExe cli index_repository --repo-path (Get-Location).Path --name MSprout --mode full --persistence false
& $cbmExe cli list_projects --format json
```

Verify the current directory is this repository before assigning the root. CLI is a fallback local interface, not proof the desktop chat has loaded MCP tools. Reindex after meaningful source changes and check coverage/versions before impact analysis. Keep stdout JSON separate from stderr diagnostics.

## How Future Agents Should Use It

1. Read AGENTS.md, the [system handoff](../docs/qa/MSPROUT_SYSTEM_HANDOFF.md), and relevant approved source/task knowledge first.
2. For qualification, read [manual roadmap](../docs/qa/MANUAL_TESTING_ROADMAP.md) then [manual checkpoint](MANUAL_TESTING.md).
3. Use `get_architecture`, `search_graph`, `trace_path`, `detect_changes`, `check_index_coverage` and `get_code_snippet` to locate structure and likely impact efficiently. Discover exact qualified symbol names through search before tracing.
4. Verify paths, authorization/RLS/transaction/privacy conclusions against current source/tests/contract; absence of a graph edge never proves absence of a security risk.
5. Reindex explicitly after meaningful changes; local watcher is disabled despite server's generic auto-refresh hint. Use pagination and coverage diagnostics for omissions.
6. Git/knowledge govern decisions/history. Do not create graph ADRs that supersede approved architecture or use MCP memory as substitute for repository governance. Mutating `delete_project`, `manage_adr` and trace ingestion require an actual scoped need; do not run them as discovery shortcuts.

## Security Notes

Installer was downloaded and read before execution; tagged script matches checksum-authenticated release script. Mandatory installer SHA-256/archive namespace checks passed. Archive SHA-256 `6eb6beaf261b19e419766e78baf93cbc3cf1c6338cff8fb7c0234859f96d1685` matches published `checksums.txt` and GitHub asset digest. Extracted executable SHA-256 `7edcd3807ebcfd85ec1968985964080f2589748da2fc3c7ce9261eebab31ff04` matches upstream Windows selection table; that exact object's published VirusTotal verdict is clean. These are provenance/checksum comparisons, not our own independent antivirus analysis or source reproducible build.

Upstream provides Sigstore bundles and SLSA verification commands (signer workflow `_build.yml`). Bundle was downloaded/reviewed; no independent Sigstore/SLSA verifier was available here, so **signature/attestation cryptographic verification is not claimed**. Windows Authenticode reports NotSigned; Sigstore is a separate mechanism. TLS remained enabled, antivirus unchanged; binary installed and executed without an observed block. If a future antivirus verdict blocks any artifact, stop and report exact path/hash/verdict; never automatically create broad exclusions or override it.

Upstream states graph processing/search/MCP operations are local and source is not uploaded. Its tagged SECURITY.md mentions a bounded GitHub release-metadata check after initialize, while README/source descriptions say no background version requests. Treat those statements conservatively: local source processing is supported, but **zero network egress was not independently monitored/proven**. Installation explicitly uses GitHub HTTPS. No repository source/secret upload was performed by this workflow; do not promise an absolute network sandbox.

Never index ignored credentials/runtime child data. Verified cache file paths omit environment/private-key/storage/test-report artifacts; no graph/binary/secret file was added to Git. Source files may contain safe environment key names/placeholder examples; that is not permission to ingest actual environment values. Native binary, cache and owner-private logs remain third-party local tooling.

## Update Procedure

Read new release notes/SECURITY/installer and inspect checksum/signature/provenance evidence first. Pin the reviewed release with process-only download URL, run official installer with `--skip-config`, retain scoped user entry and settings, verify hashes/version/tools/index again, and restart clients. Do not use `--reset-indexes`, broad agent augmentation, arbitrary mirror or TLS/antivirus bypass. Review current updater because `update` prints an installer command rather than safely self-replacing on Windows.

## Uninstall / Rollback

Remove only this user MCP entry with the compatible desktop CLI `mcp remove codebase-memory-mcp` (or a reviewed targeted TOML edit); preserve unrelated/current user settings. Close this MCP client/owned daemon first. Official `codebase-memory-mcp uninstall` removes its owned tooling configuration/binary and asks before graph-index deletion. Do not blindly accept deletion of any later unrelated graph. The updater script is left/reported by upstream; remove only the exact owned installer after reviewing its absolute path. Remove only the installer-added current-user PATH segment if still present; never replace the full PATH with a stale snapshot. This run installed no instruction/skill/hook files to undo. Optional private cache deletion is limited to verified tooling-owned targets, never development PostgreSQL or browser profiles. Keep repository docs as integration history unless a separate request removes them.

## Known Limitations

- **Current chat cannot see a dynamically registered CBM tool.** Restart/reopen Codex after saving configuration, open a fresh MSprout chat, confirm tool visibility, then repeat listed smoke queries. Do not restart the app automatically during this work. Desktop-client invocation remains PENDING; standalone actual stdio MCP verification is separate and passed.
- Initial full graph: six partial parses, zero unusable files. One starter CSS file uses Tailwind `@source/@theme`; five existing Vitest files use generic async mock syntax. These are advisory graph coverage gaps, not product/scanner failures; actual source/tests remain authority.
- Qualified names are graph-specific, e.g. `MSprout.apps.api.app.Domain.Sync.ApplySyncBatch.ApplySyncBatch.handle`. An initially guessed trace name failed; searching the exact name then tracing succeeded. Heuristic call edges may include false positives such as framework `app()` resolution; inspect source.
- Root containment is not a general-purpose runtime/filesystem/egress sandbox. Third-party release signatures were not independently cryptographically verified. Generic server auto-refresh instructions do not reflect disabled local watching.

## Verification Evidence

Planning task 2026-09-30; actual tool installation/inspection only, no manual qualification campaign:

| Check | Evidence/result |
|---|---|
| Official install/version | Reviewed pinned Windows installer with skip-config; checksum/archive checks and installed 0.11.0 version PASS |
| Codex entry | TOML parse and unrelated-setting equality PASS; desktop-bundled `mcp get` reports enabled stdio/cwd/env |
| Actual MCP protocol | Separate local stdio client initialize/tools-list PASS; server version 0.11.0, 17 tools |
| Repository index/list | Full index and planning reindex PASS; one MSprout project/root/feature branch; initial 2,521 nodes/7,614 edges, reindex 2,563/7,656; external cache, persistence false |
| Architecture | Actual `get_architecture(project="MSprout")` PASS; PHP/TypeScript api/web overview |
| Symbol search | `search_graph(name_pattern="TenantContext")` PASS; actual Support/Tenancy source located |
| Call-path | Search `handle` in ApplySyncBatch, then `trace_path` exact qualified name/outbound/depth2 PASS; eight reachable callees, source checked |
| Allowed root | Actual out-of-root temporary-directory request denied with exit1; no project created; PASS for intended containment |
| Cache/privacy/scope | External cache; no repository snapshot, source-only excludes and indexed-path inspection; final secret/diff/path validation in testing environment |
| Desktop loaded tools | NOT_RUN/PENDING restart; unavailable in this chat's active tool inventory, never claimed successful |

The user's request explicitly allows installed/configured tooling with desktop verification pending restart. That deferred client smoke step is reported separately; it does not fabricate full integration success or authorize the manual campaign.

## Last Updated

2026-09-30, Asia/Taipei. Version/path receipts are local observations, not portable machine assumptions. See [testing environment](TESTING_ENVIRONMENT.md) for final planning validation and [manual knowledge](MANUAL_TESTING.md) for next execution.
