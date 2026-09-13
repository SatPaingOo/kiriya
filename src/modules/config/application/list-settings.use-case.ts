import { CONFIG_KEYS } from "../../../config/config-keys.js";
import { checkConfigTypes, configKey } from "../../../core/application/config-values.js";
import type { Command, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { byCodePoint } from "../../../core/domain/names.js";
import type { ConfigStore, ConfigValue } from "../../../core/domain/ports/config-store.js";
import { CONFIG_COMMAND, noInput, type NoInput } from "./config-commands.js";

export interface Setting {
  readonly key: string;
  /** null when the setting is not in the file. */
  readonly value: ConfigValue | null;
  /** false for a setting in the file that kiriya does not read. */
  readonly known: boolean;
}

export interface ListOutput {
  readonly path: string;
  readonly settings: readonly Setting[];
}

export const listSpec: CommandSpec<NoInput> = {
  id: "config.list",
  summary: "config.list.summary",
  examples: ["kiriya config list", "kiriya config list --json"],
  safety: "read",
  ...CONFIG_COMMAND,
  input: noInput,
};

export class ListSettings implements Command<NoInput, ListOutput> {
  readonly spec = listSpec;

  constructor(private readonly config: ConfigStore) {}

  async execute(): Promise<CommandResult<ListOutput>> {
    const values = await this.config.read();
    checkConfigTypes(values, this.config.path);
    const keys = [...new Set([...CONFIG_KEYS.map((entry) => entry.key), ...Object.keys(values)])].sort(byCodePoint);
    const settings = keys.map((key) => ({ key, value: values[key] ?? null, known: configKey(key) !== undefined }));
    return done({ path: this.config.path, settings });
  }
}
