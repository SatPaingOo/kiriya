import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message } from "../../../core/domain/message.js";
import type { Clock } from "../../../core/domain/ports/clock.js";
import type { HttpFailure, Network } from "../../../core/domain/ports/network.js";
import { failureReason } from "../domain/reasons.js";
import { parseHttpAddress, readStatuses, readTimeout, statusIsReady, TIMEOUT_OPTION } from "../domain/wait-input.js";
import { poll } from "./poll.js";

/** The longest one request may take, so a server that never answers is asked again. */
export const URL_ATTEMPT_MS = 5_000;

export interface WaitUrlInput {
  readonly url: string;
  /** The statuses that count as ready; empty means any 2xx. */
  readonly statuses: readonly number[];
  readonly timeoutSeconds: number;
}

export interface WaitUrlOutput {
  readonly url: string;
  readonly ready: boolean;
  readonly attempts: number;
  readonly waitedMs: number;
  /** From the last attempt: the status it answered with, or why it did not answer. */
  readonly status: number | null;
  readonly failure: HttpFailure | null;
  readonly code: string | null;
}

export const waitUrlSpec: CommandSpec<WaitUrlInput> = {
  id: "wait.url",
  summary: "wait.url.summary",
  examples: [
    "kiriya wait url http://localhost:3000/health",
    "kiriya wait url https://example.com/ready --status 200 --status 204",
  ],
  safety: "read",
  idempotent: true,
  usesNetwork: true,
  runsUserCommands: false,
  // The address can carry any text to a website, as with open.
  sensitive: true,
  input: {
    positionals: [{ name: "url", description: "wait.url.arg.url", required: true, variadic: false }],
    options: {
      status: { type: "string", description: "wait.url.option.status", valueName: "<code>", multiple: true },
      timeout: TIMEOUT_OPTION,
    },
    parse(raw) {
      const reader = new RawReader(raw);
      const text = reader.positional(0) ?? "";
      const url = parseHttpAddress(text);
      if (url === null) throw new UsageError("wait.url.not-http", { url: text });
      return { url, statuses: readStatuses(reader), timeoutSeconds: readTimeout(reader) };
    },
  },
};

export class WaitForUrl implements Command<WaitUrlInput, WaitUrlOutput> {
  readonly spec = waitUrlSpec;

  constructor(
    private readonly network: Network,
    private readonly clock: Clock,
  ) {}

  async execute(input: WaitUrlInput, context: CommandContext): Promise<CommandResult<WaitUrlOutput>> {
    const polled = await poll(this.clock, input.timeoutSeconds * 1000, context.signal, async (allowedMs) => {
      const outcome = await this.network.request(input.url, Math.min(URL_ATTEMPT_MS, allowedMs), context.signal);
      return { ready: outcome.ok && statusIsReady(outcome.status, input.statuses), value: outcome };
    });
    const { last } = polled;
    const data: WaitUrlOutput = {
      url: input.url,
      ready: polled.ready,
      attempts: polled.attempts,
      waitedMs: polled.waitedMs,
      status: last.ok ? last.status : null,
      failure: last.ok ? null : last.failure,
      code: last.ok ? null : last.code,
    };
    if (polled.ready) return done(data);
    const reason = last.ok
      ? message("wait.reason.status", { status: last.status })
      : failureReason(last.failure, new URL(input.url).hostname, last.code);
    const failure = message("wait.url.timed-out", { url: input.url, seconds: input.timeoutSeconds, reason });
    return done(data, { failures: [failure] });
  }
}
