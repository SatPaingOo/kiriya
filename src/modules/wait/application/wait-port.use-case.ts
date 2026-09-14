import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message } from "../../../core/domain/message.js";
import type { Clock } from "../../../core/domain/ports/clock.js";
import type { ConnectFailure, Network } from "../../../core/domain/ports/network.js";
import { formatTarget, type Target } from "../../../core/domain/targets.js";
import { failureReason } from "../domain/reasons.js";
import { parsePortTarget, readTimeout, TIMEOUT_OPTION } from "../domain/wait-input.js";
import { poll } from "./poll.js";

/** The longest one connection attempt may take, so a host that never answers is tried again. */
export const PORT_ATTEMPT_MS = 2_000;

export interface WaitPortInput {
  readonly target: Target;
  readonly gone: boolean;
  readonly timeoutSeconds: number;
}

export interface WaitPortOutput {
  readonly host: string;
  readonly port: number;
  /** Waiting until nothing listens, rather than until something does. */
  readonly gone: boolean;
  readonly ready: boolean;
  readonly attempts: number;
  readonly waitedMs: number;
  /** From the last attempt: the address that answered, or why nothing did. */
  readonly address: string | null;
  readonly failure: ConnectFailure | null;
  /** The operating system's error code, such as ECONNREFUSED. */
  readonly code: string | null;
}

export const waitPortSpec: CommandSpec<WaitPortInput> = {
  id: "wait.port",
  summary: "wait.port.summary",
  examples: [
    "kiriya wait port 5432",
    "kiriya wait port db.internal:5432 --timeout 120",
    "kiriya wait port 3000 --gone",
  ],
  safety: "read",
  idempotent: true,
  usesNetwork: true,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "target", description: "wait.port.arg.target", required: true, variadic: false }],
    options: {
      gone: { type: "boolean", description: "wait.port.option.gone" },
      timeout: TIMEOUT_OPTION,
    },
    parse(raw) {
      const reader = new RawReader(raw);
      const text = reader.positional(0) ?? "";
      const target = parsePortTarget(text);
      if (target === null) throw new UsageError("wait.port.target-invalid", { target: text });
      return { target, gone: reader.flag("gone"), timeoutSeconds: readTimeout(reader) };
    },
  },
};

export class WaitForPort implements Command<WaitPortInput, WaitPortOutput> {
  readonly spec = waitPortSpec;

  constructor(
    private readonly network: Network,
    private readonly clock: Clock,
  ) {}

  async execute(input: WaitPortInput, context: CommandContext): Promise<CommandResult<WaitPortOutput>> {
    const { host, port } = input.target;
    const polled = await poll(this.clock, input.timeoutSeconds * 1000, context.signal, async (allowedMs) => {
      const outcome = await this.network.connect(host, port, Math.min(PORT_ATTEMPT_MS, allowedMs), context.signal);
      return { ready: outcome.ok !== input.gone, value: outcome };
    });
    const { last } = polled;
    const data: WaitPortOutput = {
      host,
      port,
      gone: input.gone,
      ready: polled.ready,
      attempts: polled.attempts,
      waitedMs: polled.waitedMs,
      address: last.ok ? last.address : null,
      failure: last.ok ? null : last.failure,
      code: last.ok ? null : last.code,
    };
    if (polled.ready) return done(data);
    const target = formatTarget(input.target);
    const seconds = input.timeoutSeconds;
    // Not ready with a connection that worked can only mean --gone.
    const failure = last.ok
      ? message("wait.port.still-listening", { target, seconds })
      : message("wait.port.timed-out", { target, seconds, reason: failureReason(last.failure, host, last.code) });
    return done(data, { failures: [failure] });
  }
}
