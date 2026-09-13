import type { Command, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import type { Clock } from "../../../core/domain/ports/clock.js";
import type { RandomSource } from "../../../core/domain/ports/random-source.js";
import { uuidV4, uuidV7 } from "../domain/identifiers.js";
import { countOption, GENERATOR, readCount, type GeneratedOutput } from "./gen-options.js";

export interface UuidInput {
  readonly count: number;
  readonly timeOrdered: boolean;
}

export const uuidSpec: CommandSpec<UuidInput> = {
  id: "gen.uuid",
  summary: "gen.uuid.summary",
  examples: ["kiriya gen uuid", "kiriya gen uuid --v7 --count 5"],
  ...GENERATOR,
  input: {
    positionals: [],
    options: { v7: { type: "boolean", description: "gen.uuid.option.v7" }, count: countOption },
    parse(raw) {
      const reader = new RawReader(raw);
      return { count: readCount(reader), timeOrdered: reader.flag("v7") };
    },
  },
};

export class GenerateUuids implements Command<UuidInput, GeneratedOutput> {
  readonly spec = uuidSpec;

  constructor(
    private readonly random: RandomSource,
    private readonly clock: Clock,
  ) {}

  execute(input: UuidInput): Promise<CommandResult<GeneratedOutput>> {
    const values = Array.from({ length: input.count }, () =>
      input.timeOrdered ? uuidV7(this.clock.now(), this.random.bytes(10)) : uuidV4(this.random.bytes(16)),
    );
    return Promise.resolve(done({ values }));
  }
}
