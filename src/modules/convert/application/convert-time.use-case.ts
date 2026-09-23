import type { Command, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import type { Clock } from "../../../core/domain/ports/clock.js";
import { EPOCH_UNITS, parseMoment, type EpochUnit } from "../domain/moments.js";
import { CONVERTER } from "./convert-input.js";

export interface TimeInput {
  readonly value: string | undefined;
  readonly unit: EpochUnit;
}

export interface TimeOutput {
  readonly iso: string;
  readonly epochSeconds: number;
  readonly epochMs: number;
}

export const timeSpec: CommandSpec<TimeInput> = {
  id: "convert.time",
  summary: "convert.time.summary",
  examples: [
    "kiriya convert time",
    "kiriya convert time 1767225600",
    "kiriya convert time 2026-01-31T12:00:00Z --json",
  ],
  ...CONVERTER,
  // Without a value it shows now.
  idempotent: false,
  input: {
    positionals: [{ name: "value", description: "convert.time.arg.value", required: false, variadic: false }],
    options: { unit: { type: "string", description: "convert.time.option.unit", choices: EPOCH_UNITS } },
    parse(raw) {
      const reader = new RawReader(raw);
      return { value: reader.positional(0), unit: reader.choice("unit", EPOCH_UNITS, "auto") };
    },
  },
};

export class ConvertTime implements Command<TimeInput, TimeOutput> {
  readonly spec = timeSpec;

  constructor(private readonly clock: Clock) {}

  execute(input: TimeInput): Promise<CommandResult<TimeOutput>> {
    const ms = input.value === undefined ? this.clock.now() : parseMoment(input.value, input.unit);
    if (ms === null) throw new UsageError("convert.time.invalid", { value: input.value ?? "" });
    return Promise.resolve(done({ iso: new Date(ms).toISOString(), epochSeconds: Math.floor(ms / 1000), epochMs: ms }));
  }
}
