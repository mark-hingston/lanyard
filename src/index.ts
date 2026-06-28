#!/usr/bin/env node

import process from "process";
import { relative } from "path";

import { configureCopilot } from "./copilot";
import { SERVERS } from "./constants";
import { configureLeanCtxWorkspace } from "./leanctx";
import { configureWorkspaceLsp } from "./lsp";
import {
  ensureLeanCtxInstalled,
  runInstructionsHygiene,
} from "./post-bootstrap";
import {
  FileMutationResult,
  LabeledFileMutationResult,
  ServerVerification,
} from "./types";
import { configureVsCodeWorkspace } from "./vscode";

const WORKSPACE = process.cwd();

async function main(): Promise<void> {
  ensureNodeVersion();

  console.log("Lanyard");
  console.log(`Workspace: ${WORKSPACE}`);

  // Make sure the lean-ctx CLI is on PATH before we write any MCP server or
  // hook config that references it — otherwise those config entries would
  // silently point at a binary that isn't installed yet.
  await ensureLeanCtxInstalled();

  const vscodeResult = await configureVsCodeWorkspace(WORKSPACE, SERVERS);
  const copilotResult = await configureCopilot(WORKSPACE, SERVERS);
  const lspResult = await configureWorkspaceLsp(WORKSPACE, {
    configureCopilot: true,
    configureVsCode: true,
  });
  const leanCtxResult = await configureLeanCtxWorkspace(WORKSPACE);

  const writtenFiles = collectWrittenFiles(
    WORKSPACE,
    vscodeResult?.file,
    copilotResult?.files ?? [],
    lspResult?.files ?? [],
    leanCtxResult?.files ?? [],
  );

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
  await runInstructionsHygiene(WORKSPACE);
}

function ensureNodeVersion(): void {
  const [major] = process.versions.node.split(".");
  if (Number(major) < 18) {
    throw new Error(
      `Lanyard requires Node.js 18 or newer. Found ${process.versions.node}.`,
    );
  }
}

function collectWrittenFiles(
  workspaceRoot: string,
  vscodeFile: FileMutationResult | undefined,
  copilotFiles: readonly LabeledFileMutationResult[],
  lspFiles: readonly LabeledFileMutationResult[],
  leanCtxFiles: readonly LabeledFileMutationResult[],
): string[] {
  const files: string[] = [];
  const push = (result: FileMutationResult | undefined): void => {
    if (result && result.changed) {
      files.push(relative(workspaceRoot, result.path));
    }
  };

  push(vscodeFile);
  for (const entry of copilotFiles) push(entry.file);
  for (const entry of lspFiles) push(entry.file);
  for (const entry of leanCtxFiles) push(entry.file);

  return files;
}

function printSummary(files: readonly string[]): void {
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

function failIfVerificationFailed(
  verifications: readonly ServerVerification[],
): void {
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
  process.exitCode = 1;
});
