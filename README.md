# Lanyard

Lanyard is a one-command bootstrap for AI coding assistants.

Run it once in a repository and it configures GitHub Copilot (CLI and VS Code), connects your AI tooling (Atlassian Rovo, Grafana Cloud and LeanCTX), detects your project's language servers, and generates a consistent set of instructions, skills and agents for everyone working in the repository.

Everything it writes is committed into your repository, so every contributor gets the same AI development environment after cloning.

---

# Why use Lanyard?

Instead of manually configuring Copilot, MCP servers, language servers, instructions, skills and agents across multiple tools, Lanyard bootstraps everything in one command.

After running Lanyard your repository includes:

* Configured GitHub Copilot workspace settings
* MCP configuration for Copilot CLI and VS Code
* Language server configuration for detected languages
* Workspace instruction files
* Agent skills
* Custom VS Code agents
* Self-learning instruction regeneration (lean-ctx events + Copilot CLI hook payloads)
* Copilot CLI hooks

Existing configuration is preserved wherever possible, and timestamped backups are created before JSON files are overwritten.

---

# Quick start

From the repository you want to configure:

```bash
npx github:mark-hingston/lanyard
```

Or from a local checkout:

```bash
npm install
npm run build
node dist/index.js
```

Lanyard always configures the current working directory.

It takes no command-line arguments.

---

# What happens during bootstrap?

Lanyard will:

1. Detect the languages used in your repository.
2. Generate Copilot CLI configuration.
3. Generate VS Code workspace configuration.
4. Configure MCP servers.
5. Configure language servers.
6. Install workspace instruction files.
7. Install bundled skills and agents.
8. Configure LeanCTX hooks.
9. Optionally run the `refactor-instructions` skill if Copilot CLI is installed and authenticated.

At the end of the run you'll see exactly which files were written.

---

# What Lanyard writes

## GitHub Copilot

* `.github/mcp.json`
* `.github/lsp.json`
* `.github/copilot-instructions.md`

## VS Code

* `.vscode/mcp.json`
* `.vscode/settings.json`
* `.vscode/extensions.json`

## Workspace automation

* `.github/hooks/hooks.json`
* `.github/scripts/regenerate-instructions.mjs`
* `.github/scripts/capture-session.mjs`

## Instructions

* `.github/instructions/*.instructions.md`

## Skills

Lanyard installs both built-in and curated third-party skills, including:

* review
* refine
* ticket-to-pr
* refactor-instructions
* find-skills
* skill-creator
* sem
* audit-integrity
* acreadiness-assess

## Agents

Lanyard also installs VS Code custom agents for workflows including:

* reviewer
* ticket-to-pr
* ai-readiness-reporter

---

# Requirements

## Required

* Node.js 18+

## Optional

These are not required to bootstrap your repository, but are required for their associated features.

### GitHub Copilot CLI

Required for:

* Post-bootstrap instruction refactoring
* Copilot CLI workflows

### VS Code

Required for:

* Workspace MCP configuration
* Workspace settings
* Recommended extensions

### LeanCTX

Recommended for:

* Context-aware tooling
* Hook execution
* Self-learning

Install with:

```bash
curl -fsSL https://leanctx.com/install.sh | sh
```

Verify installation:

```bash
lean-ctx doctor integrations
```

### Language servers

Lanyard configures language servers but does **not** install them.

Install whichever servers your project requires (Pyright, gopls, rust-analyzer, clangd, etc.).

---

# What Lanyard does not do

Lanyard intentionally does not:

* Create `AGENTS.md` or `CLAUDE.md`
* Install language servers (Pyright, gopls, rust-analyzer, clangd, etc.)
* Commit changes
* Push to Git
* Merge pull requests
* Modify Git history
* Send telemetry

> **Note:** Lanyard _does_ attempt to install the [`lean-ctx`](https://leanctx.com) CLI on your behalf when it isn't already on `PATH`, because the MCP server entries and pre/post-tool hooks Lanyard writes hard-depend on it. See [LeanCTX](#leanctx) above for details. Skip the auto-install in air-gapped CI by setting `LEAN_CTX_SKIP_INSTALL=1`, or override the install commands via `LEAN_CTX_INSTALL_COMMANDS` (newline-separated, e.g. `"npm install -g my-internal-lean-ctx\ncurl -fsSL https://internal/install.sh | sh"`).

---

# After bootstrap

If GitHub Copilot CLI is installed and authenticated, Lanyard automatically runs the `refactor-instructions` skill to organise your instruction files.

If Copilot CLI is unavailable, Lanyard prints the command you can run later.

Bootstrap still completes successfully.

---

# Authentication

After bootstrap you'll authenticate services as you use them.

* VS Code prompts for OAuth when connecting to remote MCP servers.
* Copilot CLI prompts via `copilot login` if needed.
* Atlassian and Grafana authentication occurs when first accessed.

---

# Supported languages

Lanyard automatically detects projects and configures language servers for:

* TypeScript / JavaScript
* Python
* Go
* Rust
* Java
* C / C++
* C#
* Ruby
* PHP
* Kotlin
* Swift
* Lua
* YAML
* Bash

Detection uses file extensions and well-known project files such as `go.mod`, `Cargo.toml`, `package.swift`, `pom.xml` and `composer.json`.

# License

MIT
