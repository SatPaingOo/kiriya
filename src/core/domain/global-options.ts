import type { MessageKey } from "../../i18n/locales/en.js";

export interface GlobalOption {
  readonly name: string;
  readonly short: string | null;
  readonly description: MessageKey;
}

/** Options every command takes, wherever they appear before `--`. */
export const GLOBAL_OPTIONS: readonly GlobalOption[] = [
  { name: "json", short: null, description: "core.option.json" },
  { name: "no-color", short: null, description: "core.option.no-color" },
  { name: "no-input", short: null, description: "core.option.no-input" },
  { name: "debug", short: null, description: "core.option.debug" },
  { name: "help", short: "h", description: "core.option.help" },
  { name: "version", short: "V", description: "core.option.version" },
];
