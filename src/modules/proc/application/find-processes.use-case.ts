import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message } from "../../../core/domain/message.js";
import type { ProcessTable } from "../../../core/domain/ports/process-table.js";
import { byNameThenPid } from "../domain/process-tree.js";
import type { ProcessesOutput } from "./list-processes.use-case.js";

export interface FindInput {
  readonly text: string;
}

export const findSpec: CommandSpec<FindInput> = {
  id: "proc.find",
  summary: "proc.find.summary",
  examples: ["kiriya proc find vite", "kiriya proc find server.js --json"],
  safety: "read",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "text", description: "proc.find.arg.text", required: true, variadic: false }],
    options: {},
    parse(raw) {
      const text = new RawReader(raw).positional(0)?.trim() ?? "";
      if (text === "") throw new UsageError("proc.find.text-missing");
      return { text };
    },
  },
};

export class FindProcesses implements Command<FindInput, ProcessesOutput> {
  readonly spec = findSpec;

  constructor(private readonly table: ProcessTable) {}

  async execute(input: FindInput, context: CommandContext): Promise<CommandResult<ProcessesOutput>> {
    const listing = await this.table.list(true, context.signal);
    const needle = input.text.toLowerCase();
    // kiriya's own command line holds the text, and so may the shell or wrapper that started it.
    const selfPid = this.table.selfPid;
    const launcher = listing.processes.find((entry) => entry.pid === selfPid)?.ppid ?? null;
    const processes = listing.processes
      .filter((entry) => {
        if (entry.pid === selfPid) return false;
        if (entry.name.toLowerCase().includes(needle)) return true;
        return entry.pid !== launcher && (entry.command?.toLowerCase().includes(needle) ?? false);
      })
      .sort(byNameThenPid);
    const failures = processes.length === 0 ? [message("proc.find.none", { text: input.text })] : [];
    return done({ processes, detailed: listing.detailed }, { failures });
  }
}
