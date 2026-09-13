import type { Command, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { NotFoundError } from "../../../core/domain/errors.js";
import type { ConfigStore, ConfigValue } from "../../../core/domain/ports/config-store.js";
import { CONFIG_COMMAND, keyInput, type KeyInput } from "./config-commands.js";

export interface GetOutput {
  readonly key: string;
  readonly value: ConfigValue;
}

export const getSpec: CommandSpec<KeyInput> = {
  id: "config.get",
  summary: "config.get.summary",
  examples: ["kiriya config get plugins"],
  safety: "read",
  ...CONFIG_COMMAND,
  input: keyInput,
};

export class GetSetting implements Command<KeyInput, GetOutput> {
  readonly spec = getSpec;

  constructor(private readonly config: ConfigStore) {}

  async execute(input: KeyInput): Promise<CommandResult<GetOutput>> {
    const value = (await this.config.read())[input.key];
    if (value === undefined) throw new NotFoundError("config.get.not-set", { key: input.key });
    return done({ key: input.key, value });
  }
}
