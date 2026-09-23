import type { Command, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import type { RandomSource } from "../../../core/domain/ports/random-source.js";
import { formatToken, TOKEN_FORMATS, type TokenFormat } from "../domain/secrets.js";
import { countOption, GENERATOR, readCount, readRange, type GeneratedOutput } from "./gen-options.js";

export interface TokenInput {
  readonly count: number;
  readonly bytes: number;
  readonly format: TokenFormat;
}

export const tokenSpec: CommandSpec<TokenInput> = {
  id: "gen.token",
  summary: "gen.token.summary",
  examples: ["kiriya gen token", "kiriya gen token --bytes 64 --format hex"],
  ...GENERATOR,
  input: {
    positionals: [],
    options: {
      bytes: { type: "string", description: "gen.token.option.bytes", valueName: "<n>" },
      format: { type: "string", description: "gen.token.option.format", choices: TOKEN_FORMATS },
      count: countOption,
    },
    parse(raw) {
      const reader = new RawReader(raw);
      return {
        count: readCount(reader),
        bytes: readRange(reader, "bytes", 32, 8, 1024),
        format: reader.choice("format", TOKEN_FORMATS, "base64url"),
      };
    },
  },
};

export class GenerateTokens implements Command<TokenInput, GeneratedOutput> {
  readonly spec = tokenSpec;

  constructor(private readonly random: RandomSource) {}

  execute(input: TokenInput): Promise<CommandResult<GeneratedOutput>> {
    const values = Array.from({ length: input.count }, () => formatToken(this.random.bytes(input.bytes), input.format));
    return Promise.resolve(done({ values }));
  }
}
