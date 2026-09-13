import { processLabels, reportEnded, type EndedProcess } from "../../../core/application/process-ending.js";
import { requireTypedConfirmation } from "../../../core/application/safety.js";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { NotFoundError, RefusedError, UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message, type Message } from "../../../core/domain/message.js";
import type { ProcessInfo, ProcessTable } from "../../../core/domain/ports/process-table.js";
import { programKey } from "../domain/process-tree.js";

export interface KillInput {
  /** A process id in digits, or a program name. */
  readonly target: string;
  readonly force: boolean;
  readonly confirm: string | undefined;
}

export interface KillOutput {
  readonly target: string;
  readonly processes: readonly EndedProcess[];
}

export const killSpec: CommandSpec<KillInput> = {
  id: "proc.kill",
  summary: "proc.kill.summary",
  examples: ["kiriya proc kill 4100", "kiriya proc kill node", "kiriya proc kill node --force --confirm=node"],
  safety: "destroy",
  idempotent: false,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "target", description: "proc.kill.arg.target", required: true, variadic: false }],
    options: {
      force: { type: "boolean", description: "proc.kill.option.force" },
      confirm: { type: "string", description: "proc.kill.option.confirm", valueName: "<id-or-name>" },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      const target = reader.positional(0)?.trim() ?? "";
      if (target === "") throw new UsageError("proc.kill.target-missing");
      return { target, force: reader.flag("force"), confirm: reader.string("confirm") };
    },
  },
};

export class EndProcesses implements Command<KillInput, KillOutput> {
  readonly spec = killSpec;

  constructor(private readonly table: ProcessTable) {}

  async execute(input: KillInput, context: CommandContext): Promise<CommandResult<KillOutput>> {
    const { processes } = await this.table.list(false, context.signal);
    const guarded = this.table.protectedPids();
    const warnings: Message[] = [];
    let targets: readonly ProcessInfo[];

    if (/^\d+$/.test(input.target)) {
      const pid = Number(input.target);
      const found = processes.find((entry) => entry.pid === pid);
      if (found === undefined) throw new NotFoundError("proc.kill.no-pid", { pid });
      if (guarded.has(pid)) throw new RefusedError("proc.kill.protected", { name: found.name, pid });
      targets = [found];
    } else {
      const key = programKey(input.target);
      const matches = processes.filter((entry) => programKey(entry.name) === key);
      if (matches.length === 0) throw new NotFoundError("proc.kill.no-name", { name: input.target });
      // Ending every node would end kiriya itself, and perhaps the program that started it.
      targets = matches.filter((entry) => !guarded.has(entry.pid));
      if (targets.length === 0) throw new RefusedError("proc.kill.only-protected", { name: input.target });
      const skipped = matches.length - targets.length;
      if (skipped > 0) warnings.push(message("proc.kill.skipped", { count: skipped }));
    }

    const names = new Map(targets.map((entry) => [entry.pid, entry.name]));
    const pids = targets.map((entry) => entry.pid).sort((first, second) => first - second);
    const warning = message("proc.kill.warn", { processes: processLabels(pids, names) });
    await requireTypedConfirmation(context, warning, input.target, input.confirm);
    const report = reportEnded(await this.table.end(pids, input.force), names);
    return done(
      { target: input.target, processes: report.processes },
      { failures: report.failures, warnings: [...warnings, ...report.warnings] },
    );
  }
}
