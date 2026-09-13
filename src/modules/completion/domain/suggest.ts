import type { GlobalOption } from "../../../core/domain/global-options.js";
import type { OptionSpec } from "../../../core/domain/input-schema.js";
import type { CatalogCommand, CatalogModule } from "../../../core/domain/ports/command-catalog.js";
import type { MessageKey } from "../../../i18n/locales/en.js";

export interface Suggestion {
  readonly value: string;
  /** null for a value that explains itself, such as one of an option's choices. */
  readonly description: MessageKey | null;
}

/** The values an option lists in its value name, such as `<hex|base64|base64url>`. */
export function optionChoices(option: OptionSpec): string[] {
  const match = /^<([a-z0-9-]+(?:\|[a-z0-9-]+)+)>$/.exec(option.valueName ?? "");
  return match?.[1]?.split("|") ?? [];
}

function ownCommand(module: CatalogModule): CatalogCommand | undefined {
  return module.commands.find((command) => command.verb === "");
}

function positionalChoices(command: CatalogCommand, index: number): string[] {
  const positionals = command.spec.input.positionals;
  const last = positionals.at(-1);
  const positional = positionals[index] ?? (last?.variadic === true ? last : undefined);
  return [...(positional?.choices ?? [])];
}

function findOption(command: CatalogCommand | undefined, word: string): OptionSpec | undefined {
  if (command === undefined) return undefined;
  const options = command.spec.input.options;
  if (word.startsWith("--")) return options[word.slice(2).split("=")[0] ?? ""];
  return Object.values(options).find((option) => option.short === word.slice(1));
}

interface Position {
  readonly module: CatalogModule | undefined;
  readonly command: CatalogCommand | undefined;
  /** Arguments the command already has. */
  readonly argument: number;
  /** The words after `help`, or null when the line is no help request. */
  readonly help: readonly string[] | null;
  /** An option still waiting for its value. */
  readonly pending: OptionSpec | undefined;
  /** After `--`, where every word is an argument. */
  readonly literal: boolean;
}

/** Where the line stands after the words before the one being completed; null after a word kiriya does not know. */
function locate(modules: readonly CatalogModule[], words: readonly string[]): Position | null {
  let module: CatalogModule | undefined;
  let command: CatalogCommand | undefined;
  let argument = 0;
  let help: string[] | null = null;
  let pending: OptionSpec | undefined;
  let literal = false;
  let started = false;
  for (const word of words) {
    if (pending !== undefined) {
      pending = undefined;
      continue;
    }
    if (!literal && word === "--") {
      literal = true;
      continue;
    }
    if (!literal && word.length > 1 && word.startsWith("-")) {
      const option = findOption(command ?? (module === undefined ? undefined : ownCommand(module)), word);
      if (option?.type === "string" && !word.includes("=")) pending = option;
      continue;
    }
    if (help !== null) {
      help.push(word);
      continue;
    }
    if (!started) {
      started = true;
      if (word === "help") {
        help = [];
        continue;
      }
      module = modules.find((candidate) => candidate.id === word);
      if (module === undefined) return null;
      continue;
    }
    if (module !== undefined && command === undefined) {
      const named = module.commands.find((candidate) => candidate.verb !== "" && candidate.verb === word);
      command = named ?? ownCommand(module);
      if (command === undefined) return null;
      // A module that is one command takes this word as its first argument.
      if (named === undefined) argument = 1;
      continue;
    }
    argument += 1;
  }
  return { module, command, argument, help, pending, literal };
}

function moduleSuggestions(modules: readonly CatalogModule[]): Suggestion[] {
  return modules.map((module) => ({ value: module.id, description: module.summary }));
}

function verbSuggestions(module: CatalogModule): Suggestion[] {
  return module.commands
    .filter((command) => command.verb !== "")
    .map((command) => ({ value: command.verb, description: command.spec.summary }));
}

function plain(values: readonly string[]): Suggestion[] {
  return values.map((value) => ({ value, description: null }));
}

/**
 * What can come next on a command line: modules, then commands, options and their
 * values. `words` are the words after `kiriya` and before the one being completed. An
 * empty result means a free value such as a path, which the shell completes as a file name.
 */
export function suggest(
  modules: readonly CatalogModule[],
  globals: readonly GlobalOption[],
  words: readonly string[],
  current: string,
): Suggestion[] {
  const position = locate(modules, words);
  if (position === null) return [];
  const starting = (suggestion: Suggestion): boolean => suggestion.value.startsWith(current);
  if (position.pending !== undefined) return plain(optionChoices(position.pending)).filter(starting);

  const command = position.command ?? (position.module === undefined ? undefined : ownCommand(position.module));
  if (!position.literal && current.startsWith("--") && current.includes("=")) {
    const name = current.slice(2, current.indexOf("="));
    const option = findOption(command, `--${name}`);
    if (option === undefined) return [];
    return plain(optionChoices(option).map((choice) => `--${name}=${choice}`)).filter(starting);
  }
  if (!position.literal && current.startsWith("-")) {
    const own = Object.entries(command?.spec.input.options ?? {}).map(([name, option]) => ({
      value: `--${name}`,
      description: option.description,
    }));
    const global = globals.map((option) => ({ value: `--${option.name}`, description: option.description }));
    return [...own, ...global].filter(starting);
  }

  if (position.help !== null) {
    const [moduleName, ...rest] = position.help;
    if (moduleName === undefined) return moduleSuggestions(modules).filter(starting);
    const helpModule = modules.find((module) => module.id === moduleName);
    return helpModule === undefined || rest.length > 0 ? [] : verbSuggestions(helpModule).filter(starting);
  }
  if (position.module === undefined) {
    const help: Suggestion = { value: "help", description: "completion.help-word" };
    return [...moduleSuggestions(modules), help].filter(starting);
  }
  if (position.command === undefined) {
    const own = ownCommand(position.module);
    const choices = own === undefined ? [] : positionalChoices(own, 0);
    return [...verbSuggestions(position.module), ...plain(choices)].filter(starting);
  }
  return plain(positionalChoices(position.command, position.argument)).filter(starting);
}
