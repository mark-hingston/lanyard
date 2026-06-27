"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureLeanCtxWorkspace = configureLeanCtxWorkspace;
exports.buildLeanCtxVsCodeServerConfig = buildLeanCtxVsCodeServerConfig;
exports.buildLeanCtxCopilotServerConfig = buildLeanCtxCopilotServerConfig;
exports.matchesLeanCtxVsCodeServer = matchesLeanCtxVsCodeServer;
exports.matchesLeanCtxCopilotServer = matchesLeanCtxCopilotServer;
const path_1 = require("path");
const promises_1 = require("readline/promises");
const process_1 = __importDefault(require("process"));
const constants_1 = require("./constants");
const json_file_1 = require("./json-file");
const shipped_1 = require("./shipped");
const string_arrays_1 = require("./string-arrays");
// Managed-block markers used inside .github/copilot-instructions.md (Copilot's
// always-on workspace instructions file — the file Copilot loads for every
// chat request per the VS Code custom-instructions convention). The body is
// Lanyard's always-on guidance: the ponytail "lazy senior dev" ruleset and
// the lean-ctx tool-mapping reference. Anything the user writes above or below
// the markers is preserved across re-runs.
const COPILOT_INSTRUCTIONS_MANAGED_BLOCK_BEGIN = "<!-- lanyard:copilot-instructions:start -->";
const COPILOT_INSTRUCTIONS_MANAGED_BLOCK_END = "<!-- lanyard:copilot-instructions:end -->";
// LEGACY markers from older Lanyard versions that appended a managed block to
// .github/copilot-instructions.md. We still recognise these so an upgrade can
// strip them and replace with the current managed block. See
// configureCopilotInstructions for the migration logic.
const LEGACY_COPILOT_INSTRUCTIONS_BLOCK_BEGIN = "<!-- lanyard:lean-ctx-rules:start -->";
const LEGACY_COPILOT_INSTRUCTIONS_BLOCK_END = "<!-- lanyard:lean-ctx-rules:end -->";
// Managed-block markers for .github/instructions/lanyard.instructions.md. The
// body is a quick reference of where Lanyard writes its files and the
// invariants to honour when editing the bootstrap config — not a TOC of
// always-on guidance (always-on content lives in copilot-instructions.md).
const LANYARD_BOOTSTRAP_MANAGED_BLOCK_BEGIN = "<!-- lanyard:bootstrap:start -->";
const LANYARD_BOOTSTRAP_MANAGED_BLOCK_END = "<!-- lanyard:bootstrap:end -->";
// ponytail "lazy senior dev" ruleset. Vendored from ponytail's instruction-only
// Copilot adapter (https://github.com/DietrichGebert/ponytail/blob/main/.github/copilot-instructions.md).
// Body lines must start with content (no leading blank) so the managed block
// renders cleanly inside copilot-instructions.md.
const PONYTAIL_RULESET_BODY = [
    "> Always-on ruleset, vendored from [ponytail](https://github.com/DietrichGebert/ponytail) (instruction-only Copilot adapter).",
    "",
    "### Lazy senior dev mode",
    "",
    "You are a lazy senior developer. Lazy means efficient, not careless. The best code is the code never written.",
    "",
    "Before writing any code, stop at the first rung that holds:",
    "",
    "1. Does this need to be built at all? (YAGNI)",
    "2. Does it already exist in this codebase? Reuse the helper, util, or pattern that's already here, don't re-write it.",
    "3. Does the standard library already do this? Use it.",
    "4. Does a native platform feature cover it? Use it.",
    "5. Does an already-installed dependency solve it? Use it.",
    "6. Can this be one line? Make it one line.",
    "7. Only then: write the minimum code that works.",
    "",
    "The ladder runs after you understand the problem, not instead of it: read the task and the code it touches, trace the real flow end to end, then climb.",
    "",
    "Bug fix = root cause, not symptom: a report names a symptom. Grep every caller of the function you touch and fix the shared function once — one guard there is a smaller diff than one per caller, and patching only the path the ticket names leaves a sibling caller still broken.",
    "",
    "Rules:",
    "",
    "- No abstractions that weren't explicitly requested.",
    "- No new dependency if it can be avoided.",
    "- No boilerplate nobody asked for.",
    "- Deletion over addition. Boring over clever. Fewest files possible.",
    "- Shortest working diff wins, but only once you understand the problem. The smallest change in the wrong place isn't lazy, it's a second bug.",
    '- Question complex requests: "Do you actually need X, or does Y cover it?"',
    "- Pick the edge-case-correct option when two stdlib approaches are the same size, lazy means less code, not the flimsier algorithm.",
    "- Mark intentional simplifications with a `ponytail:` comment. If the shortcut has a known ceiling (global lock, O(n²) scan, naive heuristic), the comment names the ceiling and the upgrade path.",
    "",
    "Not lazy about: understanding the problem (read it fully and trace the real flow before picking a rung, a small diff you don't understand is just laziness dressed up as efficiency), input validation at trust boundaries, error handling that prevents data loss, security, accessibility, the calibration real hardware needs (the platform is never the spec ideal, a clock drifts, a sensor reads off), anything explicitly requested. Lazy code without its check is unfinished: non-trivial logic leaves ONE runnable check behind, the smallest thing that fails if the logic breaks (an assert-based demo/self-check or one small test file; no frameworks, no fixtures). Trivial one-liners need no test.",
].join("\n");
// lean-ctx tool-mapping reference. Cross-language, applies to every repo
// Lanyard ships lean-ctx hooks into — i.e. every repo Lanyard ships. So this
// belongs in the always-on block.
const LEAN_CTX_TOOL_MAPPING_BODY = [
    "### lean-ctx — context-engineering layer",
    "",
    "lean-ctx ships cheaper, context-aware replacements for the common file/shell tools. Prefer them when available in this repository.",
    "",
    "**Tool mapping**",
    "",
    "| Instead of | Use | Example |",
    "|------------|-----|---------|",
    '| Read/cat/head/tail | `ctx_read(path, mode)` | `ctx_read("src/main.ts", "full")` |',
    '| Grep/rg/find | `ctx_search(pattern, path)` | `ctx_search("function main", "src/")` |',
    '| Shell/bash | `ctx_shell(command)` | `ctx_shell("npm test")` |',
    '| Directory listings | `ctx_tree(path, depth)` | `ctx_tree(".", 3)` |',
    "",
    "**Preferred workflow**",
    "",
    "1. Orient with `ctx_overview(task)` for unfamiliar tasks.",
    "2. Locate code with `ctx_search(pattern, path)`.",
    "3. Read files with `ctx_read(path, mode)` before editing.",
    '4. Re-read with `ctx_read(path, "diff")` after edits.',
    "5. Use native edit tools only after lean-ctx has provided the file context.",
    "",
    "**Read modes** — `full` (editing), `signatures` (API-only), `map` (large-file structure), `lines:N-M` (exact ranges).",
].join("\n");
// Body of the always-on managed block inside .github/copilot-instructions.md.
// Ponytail ruleset first (high-level mindset), lean-ctx tool mapping second
// (specific tool reference).
const COPILOT_INSTRUCTIONS_MANAGED_BLOCK = [
    COPILOT_INSTRUCTIONS_MANAGED_BLOCK_BEGIN,
    "## Lanyard assistant guidance",
    "",
    "This repository was bootstrapped by [Lanyard](https://github.com/earendil-works/lanyard). Edit outside the `lanyard:copilot-instructions` markers and your changes will be preserved across re-runs.",
    "",
    PONYTAIL_RULESET_BODY,
    "",
    LEAN_CTX_TOOL_MAPPING_BODY,
    "",
    COPILOT_INSTRUCTIONS_MANAGED_BLOCK_END,
].join("\n");
// Body of the description-only managed block inside
// .github/instructions/lanyard.instructions.md. The agent loads this file
// only when its task semantically matches the front-matter description
// (editing the assistant wiring). The body is a quick reference of where
// Lanyard writes its files and the invariants to honour — kept short so the
// file does its job and stays out of the way.
const LANYARD_BOOTSTRAP_MANAGED_BLOCK = [
    LANYARD_BOOTSTRAP_MANAGED_BLOCK_BEGIN,
    "## What Lanyard writes",
    "",
    "Lanyard owns and refreshes these files on every `npx lanyard` run:",
    "",
    "| File | Lanyard-managed region | Purpose |",
    "|------|------------------------|---------|",
    "| `.github/copilot-instructions.md` | `<!-- lanyard:copilot-instructions:start/end -->` block | Always-on guidance: ponytail ruleset + lean-ctx tool mapping. The file is user-owned; content outside the markers is preserved. |",
    "| `.github/instructions/lanyard.instructions.md` *(this file)* | `<!-- lanyard:bootstrap:start/end -->` block | Description-only: loaded when editing the assistant wiring. |",
    "| `.github/instructions/self-learning.instructions.md` | `<!-- managed-by:lanyard start/end -->` block | Description-only: learned patterns from past Copilot/lean-ctx sessions. Body rewritten on `sessionEnd`. |",
    "| `.vscode/settings.json` | `chat.mcp.enabled`, `github.copilot.chat.planAgent.additionalTools` | Enables MCP and registers lean-ctx tools with the plan agent. |",
    "| `.github/hooks/hooks.json` | `preToolUse`, `postToolUse`, `sessionEnd` | Lanyard-owned hook entries, merged with any user entries. |",
    "| `.github/mcp.json` (or `.mcp.json`) | Atlassian, Grafana, lean-ctx servers | Workspace MCP servers. |",
    "| `.github/lsp.json` (or `lsp.json`) | Detected language servers | Detected LSP servers. |",
    "| `.github/scripts/regenerate-instructions.mjs` | full file | Self-learning regenerator (invoked by `sessionEnd` hook). |",
    "| `.github/skills/<name>/` and `.github/agents/<name>.agent.md` | full file | Lanyard-shipped skills and custom agents. |",
    "",
    "## Invariants",
    "",
    "When editing Lanyard-owned content (either in this repo or in the Lanyard source):",
    "",
    "- **Never edit inside a managed block.** The block body is regenerated on every `npx lanyard` run from `src/constants.ts` and `src/leanctx.ts` in the Lanyard repo. Manual edits inside the markers are discarded.",
    "- **Front matter above the first managed marker is Lanyard-owned too.** Source of truth: `COPILOT_INSTRUCTIONS_INDEX_FRONT_MATTER` and `SELF_LEARNING_INSTRUCTIONS_FRONT_MATTER` in `src/constants.ts`. The `refactor-instructions` skill audits Lanyard-owned files for structural findings only and never rewrites their front matter.",
    "- **Idempotency.** Re-running `npx lanyard` on an already-bootstrapped repo must be a no-op for content the user has not changed. The block-merge helpers in `src/leanctx.ts` use the marker pair to detect and replace in place; whitespace outside the markers is preserved verbatim.",
    "- **`AGENTS.md` / `CLAUDE.md` are no longer Lanyard's responsibility.** Lanyard targets Copilot only. If the user already has one, leave it alone (the `refactor-instructions` skill may still extract VS Code-specific sections out of it; see its rewrite contract).",
    LANYARD_BOOTSTRAP_MANAGED_BLOCK_END,
].join("\n");
const SELF_LEARNING_MANAGED_BLOCK_BEGIN = "<!-- managed-by:lanyard start -->";
const SELF_LEARNING_MANAGED_BLOCK_END = "<!-- managed-by:lanyard end -->";
const SELF_LEARNING_MANAGED_BLOCK_INITIAL = "## Learned patterns\n\n_No repeating patterns detected yet. Mined from lean-ctx events since last session._";
// Per-event stdin pattern for capture-session.mjs. The hook receives the
// payload via stdin; we tee it into the script. The script is fire-and-forget
// (backgrounded with & disown) so it never blocks the IDE on slow disk I/O.
const captureSessionBash = (event) => `PAYLOAD=$(cat); echo "$PAYLOAD" | node .github/scripts/capture-session.mjs ${event} & disown $!`;
const captureSessionPowershell = (event) => [
    "$payload = [Console]::In.ReadToEnd();",
    "$cwd = (Get-Location).Path;",
    "$temp = [System.IO.Path]::GetTempFileName();",
    "Set-Content -Path $temp -Value $payload -NoNewline -Encoding utf8;",
    `Start-Process -FilePath node -WorkingDirectory $cwd -ArgumentList '.github/scripts/capture-session.mjs', '${event}', '--payload-file', $temp -WindowStyle Hidden`,
].join(" ");
const REQUIRED_HOOKS = {
    preToolUse: [
        {
            type: "command",
            bash: "lean-ctx hook rewrite",
            powershell: "lean-ctx hook rewrite",
            timeoutSec: 15,
        },
        {
            type: "command",
            bash: "lean-ctx hook redirect",
            powershell: "lean-ctx hook redirect",
            timeoutSec: 5,
        },
    ],
    postToolUse: [
        {
            type: "command",
            bash: "lean-ctx hook observe",
            powershell: "lean-ctx hook observe",
            timeoutSec: 5,
        },
        {
            type: "command",
            bash: captureSessionBash("postToolUse"),
            powershell: captureSessionPowershell("postToolUse"),
            cwd: ".",
            timeoutSec: 2,
        },
    ],
    userPromptSubmitted: [
        {
            type: "command",
            bash: captureSessionBash("userPromptSubmitted"),
            powershell: captureSessionPowershell("userPromptSubmitted"),
            cwd: ".",
            timeoutSec: 2,
        },
    ],
    errorOccurred: [
        {
            type: "command",
            bash: captureSessionBash("errorOccurred"),
            powershell: captureSessionPowershell("errorOccurred"),
            cwd: ".",
            timeoutSec: 2,
        },
    ],
    sessionStart: [
        {
            type: "command",
            bash: captureSessionBash("sessionStart"),
            powershell: captureSessionPowershell("sessionStart"),
            cwd: ".",
            timeoutSec: 2,
        },
    ],
    // Two writers run in order:
    //   1. regenerate-instructions.mjs — mines lean-ctx events for tool usage
    //      and contradiction counts (low signal, but free).
    //   2. capture-session.mjs — writes the rich lessons block. It deliberately
    //      overwrites the lanyard-managed block above with its own managed
    //      block (managed-by:hooks), so the hook data wins.
    sessionEnd: [
        {
            type: "command",
            bash: `node .github/scripts/regenerate-instructions.mjs`,
            powershell: `node .github/scripts/regenerate-instructions.mjs`,
            timeoutSec: 15,
        },
        {
            type: "command",
            bash: `node .github/scripts/capture-session.mjs sessionEnd`,
            powershell: `node .github/scripts/capture-session.mjs sessionEnd`,
            timeoutSec: 15,
        },
    ],
};
async function configureLeanCtxWorkspace(workspaceRoot) {
    const files = [];
    files.push(await configureVsCodeSettings(workspaceRoot));
    files.push(await configureCopilotHooks(workspaceRoot));
    // Lanyard's always-on guidance (ponytail ruleset + lean-ctx tool mapping)
    // lives in .github/copilot-instructions.md as a managed block — the file
    // Copilot loads for every chat request. configureCopilotInstructions also
    // handles the legacy migration (stripping the older
    // `<!-- lanyard:lean-ctx-rules:start/end -->` block an upgrade may leave
    // behind). The description-only bootstrap-config file lives under
    // .github/instructions/.
    files.push(await configureCopilotInstructions(workspaceRoot));
    files.push(await configureBootstrapConfigInstructions(workspaceRoot));
    files.push(await configureSelfLearningInstructions(workspaceRoot));
    files.push(await configureSelfLearningRegenerator(workspaceRoot));
    files.push(await configureSelfLearningCapture(workspaceRoot));
    // Ship third-party skills (find-skills, skill-creator, sem, audit-integrity,
    // acreadiness-assess) before the refactor-instructions skill — they have
    // no audit dependency, they're just made available to the agent. sem is
    // an optional integration point for the ticket-to-pr PR-creator
    // (entity-level blast radius in the PR body); its absence does not block
    // any workflow. acreadiness-assess optionally invokes
    // `npx github:microsoft/agentrc` and the companion
    // `ai-readiness-reporter` custom agent (shipped below via
    // configureAgents) — both fail open, the skill simply reports the
    // missing prerequisite.
    files.push(...(await configureSkill(workspaceRoot, "Find-skills skill", constants_1.FIND_SKILLS_SKILL_DIR, shipped_1.FIND_SKILLS_FILES)), ...(await configureSkill(workspaceRoot, "Skill-creator skill", constants_1.SKILL_CREATOR_SKILL_DIR, shipped_1.SKILL_CREATOR_FILES)), ...(await configureSkill(workspaceRoot, "Sem skill", constants_1.SEM_SKILL_DIR, shipped_1.SEM_FILES)), ...(await configureSkill(workspaceRoot, "Audit-integrity skill", constants_1.AUDIT_INTEGRITY_SKILL_DIR, shipped_1.AUDIT_INTEGRITY_FILES)), ...(await configureSkill(workspaceRoot, "Acreadiness-assess skill", constants_1.ACREADINESS_ASSESS_SKILL_DIR, shipped_1.ACREADINESS_ASSESS_FILES)));
    // Ship the review workflow: the coordinating skill in
    // .github/skills/ (entry point — its `description` triggers when the
    // user asks for a code review) plus the custom agents it dispatches
    // (.github/agents/, VS Code's discovery location). Custom agents are
    // flat siblings under .github/agents/, so configureAgents writes each
    // file at the directory root rather than preserving subdirs. The same
    // agents/ directory is shared with the ticket-to-pr workflow — both
    // ship through the same configureAgents call below.
    files.push(
    // Reviewer coordinator + five lens subagents (correctness, security,
    // spec, tests, design). See src/agents/reviewer*.agent.md and
    // src/skills/review/SKILL.md. The review SKILL.md (the description
    // that triggers the workflow) ships via configureSkill below;
    // configureAgents writes the agents/ files at the directory root
    // because VS Code discovers them as flat siblings, not nested.
    ...(await configureAgents(workspaceRoot, shipped_1.CUSTOM_AGENT_FILES)), 
    // Ship the review skill itself — entry point whose `description`
    // loads on review prompts ("review this", "code review", etc.).
    // Must come after configureAgents so the SKILL.md and the
    // reviewer-*.agent.md files it references both exist before the
    // post-bootstrap refactor-instructions pass.
    ...(await configureSkill(workspaceRoot, "Review skill", constants_1.REVIEW_SKILL_DIR, shipped_1.REVIEW_FILES)), 
    // Ship the refine skill alongside the other vendor/utility skills —
    // it has no audit dependency, it just needs the Atlassian MCP and
    // the VS Code Plan agent to be available at invoke time.
    ...(await configureSkill(workspaceRoot, "Refine skill", constants_1.REFINE_SKILL_DIR, shipped_1.REFINE_FILES)), 
    // Ship the ticket-to-pr skill — coordinator + implementer +
    // pr-creator subagents (the latter two live alongside the reviewer
    // agents in .github/agents/ and were shipped via configureAgents
    // above). The skill requires the Atlassian MCP, the `gh` CLI
    // authenticated for the target repo, and a clean working tree.
    ...(await configureSkill(workspaceRoot, "Ticket-to-PR skill", constants_1.TICKET_TO_PR_SKILL_DIR, shipped_1.TICKET_TO_PR_FILES)));
    // The refactor-instructions skill is written last, after every instruction
    // file it audits exists: it reorganises the .github/instructions/ tree lanyard
    // just wrote. The agent should load this skill from its description as the
    // next step after the bootstrap completes (see the skill's When to use).
    files.push(...(await configureSkill(workspaceRoot, "Instructions-hygiene skill", constants_1.REFACTOR_INSTRUCTIONS_SKILL_DIR, shipped_1.REFACTOR_INSTRUCTIONS_FILES)));
    return { files };
}
function buildLeanCtxVsCodeServerConfig() {
    return {
        type: "stdio",
        command: constants_1.LEAN_CTX_SERVER_NAME,
        args: [],
    };
}
function buildLeanCtxCopilotServerConfig() {
    return {
        command: constants_1.LEAN_CTX_SERVER_NAME,
        args: [],
    };
}
function matchesLeanCtxVsCodeServer(value) {
    if (!(0, json_file_1.isRecord)(value)) {
        return false;
    }
    const typeMatches = value.type === undefined || value.type === "stdio";
    return (typeMatches &&
        matchesLeanCtxCommand(value.command) &&
        matchesEmptyArgs(value.args));
}
function matchesLeanCtxCopilotServer(value) {
    if (!(0, json_file_1.isRecord)(value)) {
        return false;
    }
    const typeMatches = value.type === undefined || value.type === "local" || value.type === "stdio";
    const toolsMatch = value.tools === undefined ||
        (Array.isArray(value.tools) &&
            value.tools.every((tool) => typeof tool === "string"));
    return (typeMatches &&
        toolsMatch &&
        matchesLeanCtxCommand(value.command) &&
        matchesEmptyArgs(value.args));
}
async function configureVsCodeSettings(workspaceRoot) {
    const filePath = (0, path_1.join)(workspaceRoot, constants_1.VSCODE_SETTINGS_CONFIG_PATH);
    const existing = (await (0, json_file_1.readJsonFile)(filePath)) ?? {};
    if (!(0, json_file_1.isRecord)(existing)) {
        throw new Error(`Expected ${filePath} to contain a JSON object.`);
    }
    const nextSettings = {
        ...existing,
        "chat.mcp.enabled": true,
        "github.copilot.chat.planAgent.additionalTools": (0, string_arrays_1.mergeStringArrays)(existing["github.copilot.chat.planAgent.additionalTools"], constants_1.LEAN_CTX_PLAN_AGENT_TOOLS, '"github.copilot.chat.planAgent.additionalTools"'),
    };
    const fileWrite = await (0, json_file_1.writeJsonFile)(filePath, nextSettings);
    return {
        label: "VS Code workspace settings",
        file: {
            path: filePath,
            ...fileWrite,
        },
    };
}
async function configureCopilotHooks(workspaceRoot) {
    const filePath = (0, path_1.join)(workspaceRoot, constants_1.COPILOT_HOOKS_CONFIG_PATH);
    const existing = (await (0, json_file_1.readJsonFile)(filePath)) ?? {};
    if (!(0, json_file_1.isRecord)(existing)) {
        throw new Error(`Expected ${filePath} to contain a JSON object.`);
    }
    const existingHooks = existing.hooks;
    if (existingHooks !== undefined && !(0, json_file_1.isRecord)(existingHooks)) {
        throw new Error(`Expected ${filePath} to contain a "hooks" object.`);
    }
    const nextHooks = {
        ...(existingHooks ?? {}),
    };
    for (const [hookName, entries] of Object.entries(REQUIRED_HOOKS)) {
        nextHooks[hookName] = mergeHookArrays(nextHooks[hookName], entries);
    }
    const nextConfig = {
        ...existing,
        version: 1,
        hooks: nextHooks,
    };
    const fileWrite = await (0, json_file_1.writeJsonFile)(filePath, nextConfig);
    return {
        label: "Copilot workspace hooks",
        file: {
            path: filePath,
            ...fileWrite,
        },
    };
}
/**
 * Write/refresh Lanyard's always-on guidance as a managed block inside
 * `.github/copilot-instructions.md` (the file Copilot loads for every chat
 * request per the VS Code custom-instructions convention
 * https://code.visualstudio.com/docs/agent-customization/custom-instructions).
 *
 * Behaviour by file state:
 *   - **No file on disk** (or empty): create the file with the managed block.
 *     The always-on guidance is the value Lanyard ships; returning no-op here
 *     would leave the agent without it. This is the default-create case.
 *   - **File exists with the current managed markers**: refresh the block in
 *     place. Idempotent — no prompt.
 *   - **File exists with legacy markers** (`<!-- lanyard:lean-ctx-rules:start/end -->`):
 *     strip them and replace with the current managed block. This is the
 *     documented upgrade migration for older Lanyard versions — no prompt.
 *   - **File exists with user content and no Lanyard markers at all**: prompt
 *     the user before appending the managed block. This is the only path
 *     where we'd be adding Lanyard-managed content to a file the user has
 *     been authoring; the prompt lets them opt out without losing their
 *     content. In non-interactive mode (no TTY) the prompt defaults to yes
 *     with a loud warning so automation keeps working.
 *
 * User content above and below the managed block is preserved across re-runs.
 */
