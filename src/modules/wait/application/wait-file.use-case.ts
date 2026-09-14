import path from "node:path";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message } from "../../../core/domain/message.js";
import type { Clock } from "../../../core/domain/ports/clock.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import { readTimeout, TIMEOUT_OPTION } from "../domain/wait-input.js";
import { poll } from "./poll.js";

export interface WaitFileInput {
  readonly path: string;
  readonly gone: boolean;
  readonly timeoutSeconds: number;
}

export interface WaitFileOutput {
  /** Absolute. */
  readonly path: string;
  /** Waiting until the path no longer exists, rather than until it does. */
  readonly gone: boolean;
  readonly ready: boolean;
  readonly attempts: number;
  readonly waitedMs: number;
}

export const waitFileSpec: CommandSpec<WaitFileInput> = {
  id: "wait.file",
  summary: "wait.file.summary",
  examples: ["kiriya wait file dist/app.js", "kiriya wait file .build.lock --gone --timeout 300"],
  safety: "read",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "path", description: "wait.file.arg.path", required: true, variadic: false, path: true }],
    options: {
      gone: { type: "boolean", description: "wait.file.option.gone" },
      timeout: TIMEOUT_OPTION,
    },
    parse(raw) {
      const reader = new RawReader(raw);
      return { path: reader.positional(0) ?? "", gone: reader.flag("gone"), timeoutSeconds: readTimeout(reader) };
    },
  },
};

export class WaitForFile implements Command<WaitFileInput, WaitFileOutput> {
  readonly spec = waitFileSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly clock: Clock,
  ) {}

  async execute(input: WaitFileInput, context: CommandContext): Promise<CommandResult<WaitFileOutput>> {
    const target = path.resolve(context.cwd, input.path);
    const polled = await poll(this.clock, input.timeoutSeconds * 1000, context.signal, async () => {
      const exists = (await this.fileSystem.stat(target)) !== null;
      return { ready: exists !== input.gone, value: exists };
    });
    const data: WaitFileOutput = {
      path: target,
      gone: input.gone,
      ready: polled.ready,
      attempts: polled.attempts,
      waitedMs: polled.waitedMs,
    };
    if (polled.ready) return done(data);
    const params = { path: target, seconds: input.timeoutSeconds };
    const failure = input.gone ? message("wait.file.still-there", params) : message("wait.file.timed-out", params);
    return done(data, { failures: [failure] });
  }
}
