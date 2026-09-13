import { OperationFailedError } from "../../../domain/errors.js";
import type { Opener } from "../../../domain/ports/opener.js";
import { firstLine, runTyped } from "../../node/typed-programs.js";

/** open returns once Launch Services has the target, and fails when no application can open it. */
export class MacosOpenerAdapter implements Opener {
  async open(target: string, signal: AbortSignal): Promise<void> {
    const result = await runTyped("/usr/bin/open", [target], { signal, timeoutMs: 60_000 });
    if (result.code !== 0) {
      const detail = firstLine(result.stderr);
      throw new OperationFailedError("core.open.failed", { program: "open", target, code: result.code, detail });
    }
  }
}
