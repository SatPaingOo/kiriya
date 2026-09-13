import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import path from "node:path";
import { CapabilityUnavailableError } from "../../domain/errors.js";
import type { ProcessOptions, ProcessResult, ProcessRunner } from "../../domain/ports/process-runner.js";
import { runProgram } from "./run-program.js";

/**
 * Without a shell, Windows starts only real executables, so PATH is searched for
 * .exe and .com files there; batch files would need cmd.exe and are not found.
 */
const WINDOWS_EXTENSIONS = [".exe", ".com"];

export class NodeProcessRunnerAdapter implements ProcessRunner {
  async find(program: string): Promise<string | null> {
    const windows = process.platform === "win32";
    const extensions = !windows || path.extname(program) !== "" ? [""] : WINDOWS_EXTENSIONS;
    const directories = (process.env["PATH"] ?? "").split(path.delimiter).filter((directory) => directory !== "");
    for (const directory of directories) {
      for (const extension of extensions) {
        const candidate = path.join(directory, `${program}${extension}`);
        try {
          if (!(await stat(candidate)).isFile()) continue;
          if (!windows) await access(candidate, constants.X_OK);
          return candidate;
        } catch {
          // Not in this folder, or not executable: keep looking.
        }
      }
    }
    return null;
  }

  async run(program: string, args: readonly string[], options: ProcessOptions = {}): Promise<ProcessResult> {
    try {
      const result = await runProgram(program, args, options);
      return { code: result.code, stdout: result.stdout, stderr: result.stderr };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new CapabilityUnavailableError("core.process.cannot-start", { program, detail }, { cause: error });
    }
  }
}
