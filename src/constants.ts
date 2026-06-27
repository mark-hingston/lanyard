import { ServerSpec } from "./types";

export const ATLASSIAN_MCP_URL = "https://mcp.atlassian.com/v1/mcp/authv2";
export const ATLASSIAN_GETTING_STARTED_DOC_URL =
  "https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/";
export const ATLASSIAN_IDE_DOC_URL =
  "https://support.atlassian.com/atlassian-rovo-mcp-server/docs/setting-up-ides/";

export const GRAFANA_MCP_URL = "https://mcp.grafana.com/mcp";
export const GRAFANA_STACK_URL = "https://puregym.grafana.net/";
export const GRAFANA_DOC_URL =
  "https://grafana.com/docs/grafana-cloud/machine-learning/assistant/configure/cloud-mcp/";

export const LEAN_CTX_INSTALL_URL = "https://leanctx.com/install.sh";

export const VSCODE_MCP_CONFIG_PATH = ".vscode/mcp.json";
export const VSCODE_EXTENSIONS_CONFIG_PATH = ".vscode/extensions.json";
export const VSCODE_SETTINGS_CONFIG_PATH = ".vscode/settings.json";
export const COPILOT_WORKSPACE_MCP_CONFIG_PATH = ".github/mcp.json";
export const COPILOT_ALTERNATE_WORKSPACE_MCP_CONFIG_PATH = ".mcp.json";
export const COPILOT_WORKSPACE_LSP_CONFIG_PATH = ".github/lsp.json";
export const COPILOT_ALTERNATE_WORKSPACE_LSP_CONFIG_PATH = "lsp.json";
export const COPILOT_HOOKS_CONFIG_PATH = ".github/hooks/hooks.json";
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
export const COPILOT_INSTRUCTIONS_PATH = ".github/copilot-instructions.md";

// Lanyard's bootstrap-config instructions file. `applyTo: ".github/**"` per
// the VS Code custom-instructions convention — the agent auto-loads it
// whenever a file under .github/ is in scope (the assistant-wiring trigger
// condition: .github/copilot-instructions.md, .github/instructions/,
// .github/hooks/hooks.json, .github/mcp.json, .github/lsp.json,
// .github/scripts/regenerate-instructions.mjs, .github/skills/, and
// .github/agents/). The `description` remains as human-readable context
// for the agent and as a fallback for description-matched loading.
export const COPILOT_INSTRUCTIONS_INDEX_PATH =
  ".github/instructions/lanyard.instructions.md";
export const COPILOT_INSTRUCTIONS_INDEX_FRONT_MATTER = [
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
export const REFACTOR_INSTRUCTIONS_SKILL_DIR =
  ".github/skills/refactor-instructions";
export const REVIEW_SKILL_DIR =
  ".github/skills/review";
export const FIND_SKILLS_SKILL_DIR = ".github/skills/find-skills";
export const SKILL_CREATOR_SKILL_DIR = ".github/skills/skill-creator";
// sem — third-party skill vendored from @ataraxy-labs/sem (MIT OR
//   Apache-2.0). Entity-level diff / impact / blast-radius for AI
//   agents. Optional integration point: the ticket-to-pr PR-creator
//   probes `npx --no-install @ataraxy-labs/sem --version` and silently
//   appends an "Affected entities" section to the PR body when present.
//   Never required — the PR must open without it.
export const SEM_SKILL_DIR = ".github/skills/sem";
// refine — Lanyard's own skill: prepares a Jira ticket for an agent
//   implementer. Scores the ticket against the generic definition-of-ready
//   rubric shipped with the skill at `references/refine-rubric.yml`, fills
//   gaps via a one-question-at-a-time loop, rewrites the live ticket
//   inline, hands off to the VS Code Plan agent for tech notes, and posts
//   those notes back as a managed `## Tech notes` section. The Atlassian
//   MCP is the only supported interface; no env-var / REST fallback.
//   Requires the Atlassian MCP (configured separately) and the VS Code
//   Plan agent.
export const REFINE_SKILL_DIR = ".github/skills/refine";
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
export const TICKET_TO_PR_SKILL_DIR = ".github/skills/ticket-to-pr";
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
export const AUDIT_INTEGRITY_SKILL_DIR = ".github/skills/audit-integrity";
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
export const ACREADINESS_ASSESS_SKILL_DIR =
  ".github/skills/acreadiness-assess";

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
export const CUSTOM_AGENTS_DIR = ".github/agents";

// Self-learning loop: Lanyard-owned write-back into Copilot instruction files.
// lean-ctx captures data; this script closes the loop. See src/self-learning-script.ts.
export const SELF_LEARNING_INSTRUCTIONS_PATH =
  ".github/instructions/self-learning.instructions.md";
export const SELF_LEARNING_REGENERATOR_SCRIPT_PATH =
  ".github/scripts/regenerate-instructions.mjs";
// Hook-driven capture. Reads the actual hook payloads (prompts, tool
// results, errors) instead of the slugs lean-ctx exposes. See the README's
// "Self-learning" section for the data-source tradeoff.
export const SELF_LEARNING_CAPTURE_SCRIPT_PATH =
  ".github/scripts/capture-session.mjs";
// Front matter for the self-learning instructions file. `applyTo: "**"` per
// the VS Code custom-instructions convention — learned patterns must be
// available at the start of every task, not just those whose description
// semantically matches "patterns and corrections". The body is a managed
// block rewritten by .github/scripts/regenerate-instructions.mjs on
// sessionEnd; the front matter above the first managed marker is
// Lanyard-owned and never modified by the regenerator.
export const SELF_LEARNING_INSTRUCTIONS_FRONT_MATTER = [
  "---",
  "name: Learned patterns",
  "description: Patterns and corrections mined from past Copilot/lean-ctx sessions in this repo. Load at the start of any task to avoid repeating mistakes previously corrected.",
  "applyTo: \"**\"",
  "---",
  "",
].join("\n");

export const LEAN_CTX_SERVER_NAME = "lean-ctx";
// Official npm wrapper for the prebuilt lean-ctx binary (same author/repo as
// the standalone install). Preferred install path when a JS package manager is
// available, because it integrates with the user's existing tooling.
export const LEAN_CTX_NPM_PACKAGE = "lean-ctx-bin";
export const LEAN_CTX_PLAN_AGENT_TOOLS = [
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
] as const;

export const SERVERS: readonly ServerSpec[] = [
  {
    name: "atlassian",
    displayName: "Atlassian Rovo MCP",
    type: "http",
    url: ATLASSIAN_MCP_URL,
    docs: [ATLASSIAN_GETTING_STARTED_DOC_URL, ATLASSIAN_IDE_DOC_URL],
  },
  {
    name: "grafana",
    displayName: "Grafana Cloud MCP",
    type: "http",
    url: GRAFANA_MCP_URL,
    headers: {
      "X-Grafana-URL": GRAFANA_STACK_URL,
    },
    docs: [GRAFANA_DOC_URL],
  },
] as const;
