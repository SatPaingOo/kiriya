import type { Command, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { GLOBAL_OPTIONS } from "../../../core/domain/global-options.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import type { CommandCatalog } from "../../../core/domain/ports/command-catalog.js";
import { suggest, type Suggestion } from "../domain/suggest.js";

export interface SuggestInput {
  readonly current: string;
  readonly words: readonly string[];
}

export interface SuggestOutput {
  readonly suggestions: readonly Suggestion[];
}

export const suggestSpec: CommandSpec<SuggestInput> = {
  id: "completion.suggest",
  summary: "completion.suggest.summary",
  examples: ["kiriya completion suggest --word=files --current=li", "kiriya completion suggest --current= --json"],
  safety: "read",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [],
    options: {
      current: { type: "string", description: "completion.suggest.option.current", valueName: "<word>" },
      word: { type: "string", multiple: true, description: "completion.suggest.option.word", valueName: "<word>" },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      return { current: reader.string("current") ?? "", words: reader.strings("word") };
    },
  },
};

/** Never runs what is on the line: it only reads the command catalog. */
export class SuggestWords implements Command<SuggestInput, SuggestOutput> {
  readonly spec = suggestSpec;

  constructor(private readonly commands: CommandCatalog) {}

  execute(input: SuggestInput): Promise<CommandResult<SuggestOutput>> {
    const suggestions = suggest(this.commands.catalog(), GLOBAL_OPTIONS, input.words, input.current);
    return Promise.resolve(done({ suggestions }));
  }
}
