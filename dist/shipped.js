"use strict";
// Source of truth for the assets Lanyard ships into target repos. Each
// `*.md` / `*.mjs` file in src/skills/, src/agents/, or src/scripts/ is
// copied into the matching path under dist/ by the postbuild step in
// package.json, then loaded here at module init and re-exported.
//
// Per skill, exported as a `Record<relativePath, content>` so the writer in
// leanctx.ts can drop a whole skill (SKILL.md plus whatever bundled
// references, scripts, or agent instructions ship with it) into the target
// repo with one loop. Skills with no bundled resources (e.g. find-skills)
// still work the same way — the map just has one entry.
//
// Custom agents (src/agents/*.agent.md) are exported flat as a single
// `Record<filename, content>` because VS Code discovers them as siblings
// under `.github/agents/`, not nested.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAPTURE_SESSION_SCRIPT = exports.REGENERATE_INSTRUCTIONS_SCRIPT = exports.CUSTOM_AGENT_FILES = exports.ACREADINESS_ASSESS_FILES = exports.AUDIT_INTEGRITY_FILES = exports.TICKET_TO_PR_FILES = exports.REFINE_FILES = exports.SEM_FILES = exports.SKILL_CREATOR_FILES = exports.FIND_SKILLS_FILES = exports.REVIEW_FILES = exports.REFACTOR_INSTRUCTIONS_FILES = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const SKILLS_DIR = (0, path_1.join)(__dirname, "skills");
const AGENTS_DIR = (0, path_1.join)(__dirname, "agents");
const SCRIPTS_DIR = (0, path_1.join)(__dirname, "scripts");
function readSkillDir(skillName) {
    const root = (0, path_1.join)(SKILLS_DIR, skillName);
    const files = {};
    const walk = (dir) => {
        for (const entry of (0, fs_1.readdirSync)(dir)) {
            const full = (0, path_1.join)(dir, entry);
            if ((0, fs_1.statSync)(full).isDirectory()) {
                walk(full);
            }
            else {
                const rel = (0, path_1.relative)(root, full).split(path_1.sep).join("/");
                files[rel] = (0, fs_1.readFileSync)(full, "utf8");
            }
        }
    };
    walk(root);
    return files;
}
// Flat read for the custom-agents directory: VS Code discovers workspace
// custom agents as siblings under `.github/agents/`, so the map keys are
// bare filenames (no directory prefix).
function readAgentDir() {
    const files = {};
    for (const entry of (0, fs_1.readdirSync)(AGENTS_DIR)) {
        const full = (0, path_1.join)(AGENTS_DIR, entry);
        if ((0, fs_1.statSync)(full).isFile()) {
            files[entry] = (0, fs_1.readFileSync)(full, "utf8");
        }
    }
    return files;
}
exports.REFACTOR_INSTRUCTIONS_FILES = readSkillDir("refactor-instructions");
exports.REVIEW_FILES = readSkillDir("review");
exports.FIND_SKILLS_FILES = readSkillDir("find-skills");
exports.SKILL_CREATOR_FILES = readSkillDir("skill-creator");
exports.SEM_FILES = readSkillDir("sem");
exports.REFINE_FILES = readSkillDir("refine");
exports.TICKET_TO_PR_FILES = readSkillDir("ticket-to-pr");
exports.AUDIT_INTEGRITY_FILES = readSkillDir("audit-integrity");
exports.ACREADINESS_ASSESS_FILES = readSkillDir("acreadiness-assess");
exports.CUSTOM_AGENT_FILES = readAgentDir();
exports.REGENERATE_INSTRUCTIONS_SCRIPT = (0, fs_1.readFileSync)((0, path_1.join)(SCRIPTS_DIR, "regenerate-instructions.mjs"), "utf8");
// Hook-driven self-learning capture. Reads the actual Copilot CLI hook
// payloads (user prompts, tool results, errors) — strictly richer than the
// lean-ctx events regenerate-instructions.mjs mines, because it has the
// actual prompt and error text instead of just slugs. Writes a managed
// `<!-- managed-by:hooks start/end -->` block in the same instructions file;
// capture-session runs last on sessionEnd so its block wins over any
// lanyard-block the lean-ctx miner produced.
exports.CAPTURE_SESSION_SCRIPT = (0, fs_1.readFileSync)((0, path_1.join)(SCRIPTS_DIR, "capture-session.mjs"), "utf8");
