import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import type { PortTable } from "../../../core/domain/ports/port-table.js";
import type { ProcessTable } from "../../../core/domain/ports/process-table.js";
import { ownedListeners, readPort, type OwnedListener } from "./port-owners.js";

export interface WhoInput {
  /** null for every listening port. */
  readonly port: number | null;
}

export interface WhoOutput {
  readonly port: number | null;
  readonly listeners: readonly OwnedListener[];
}

export const whoSpec: CommandSpec<WhoInput> = {
  id: "port.who",
  summary: "port.who.summary",
  examples: ["kiriya port who 3000", "kiriya port who", "kiriya port who 5432 --json"],
  safety: "read",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "port", description: "port.who.arg.port", required: false, variadic: false }],
    options: {},
    parse(raw) {
      const text = new RawReader(raw).positional(0);
      return { port: text === undefined ? null : readPort(text) };
    },
  },
};

export class FindListeners implements Command<WhoInput, WhoOutput> {
  readonly spec = whoSpec;

  constructor(
    private readonly ports: PortTable,
    private readonly processes: ProcessTable,
  ) {}

  async execute(input: WhoInput, context: CommandContext): Promise<CommandResult<WhoOutput>> {
    const listeners = await ownedListeners(this.ports, this.processes, input.port, context.signal);
    return done({ port: input.port, listeners });
  }
}
