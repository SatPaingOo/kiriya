import type { Command, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { completionScript, SHELLS, type Shell } from "../domain/scripts.js";

export interface ScriptInput {
  readonly shell: Shell;
}

export interface ScriptOutput {
  readonly shell: Shell;
  readonly script: string;
}

export const scriptSpec: CommandSpec<ScriptInput> = {
  id: "completion",
  summary: "completion.script.summary",
  examples: [
    'eval "$(kiriya completion bash)"',
    "kiriya completion fish > ~/.config/fish/completions/kiriya.fish",
    "kiriya completion powershell | Out-String | Invoke-Expression",
  ],
  safety: "read",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [
      { name: "shell", description: "completion.arg.shell", required: true, variadic: false, choices: SHELLS },
    ],
    options: {},
    parse(raw) {
      const text = new RawReader(raw).positional(0) ?? "";
      const shell = SHELLS.find((candidate) => candidate === text);
      if (shell === undefined) throw new UsageError("completion.shell-invalid", { shell: text });
      return { shell };
    },
  },
};

/** Prints the script and installs nothing, so it can be read before it is loaded. */
export class PrintScript implements Command<ScriptInput, ScriptOutput> {
  readonly spec = scriptSpec;

  execute(input: ScriptInput): Promise<CommandResult<ScriptOutput>> {
    return Promise.resolve(done({ shell: input.shell, script: completionScript(input.shell) }));
  }
}
