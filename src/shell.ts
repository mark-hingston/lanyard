import { spawn } from "child_process";

export interface CommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export async function commandExists(command: string): Promise<boolean> {
  // Probe via `sh -c 'command -v ...'` rather than `which`/`where` so this
  // works in stripped PATHs (containers, CI runners) where `which` itself is
  // not on PATH. POSIX `sh` is essentially always present.
  const probe = process.platform === "win32"
    ? await runCommand("cmd", ["/d", "/s", "/c", `where ${command}`], { allowNonZero: true }).catch(() => null)
    : await runCommand("sh", ["-c", `command -v -- ${command} >/dev/null 2>&1`], { allowNonZero: true }).catch(() => null);
  return probe?.code === 0;
}

export async function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string; allowNonZero?: boolean } = {},
): Promise<CommandResult> {
  const { cwd, allowNonZero = false } = options;

  return await new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      const result = { code, stdout, stderr };
      if (!allowNonZero && code !== 0) {
        reject(
          new Error(
            `${formatCommand(command, args)} failed with exit code ${
              code ?? "unknown"
            }.\n${stderr || stdout}`.trim(),
          ),
        );
        return;
      }

      resolve(result);
    });
  });
}

export async function runInteractiveCommand(
  command: string,
  args: string[],
  cwd?: string,
): Promise<number | null> {
  return await new Promise<number | null>((resolve, reject) => {
    const child = spawn(command, args, {
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
export async function runShellCommand(
  commandLine: string,
  cwd?: string,
): Promise<number | null> {
  return await new Promise<number | null>((resolve, reject) => {
    const child = spawn(commandLine, {
      cwd,
      stdio: "inherit",
      shell: true,
    });

    child.on("error", reject);
    child.on("close", (code) => resolve(code));
  });
}

export function formatCommand(command: string, args: string[]): string {
  return [command, ...args.map(quoteIfNeeded)].join(" ");
}

function quoteIfNeeded(value: string): string {
  return /\s/.test(value) ? JSON.stringify(value) : value;
}

