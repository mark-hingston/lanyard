"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runInstructionsHygiene = runInstructionsHygiene;
exports.warnIfLeanCtxMissing = warnIfLeanCtxMissing;
exports.ensureLeanCtxInstalled = ensureLeanCtxInstalled;
const shell_1 = require("./shell");
const constants_1 = require("./constants");
const SHELL_OPERATOR_RE = /[|&;]|\$\(|>|<|`/;
// The prompt that drives a non-interactive Copilot run to execute the
// refactor-instructions skill against the repo's .github/instructions/ tree.
// Copilot loads the skill from .github/skills/refactor-instructions/; this prompt
// tells the agent to actually run it (so the tidy-up is guaranteed rather than
// left to the agent's discretion) and scopes the work to structural findings.
// Front-matter `description`/`name`/`applyTo` on Lanyard-owned files is owned
// by the bootstrap source-of-truth in src/constants.ts; the next `lanyard`
// run would reset any model rewrite anyway, so the model only audits those
// files for structural findings and only rewrites front matter on user-added
// files.
const REFACTOR_INSTRUCTIONS_PROMPT = [
    "Run the `refactor-instructions` agent skill from",
    "`.github/skills/refactor-instructions/SKILL.md` to audit and reorganise the",
    "`.github/instructions/` files in this repo per the VS Code custom-instructions",
    "convention. Apply the structural findings: split oversized always-on files",
    "into scoped ones, validate `applyTo` globs against the repo's actual files,",
    "and flag missing front matter on user-added files. Do NOT rewrite the YAML",
    "front matter (`description`, `name`, `applyTo`) of Lanyard-owned",
    "instruction files — those have `<!-- lanyard:*:start/end -->` or",
    "`<!-- managed-by:lanyard start/end -->` markers and their front matter is",
    "the bootstrap's source-of-truth (the next `lanyard` run would overwrite",
    "any rewrite). Do not delete any file.",
].join(" ");
/**
 * Drive a non-interactive Copilot CLI run that executes the refactor-instructions
 * skill against the repo's `.github/instructions/` tree, so existing repo
 * instructions are tidied (applyTo scoping, descriptions, splitting) as part of
 * the bootstrap. The skill must already be on disk (written by
 * configureLeanCtxWorkspace); this runs after every other config write.
 *
 * Warns loudly and returns without throwing if the copilot CLI is not installed
 * (the config writes already succeeded; a missing tidy-up step should not roll
 * those back). A non-zero exit from copilot is surfaced as a warning, not an
 * error, for the same reason.
 */
async function runInstructionsHygiene(workspaceRoot) {
    if (!(await (0, shell_1.commandExists)("copilot"))) {
        console.warn(`\n[warn] The GitHub Copilot CLI was not found on PATH, so the refactor-instructions skill was not run. The instruction files were written; to tidy them now, install the Copilot CLI (https://docs.github.com/copilot/copilot-cli) and run:\n\n  copilot -p "${REFACTOR_INSTRUCTIONS_PROMPT}" --allow-all-tools --add-dir .\n`);
        return;
    }
    console.log("\nRunning the refactor-instructions skill via the Copilot CLI to tidy the .github/instructions/ tree …");
    const exitCode = await (0, shell_1.runInteractiveCommand)("copilot", [
        "-p",
        REFACTOR_INSTRUCTIONS_PROMPT,
        "--allow-all-tools",
        "--add-dir",
        ".",
    ], workspaceRoot);
    if (exitCode !== 0) {
        console.warn(`\n[warn] Copilot exited with code ${exitCode ?? "unknown"} while running the refactor-instructions skill. The configuration files were still written; inspect .github/instructions/ and re-run the skill manually if needed:\n\n  copilot -p "${REFACTOR_INSTRUCTIONS_PROMPT}" --allow-all-tools --add-dir .\n`);
    }
}
/**
 * Warn loudly if lean-ctx (required for the workspace MCP servers to resolve)
 * is not on PATH. Lanyard writes the config but does not install binaries;
 * tell the user the install command so they can do it themselves.
 */
