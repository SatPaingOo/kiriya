import { OperationFailedError } from "../../../domain/errors.js";
import type { Clipboard } from "../../../domain/ports/clipboard.js";
import type { ProgramResult } from "../../node/run-program.js";
import { firstLine, runTyped } from "../../node/typed-programs.js";

/** pbcopy garbles UTF-8 under the C locale, as the phase 0 spike found, so both programs get a UTF-8 one. */
const UTF8_LOCALE = { LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8", LC_CTYPE: "en_US.UTF-8" };

function failed(program: string, result: ProgramResult): OperationFailedError {
  return new OperationFailedError("core.clipboard.failed", {
    program,
    code: result.code,
    detail: firstLine(result.stderr),
  });
}

export class MacosClipboardAdapter implements Clipboard {
  backend(): Promise<string> {
    return Promise.resolve("pbcopy");
  }

  async write(text: string, signal: AbortSignal): Promise<void> {
    const options = { input: text, env: UTF8_LOCALE, signal, timeoutMs: 30_000 };
    const result = await runTyped("/usr/bin/pbcopy", [], options);
    if (result.code !== 0) throw failed("pbcopy", result);
  }

  async read(signal: AbortSignal): Promise<string> {
    const result = await runTyped("/usr/bin/pbpaste", [], { env: UTF8_LOCALE, signal, timeoutMs: 30_000 });
    if (result.code !== 0) throw failed("pbpaste", result);
    return result.stdout;
  }
}
