import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { OperationFailedError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import type { PortTable } from "../../../core/domain/ports/port-table.js";
import { readPort } from "./port-owners.js";

const DEFAULT_FROM = 3000;
const LAST_PORT = 65_535;

export interface FreeInput {
  readonly from: number;
}

export interface FreeOutput {
  readonly port: number;
}

export const freeSpec: CommandSpec<FreeInput> = {
  id: "port.free",
  summary: "port.free.summary",
  examples: ["kiriya port free", "kiriya port free --from 8080", "PORT=$(kiriya port free)"],
  safety: "read",
  idempotent: false,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [],
    options: { from: { type: "string", description: "port.free.option.from", valueName: "<port>" } },
    parse(raw) {
      const from = new RawReader(raw).string("from");
      return { from: from === undefined ? DEFAULT_FROM : readPort(from) };
    },
  },
};

export class FindFreePort implements Command<FreeInput, FreeOutput> {
  readonly spec = freeSpec;

  constructor(private readonly ports: PortTable) {}

  async execute(input: FreeInput, context: CommandContext): Promise<CommandResult<FreeOutput>> {
    const taken = new Set((await this.ports.listeners(context.signal)).map((listener) => listener.port));
    for (let port = input.from; port <= LAST_PORT; port += 1) {
      // The listener table catches a port held on one address that a test bind could still share on some systems.
      if (!taken.has(port) && (await this.ports.canListen(port))) return done({ port });
    }
    throw new OperationFailedError("port.free.none", { from: input.from });
  }
}
