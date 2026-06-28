#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const process_1 = __importDefault(require("process"));
const path_1 = require("path");
const copilot_1 = require("./copilot");
const constants_1 = require("./constants");
const leanctx_1 = require("./leanctx");
const lsp_1 = require("./lsp");
const post_bootstrap_1 = require("./post-bootstrap");
const vscode_1 = require("./vscode");
const WORKSPACE = process_1.default.cwd();
async function main() {
    ensureNodeVersion();
    console.log("Lanyard");
    console.log(`Workspace: ${WORKSPACE}`);
    // Make sure the lean-ctx CLI is on PATH before we write any MCP server or
    // hook config that references it — otherwise those config entries would
    // silently point at a binary that isn't installed yet.
    await (0, post_bootstrap_1.ensureLeanCtxInstalled)();
    const vscodeResult = await (0, vscode_1.configureVsCodeWorkspace)(WORKSPACE, constants_1.SERVERS);
    const copilotResult = await (0, copilot_1.configureCopilot)(WORKSPACE, constants_1.SERVERS);
    const lspResult = await (0, lsp_1.configureWorkspaceLsp)(WORKSPACE, {
        configureCopilot: true,
        configureVsCode: true,
    });
    const leanCtxResult = await (0, leanctx_1.configureLeanCtxWorkspace)(WORKSPACE);
    const writtenFiles = collectWrittenFiles(WORKSPACE, vscodeResult?.file, copilotResult?.files ?? [], lspResult?.files ?? [], leanCtxResult?.files ?? []);
    const verifications = [
        ...(vscodeResult?.verifications ?? []),
        ...(copilotResult?.verifications ?? []),
        ...(lspResult?.verifications ?? []),
    ];
    failIfVerificationFailed(verifications);
    printSummary(writtenFiles);
    // The refactor-instructions skill is now on disk in .github/skills/. Drive a
    // non-interactive Copilot run to execute it against the instructions tree we
    // just wrote, so existing repo instructions are tidied (applyTo scoping,
    // descriptions, splitting) as part of the bootstrap. Warns loudly and tells
    // the user what to do if the copilot CLI is not installed.
    await (0, post_bootstrap_1.runInstructionsHygiene)(WORKSPACE);
}
function ensureNodeVersion() {
    const [major] = process_1.default.versions.node.split(".");
    if (Number(major) < 18) {
        throw new Error(`Lanyard requires Node.js 18 or newer. Found ${process_1.default.versions.node}.`);
    }
}
function collectWrittenFiles(workspaceRoot, vscodeFile, copilotFiles, lspFiles, leanCtxFiles) {
    const files = [];
    const push = (result) => {
        if (result && result.changed) {
            files.push((0, path_1.relative)(workspaceRoot, result.path));
        }
    };
    push(vscodeFile);
    for (const entry of copilotFiles)
        push(entry.file);
    for (const entry of lspFiles)
        push(entry.file);
    for (const entry of leanCtxFiles)
        push(entry.file);
    return files;
}
function printSummary(files) {
    console.log("");
    if (files.length === 0) {
        console.log("No files needed changes.");
        return;
    }
    console.log("Wrote:");
    for (const file of files) {
        console.log(`  ${file}`);
    }
}
function failIfVerificationFailed(verifications) {
    const failures = verifications.filter((verification) => !verification.verified);
    if (failures.length === 0) {
        return;
    }
    const names = failures.map((failure) => failure.name).join(", ");
    throw new Error(`Verification failed for: ${names}`);
}
main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[error] ${message}`);
    process_1.default.exitCode = 1;
});
