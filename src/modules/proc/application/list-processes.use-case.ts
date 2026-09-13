import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message } from "../../../core/domain/message.js";
import type { ProcessInfo, ProcessTable } from "../../../core/domain/ports/process-table.js";
import { byNameThenPid } from "../domain/process-tree.js";

export interface ListInput {
  readonly name: string | undefined;
  readonly full: boolean;
}

export interface ProcessesOutput {
  readonly processes: readonly ProcessInfo[];
  /** Parent ids and command lines are included. */
  readonly detailed: boolean;
}

export const listSpec: CommandSpec<ListInput> = {
  id: "proc.list",
  summary: "proc.list.summary",
  examples: ["kiriya proc list", "kiriya proc list --name node", "kiriya proc list --full --json"],
  safety: "read",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [],
    options: {
      name: { type: "string", description: "proc.list.option.name", valueName: "<text>" },
      full: { type: "boolean", description: "proc.list.option.full", sensitive: true },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      return { name: reader.string("name"), full: reader.flag("full") };
    },
  },
};

export class ListProcesses implements Command<ListInput, ProcessesOutput> {
  readonly spec = listSpec;

  constructor(private readonly table: ProcessTable) {}

  async execute(input: ListInput, context: CommandContext): Promise<CommandResult<ProcessesOutput>> {
    const listing = await this.table.list(input.full, context.signal);
    const needle = input.name?.toLowerCase();
    const processes = listing.processes
      .filter((entry) => needle === undefined || entry.name.toLowerCase().includes(needle))
      .sort(byNameThenPid);
    const failures =
      input.name !== undefined && processes.length === 0 ? [message("proc.list.none", { name: input.name })] : [];
    return done({ processes, detailed: listing.detailed }, { failures });
  }
}
