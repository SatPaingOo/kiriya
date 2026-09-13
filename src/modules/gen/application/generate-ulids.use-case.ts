import type { Command, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import type { Clock } from "../../../core/domain/ports/clock.js";
import type { RandomSource } from "../../../core/domain/ports/random-source.js";
import { incrementRandom, ulid } from "../domain/identifiers.js";
import { countOption, GENERATOR, readCount, type GeneratedOutput } from "./gen-options.js";

export interface UlidInput {
  readonly count: number;
}

export const ulidSpec: CommandSpec<UlidInput> = {
  id: "gen.ulid",
  summary: "gen.ulid.summary",
  examples: ["kiriya gen ulid", "kiriya gen ulid --count 10"],
  ...GENERATOR,
  input: {
    positionals: [],
    options: { count: countOption },
    parse: (raw) => ({ count: readCount(new RawReader(raw)) }),
  },
};

export class GenerateUlids implements Command<UlidInput, GeneratedOutput> {
  readonly spec = ulidSpec;

  constructor(
    private readonly random: RandomSource,
    private readonly clock: Clock,
  ) {}

  execute(input: UlidInput): Promise<CommandResult<GeneratedOutput>> {
    const values: string[] = [];
    let previousTime = -1;
    let previousRandom: Uint8Array | null = null;
    for (let index = 0; index < input.count; index += 1) {
      const time = this.clock.now();
      // Within one millisecond the random part counts up, so the values keep the order they were made in.
      const next: Uint8Array | null =
        time === previousTime && previousRandom !== null ? incrementRandom(previousRandom) : null;
      const random: Uint8Array = next ?? this.random.bytes(10);
      values.push(ulid(time, random));
      previousTime = time;
      previousRandom = random;
    }
    return Promise.resolve(done({ values }));
  }
}
