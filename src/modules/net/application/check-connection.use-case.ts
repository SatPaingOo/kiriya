import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message, type Message } from "../../../core/domain/message.js";
import type { ConnectFailure, ConnectOutcome, Network } from "../../../core/domain/ports/network.js";
import type { MessageKey } from "../../../i18n/locales/en.js";
import { formatTarget, parseTarget, type Target } from "../domain/targets.js";

const MAX_TIMEOUT_SECONDS = 120;

export interface CheckInput {
  readonly target: Target;
  readonly timeoutSeconds: number;
}

export interface CheckOutput {
  readonly host: string;
  readonly port: number;
  readonly reachable: boolean;
  /** The address that answered; null when none did. */
  readonly address: string | null;
  readonly ms: number;
  readonly failure: ConnectFailure | null;
  /** The operating system's error code, such as ECONNREFUSED. */
  readonly code: string | null;
}

export const checkSpec: CommandSpec<CheckInput> = {
  id: "net.check",
  summary: "net.check.summary",
  examples: ["kiriya net check localhost:5432", "kiriya net check https://example.com", "kiriya net check [::1]:8080"],
  safety: "read",
  idempotent: true,
  usesNetwork: true,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "target", description: "net.check.arg.target", required: true, variadic: false }],
    options: { timeout: { type: "string", description: "net.check.option.timeout", valueName: "<seconds>" } },
    parse(raw) {
      const reader = new RawReader(raw);
      const text = reader.positional(0) ?? "";
      const target = parseTarget(text);
      if (target === null) throw new UsageError("net.check.target-invalid", { target: text });
      const timeoutSeconds = reader.positiveInteger("timeout", 5);
      if (timeoutSeconds > MAX_TIMEOUT_SECONDS) {
        throw new UsageError("net.check.timeout-range", { max: MAX_TIMEOUT_SECONDS });
      }
      return { target, timeoutSeconds };
    },
  },
};

const FAILURE_KEYS: Readonly<Record<ConnectFailure, MessageKey>> = {
  refused: "net.check.refused",
  timeout: "net.check.timeout",
  "not-found": "net.check.not-found",
  unreachable: "net.check.unreachable",
  failed: "net.check.failed",
};

function failureMessage(input: CheckInput, outcome: Extract<ConnectOutcome, { ok: false }>): Message {
  return message(FAILURE_KEYS[outcome.failure], {
    target: formatTarget(input.target),
    host: input.target.host,
    seconds: input.timeoutSeconds,
    code: outcome.code ?? outcome.failure,
  });
}

export class CheckConnection implements Command<CheckInput, CheckOutput> {
  readonly spec = checkSpec;

  constructor(private readonly network: Network) {}

  async execute(input: CheckInput, context: CommandContext): Promise<CommandResult<CheckOutput>> {
    const { host, port } = input.target;
    const outcome = await this.network.connect(host, port, input.timeoutSeconds * 1000, context.signal);
    if (outcome.ok) {
      return done({ host, port, reachable: true, address: outcome.address, ms: outcome.ms, failure: null, code: null });
    }
    const data = {
      host,
      port,
      reachable: false,
      address: null,
      ms: outcome.ms,
      failure: outcome.failure,
      code: outcome.code,
    };
    return done(data, { failures: [failureMessage(input, outcome)] });
  }
}
