import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message } from "../../../core/domain/message.js";
import { isJsonPath, lookupJsonPath } from "../domain/json-path.js";
import { findJsonProblem } from "../domain/json-syntax.js";
import { CONVERTER, fileOption, inputText, readInput, valuePositional, type InputSources } from "./convert-input.js";

export interface JsonInput {
  readonly value: string | undefined;
  readonly file: string | undefined;
  readonly minify: boolean;
  readonly check: boolean;
  /** The dotted path --get asked for, already known to name something. */
  readonly get: string | undefined;
}

export interface JsonOutput {
  readonly valid: boolean;
  /**
   * The formatted or minified JSON, or what --get asked for; null with --check, when the
   * JSON is invalid, and when the path was not there.
   */
  readonly output: string | null;
  /** Where the first error is, from 1; null when it is valid. */
  readonly line: number | null;
  readonly column: number | null;
  /** The path --get asked for; null when none was. */
  readonly path: string | null;
  /** Whether that path was there; null when none was asked for. */
  readonly found: boolean | null;
  /** What was at the path, as JSON rather than as text; null when there was nothing to take. */
  readonly value: unknown;
}

/** A string prints as itself, so a value can feed a shell variable with no quotes to strip. */
function render(value: unknown, minify: boolean): string {
  if (typeof value === "string") return value;
  // Everything else JSON holds stringifies; undefined, which would not, cannot come from JSON.
  return JSON.stringify(value, null, minify ? undefined : 2) ?? "null";
}

export const jsonSpec: CommandSpec<JsonInput> = {
  id: "convert.json",
  summary: "convert.json.summary",
  examples: [
    "kiriya convert json --file package.json",
    "kiriya convert json --minify < data.json",
    "kiriya convert json --check --file config.json",
    "kiriya convert json --file package.json --get version",
    "kiriya convert json --get data.listeners.0.pid < who.json",
  ],
  ...CONVERTER,
  input: {
    positionals: [valuePositional],
    options: {
      minify: { type: "boolean", description: "convert.json.option.minify" },
      check: { type: "boolean", description: "convert.json.option.check" },
      get: { type: "string", description: "convert.json.option.get", valueName: "<path>" },
      file: fileOption,
    },
    parse(raw) {
      const reader = new RawReader(raw);
      const get = reader.string("get");
      if (get !== undefined) {
        // Both ask for different things, and silently letting one win is how a script goes wrong.
        if (reader.flag("check")) throw new UsageError("convert.json.get-with-check");
        if (!isJsonPath(get)) throw new UsageError("convert.json.get-invalid", { path: get });
      }
      return {
        value: reader.positional(0),
        file: reader.string("file"),
        minify: reader.flag("minify"),
        check: reader.flag("check"),
        get,
      };
    },
  },
};

export class ConvertJson implements Command<JsonInput, JsonOutput> {
  readonly spec = jsonSpec;

  constructor(private readonly sources: InputSources) {}

  async execute(input: JsonInput, context: CommandContext): Promise<CommandResult<JsonOutput>> {
    const text = inputText(await readInput(this.sources, context.cwd, input.value, input.file));
    const nothing = { path: input.get ?? null, found: null, value: null };
    const problem = findJsonProblem(text);
    if (problem !== null) {
      const where = { line: problem.line, column: problem.column };
      const data = { valid: false, output: null, ...where, ...nothing };
      return done(data, { failures: [message("convert.json.invalid", where)] });
    }
    const parsed: unknown = JSON.parse(text);
    const good = { valid: true, line: null, column: null } as const;

    if (input.get === undefined) {
      const output = input.check ? null : JSON.stringify(parsed, null, input.minify ? undefined : 2);
      return done({ ...good, output, ...nothing });
    }
    const lookup = lookupJsonPath(parsed, input.get);
    if (!lookup.found) {
      const data = { ...good, output: null, path: input.get, found: false, value: null };
      return done(data, { failures: [message("convert.json.not-there", { at: lookup.at })] });
    }
    const output = render(lookup.value, input.minify);
    return done({ ...good, output, path: input.get, found: true, value: lookup.value });
  }
}