async function configureCopilotInstructions(workspaceRoot) {
    const filePath = (0, path_1.join)(workspaceRoot, constants_1.COPILOT_INSTRUCTIONS_PATH);
    const existing = await (0, json_file_1.readTextFileIfExists)(filePath);
    // Missing or whitespace-only file: default-create. The always-on guidance
    // (ponytail ruleset + lean-ctx tool mapping) is the value Lanyard ships;
    // a fresh file has no user content to protect, so create without prompting.
    if (existing === undefined || existing.trim() === "") {
        const fileWrite = await (0, json_file_1.writeTextFile)(filePath, `${COPILOT_INSTRUCTIONS_MANAGED_BLOCK}\n`);
        return {
            label: "Copilot instructions (always-on managed block)",
            file: { path: filePath, ...fileWrite },
        };
    }
    // File exists with user content but no Lanyard markers (current or legacy).
    // We are about to append our managed block to a file the user has been
    // authoring — prompt before doing it. The refresh-in-place and legacy-
    // migrate paths are documented and idempotent; no prompt there.
    const hasCurrentMarkers = containsManagedBlock(existing, COPILOT_INSTRUCTIONS_MANAGED_BLOCK_BEGIN, COPILOT_INSTRUCTIONS_MANAGED_BLOCK_END);
    const hasLegacyMarkers = containsManagedBlock(existing, LEGACY_COPILOT_INSTRUCTIONS_BLOCK_BEGIN, LEGACY_COPILOT_INSTRUCTIONS_BLOCK_END);
    if (!hasCurrentMarkers && !hasLegacyMarkers) {
        const proceed = await promptYesNo(`Append Lanyard always-on guidance (ponytail ruleset + lean-ctx tool mapping) to ${constants_1.COPILOT_INSTRUCTIONS_PATH}?`);
        if (!proceed) {
            return {
                label: "Copilot instructions (always-on managed block)",
                file: { path: filePath, changed: false, created: false },
            };
        }
    }
    // existing is guaranteed to be a non-empty string here (missing/empty
    // handled above), so mergeCopilotInstructionsManagedBlock will not return
    // undefined.
    const next = mergeCopilotInstructionsManagedBlock(existing);
    const fileWrite = await (0, json_file_1.writeTextFile)(filePath, next);
    return {
        label: "Copilot instructions (always-on managed block)",
        file: { path: filePath, ...fileWrite },
    };
}
/**
 * Returns true if `content` contains a managed block delimited by the given
 * begin/end markers (matched as a non-greedy multi-line span).
 */
