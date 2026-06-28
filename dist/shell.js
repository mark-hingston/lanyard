"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commandExists = commandExists;
exports.runCommand = runCommand;
exports.runInteractiveCommand = runInteractiveCommand;
exports.runShellCommand = runShellCommand;
exports.formatCommand = formatCommand;
const child_process_1 = require("child_process");
async function commandExists(command) {
    // Probe via `sh -c 'command -v ...'` rather than `which`/`where` so this
    // works in stripped PATHs (containers, CI runners) where `which` itself is
    // not on PATH. POSIX `sh` is essentially always present.
    const probe = process.platform === "win32"
        ? await runCommand("cmd", ["/d", "/s", "/c", `where ${command}`], { allowNonZero: true }).catch(() => null)
        : await runCommand("sh", ["-c", `command -v -- ${command} >/dev/null 2>&1`], { allowNonZero: true }).catch(() => null);
    return probe?.code === 0;
}
async function runCommand(command, args, options = {}) {
    const { cwd, allowNonZero = false } = options;
    return await new Promise((resolve, reject) => {
        const child = (0, child_process_1.spawn)(command, args, {
            cwd,
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });
        child.on("error", reject);
        child.on("close", (code) => {
            const result = { code, stdout, stderr };
            if (!allowNonZero && code !== 0) {
                reject(new Error(`${formatCommand(command, args)} failed with exit code ${code ?? "unknown"}.\n${stderr || stdout}`.trim()));
                return;
            }
            resolve(result);
        });
    });
}
async function runInteractiveCommand(command, args, cwd) {
    return await new Promise((resolve, reject) => {
        const child = (0, child_process_1.spawn)(command, args, {
            cwd,
            stdio: "inherit",
        });
        child.on("error", reject);
        child.on("close", (code) => resolve(code));
    });
}
/**
 * Run a command via the system shell (`/bin/sh -c` on POSIX, `cmd.exe /d /s /c`
 * on Windows). Use only for commands that contain shell metacharacters the
 * argv form cannot express (`|`, `&&`, `>`, etc.). Do NOT pass untrusted input
 * here — anything passed to the shell is interpreted as shell syntax.
 */
async function runShellCommand(commandLine, cwd) {
    return await new Promise((resolve, reject) => {
        const child = (0, child_process_1.spawn)(commandLine, {
            cwd,
            stdio: "inherit",
            shell: true,
        });
        child.on("error", reject);
        child.on("close", (code) => resolve(code));
    });
}
function formatCommand(command, args) {
    return [command, ...args.map(quoteIfNeeded)].join(" ");
}
function quoteIfNeeded(value) {
    return /\s/.test(value) ? JSON.stringify(value) : value;
}
