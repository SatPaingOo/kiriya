import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { NotFoundError, UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import type { ProcessTable } from "../../../core/domain/ports/process-table.js";
import { processTree, type TreeRow } from "../domain/process-tree.js";

export interface TreeInput {
  /** null for every process. */
  readonly pid: number | null;
}

export interface TreeOutput {
  readonly rows: readonly TreeRow[];
}

export const treeSpec: CommandSpec<TreeInput> = {
  id: "proc.tree",
  summary: "proc.tree.summary",
  examples: ["kiriya proc tree", "kiriya proc tree 4100", "kiriya proc tree 4100 --json"],
  safety: "read",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "pid", description: "proc.tree.arg.pid", required: false, variadic: false }],
    options: {},
    parse(raw) {
      const text = new RawReader(raw).positional(0);
      if (text === undefined) return { pid: null };
      if (!/^\d+$/.test(text)) throw new UsageError("proc.tree.pid-invalid", { pid: text });
      return { pid: Number(text) };
    },
  },
};

export class ShowTree implements Command<TreeInput, TreeOutput> {
  readonly spec = treeSpec;

  constructor(private readonly table: ProcessTable) {}

  async execute(input: TreeInput, context: CommandContext): Promise<CommandResult<TreeOutput>> {
    const { processes } = await this.table.list(true, context.signal);
    if (input.pid !== null && !processes.some((entry) => entry.pid === input.pid)) {
      throw new NotFoundError("proc.tree.no-pid", { pid: input.pid });
    }
    return done({ rows: processTree(processes, input.pid) });
  }
}
