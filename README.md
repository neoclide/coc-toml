# coc-toml

[![Tests](https://github.com/neoclide/coc-toml/actions/workflows/ci.yml/badge.svg)](https://github.com/neoclide/coc-toml/actions/workflows/ci.yml)

[![npm version](https://badge.fury.io/js/coc-toml.svg)](https://badge.fury.io/js/coc-toml)

TOML language server extension for [coc.nvim](https://github.com/neoclide/coc.nvim).

Powered by [Tombi](https://github.com/tombi-toml/tombi).

## Breaking Changes in v2.0

v2.0 is a **complete rewrite** with the following breaking changes:

### Language Server: Taplo → Tombi

The underlying language server has been replaced from [Taplo](https://github.com/tamasfe/taplo) to [Tombi](https://github.com/tombi-toml/tombi). Tombi runs as a **native binary** (`tombi lsp`) — WASM is no longer used.

The tombi binary is **automatically downloaded** when the extension activates. You can also specify a custom path via `tombi.path` setting.

### Configuration namespace: `toml.*` → `tombi.*`

All settings have been renamed:

| v1.x (`toml.*`) | v2.0 (`tombi.*`) |
|---|---|
| `toml.enabled` | `tombi.enabled` |
| `toml.activationStatus` | *(removed)* |
| `toml.taploConfig` | *(project-level `tombi.toml` instead now. global config will be implemented later)* |
| `toml.taploConfigEnabled` | *(removed)* |
| `toml.semanticTokens` | *(removed — handled by Tombi)* |
| `toml.formatter.*` | *(project-level `tombi.toml` instead. global config will be implemented later)* |
| `toml.schema.*` | *(project-level `tombi.toml` instead. global config will be implemented later)* |
| *(new)* | `tombi.path` |
| *(new)* | `tombi.args` |
| *(new)* | `tombi.env` |

### Commands renamed

| v1.x | v2.0 |
|---|---|
| `toml.syntaxTree` | *(removed)* |
| `toml.downloadSchemas` | `tombi.refreshCache` |
| `toml.tomlToJson` | *(removed)* |
| `toml.jsonToToml` | *(removed)* |
| *(new)* | `tombi.selectSchema` |
| *(new)* | `tombi.showLanguageServerVersion` |
| *(new)* | `tombi.restartLanguageServer` |

### Schema configuration

Schemas are now configured in project-level `tombi.toml` or `.tombi.toml` files, not in `coc-settings.json`. See [Tombi documentation](https://github.com/tombi-toml/tombi) for details.
Global config by coc-settings.json will be implemented later.

## Install

### Prerequisites

- [coc.nvim](https://github.com/neoclide/coc.nvim) >= 0.0.82

```vim
:CocInstall coc-toml
```

Or via plugin manager (e.g., dein.vim):

```vim
[[plugins]]
repo    = 'kkiyama117/coc-toml'
depends = 'coc.nvim'
```

## Configuration

Add to your `coc-settings.json` (`:CocConfig`):

```json
{
  "tombi.enabled": true,
  "tombi.path": null,
  "tombi.args": [],
  "tombi.env": {},
  "tombi.tomlVersion": "v1.1.0",
  "tombi.schemas": []
}
```

| Setting | Description | Default |
|---|---|---|
| `tombi.enabled` | Enable the extension | `true` |
| `tombi.path` | Absolute path to the tombi executable. If not set, searches PATH. | `null` |
| `tombi.args` | Additional arguments passed to `tombi lsp` | `[]` |
| `tombi.env` | Environment variables passed to the tombi process | `{}` |
| `tombi.tomlVersion` | Default TOML version (`"v1.0.0"` or `"v1.1.0"`). Sent to Tombi via `workspace/didChangeConfiguration` and used as fallback for `tombi.schemas` entries that omit `tomlVersion`. Schema/comment directives still take precedence. | `"v1.1.0"` |
| `tombi.schemas` | Editor-level JSON schema associations registered on startup. Each entry calls `tombi/associateSchema`. | `[]` |

Formatter, linter, and project-wide schema settings are configured in project-level `tombi.toml` files. For editor-level schema overrides (similar to `yaml.schemas` in coc-yaml), use `tombi.schemas`:

```json
{
  "tombi.schemas": [
    {
      "uri": "https://json.schemastore.org/cargo.json",
      "fileMatch": ["Cargo.toml"],
      "tomlVersion": "v1.1.0"
    },
    {
      "uri": "https://json.schemastore.org/pyproject.json",
      "fileMatch": ["pyproject.toml"]
    }
  ]
}
```

## Commands

| Command | Description |
|---|---|
| `tombi.refreshCache` | Refresh schema cache |
| `tombi.selectSchema` | Select schema for current file |
| `tombi.showLanguageServerVersion` | Show Tombi version |
| `tombi.restartLanguageServer` | Restart the language server |

## Features

- Formatting and linting for TOML files
- Completion with schema validation
- Go-to-definition and hover
- Diagnostics
- Schema association

## Develop

```bash
pnpm install --frozen-lockfile
pnpm build
```

## Testing

Smoke tests run inside a container so they are reproducible across
hosts. Both Docker and Podman work — the `pnpm docker:*` scripts use
the `docker` CLI name, and Podman ships a `docker` alias by default.

```bash
# Build the image and run every scenario (build check + all fixtures).
pnpm test

# Or step through pieces:
pnpm docker:build                # build the test image
pnpm docker:test                 # build artifact + tombi binary check
pnpm docker:test:all             # all scenarios

# Interactive shell / nvim inside the image:
pnpm docker:shell
pnpm docker:nvim
```

A `docker/compose.yaml` is also provided for `docker compose` /
`podman compose` users — see `pnpm compose:test`, `compose:test:all`,
`compose:shell`, and `compose:nvim`.

## License

MIT.

## Dependencies

- [Tombi](https://github.com/tombi-toml/tombi) — TOML language server
- [coc.nvim](https://github.com/neoclide/coc.nvim)

## Development tests

Use the package manager pinned in `package.json`:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test:integration:nvim
pnpm test:integration:vim
```

The integration suite runs real editors, coc.nvim and the pinned development-only Tombi CLI. It covers activation, formatting, configuration, local schema selection and restart replay. Set `COC_TEST_COC_PATH` to use a local coc.nvim checkout. The existing `pnpm test` Docker smoke suite is retained separately.
