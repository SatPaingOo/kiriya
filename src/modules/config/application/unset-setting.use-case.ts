import type { Command, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import type { ConfigStore } from "../../../core/domain/ports/config-store.js";
import { CONFIG_COMMAND, keyInput, type KeyInput } from "./config-commands.js";

export interface UnsetOutput {
  readonly key: string;
  /** false when the setting was not in the file. */
  readonly removed: boolean;
}

export const unsetSpec: CommandSpec<KeyInput> = {
  id: "config.unset",
  summary: "config.unset.summary",
  examples: ["kiriya config unset plugins"],
  safety: "write",
  ...CONFIG_COMMAND,
  // Over MCP an agent could take back a limit the user set.
  terminalOnly: true,
  input: keyInput,
};

export class UnsetSetting implements Command<KeyInput, UnsetOutput> {
  readonly spec = unsetSpec;

  constructor(private readonly config: ConfigStore) {}

  async execute(input: KeyInput): Promise<CommandResult<UnsetOutput>> {
    const current = await this.config.read();
    if (!(input.key in current)) return done({ key: input.key, removed: false });
    const remaining = Object.fromEntries(Object.entries(current).filter(([key]) => key !== input.key));
    await this.config.write(remaining);
    return done({ key: input.key, removed: true });
  }
}
