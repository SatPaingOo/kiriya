import { constants } from "node:fs";
import { access, rename } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { message } from "../../../domain/message.js";
import type { Environment } from "../../../domain/ports/environment.js";
import type { Trash, TrashOutcome } from "../../../domain/ports/trash.js";
import { runProgram } from "../../node/run-program.js";

const SYSTEM_TRASH = "/usr/bin/trash";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * macOS 15 and later ship /usr/bin/trash; older systems get a plain move into
 * ~/.Trash, which Finder cannot Put Back. Verified on macOS 26 in the phase 0 spike.
 */
export class MacosTrashAdapter implements Trash {
  readonly location = "core.trash.location.macos";

  constructor(private readonly environment: Environment) {}

  async send(paths: readonly string[]): Promise<readonly TrashOutcome[]> {
    const useSystem = await exists(SYSTEM_TRASH);
    const outcomes: TrashOutcome[] = [];
    for (const path of paths) outcomes.push(useSystem ? await this.withSystemTrash(path) : await this.byMove(path));
    return outcomes;
  }

  private async withSystemTrash(path: string): Promise<TrashOutcome> {
    const result = await runProgram(SYSTEM_TRASH, [path], { timeoutMs: 10 * 60_000 });
    if (result.code === 0 && !(await exists(path))) return { path, ok: true };
    return {
      path,
      ok: false,
      reason: message("core.trash.failed", { detail: result.stderr.trim() || `exit ${result.code}` }),
    };
  }

  private async byMove(path: string): Promise<TrashOutcome> {
    const trash = join(this.environment.homeDirectory, ".Trash");
    const name = basename(path);
    const extension = extname(name);
    const stem = name.slice(0, name.length - extension.length);
    try {
      for (let attempt = 1; ; attempt += 1) {
        const candidate = join(trash, attempt === 1 ? name : `${stem} ${attempt}${extension}`);
        if (await exists(candidate)) continue;
        await rename(path, candidate);
        return { path, ok: true };
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      const key = code === "EXDEV" ? "core.trash.other-device" : "core.trash.failed";
      return { path, ok: false, reason: message(key, { detail: code ?? (error as Error).message }) };
    }
  }
}
