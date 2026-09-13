import type { MessageKey } from "../../../i18n/locales/en.js";
import type { CommandSpec } from "../command.js";

export interface CatalogCommand {
  /** Empty for a module that is one command. */
  readonly verb: string;
  readonly spec: CommandSpec<unknown>;
}

export interface CatalogModule {
  readonly id: string;
  readonly summary: MessageKey;
  readonly commands: readonly CatalogCommand[];
}

/** Every registered module and command, plugins included, for commands that describe kiriya itself. */
export interface CommandCatalog {
  /** Read when a command runs, so plugins loaded after the built-in modules are there. */
  catalog(): readonly CatalogModule[];
}
