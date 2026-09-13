import { UsageError } from "../../domain/errors.js";
import type { StandardInput } from "../../domain/ports/standard-input.js";

/**
 * Standard input that carries something else, such as MCP messages, so no command may
 * read it. It reports a terminal, which makes a command ask for its value as an argument.
 */
export class ClosedStandardInput implements StandardInput {
  readonly isTerminal = true;

  read(): Promise<Uint8Array> {
    return Promise.reject(new UsageError("core.input.missing"));
  }
}
