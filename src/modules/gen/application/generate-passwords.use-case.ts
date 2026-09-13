import type { Command, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import type { RandomSource } from "../../../core/domain/ports/random-source.js";
import { DIGITS, LOWER, password, SYMBOLS, UPPER } from "../domain/secrets.js";
import { countOption, GENERATOR, readCount, readRange, type GeneratedOutput } from "./gen-options.js";

export interface PasswordInput {
  readonly count: number;
  readonly length: number;
  readonly symbols: boolean;
}

export const passwordSpec: CommandSpec<PasswordInput> = {
  id: "gen.password",
  summary: "gen.password.summary",
  examples: ["kiriya gen password", "kiriya gen password --length 40 --no-symbols"],
  ...GENERATOR,
  input: {
    positionals: [],
    options: {
      length: { type: "string", description: "gen.password.option.length", valueName: "<n>" },
      "no-symbols": { type: "boolean", description: "gen.password.option.no-symbols" },
      count: countOption,
    },
    parse(raw) {
      const reader = new RawReader(raw);
      return {
        count: readCount(reader),
        length: readRange(reader, "length", 24, 8, 256),
        symbols: !reader.flag("no-symbols"),
      };
    },
  },
};

export class GeneratePasswords implements Command<PasswordInput, GeneratedOutput> {
  readonly spec = passwordSpec;

  constructor(private readonly random: RandomSource) {}

  execute(input: PasswordInput): Promise<CommandResult<GeneratedOutput>> {
    const classes = input.symbols ? [LOWER, UPPER, DIGITS, SYMBOLS] : [LOWER, UPPER, DIGITS];
    const values = Array.from({ length: input.count }, () =>
      password(input.length, classes, (count) => this.random.bytes(count)),
    );
    return Promise.resolve(done({ values }));
  }
}
