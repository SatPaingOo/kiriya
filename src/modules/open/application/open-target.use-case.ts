import path from "node:path";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { NotFoundError, RefusedError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import type { Environment } from "../../../core/domain/ports/environment.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import type { Opener } from "../../../core/domain/ports/opener.js";
import { classifyTarget, runsWhenOpened } from "../domain/targets.js";

export interface OpenInput {
  readonly target: string;
}

export interface OpenOutput {
  /** The web address, or the absolute path. */
  readonly target: string;
  readonly kind: "url" | "file" | "folder";
}

export const openSpec: CommandSpec<OpenInput> = {
  id: "open",
  summary: "open.summary",
  examples: ["kiriya open .", "kiriya open report.pdf", "kiriya open https://example.com/docs"],
  safety: "read",
  idempotent: false,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "target", description: "open.arg.target", required: true, variadic: false }],
    options: {},
    parse: (raw) => ({ target: new RawReader(raw).positional(0) ?? "" }),
  },
};

/** Opening never runs a program: other schemes and files that would run as programs are refused. */
export class OpenTarget implements Command<OpenInput, OpenOutput> {
  readonly spec = openSpec;

  constructor(
    private readonly opener: Opener,
    private readonly fileSystem: FileSystem,
    private readonly environment: Environment,
  ) {}

  async execute(input: OpenInput, context: CommandContext): Promise<CommandResult<OpenOutput>> {
    const target = classifyTarget(input.target);
    if (target.kind === "refused") throw new RefusedError("open.scheme-refused", { scheme: target.scheme });
    if (target.kind === "url") {
      await this.opener.open(target.url, context.signal);
      return done({ target: target.url, kind: "url" });
    }

    // An absolute path never starts with a dash, so no opener mistakes it for an option.
    const absolute = path.resolve(context.cwd, target.path);
    const stat = await this.fileSystem.stat(absolute);
    if (stat === null) throw new NotFoundError("core.fs.not-found", { path: absolute });
    if (runsWhenOpened(path.basename(absolute), this.environment.os)) {
      throw new RefusedError("open.runs-program", { path: absolute });
    }
    await this.opener.open(absolute, context.signal);
    return done({ target: absolute, kind: stat.kind === "directory" ? "folder" : "file" });
  }
}
