import { CONFIG_KEYS, type ConfigKey } from "../../config/config-keys.js";
import { OperationFailedError } from "../domain/errors.js";
import { message } from "../domain/message.js";
import type { ConfigValues } from "../domain/ports/config-store.js";

export function configKey(key: string): ConfigKey | undefined {
  return CONFIG_KEYS.find((entry) => entry.key === key);
}

/** A setting kiriya knows must hold the type its key declares; settings it does not know are left alone. */
export function checkConfigTypes(values: ConfigValues, file: string): void {
  for (const [key, value] of Object.entries(values)) {
    const known = configKey(key);
    if (known === undefined) continue;
    const isList = typeof value !== "string";
    if ((known.type === "list") !== isList) {
      const expected = message(known.type === "list" ? "core.config.type.list" : "core.config.type.string");
      throw new OperationFailedError("core.config.wrong-type", { path: file, field: key, expected });
    }
  }
}

/** Whether the MCP server may offer tools that change files. Only the exact value `true` allows it. */
export function mcpAllowsWrite(values: ConfigValues): boolean {
  return values["mcp.allowWrite"] === "true";
}

/** The plugins the configuration lists, in order; none when the setting is missing or malformed. */
export function pluginEntries(values: ConfigValues): readonly string[] {
  const value = values["plugins"];
  return value === undefined || typeof value === "string" ? [] : value;
}
