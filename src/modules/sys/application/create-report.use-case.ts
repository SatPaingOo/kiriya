import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import type { RuntimeInfo } from "../../../core/domain/module.js";
import type { ProcessRunner } from "../../../core/domain/ports/process-runner.js";
import type { SystemInfo } from "../../../core/domain/ports/system-info.js";
import {
  findTools,
  machineFacts,
  noInput,
  SYS_COMMAND,
  type MachineFacts,
  type NoInput,
  type ToolReport,
} from "./machine-facts.js";

export interface ReportOutput {
  readonly machine: MachineFacts;
  readonly tools: readonly ToolReport[];
}

export const reportSpec: CommandSpec<NoInput> = {
  id: "sys.report",
  summary: "sys.report.summary",
  examples: ["kiriya sys report", "kiriya sys report --json"],
  ...SYS_COMMAND,
  idempotent: false,
  input: noInput,
};

/** Machine facts and tool versions to paste into a bug report; the host name and tool paths stay out. */
export class CreateReport implements Command<NoInput, ReportOutput> {
  readonly spec = reportSpec;

  constructor(
    private readonly system: SystemInfo,
    private readonly processRunner: ProcessRunner,
    private readonly runtime: RuntimeInfo,
  ) {}

  async execute(_input: NoInput, context: CommandContext): Promise<CommandResult<ReportOutput>> {
    const [snapshot, tools] = await Promise.all([this.system.read(), findTools(this.processRunner, context.signal)]);
    return done({
      machine: machineFacts(snapshot, this.runtime),
      tools: tools.map((tool) => ({ name: tool.name, version: tool.version, path: null })),
    });
  }
}