async function warnIfLeanCtxMissing() {
    if (await (0, shell_1.commandExists)("lean-ctx")) {
        return;
    }
    console.warn(`\n[warn] lean-ctx is not on PATH; the workspace MCP servers won't resolve until it's installed. Install it:\n\n  curl -fsSL ${constants_1.LEAN_CTX_INSTALL_URL} | sh\n\nOr, if you have a JS package manager:\n\n  npm install -g ${constants_1.LEAN_CTX_NPM_PACKAGE}\n`);
}
/**
 * Make sure the lean-ctx CLI is on PATH. The bootstrap writes `.github/mcp.json`
 * and `.vscode/mcp.json` entries that reference a `lean-ctx` MCP server, plus
 * pre-tool-use / post-tool-use hooks that shell out to `lean-ctx hook ...`.
 * Those will hard-fail at runtime in the user's IDE if lean-ctx is missing, so
 * detect here and try to install it before we hand control back.
 *
 * Behaviour:
 *   - Already installed → silent no-op.
 *   - LEAN_CTX_SKIP_INSTALL=1 (or the deprecated LANYARD_SKIP_LEAN_CTX_INSTALL=1)
 *     → falls through to warnIfLeanCtxMissing(). Use this for air-gapped CI.
 *   - LEAN_CTX_INSTALL_COMMANDS env var (newline-separated, e.g. "npm install
 *     -g my-internal-lean-ctx\ncurl -fsSL https://internal/install.sh | sh")
 *     → overrides the default command list.
 *   - Otherwise tries the default list in order: `npm install -g lean-ctx-bin`
 *     (cross-platform, no curl-pipe), then the official
 *     `curl -fsSL https://leanctx.com/install.sh | sh`. After each attempt
 *     re-checks `commandExists("lean-ctx")`; the first command that puts it on
 *     PATH wins.
 *   - If every command fails, falls back to warnIfLeanCtxMissing() so the user
 *     always sees the manual-install command.
 */
async function ensureLeanCtxInstalled() {
    if (await (0, shell_1.commandExists)("lean-ctx")) {
        return;
    }
    const skipEnv = process.env.LEAN_CTX_SKIP_INSTALL ??
        process.env.LANYARD_SKIP_LEAN_CTX_INSTALL ??
        "";
    if (skipEnv === "1" || skipEnv.toLowerCase() === "true") {
        return warnIfLeanCtxMissing();
    }
    console.log("\nlean-ctx was not found on PATH. The workspace MCP servers and hooks " +
        "Lanyard just wrote depend on it, so attempting an automatic install…");
    for (const commandLine of constants_1.LEAN_CTX_INSTALL_COMMANDS) {
        const trimmed = commandLine.trim();
        if (trimmed.length === 0) {
            continue;
        }
        const usesShell = SHELL_OPERATOR_RE.test(trimmed);
        const argv = usesShell ? [] : splitCommandLine(trimmed);
        const head = usesShell ? trimmed.split(/\s+/)[0] : argv[0];
        if (!head) {
            continue;
        }
        console.log(`\n[lanyard] Running: ${trimmed}`);
        const probe = await (0, shell_1.runCommand)(head, ["--version"], { allowNonZero: true }).catch(() => null);
        if (!probe || probe.code !== 0) {
            console.log(`[lanyard] Skipping \`${head}\` — not available on this machine.`);
            continue;
        }
        const exitCode = usesShell
            ? await (0, shell_1.runShellCommand)(trimmed)
            : await (0, shell_1.runInteractiveCommand)(argv[0], argv.slice(1));
        if (exitCode !== 0) {
            console.warn(`[lanyard] \`${trimmed}\` exited with code ${exitCode ?? "unknown"}; trying the next option.`);
            continue;
        }
        if (await (0, shell_1.commandExists)("lean-ctx")) {
            console.log(`[lanyard] lean-ctx installed successfully via \`${head}\`.`);
            return;
        }
        console.warn(`[lanyard] \`${head}\` ran successfully but lean-ctx is still not on PATH. ` +
            `It may have been installed to a location not on $PATH (try re-opening your shell ` +
            `or check \`npm config get prefix\`).`);
    }
    await warnIfLeanCtxMissing();
}
function splitCommandLine(value) {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return [];
    }
    const parts = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [trimmed];
    return parts.map((part) => part.replace(/^["']|["']$/g, ""));
}
