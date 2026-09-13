import type { MessageKey } from "../../i18n/locales/en.js";
import type { InputSchema } from "./input-schema.js";
import type { Message } from "./message.js";
import type { Confirmation } from "./ports/confirmation.js";
import type { Passthrough } from "./ports/passthrough.js";

export const SAFETY_LEVELS = ["read", "write", "destroy"] as const;
/** read: changes nothing. write: changes something that can be undone. destroy: cannot be undone. */
export type SafetyLevel = (typeof SAFETY_LEVELS)[number];

export interface CommandSpec<Input> {
  /**
   * `<module>.<verb>`, such as `files.delete`, or only `<module>` for a module that is
   * a single command, such as `doctor`: `kiriya doctor` then runs it directly.
   */
  readonly id: string;
  readonly summary: MessageKey;
  readonly input: InputSchema<Input>;
  readonly examples: readonly string[];
  /** The highest level the command can reach with any flags. */
  readonly safety: SafetyLevel;
  readonly idempotent: boolean;
  readonly usesNetwork: boolean;
  /** Runs a program the user names; never exposed over MCP. */
  readonly runsUserCommands: boolean;
}

export interface CommandContext {
  readonly cwd: string;
  readonly confirmation: Confirmation;
  /** Where the live output of a program the command runs goes, such as docker compose's. */
  readonly passthrough: Passthrough;
  readonly signal: AbortSignal;
}

export type CommandResult<Output> =
  | {
      readonly kind: "done";
      readonly data: Output;
      readonly warnings: readonly Message[];
      readonly failures: readonly Message[];
    }
  | {
      readonly kind: "preview";
      readonly data: Output;
      /** The flag that applies the previewed change, such as `--apply`. */
      readonly applyFlag: string;
      readonly warnings: readonly Message[];
    };

export function done<Output>(
  data: Output,
  notes: { readonly warnings?: readonly Message[]; readonly failures?: readonly Message[] } = {},
): CommandResult<Output> {
  return { kind: "done", data, warnings: notes.warnings ?? [], failures: notes.failures ?? [] };
}

export function preview<Output>(
  data: Output,
  applyFlag: string,
  warnings: readonly Message[] = [],
): CommandResult<Output> {
  return { kind: "preview", data, applyFlag, warnings };
}

/** One command: a use case that computes a result and never prints. */
export interface Command<Input, Output> {
  readonly spec: CommandSpec<Input>;
  execute(input: Input, context: CommandContext): Promise<CommandResult<Output>>;
}
