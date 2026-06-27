"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERVERS = exports.LEAN_CTX_PLAN_AGENT_TOOLS = exports.LEAN_CTX_NPM_PACKAGE = exports.LEAN_CTX_SERVER_NAME = exports.SELF_LEARNING_INSTRUCTIONS_FRONT_MATTER = exports.SELF_LEARNING_CAPTURE_SCRIPT_PATH = exports.SELF_LEARNING_REGENERATOR_SCRIPT_PATH = exports.SELF_LEARNING_INSTRUCTIONS_PATH = exports.CUSTOM_AGENTS_DIR = exports.ACREADINESS_ASSESS_SKILL_DIR = exports.AUDIT_INTEGRITY_SKILL_DIR = exports.TICKET_TO_PR_SKILL_DIR = exports.REFINE_SKILL_DIR = exports.SEM_SKILL_DIR = exports.SKILL_CREATOR_SKILL_DIR = exports.FIND_SKILLS_SKILL_DIR = exports.REVIEW_SKILL_DIR = exports.REFACTOR_INSTRUCTIONS_SKILL_DIR = exports.COPILOT_INSTRUCTIONS_INDEX_FRONT_MATTER = exports.COPILOT_INSTRUCTIONS_INDEX_PATH = exports.COPILOT_INSTRUCTIONS_PATH = exports.COPILOT_HOOKS_CONFIG_PATH = exports.COPILOT_ALTERNATE_WORKSPACE_LSP_CONFIG_PATH = exports.COPILOT_WORKSPACE_LSP_CONFIG_PATH = exports.COPILOT_ALTERNATE_WORKSPACE_MCP_CONFIG_PATH = exports.COPILOT_WORKSPACE_MCP_CONFIG_PATH = exports.VSCODE_SETTINGS_CONFIG_PATH = exports.VSCODE_EXTENSIONS_CONFIG_PATH = exports.VSCODE_MCP_CONFIG_PATH = exports.LEAN_CTX_INSTALL_URL = exports.GRAFANA_DOC_URL = exports.GRAFANA_STACK_URL = exports.GRAFANA_MCP_URL = exports.ATLASSIAN_IDE_DOC_URL = exports.ATLASSIAN_GETTING_STARTED_DOC_URL = exports.ATLASSIAN_MCP_URL = void 0;
exports.ATLASSIAN_MCP_URL = "https://mcp.atlassian.com/v1/mcp/authv2";
exports.ATLASSIAN_GETTING_STARTED_DOC_URL = "https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/";
exports.ATLASSIAN_IDE_DOC_URL = "https://support.atlassian.com/atlassian-rovo-mcp-server/docs/setting-up-ides/";
exports.GRAFANA_MCP_URL = "https://mcp.grafana.com/mcp";
exports.GRAFANA_STACK_URL = "https://puregym.grafana.net/";
exports.GRAFANA_DOC_URL = "https://grafana.com/docs/grafana-cloud/machine-learning/assistant/configure/cloud-mcp/";
exports.LEAN_CTX_INSTALL_URL = "https://leanctx.com/install.sh";
exports.VSCODE_MCP_CONFIG_PATH = ".vscode/mcp.json";
exports.VSCODE_EXTENSIONS_CONFIG_PATH = ".vscode/extensions.json";
exports.VSCODE_SETTINGS_CONFIG_PATH = ".vscode/settings.json";
exports.COPILOT_WORKSPACE_MCP_CONFIG_PATH = ".github/mcp.json";
exports.COPILOT_ALTERNATE_WORKSPACE_MCP_CONFIG_PATH = ".mcp.json";
exports.COPILOT_WORKSPACE_LSP_CONFIG_PATH = ".github/lsp.json";
exports.COPILOT_ALTERNATE_WORKSPACE_LSP_CONFIG_PATH = "lsp.json";
exports.COPILOT_HOOKS_CONFIG_PATH = ".github/hooks/hooks.json";
// Copilot's always-on workspace-wide instructions file. Per the VS Code
// custom-instructions convention
// (https://code.visualstudio.com/docs/agent-customization/custom-instructions),
// this is the file Copilot loads for every chat request. Lanyard uses it as
// the home for its always-on guidance: the lean-ctx tool-mapping reference
// and the ponytail "lazy senior dev" ruleset, wrapped in a managed block so
// any content the user writes above or below the markers is preserved across
// re-runs. The file has no YAML front matter (Copilot convention).
//
// Behaviour by file state (see configureCopilotInstructions in leanctx.ts):
//   - Missing or empty: default-create. The always-on guidance is the value
//     Lanyard ships; a fresh file has no user content to protect.
//   - Exists with the current managed markers: refresh in place (idempotent).
//   - Exists with legacy markers (<!-- lanyard:lean-ctx-rules:start/end -->):
//     strip and replace with the current managed block (documented upgrade).
//   - Exists with user content and no Lanyard markers: prompt the user
//     before appending the managed block. Non-interactive mode (no TTY)
//     defaults to yes with a loud warning so automation keeps working.
exports.COPILOT_INSTRUCTIONS_PATH = ".github/copilot-instructions.md";
// Lanyard's bootstrap-config instructions file. `applyTo: ".github/**"` per
// the VS Code custom-instructions convention — the agent auto-loads it
// whenever a file under .github/ is in scope (the assistant-wiring trigger
// condition: .github/copilot-instructions.md, .github/instructions/,
// .github/hooks/hooks.json, .github/mcp.json, .github/lsp.json,
// .github/scripts/regenerate-instructions.mjs, .github/skills/, and
// .github/agents/). The `description` remains as human-readable context
// for the agent and as a fallback for description-matched loading.
exports.COPILOT_INSTRUCTIONS_INDEX_PATH = ".github/instructions/lanyard.instructions.md";
exports.COPILOT_INSTRUCTIONS_INDEX_FRONT_MATTER = [
    "---",
    "name: Lanyard bootstrap config",
    "description: How Lanyard wires up this repo's Copilot/VS Code assistant — the files Lanyard writes, the conventions it enforces, and the scripts that keep the wiring current. Load when editing .github/copilot-instructions.md, .github/instructions/, .github/hooks/hooks.json, .github/mcp.json, .github/lsp.json, .github/scripts/regenerate-instructions.mjs, .vscode/settings.json, or anything under .github/skills/ or .github/agents/.",
    "applyTo: \".github/**\"",
    "---",
    "",
].join("\n");
// Agent skills Lanyard ships into target repos. Each lands at
// `.github/skills/<name>/...` (per-skill subdir so VS Code's recursive
// `.github/skills/` discovery finds them). The asset contents are loaded
// in src/shipped.ts; this file only owns the on-disk layout.
//
// refactor-instructions — Lanyard's own skill: audits and reorganises the
//   repo's .github/instructions/*.md files per the VS Code custom-
//   instructions convention. Loaded from its description; runs as the next
//   step after the bootstrap completes.
// review — Lanyard's own skill: dispatches the
//   `reviewer` custom agent (`.github/agents/`) which fans out
//   five parallel review lenses (correctness, security, spec, tests,
//   design) and merges the findings into a severity-ordered report. Loaded
//   from its description when the user asks for a code review or PR
//   review.
// find-skills / skill-creator — third-party skills (vercel-labs/skills and
//   anthropics/skills respectively, both MIT, fetched and vendored under
//   src/skills/ at the time src/skills/<name>/ was added). Available to
//   the agent as-is; the user can `npx skills update` against the upstream
//   to refresh.
exports.REFACTOR_INSTRUCTIONS_SKILL_DIR = ".github/skills/refactor-instructions";
exports.REVIEW_SKILL_DIR = ".github/skills/review";
exports.FIND_SKILLS_SKILL_DIR = ".github/skills/find-skills";
exports.SKILL_CREATOR_SKILL_DIR = ".github/skills/skill-creator";
// sem — third-party skill vendored from @ataraxy-labs/sem (MIT OR
//   Apache-2.0). Entity-level diff / impact / blast-radius for AI
//   agents. Optional integration point: the ticket-to-pr PR-creator
//   probes `npx --no-install @ataraxy-labs/sem --version` and silently
//   appends an "Affected entities" section to the PR body when present.
//   Never required — the PR must open without it.
exports.SEM_SKILL_DIR = ".github/skills/sem";
// refine — Lanyard's own skill: prepares a Jira ticket for an agent
//   implementer. Scores the ticket against the generic definition-of-ready
//   rubric shipped with the skill at `references/refine-rubric.yml`, fills
//   gaps via a one-question-at-a-time loop, rewrites the live ticket
//   inline, hands off to the VS Code Plan agent for tech notes, and posts
//   those notes back as a managed `## Tech notes` section. The Atlassian
//   MCP is the only supported interface; no env-var / REST fallback.
//   Requires the Atlassian MCP (configured separately) and the VS Code
//   Plan agent.
exports.REFINE_SKILL_DIR = ".github/skills/refine";
// ticket-to-pr — Lanyard's own skill: end-to-end Jira ticket to opened
//   pull request. Coordinator agent (`ticket-to-pr`) reads the ticket via
//   Atlassian MCP, sets up a feature branch, dispatches an implementer
//   subagent (`ticket-to-pr-implementer`) to write code and pass test/lint
//   gates, then a PR-creator subagent (`ticket-to-pr-pr-creator`) to push
//   the branch and open the PR via `gh`. No worktree, no planning phase —
//   straight from Jira key to opened PR. Requires the Atlassian MCP, the
//   `gh` CLI authenticated for the target repo, and a clean working tree.
//   See src/skills/ticket-to-pr/SKILL.md for the human entry point and
//   references/ for protocol, tech-notes extraction, command detection,
//   and PR body template.
exports.TICKET_TO_PR_SKILL_DIR = ".github/skills/ticket-to-pr";
// audit-integrity — third-party skill vendored from
//   github/awesome-copilot/skills/audit-integrity (MIT). Shared audit
//   integrity framework for any analysis agent: anti-rationalization
//   guards, self-critique loops, retry protocols, non-negotiable
//   behaviours, self-reflection quality gates (1–10 scoring, ≥8
//   threshold), and a self-learning lesson/memory system. Pure
//   methodology — no runtime tool, no external dependency. Pairs well
//   with Lanyard's own `review` skill (apply as a post-lens gate) and
//   with the lean-ctx self-learning regenerator (the
//   self-learning-system reference here formalises the lesson/memory
//   pattern that the regenerator's `## Learned patterns` block
//   implements at the workspace level).
exports.AUDIT_INTEGRITY_SKILL_DIR = ".github/skills/audit-integrity";
// acreadiness-assess — third-party skill vendored from
//   github/awesome-copilot/skills/acreadiness-assess (MIT). The Measure
//   step in AgentRC's Measure → Generate → Maintain loop. Produces a
//   static HTML dashboard at `reports/index.html` via the companion
//   `ai-readiness-reporter` custom agent. Runtime: `npx -y
//   github:microsoft/agentrc readiness --json` (auto-downloads on first
//   run, ~50MB cached afterwards) — same fail-open pattern as the `sem`
//   skill (probes via `npx --no-install` to detect presence; absent or
//   unreachable, the skill simply tells the user to install it). The
//   companion custom agent is shipped alongside in
//   `.github/agents/ai-readiness-reporter.agent.md` (see
//   src/agents/).
//   Note: not to be confused with the `acreadiness-generate-instructions`
//   skill in the same upstream repo — that one writes
//   `.github/copilot-instructions.md`, which is the file Lanyard manages
//   behind `<!-- lanyard:copilot-instructions:start/end -->` markers, so
//   it is intentionally NOT vendored (running it would clobber the
//   managed block).
exports.ACREADINESS_ASSESS_SKILL_DIR = ".github/skills/acreadiness-assess";
// VS Code custom agents Lanyard ships into target repos. Each `<name>.agent.md`
// file in src/agents/ lands flat at `.github/agents/<name>.agent.md` — VS
// Code's workspace-level discovery location for custom agents (see
// https://code.visualstudio.com/docs/agent-customization/custom-agents).
// Lanyard-shipped agents fall under two coordinator-driven workflows:
//   - `review` workflow (read-only): the `reviewer` user-invocable
//     coordinator dispatches five lens subagents in parallel
//     (`reviewer-correctness` / `reviewer-security` / `reviewer-spec` /
//     `reviewer-tests` / `reviewer-design`). Each runs in isolated
//     context (`user-invocable: false`) so findings are independent and
//     unanchored.
//   - `ticket-to-pr` workflow (write): the `ticket-to-pr` user-invocable
//     coordinator dispatches two subagents sequentially —
//     `ticket-to-pr-implementer` (code + test/lint gate + commit) and
//     `ticket-to-pr-pr-creator` (`git push` + `gh pr create`). Both are
//     `user-invocable: false`; the coordinator is the only entry point.
exports.CUSTOM_AGENTS_DIR = ".github/agents";
// Self-learning loop: Lanyard-owned write-back into Copilot instruction files.
// lean-ctx captures data; this script closes the loop. See src/self-learning-script.ts.
exports.SELF_LEARNING_INSTRUCTIONS_PATH = ".github/instructions/self-learning.instructions.md";
exports.SELF_LEARNING_REGENERATOR_SCRIPT_PATH = ".github/scripts/regenerate-instructions.mjs";
// Hook-driven capture. Reads the actual hook payloads (prompts, tool
// results, errors) instead of the slugs lean-ctx exposes. See the README's
// "Self-learning" section for the data-source tradeoff.
exports.SELF_LEARNING_CAPTURE_SCRIPT_PATH = ".github/scripts/capture-session.mjs";
// Front matter for the self-learning instructions file. `applyTo: "**"` per
// the VS Code custom-instructions convention — learned patterns must be
// available at the start of every task, not just those whose description
// semantically matches "patterns and corrections". The body is a managed
// block rewritten by .github/scripts/regenerate-instructions.mjs on
// sessionEnd; the front matter above the first managed marker is
// Lanyard-owned and never modified by the regenerator.
exports.SELF_LEARNING_INSTRUCTIONS_FRONT_MATTER = [
    "---",
    "name: Learned patterns",
    "description: Patterns and corrections mined from past Copilot/lean-ctx sessions in this repo. Load at the start of any task to avoid repeating mistakes previously corrected.",
    "applyTo: \"**\"",
    "---",
    "",
].join("\n");
exports.LEAN_CTX_SERVER_NAME = "lean-ctx";
// Official npm wrapper for the prebuilt lean-ctx binary (same author/repo as
// the standalone install). Preferred install path when a JS package manager is
// available, because it integrates with the user's existing tooling.
exports.LEAN_CTX_NPM_PACKAGE = "lean-ctx-bin";
exports.LEAN_CTX_PLAN_AGENT_TOOLS = [
    "lean-ctx_ctx_read",
    "lean-ctx_ctx_search",
    "lean-ctx_ctx_tree",
    "lean-ctx_ctx_overview",
    "lean-ctx_ctx_plan",
    "lean-ctx_ctx_metrics",
    "lean-ctx_ctx_compress",
    "lean-ctx_ctx_session",
    "lean-ctx_ctx_knowledge",
    "lean-ctx_ctx_graph",
    "lean-ctx_ctx_retrieve",
    "lean-ctx_ctx_provider",
];
exports.SERVERS = [
    {
        name: "atlassian",
        displayName: "Atlassian Rovo MCP",
        type: "http",
        url: exports.ATLASSIAN_MCP_URL,
        docs: [exports.ATLASSIAN_GETTING_STARTED_DOC_URL, exports.ATLASSIAN_IDE_DOC_URL],
    },
    {
        name: "grafana",
        displayName: "Grafana Cloud MCP",
        type: "http",
        url: exports.GRAFANA_MCP_URL,
        headers: {
            "X-Grafana-URL": exports.GRAFANA_STACK_URL,
        },
        docs: [exports.GRAFANA_DOC_URL],
    },
];
