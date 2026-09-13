import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message } from "../../../core/domain/message.js";
import { findJsonProblem } from "../domain/json-syntax.js";
import { CONVERTER, fileOption, inputText, readInput, valuePositional, type InputSources } from "./convert-input.js";

export interface JsonInput {
  readonly value: string | undefined;
  readonly file: string | undefined;
  readonly minify: boolean;
  readonly check: boolean;
}

export interface JsonOutput {
  readonly valid: boolean;
  /** The formatted or minified JSON; null with --check or when it is invalid. */
  readonly output: string | null;
  /** Where the first error is, from 1; null when it is valid. */
  readonly line: number | null;
  readonly column: number | null;
}

export const jsonSpec: CommandSpec<JsonInput> = {
  id: "convert.json",
  summary: "convert.json.summary",
  examples: [
    "kiriya convert json --file package.json",
    "kiriya convert json --minify < data.json",
    "kiriya convert json --check --file config.json",
  ],
  ...CONVERTER,
  input: {
    positionals: [valuePositional],
    options: {
      minify: { type: "boolean", description: "convert.json.option.minify" },
      check: { type: "boolean", description: "convert.json.option.check" },
      file: fileOption,
    },
    parse(raw) {
      const reader = new RawReader(raw);
      return {
        value: reader.positional(0),
        file: reader.string("file"),
        minify: reader.flag("minify"),
        check: reader.flag("check"),
      };
    },
  },
};

export class ConvertJson implements Command<JsonInput, JsonOutput> {
  readonly spec = jsonSpec;

  constructor(private readonly sources: InputSources) {}

  async execute(input: JsonInput, context: CommandContext): Promise<CommandResult<JsonOutput>> {
    const text = inputText(await readInput(this.sources, context.cwd, input.value, input.file));
    const problem = findJsonProblem(text);
    if (problem !== null) {
      const where = { line: problem.line, column: problem.column };
      return done({ valid: false, output: null, ...where }, { failures: [message("convert.json.invalid", where)] });
    }
    const parsed: unknown = JSON.parse(text);
    const output = input.check ? null : JSON.stringify(parsed, null, input.minify ? undefined : 2);
    return done({ valid: true, output, line: null, column: null });
  }
}
