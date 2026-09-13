import { checkConfigTypes, configKey } from "../../../core/application/config-values.js";
import type { Command, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { RefusedError, UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import type { ConfigStore, ConfigValue } from "../../../core/domain/ports/config-store.js";
import { looksSecret } from "../../../core/domain/secrets.js";
import { CONFIG_COMMAND } from "./config-commands.js";

export interface SetInput {
  readonly key: string;
  readonly values: readonly string[];
}

export interface SetOutput {
  readonly key: string;
  readonly value: ConfigValue;
  /** null when the setting was not in the file. */
  readonly previous: ConfigValue | null;
}

export const setSpec: CommandSpec<SetInput> = {
  id: "config.set",
  summary: "config.set.summary",
  examples: ["kiriya config set plugins kiriya-plugin-example", "kiriya config set plugins ./team/plugin ./my/plugin"],
  safety: "write",
  ...CONFIG_COMMAND,
  input: {
    positionals: [
      { name: "key", description: "config.set.arg.key", required: true, variadic: false },
      { name: "values", description: "config.set.arg.values", required: true, variadic: true },
    ],
    options: {},
    parse(raw) {
      const reader = new RawReader(raw);
      return { key: reader.positional(0) ?? "", values: reader.positionalsFrom(1) };
    },
  },
};

export class SetSetting implements Command<SetInput, SetOutput> {
  readonly spec = setSpec;

  constructor(private readonly config: ConfigStore) {}

  async execute(input: SetInput): Promise<CommandResult<SetOutput>> {
    const known = configKey(input.key);
    if (known === undefined) throw new UsageError("config.set.unknown-key", { key: input.key });
    if (known.type === "string" && input.values.length !== 1) {
      throw new UsageError("config.set.one-value", { key: input.key });
    }
    // The file sits in plain text in the user's profile, so it never takes a secret.
    if (input.values.some(looksSecret)) throw new RefusedError("config.set.secret");

    const current = await this.config.read();
    checkConfigTypes(current, this.config.path);
    const value: ConfigValue = known.type === "list" ? [...input.values] : (input.values[0] ?? "");
    await this.config.write({ ...current, [input.key]: value });
    return done({ key: input.key, value, previous: current[input.key] ?? null });
  }
}
