import { CONFIG_KEYS } from "../../../config/config-keys.js";
import type { Command, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { message, type Message } from "../../../core/domain/message.js";
import { CONFIG_COMMAND, noInput, type NoInput } from "./config-commands.js";

export interface KeyInfo {
  readonly key: string;
  readonly type: "string" | "list";
  readonly description: Message;
  readonly example: string;
}

export interface KeysOutput {
  readonly keys: readonly KeyInfo[];
}

export const keysSpec: CommandSpec<NoInput> = {
  id: "config.keys",
  summary: "config.keys.summary",
  examples: ["kiriya config keys"],
  safety: "read",
  ...CONFIG_COMMAND,
  input: noInput,
};

export class ListConfigKeys implements Command<NoInput, KeysOutput> {
  readonly spec = keysSpec;

  execute(): Promise<CommandResult<KeysOutput>> {
    const keys = CONFIG_KEYS.map((entry) => ({
      key: entry.key,
      type: entry.type,
      description: message(entry.description),
      example: entry.example,
    }));
    return Promise.resolve(done({ keys }));
  }
}
