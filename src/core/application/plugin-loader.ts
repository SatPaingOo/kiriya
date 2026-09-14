import { KiriyaError } from "../domain/errors.js";
import { message, type Message } from "../domain/message.js";
import type { CorePorts, KiriyaModule } from "../domain/module.js";
import type { LoadedPlugin, PluginInventory, PluginProblem } from "../domain/ports/plugin-inventory.js";
import type { PluginSource } from "../domain/ports/plugin-source.js";
import type { CommandRegistry } from "./command-registry.js";

const PLUGIN_ID = /^[a-z][a-z0-9-]*$/;
/** Words the command line itself uses, which no module may take. */
const RESERVED_IDS: ReadonlySet<string> = new Set(["core", "help", "mcp", "version"]);

interface PluginModule extends KiriyaModule {
  readonly messages: Readonly<Record<string, string>>;
}

/** The exported module, or why it is not one: the contract in docs/guides/plugins.md. */
function checkShape(exports: unknown): { readonly plugin: PluginModule } | { readonly problem: Message } {
  const exported =
    typeof exports === "object" && exports !== null && "default" in exports
      ? (exports as { readonly default: unknown }).default
      : exports;
  if (typeof exported !== "object" || exported === null) return { problem: message("core.plugin.no-module") };
  const { id, summary, register, messages } = exported as Record<string, unknown>;
  if (typeof id !== "string" || !PLUGIN_ID.test(id)) return { problem: message("core.plugin.bad-id") };
  if (typeof register !== "function") return { problem: message("core.plugin.no-register", { id }) };
  if (typeof messages !== "object" || messages === null) {
    return { problem: message("core.plugin.no-messages", { id }) };
  }
  for (const [key, text] of Object.entries(messages)) {
    if (!key.startsWith(`${id}.`) || typeof text !== "string") {
      return { problem: message("core.plugin.bad-message", { id, key }) };
    }
  }
  if (typeof summary !== "string" || !(summary in messages)) {
    return { problem: message("core.plugin.no-summary", { id }) };
  }
  // Help reads these optional fields as it prints, so a wrong shape is refused here rather than failing there.
  const { about, examples, guide } = exported as Record<string, unknown>;
  if (about !== undefined && (typeof about !== "string" || !(about in messages))) {
    return { problem: message("core.plugin.bad-about", { id }) };
  }
  if (examples !== undefined && !(Array.isArray(examples) && examples.every((line) => typeof line === "string"))) {
    return { problem: message("core.plugin.bad-examples", { id }) };
  }
  if (guide !== undefined && (typeof guide !== "string" || !guide.startsWith("https://"))) {
    return { problem: message("core.plugin.bad-guide", { id }) };
  }
  return { plugin: exported as PluginModule };
}

/**
 * Loads the plugins the configuration lists and registers their commands. A plugin
 * that cannot be found, imported, checked or registered is recorded and skipped, so
 * one broken plugin never stops kiriya; `kiriya doctor` reports it.
 */
export class PluginLoader implements PluginInventory {
  private readonly succeeded: LoadedPlugin[] = [];
  private readonly failed: PluginProblem[] = [];
  /** The English text of every loaded plugin's message keys. */
  readonly messages: Record<string, string> = {};

  loaded(): readonly LoadedPlugin[] {
    return this.succeeded;
  }

  problems(): readonly PluginProblem[] {
    return this.failed;
  }

  async load(
    entries: readonly string[],
    baseDirectory: string,
    source: PluginSource,
    registry: CommandRegistry,
    ports: CorePorts,
  ): Promise<void> {
    for (const entry of entries) {
      let found;
      try {
        found = await source.load(entry, baseDirectory);
      } catch (error) {
        if (!(error instanceof KiriyaError)) throw error;
        this.failed.push({ entry, reason: error.detail });
        continue;
      }
      const checked = checkShape(found.exports);
      if ("problem" in checked) {
        this.failed.push({ entry, reason: checked.problem });
        continue;
      }
      const { plugin } = checked;
      if (RESERVED_IDS.has(plugin.id) || registry.module(plugin.id) !== undefined) {
        this.failed.push({ entry, reason: message("core.plugin.taken", { id: plugin.id }) });
        continue;
      }
      try {
        registry.register(plugin, ports);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        this.failed.push({ entry, reason: message("core.plugin.register-failed", { id: plugin.id, detail }) });
        continue;
      }
      Object.assign(this.messages, plugin.messages);
      this.succeeded.push({
        entry,
        id: plugin.id,
        name: found.name,
        version: found.version,
        location: found.location,
        commands: registry.module(plugin.id)?.commands.size ?? 0,
      });
    }
  }
}
