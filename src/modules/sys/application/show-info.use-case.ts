import type { Command, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import type { RuntimeInfo } from "../../../core/domain/module.js";
import type { SystemInfo } from "../../../core/domain/ports/system-info.js";
import { machineFacts, noInput, SYS_COMMAND, type MachineFacts, type NoInput } from "./machine-facts.js";

export interface InfoOutput extends MachineFacts {
  readonly uptimeSeconds: number;
  readonly hostname: string;
}

export const infoSpec: CommandSpec<NoInput> = {
  id: "sys.info",
  summary: "sys.info.summary",
  examples: ["kiriya sys info", "kiriya sys info --json"],
  ...SYS_COMMAND,
  // Free memory and uptime change from one run to the next.
  idempotent: false,
  input: noInput,
};

export class ShowInfo implements Command<NoInput, InfoOutput> {
  readonly spec = infoSpec;

  constructor(
    private readonly system: SystemInfo,
    private readonly runtime: RuntimeInfo,
  ) {}

  async execute(): Promise<CommandResult<InfoOutput>> {
    const snapshot = await this.system.read();
    return done({
      ...machineFacts(snapshot, this.runtime),
      uptimeSeconds: snapshot.uptimeSeconds,
      hostname: snapshot.hostname,
    });
  }
}