function containsManagedBlock(content, begin, end) {
    const pattern = new RegExp(`${escapeRegExp(begin)}[\\s\\S]*?${escapeRegExp(end)}\\n?`);
    return pattern.test(content);
}
/**
 * Interactive yes/no prompt for a single question. Returns true for empty
 * input or Y/y/yes (case-insensitive); false for N/n/no. In non-interactive
 * mode (no TTY, e.g. CI, piped stdin) the prompt defaults to true with a
 * warning logged to stdout so automation keeps working — callers that want
 * to fail closed in CI should check `process.stdin.isTTY` themselves before
 * calling. A Ctrl+D / EOF before the user types anything is treated as
 * "decline" (return false) so the program does not crash on a stray abort.
 */
async function promptYesNo(question) {
    if (!process_1.default.stdin.isTTY) {
        console.warn(`[lanyard] ${question} — defaulting to yes (no TTY)`);
        return true;
    }
    const rl = (0, promises_1.createInterface)({
        input: process_1.default.stdin,
        output: process_1.default.stdout,
    });
    try {
        const answer = (await rl.question(`${question} [Y/n] `))
            .trim()
            .toLowerCase();
        return answer === "" || answer === "y" || answer === "yes";
    }
    catch {
        // Ctrl+D / SIGINT before the user typed anything — treat as decline.
        console.warn(`[lanyard] ${question} — declined (input closed)`);
        return false;
    }
    finally {
        rl.close();
    }
}
/**
 * Write/refresh Lanyard's description-only bootstrap-config instructions file
 * at `.github/instructions/lanyard.instructions.md`. The file has YAML front
 * matter (`description` only, no `applyTo`) so VS Code loads it when the
 * agent's task semantically matches the description — i.e. when the user is
 * editing the assistant wiring itself. The body is a quick reference of where
 * Lanyard writes its files and the invariants to honour.
 */
