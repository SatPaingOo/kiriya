import type { MessageKey } from "../i18n/locales/en.js";

export interface ConfigKey {
  readonly key: string;
  /** `string`: one value. `list`: any number of values, in order. */
  readonly type: "string" | "list";
  readonly description: MessageKey;
  /** Values as they would follow `kiriya config set <key>`. */
  readonly example: string;
}

/** Every setting kiriya reads. Adding a setting means adding an entry here. */
export const CONFIG_KEYS: readonly ConfigKey[] = [
  {
    key: "plugins",
    type: "list",
    description: "config.key.plugins",
    example: "kiriya-plugin-example ./team/kiriya-plugin",
  },
];
