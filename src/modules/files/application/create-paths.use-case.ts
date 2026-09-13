import path from "node:path";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { KiriyaError, UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message, type Message } from "../../../core/domain/message.js";
import type { Environment } from "../../../core/domain/ports/environment.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import { invalidNameReason } from "../../../core/domain/names.js";

export interface CreateInput {
  readonly paths: readonly string[];
  readonly directory: boolean;
  readonly content: string | undefined;
}

export interface CreatedPath {
  readonly path: string;
  readonly kind: "file" | "directory";
  readonly created: boolean;
  readonly reason: Message | null;
}

export interface CreateOutput {
  readonly items: readonly CreatedPath[];
}

export const createSpec: CommandSpec<CreateInput> = {
  id: "files.new",
  summary: "files.new.summary",
  examples: [
    "kiriya files new notes.md",
    "kiriya files new src/app/ docs/",
    'kiriya files new .env.example --content "PORT=3000"',
  ],
  safety: "write",
  idempotent: false,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "paths", description: "files.new.arg.paths", required: true, variadic: true, path: true }],
    options: {
      dir: { type: "boolean", description: "files.new.option.dir" },
      content: { type: "string", description: "files.new.option.content", valueName: "<text>" },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      const directory = reader.flag("dir");
      const content = reader.string("content");
      if (directory && content !== undefined) throw new UsageError("files.new.content-with-dir");
      return { paths: reader.positionalsFrom(0), directory, content };
    },
  },
};

export class CreatePaths implements Command<CreateInput, CreateOutput> {
  readonly spec = createSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly environment: Environment,
  ) {}

  async execute(input: CreateInput, context: CommandContext): Promise<CommandResult<CreateOutput>> {
    const items: CreatedPath[] = [];
    const failures: Message[] = [];
    for (const arg of input.paths) {
      const folder = input.directory || arg.endsWith("/") || (this.environment.os === "windows" && arg.endsWith("\\"));
      const target = path.resolve(context.cwd, arg);
      const kind = folder ? "directory" : "file";
      const reason = await this.problem(target);
      if (reason !== null) {
        items.push({ path: target, kind, created: false, reason });
        failures.push(reason);
        continue;
      }
      try {
        if (folder) {
          await this.fileSystem.createDirectory(target);
        } else {
          await this.fileSystem.createDirectory(path.dirname(target));
          await this.fileSystem.createFile(target, input.content ?? "");
        }
        items.push({ path: target, kind, created: true, reason: null });
      } catch (error) {
        if (!(error instanceof KiriyaError)) throw error;
        items.push({ path: target, kind, created: false, reason: error.detail });
        failures.push(error.detail);
      }
    }
    return done({ items }, { failures });
  }

  private async problem(target: string): Promise<Message | null> {
    const name = path.basename(target);
    const invalid = invalidNameReason(name);
    if (invalid !== null) return message(invalid, { name });
    if ((await this.fileSystem.lstat(target)) !== null) return message("core.fs.exists", { path: target });
    return null;
  }
}
