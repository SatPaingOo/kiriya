import type { MessageKey } from "../i18n/locales/en.js";

export interface ConfigKey {
  readonly key: string;
  /** `string`: one value. `list`: any number of values, in order. */
  readonly type: "string" | "list";
  readonly description: MessageKey;
  /** Values as they would follow `kiriya config set <key>`. */
  readonly example: string;
  /** The only values a `string` setting takes. */
  readonly choices?: readonly string[];
}

/** Every setting kiriya reads. Adding a setting means adding an entry here. */
export const CONFIG_KEYS: readonly ConfigKey[] = [
  {
    key: "mcp.allowDestroy",
    type: "string",
    description: "config.key.mcp-allow-destroy",
    example: "true",
    choices: ["true", "false"],
  },
  {
    key: "mcp.allowWrite",
    type: "string",
    description: "config.key.mcp-allow-write",
    example: "true",
    choices: ["true", "false"],
  },
  {
    key: "plugins",
    type: "list",
    description: "config.key.plugins",
    example: "kiriya-plugin-example ./team/kiriya-plugin",
  },
];
