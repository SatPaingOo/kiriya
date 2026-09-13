import type { MessageKey } from "../../i18n/locales/en.js";
import type { Command } from "../domain/command.js";
import type { CommandRegistrar, CorePorts, KiriyaModule } from "../domain/module.js";
import type { TextView } from "../domain/view.js";

export interface RegisteredCommand {
  readonly command: Command<unknown, unknown>;
  readonly view: TextView<unknown>;
  /** The verb, the part of the id after the module. */
  readonly verb: string;
}

export interface RegisteredModule {
  readonly id: string;
  readonly summary: MessageKey;
  readonly commands: ReadonlyMap<string, RegisteredCommand>;
}

/** Built-in modules and plugins register here; presentation looks commands up by module and verb. */
export class CommandRegistry {
  private readonly modules = new Map<
    string,
    { id: string; summary: MessageKey; commands: Map<string, RegisteredCommand> }
  >();

  register(module: KiriyaModule, ports: CorePorts): void {
    if (this.modules.has(module.id)) throw new Error(`module ${module.id} is registered twice`);
    const entry = { id: module.id, summary: module.summary, commands: new Map<string, RegisteredCommand>() };
    const registrar: CommandRegistrar = {
      add<Input, Output>(command: Command<Input, Output>, view: TextView<Output>): void {
        const [moduleId, verb] = command.spec.id.split(".");
        if (moduleId !== module.id || verb === undefined || verb === "") {
          throw new Error(`command ${command.spec.id} does not belong to module ${module.id}`);
        }
        if (entry.commands.has(verb)) throw new Error(`command ${command.spec.id} is registered twice`);
        entry.commands.set(verb, {
          command: command as Command<unknown, unknown>,
          view: view as TextView<unknown>,
          verb,
        });
      },
    };
    module.register(registrar, ports);
    this.modules.set(module.id, entry);
  }

  module(id: string): RegisteredModule | undefined {
    return this.modules.get(id);
  }

  /** Modules in code-point order, which is the same on every OS. */
  list(): readonly RegisteredModule[] {
    return [...this.modules.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
}
