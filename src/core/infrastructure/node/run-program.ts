import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface ProgramResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly ms: number;
}

export interface ProgramOptions {
  readonly cwd?: string;
  readonly input?: string;
  /** Added to the inherited environment; how data reaches a script without appearing in its arguments. */
  readonly env?: Readonly<Record<string, string>>;
  /** 60 seconds by default; 0 means no limit, for a program that runs until it is stopped. */
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  /** Receives output as it arrives, decoded as UTF-8; the result's stdout and stderr are then empty. */
  readonly onOutput?: (text: string, stream: "stdout" | "stderr") => void;
  /**
   * For a program that leaves a child in the background holding its output open, such as
   * xclip: its output is not read, and the run ends when the program itself exits.
   */
  readonly ignoreOutput?: boolean;
}

/** Runs a program without a shell, so no argument is ever re-parsed. */
export function runProgram(
  command: string,
  args: readonly string[],
  options: ProgramOptions = {},
): Promise<ProgramResult> {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const output = options.ignoreOutput === true ? "ignore" : "pipe";
    const child = spawn(command, [...args], {
      env: options.env === undefined ? process.env : { ...process.env, ...options.env },
      windowsHide: true,
      stdio: ["pipe", output, output],
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    const timeoutMs = options.timeoutMs ?? 60_000;
    const timer = timeoutMs > 0 ? setTimeout(() => child.kill(), timeoutMs) : undefined;
    const onOutput = options.onOutput;
    if (onOutput === undefined) {
      child.stdout?.on("data", (chunk: Buffer) => out.push(chunk));
      child.stderr?.on("data", (chunk: Buffer) => err.push(chunk));
    } else {
      // Decoding per stream keeps a character split across two chunks whole.
      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      child.stdout?.on("data", (text: string) => onOutput(text, "stdout"));
      child.stderr?.on("data", (text: string) => onOutput(text, "stderr"));
    }
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    const finish = (code: number | null): void => {
      clearTimeout(timer);
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(out).toString("utf8"),
        stderr: Buffer.concat(err).toString("utf8"),
        ms: performance.now() - started,
      });
    };
    if (options.ignoreOutput === true) child.on("exit", finish);
    else child.on("close", finish);
    // A program may exit without reading its input, and writing to its closed pipe raises
    // EPIPE. That is not a failure of the run: the exit code and output still tell the result.
    child.stdin?.on("error", () => undefined);
    child.stdin?.end(options.input ?? "");
  });
}

export function windowsPowerShell(): string {
  const inbox = join(
    process.env["SystemRoot"] ?? "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  return existsSync(inbox) ? inbox : "powershell.exe";
}

/** A Windows PowerShell script through -EncodedCommand. Data travels in environment variables or stdin, never in the script. */
export function runPowerShell(script: string, options: ProgramOptions = {}): Promise<ProgramResult> {
  // Without this, progress records such as "Preparing modules for first use" arrive on stderr as CLIXML.
  const encoded = Buffer.from(`$ProgressPreference = 'SilentlyContinue'\n${script}`, "utf16le").toString("base64");
  return runProgram(
    windowsPowerShell(),
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
    options,
  );
}
