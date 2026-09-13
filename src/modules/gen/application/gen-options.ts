import { UsageError } from "../../../core/domain/errors.js";
import type { OptionSpec, RawReader } from "../../../core/domain/input-schema.js";

export const MAX_COUNT = 1000;

export interface GeneratedOutput {
  readonly values: readonly string[];
}

/** Every run gives new values, and nothing leaves the machine. */
export const GENERATOR = { safety: "read", idempotent: false, usesNetwork: false, runsUserCommands: false } as const;

export const countOption: OptionSpec = { type: "string", description: "gen.option.count", valueName: "<n>" };

export function readCount(reader: RawReader): number {
  const count = reader.positiveInteger("count", 1);
  if (count > MAX_COUNT) throw new UsageError("gen.count-too-large", { max: MAX_COUNT });
  return count;
}

export function readRange(reader: RawReader, option: string, fallback: number, min: number, max: number): number {
  const value = reader.positiveInteger(option, fallback);
  if (value < min || value > max) throw new UsageError("gen.out-of-range", { option, min, max });
  return value;
}
