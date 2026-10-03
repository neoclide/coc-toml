# Tombi adapter synchronization — 2026-10-03

Downstream base: `ffa2e02` (coc-toml 2.1.0). This is no longer a Taplo adapter: `6300fd8` migrated to Tombi and `43617df` added Coc TOML-version and schema settings. Neither records an exact Tombi commit baseline. Compared the corresponding adapter/protocol files against verified `tombi-toml/tombi` main snapshot `fd61510446f03db0821df26c41907e66792626fa`; no full upstream parity claim is made.

Adapted source paths:

- `editors/vscode/src/command/select-schema.ts`: use filesystem paths for schema association; reject non-TOML and unsaved documents before selection. Retain Coc cargoLock support, command IDs and quickpick UI. Capture the document before asynchronous schema selection.
- `editors/vscode/src/options/client-options.ts` and `src/extension/index.ts`: support untitled TOML/cargoLock documents and watch nested `tombi/config.toml`. Explicitly own output channel and watchers through Coc subscriptions.
- `editors/vscode/src/lsp/client.ts`: align list-schema metadata with optional catalog URI and optional legacy fileMatch.
- `editors/vscode/src/command/restart-language-server.ts`: await restart completion, and replay Coc-only TOML-version/user-schema state after restarting. Retain configured binary resolution, arguments, environment and automatic updates.
- Upstream npm packaging now uses `@tombi-toml/cli`; update manual install guidance. Pin CLI 1.7.1 only as a development dependency for reproducible real-server tests, without changing the user's installed/production server.

Omitted VS Code status-bar/hover-link UI, editor-specific extension schema scanning, bootstrap UI and VS Code languageclient APIs. The existing Coc user schema settings and command interfaces remain intact; no old Taplo feature or setting is reintroduced.

Tests and CI:

- Added coc-test 0.2.0 with src/index.ts source entry; retained existing Docker smoke scripts and workflows.
- Added test:integration, test:integration:nvim, test:integration:vim and typecheck scripts.
- Real Tombi CLI 1.7.1 + local coc.nvim: Neovim 5/5 and Vim 5/5. Tests cover activation, formatting applied to a real buffer, TOML-version sync, filesystem-path schema selection, restart replay, non-TOML rejection and teardown.
- Baseline and final builds/typechecks pass. Existing source formatting check passes. Coc contract inventory riskCount 0; git diff --check passes.
- Existing CI expanded to Node 22/24 × Neovim/Vim, permissions contents:read, checkout credentials disabled, bounded timeout. No secrets or publishing added. Existing publication workflow is untouched.
- Docker smoke suite was retained but could not run: Docker daemon socket /Users/chemzqm/.docker/run/docker.sock is absent. Real native Tombi/editor tests ran independently.
- Existing Coc 0.0.82 peer ranges warn about Node types 26/TypeScript 7; these are baseline dependencies, typecheck succeeds, and no engine or production dependency is changed.

The task-specific AGENTS.md authorizes verified working-branch commits/pushes, preserving unrelated work and excluding force-push/default-branch merges/npm publication/credential changes. Tool approval rejections still require escalation to the trusted user context. Delivery was resumed after renewed user authorization; see Git history and the task report for commit/remote verification.