async function configureBootstrapConfigInstructions(workspaceRoot) {
    const filePath = (0, path_1.join)(workspaceRoot, constants_1.COPILOT_INSTRUCTIONS_INDEX_PATH);
    const existing = await (0, json_file_1.readTextFileIfExists)(filePath);
    const next = mergeBootstrapConfigBlock(existing);
    const fileWrite = await (0, json_file_1.writeTextFile)(filePath, next);
    return {
        label: "Lanyard bootstrap config instructions",
        file: {
            path: filePath,
            ...fileWrite,
        },
    };
}
async function configureSelfLearningInstructions(workspaceRoot) {
    const filePath = (0, path_1.join)(workspaceRoot, constants_1.SELF_LEARNING_INSTRUCTIONS_PATH);
    const existing = await (0, json_file_1.readTextFileIfExists)(filePath);
    // Preserve any existing front matter and user content; only ensure the
    // managed Learned-patterns block exists so the regenerator has a target.
    const next = ensureSelfLearningBlock(existing, true);
    const fileWrite = await (0, json_file_1.writeTextFile)(filePath, next);
    return {
        label: "Self-learning instructions (Learned patterns)",
        file: {
            path: filePath,
            ...fileWrite,
        },
    };
}
async function configureSelfLearningRegenerator(workspaceRoot) {
    const filePath = (0, path_1.join)(workspaceRoot, constants_1.SELF_LEARNING_REGENERATOR_SCRIPT_PATH);
    const next = shipped_1.REGENERATE_INSTRUCTIONS_SCRIPT;
    const fileWrite = await (0, json_file_1.writeTextFile)(filePath, next);
    return {
        label: "Self-learning regenerator (sessionEnd hook)",
        file: {
            path: filePath,
            ...fileWrite,
        },
    };
}
async function configureSelfLearningCapture(workspaceRoot) {
    const filePath = (0, path_1.join)(workspaceRoot, constants_1.SELF_LEARNING_CAPTURE_SCRIPT_PATH);
    const next = shipped_1.CAPTURE_SESSION_SCRIPT;
    const fileWrite = await (0, json_file_1.writeTextFile)(filePath, next);
    return {
        label: "Self-learning capture (sessionStart/userPromptSubmitted/postToolUse/errorOccurred/sessionEnd hooks)",
        file: {
            path: filePath,
            ...fileWrite,
        },
    };
}
/**
 * Write a shipped agent skill into the target repo's
 * `.github/skills/<name>/` tree, preserving the skill's on-disk layout
 * (SKILL.md at the root, plus whatever bundled references / scripts /
 * agent files the skill ships with — see the readSkillDir() loader in
 * src/shipped.ts). Each file is written through writeTextFile's
 * exact-match idempotency, so re-runs on an up-to-date tree are no-ops.
 * Returns one labeled entry per file.
 */
