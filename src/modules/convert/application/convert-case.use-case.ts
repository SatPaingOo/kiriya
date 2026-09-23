import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { TEXT_CASES, toCase, type TextCase } from "../../../core/domain/text-case.js";
import { CONVERTER, fileOption, inputText, readInput, valuePositional, type InputSources } from "./convert-input.js";

export interface CaseInput {
  readonly value: string | undefined;
  readonly file: string | undefined;
  readonly to: TextCase;
}

export interface CaseOutput {
  readonly output: string;
}

export const caseSpec: CommandSpec<CaseInput> = {
  id: "convert.case",
  summary: "convert.case.summary",
  examples: ['kiriya convert case "user profile id" --to camel', "kiriya convert case OrderItems --to kebab"],
  ...CONVERTER,
  input: {
    positionals: [valuePositional],
    options: {
      to: { type: "string", description: "convert.case.option.to", choices: TEXT_CASES },
      file: fileOption,
    },
    parse(raw) {
      const reader = new RawReader(raw);
      if (reader.string("to") === undefined) throw new UsageError("convert.case.to-required");
      return { value: reader.positional(0), file: reader.string("file"), to: reader.choice("to", TEXT_CASES, "kebab") };
    },
  },
};

export class ConvertCase implements Command<CaseInput, CaseOutput> {
  readonly spec = caseSpec;

  constructor(private readonly sources: InputSources) {}

  async execute(input: CaseInput, context: CommandContext): Promise<CommandResult<CaseOutput>> {
    const text = inputText(await readInput(this.sources, context.cwd, input.value, input.file));
    // Each line changes on its own, so a list of names stays a list.
    const lines = text.split(/\r?\n/).map((line) => toCase(line, input.to));
    return done({ output: lines.join("\n") });
  }
}
