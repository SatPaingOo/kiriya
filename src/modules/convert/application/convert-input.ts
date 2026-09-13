import type { OptionSpec, PositionalSpec } from "../../../core/domain/input-schema.js";

export { inputBytes, inputText, readInput } from "../../../core/application/text-input.js";
export type { InputRead as ConvertInput, InputSources } from "../../../core/application/text-input.js";

/** Every conversion runs on this machine, changes nothing, and gives the same result for the same input. */
export const CONVERTER = { safety: "read", idempotent: true, usesNetwork: false, runsUserCommands: false } as const;

export const valuePositional: PositionalSpec = {
  name: "value",
  description: "convert.arg.value",
  required: false,
  variadic: false,
};

export const fileOption: OptionSpec = {
  type: "string",
  description: "convert.option.file",
  valueName: "<path>",
  path: true,
};
