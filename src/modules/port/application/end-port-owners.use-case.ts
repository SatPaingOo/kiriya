import { processLabels, reportEnded, type EndedProcess } from "../../../core/application/process-ending.js";
import { requireTypedConfirmation } from "../../../core/application/safety.js";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { NotFoundError, RefusedError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message } from "../../../core/domain/message.js";
import type { PortTable } from "../../../core/domain/ports/port-table.js";
import type { ProcessTable } from "../../../core/domain/ports/process-table.js";
import { ownedListeners, readPort } from "./port-owners.js";

export interface KillPortInput {
  readonly port: number;
  readonly force: boolean;
  readonly confirm: string | undefined;
}

export interface KillPortOutput {
  readonly port: number;
  readonly processes: readonly EndedProcess[];
}

export const killSpec: CommandSpec<KillPortInput> = {
  id: "port.kill",
  summary: "port.kill.summary",
  examples: ["kiriya port kill 3000", "kiriya port kill 3000 --force --confirm=3000"],
  safety: "destroy",
  idempotent: false,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "port", description: "port.kill.arg.port", required: true, variadic: false }],
    options: {
      force: { type: "boolean", description: "port.kill.option.force" },
      confirm: { type: "string", description: "port.kill.option.confirm", valueName: "<port>", terminalOnly: true },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      return {
        port: readPort(reader.positional(0) ?? ""),
        force: reader.flag("force"),
        confirm: reader.string("confirm"),
      };
    },
  },
};

export class EndPortOwners implements Command<KillPortInput, KillPortOutput> {
  readonly spec = killSpec;

  constructor(
    private readonly ports: PortTable,
    private readonly processes: ProcessTable,
  ) {}

  async execute(input: KillPortInput, context: CommandContext): Promise<CommandResult<KillPortOutput>> {
    const { port } = input;
    const listeners = await ownedListeners(this.ports, this.processes, port, context.signal);
    if (listeners.length === 0) throw new NotFoundError("port.kill.nothing", { port });
    const pids = [...new Set(listeners.flatMap((listener) => (listener.pid === null ? [] : [listener.pid])))];
    // kiriya never elevates, so another user's listener stays out of reach.
    if (pids.length === 0) throw new RefusedError("port.kill.hidden", { port });

    const names = new Map<number, string>();
    for (const listener of listeners) {
      if (listener.pid !== null && listener.name !== null) names.set(listener.pid, listener.name);
    }
    const guarded = this.processes.protectedPids();
    const refused = pids.find((pid) => guarded.has(pid));
    if (refused !== undefined) {
      throw new RefusedError("port.kill.protected", { name: names.get(refused) ?? "?", pid: refused });
    }

    const warning = message("port.kill.warn", { port, processes: processLabels(pids, names) });
    await requireTypedConfirmation(context, warning, String(port), input.confirm);
    const report = reportEnded(await this.processes.end(pids, input.force), names);
    const hidden = listeners.some((listener) => listener.pid === null)
      ? [message("port.kill.some-hidden", { port })]
      : [];
    return done(
      { port, processes: report.processes },
      { failures: report.failures, warnings: [...hidden, ...report.warnings] },
    );
  }
}