async function configureSkill(workspaceRoot, label, skillDir, files) {
    const results = [];
    for (const [relPath, content] of Object.entries(files)) {
        const filePath = (0, path_1.join)(workspaceRoot, skillDir, relPath);
        const fileWrite = await (0, json_file_1.writeTextFile)(filePath, content);
        results.push({
            label: `${label} (${relPath})`,
            file: {
                path: filePath,
                ...fileWrite,
            },
        });
    }
    return results;
}
/**
 * Write Lanyard-shipped VS Code custom agents into the target repo's
 * `.github/agents/` directory (VS Code's workspace-level discovery
 * location — https://code.visualstudio.com/docs/agent-customization/custom-agents).
 * Agents are flat siblings (no subdirectories), so the keys of the
 * `files` map are bare filenames like `reviewer.agent.md`,
 * matching what readAgentDir() in src/shipped.ts produces. Each file is
 * written through writeTextFile's exact-match idempotency, so re-runs on
 * an up-to-date tree are no-ops. Returns one labeled entry per file.
 */
async function configureAgents(workspaceRoot, files) {
    const results = [];
    for (const [filename, content] of Object.entries(files)) {
        const filePath = (0, path_1.join)(workspaceRoot, constants_1.CUSTOM_AGENTS_DIR, filename);
        const fileWrite = await (0, json_file_1.writeTextFile)(filePath, content);
        results.push({
            label: `Custom agent (${filename})`,
            file: {
                path: filePath,
                ...fileWrite,
            },
        });
    }
    return results;
}
function ensureSelfLearningBlock(existing, includeFrontMatter) {
    const block = `${SELF_LEARNING_MANAGED_BLOCK_BEGIN}\n${SELF_LEARNING_MANAGED_BLOCK_INITIAL}\n${SELF_LEARNING_MANAGED_BLOCK_END}`;
    if (!existing || existing.trim() === "") {
        return includeFrontMatter
            ? `${constants_1.SELF_LEARNING_INSTRUCTIONS_FRONT_MATTER}${block}\n`
            : `${block}\n`;
    }
    if (existing.includes(SELF_LEARNING_MANAGED_BLOCK_BEGIN)) {
        return existing;
    }
    const prefix = existing.trimEnd();
    const sep = prefix.length > 0 ? "\n\n" : "";
    return `${prefix}${sep}${block}\n`;
}
function mergeHookArrays(existing, required) {
    if (existing === undefined) {
        return [...required];
    }
    if (!Array.isArray(existing) || existing.some((item) => !(0, json_file_1.isRecord)(item))) {
        throw new Error("Expected hook definitions to be arrays of objects.");
    }
    const merged = [...existing];
    for (const requiredHook of required) {
        if (!merged.some((candidate) => hookEquals(candidate, requiredHook))) {
            merged.push(requiredHook);
        }
    }
    return merged;
}
function hookEquals(left, right) {
    return (left.type === right.type &&
        left.bash === right.bash &&
        left.powershell === right.powershell &&
        left.timeoutSec === right.timeoutSec);
}
/**
 * Merge Lanyard's always-on managed block into `.github/copilot-instructions.md`.
 * Recognises both the current `lanyard:copilot-instructions` markers and the
 * legacy `lanyard:lean-ctx-rules` markers from older Lanyard versions (the
 * upgrade path strips the legacy block and replaces it with the current one).
 * If the file is missing entirely, return `undefined` so the caller can report
 * a no-op — that file is the user's and absence is a deliberate choice.
 */
