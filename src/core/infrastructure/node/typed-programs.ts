import { spawn } from "node:child_process";
import { CapabilityUnavailableError, InterruptedError } from "../../domain/errors.js";
import { runPowerShell, runProgram, type ProgramOptions, type ProgramResult } from "./run-program.js";

function cannotStart(program: string, error: unknown): CapabilityUnavailableError {
  const detail = error instanceof Error ? error.message : String(error);
  return new CapabilityUnavailableError("core.process.cannot-start", { program, detail }, { cause: error });
}

/** The first line of a program's error output, for a message. */
export function firstLine(text: string): string {
  return text.trim().split(/\r?\n/)[0] ?? "";
}

/** runProgram with kiriya's errors: InterruptedError when the signal stopped it, CapabilityUnavailableError when it could not start. */
export async function runTyped(
  command: string,
  args: readonly string[],
  options: ProgramOptions = {},
): Promise<ProgramResult> {
  try {
    return await runProgram(command, args, options);
  } catch (error) {
    if (options.signal?.aborted === true) throw new InterruptedError("core.error.interrupted", {}, { cause: error });
    throw cannotStart(command, error);
  }
}

/** runPowerShell with the same errors as runTyped. */
export async function runPowerShellTyped(script: string, options: ProgramOptions = {}): Promise<ProgramResult> {
  try {
    return await runPowerShell(script, options);
  } catch (error) {
    if (options.signal?.aborted === true) throw new InterruptedError("core.error.interrupted", {}, { cause: error });
    throw cannotStart("powershell.exe", error);
  }
}

/** Starts a program that outlives kiriya, such as the application a file opens in, and returns once it has started. */
export function launchDetached(command: string, args: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], { detached: true, stdio: "ignore" });
    child.once("error", (error) => reject(cannotStart(command, error)));
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}
