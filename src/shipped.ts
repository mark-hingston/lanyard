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

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, sep } from "path";

const SKILLS_DIR = join(__dirname, "skills");
const AGENTS_DIR = join(__dirname, "agents");
const SCRIPTS_DIR = join(__dirname, "scripts");

function readSkillDir(skillName: string): Record<string, string> {
  const root = join(SKILLS_DIR, skillName);
  const files: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else {
        const rel = relative(root, full).split(sep).join("/");
        files[rel] = readFileSync(full, "utf8");
      }
    }
  };
  walk(root);
  return files;
}

// Flat read for the custom-agents directory: VS Code discovers workspace
// custom agents as siblings under `.github/agents/`, so the map keys are
// bare filenames (no directory prefix).
function readAgentDir(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(AGENTS_DIR)) {
    const full = join(AGENTS_DIR, entry);
    if (statSync(full).isFile()) {
      files[entry] = readFileSync(full, "utf8");
    }
  }
  return files;
}

export const REFACTOR_INSTRUCTIONS_FILES = readSkillDir("refactor-instructions");
export const REVIEW_FILES = readSkillDir("review");
export const FIND_SKILLS_FILES = readSkillDir("find-skills");
export const SKILL_CREATOR_FILES = readSkillDir("skill-creator");
export const SEM_FILES = readSkillDir("sem");
export const REFINE_FILES = readSkillDir("refine");
export const TICKET_TO_PR_FILES = readSkillDir("ticket-to-pr");
export const AUDIT_INTEGRITY_FILES = readSkillDir("audit-integrity");
export const ACREADINESS_ASSESS_FILES = readSkillDir("acreadiness-assess");

export const CUSTOM_AGENT_FILES = readAgentDir();

export const REGENERATE_INSTRUCTIONS_SCRIPT = readFileSync(
  join(SCRIPTS_DIR, "regenerate-instructions.mjs"),
  "utf8",
);

// Hook-driven self-learning capture. Reads the actual Copilot CLI hook
// payloads (user prompts, tool results, errors) — strictly richer than the
// lean-ctx events regenerate-instructions.mjs mines, because it has the
// actual prompt and error text instead of just slugs. Writes a managed
// `<!-- managed-by:hooks start/end -->` block in the same instructions file;
// capture-session runs last on sessionEnd so its block wins over any
// lanyard-block the lean-ctx miner produced.
export const CAPTURE_SESSION_SCRIPT = readFileSync(
  join(SCRIPTS_DIR, "capture-session.mjs"),
  "utf8",
);
