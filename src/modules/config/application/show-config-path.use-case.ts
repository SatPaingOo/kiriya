import type { Command, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import type { ConfigStore } from "../../../core/domain/ports/config-store.js";
import { CONFIG_COMMAND, noInput, type NoInput } from "./config-commands.js";

export interface PathOutput {
  readonly path: string;
  readonly exists: boolean;
}

export const pathSpec: CommandSpec<NoInput> = {
  id: "config.path",
  summary: "config.path.summary",
  examples: ["kiriya config path"],
  safety: "read",
  ...CONFIG_COMMAND,
  input: noInput,
};

export class ShowConfigPath implements Command<NoInput, PathOutput> {
  readonly spec = pathSpec;

  constructor(private readonly config: ConfigStore) {}

  async execute(): Promise<CommandResult<PathOutput>> {
    return done({ path: this.config.path, exists: await this.config.exists() });
  }
}
