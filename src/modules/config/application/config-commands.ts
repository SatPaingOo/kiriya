import type { CommandSpec } from "../../../core/domain/command.js";
import type { InputSchema } from "../../../core/domain/input-schema.js";
import { RawReader } from "../../../core/domain/input-schema.js";

export type NoInput = Readonly<Record<string, never>>;

export interface KeyInput {
  readonly key: string;
}

export const noInput: InputSchema<NoInput> = { positionals: [], options: {}, parse: () => ({}) };

export const keyInput: InputSchema<KeyInput> = {
  positionals: [{ name: "key", description: "config.arg.key", required: true, variadic: false }],
  options: {},
  parse: (raw) => ({ key: new RawReader(raw).positional(0) ?? "" }),
};

/** What every config command shares: they read or write one small local file. */
export const CONFIG_COMMAND = {
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
} as const satisfies Partial<CommandSpec<unknown>>;