function mergeCopilotInstructionsManagedBlock(existing) {
    if (existing === undefined) {
        return undefined;
    }
    const currentPattern = new RegExp(`${escapeRegExp(COPILOT_INSTRUCTIONS_MANAGED_BLOCK_BEGIN)}[\\s\\S]*?${escapeRegExp(COPILOT_INSTRUCTIONS_MANAGED_BLOCK_END)}\\n?`, "g");
    if (currentPattern.test(existing)) {
        return `${existing
            .replace(currentPattern, COPILOT_INSTRUCTIONS_MANAGED_BLOCK)
            .trimEnd()}\n`;
    }
    const legacyPattern = new RegExp(`${escapeRegExp(LEGACY_COPILOT_INSTRUCTIONS_BLOCK_BEGIN)}[\\s\\S]*?${escapeRegExp(LEGACY_COPILOT_INSTRUCTIONS_BLOCK_END)}\\n?`, "g");
    if (legacyPattern.test(existing)) {
        return `${existing
            .replace(legacyPattern, COPILOT_INSTRUCTIONS_MANAGED_BLOCK)
            .replace(/\n{3,}/g, "\n\n")
            .trimEnd()}\n`;
    }
    // No markers — append our block after the user's existing content.
    return `${existing.trimEnd()}\n\n${COPILOT_INSTRUCTIONS_MANAGED_BLOCK}`;
}
/**
 * Merge Lanyard's bootstrap-config managed block into
 * `.github/instructions/lanyard.instructions.md`. Replaces the existing
 * managed block in place if present; otherwise seeds the file with the front
 * matter followed by the managed block. Front matter above the block is
 * Lanyard-owned (see `COPILOT_INSTRUCTIONS_INDEX_FRONT_MATTER`) and is
 * refreshed on every run; user content outside the markers is preserved.
 */
