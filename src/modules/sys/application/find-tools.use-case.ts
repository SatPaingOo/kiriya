import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import type { ProcessRunner } from "../../../core/domain/ports/process-runner.js";
import { findTools, noInput, SYS_COMMAND, type NoInput, type ToolReport } from "./machine-facts.js";

export interface ToolsOutput {
  readonly tools: readonly ToolReport[];
}

export const toolsSpec: CommandSpec<NoInput> = {
  id: "sys.tools",
  summary: "sys.tools.summary",
  examples: ["kiriya sys tools", "kiriya sys tools --json"],
  ...SYS_COMMAND,
  input: noInput,
};

export class FindTools implements Command<NoInput, ToolsOutput> {
  readonly spec = toolsSpec;

  constructor(private readonly processRunner: ProcessRunner) {}

  async execute(_input: NoInput, context: CommandContext): Promise<CommandResult<ToolsOutput>> {
    return done({ tools: await findTools(this.processRunner, context.signal) });
  }
}
