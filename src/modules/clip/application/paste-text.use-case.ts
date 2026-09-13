import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import type { Clipboard } from "../../../core/domain/ports/clipboard.js";

type NoInput = Readonly<Record<string, never>>;

export interface PasteOutput {
  readonly text: string;
}

export const pasteSpec: CommandSpec<NoInput> = {
  id: "clip.paste",
  summary: "clip.paste.summary",
  examples: ["kiriya clip paste", "kiriya clip paste > notes.txt", "kiriya clip paste --json"],
  safety: "read",
  // The clipboard can change between runs.
  idempotent: false,
  usesNetwork: false,
  runsUserCommands: false,
  // The clipboard often holds a password on its way to a form.
  sensitive: true,
  input: { positionals: [], options: {}, parse: () => ({}) },
};

export class PasteText implements Command<NoInput, PasteOutput> {
  readonly spec = pasteSpec;

  constructor(private readonly clipboard: Clipboard) {}

  async execute(_input: NoInput, context: CommandContext): Promise<CommandResult<PasteOutput>> {
    return done({ text: await this.clipboard.read(context.signal) });
  }
}