function mergeBootstrapConfigBlock(existing) {
    const blockPattern = new RegExp(`${escapeRegExp(LANYARD_BOOTSTRAP_MANAGED_BLOCK_BEGIN)}[\\s\\S]*?${escapeRegExp(LANYARD_BOOTSTRAP_MANAGED_BLOCK_END)}\\n?`, "g");
    if (!existing || existing.trim() === "") {
        return `${constants_1.COPILOT_INSTRUCTIONS_INDEX_FRONT_MATTER}${LANYARD_BOOTSTRAP_MANAGED_BLOCK}\n`;
    }
    if (blockPattern.test(existing)) {
        return `${existing
            .replace(blockPattern, LANYARD_BOOTSTRAP_MANAGED_BLOCK)
            .trimEnd()}\n`;
    }
    // User already has the file with their own front matter / body — keep it
    // and append our managed block at the bottom so their content stays intact.
    return `${existing.trimEnd()}\n\n${LANYARD_BOOTSTRAP_MANAGED_BLOCK}`;
}
function matchesLeanCtxCommand(value) {
    return (typeof value === "string" &&
        /(^|[\\/])lean-ctx(?:\.exe)?$/i.test(value));
}
function matchesEmptyArgs(value) {
    return value === undefined || (Array.isArray(value) && value.length === 0);
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
