import { inputText, readInput, type InputSources } from "../../../core/application/text-input.js";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message } from "../../../core/domain/message.js";
import type { Clipboard } from "../../../core/domain/ports/clipboard.js";
import { looksSecret } from "../../../core/domain/secrets.js";

export interface CopyInput {
  readonly value: string | undefined;
  readonly file: string | undefined;
}

export interface CopyOutput {
  /** Unicode characters, not UTF-16 units. */
  readonly characters: number;
}

export const copySpec: CommandSpec<CopyInput> = {
  id: "clip.copy",
  summary: "clip.copy.summary",
  examples: ['kiriya clip copy "hello"', "git log -1 | kiriya clip copy", "kiriya clip copy --file notes.md"],
  // It replaces what is on the clipboard, which is why it is there.
  safety: "write",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "text", description: "clip.copy.arg.text", required: false, variadic: false }],
    options: { file: { type: "string", description: "clip.copy.option.file", valueName: "<path>" } },
    parse(raw) {
      const reader = new RawReader(raw);
      return { value: reader.positional(0), file: reader.string("file") };
    },
  },
};

export class CopyText implements Command<CopyInput, CopyOutput> {
  readonly spec = copySpec;

  constructor(
    private readonly clipboard: Clipboard,
    private readonly sources: InputSources,
  ) {}

  async execute(input: CopyInput, context: CommandContext): Promise<CommandResult<CopyOutput>> {
    const text = inputText(await readInput(this.sources, context.cwd, input.value, input.file));
    if (text === "") throw new UsageError("clip.copy.empty");
    await this.clipboard.write(text, context.signal);
    // Clipboard history and other programs can read it long after.
    const warnings = looksSecret(text) ? [message("clip.copy.secret")] : [];
    return done({ characters: [...text].length }, { warnings });
  }
}
