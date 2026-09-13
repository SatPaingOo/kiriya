import path from "node:path";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { NotFoundError, OperationFailedError, UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import type { FileContent } from "../../../core/domain/ports/file-content.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import { formatBytes } from "../../../core/domain/values/bytes.js";
import { MAX_TEXT_BYTES, splitLines, type TextEncoding } from "../domain/text-encoding.js";
import { readTextFile } from "./text-files.js";

export interface ReadInput {
  readonly path: string;
  readonly head: number | undefined;
  readonly tail: number | undefined;
  readonly range: { readonly from: number; readonly to: number } | undefined;
  readonly number: boolean;
}

export interface ReadOutput {
  readonly path: string;
  readonly encoding: TextEncoding;
  /** Line numbers, from 1, of the first and the last line in `lines`. */
  readonly first: number;
  readonly last: number;
  readonly totalLines: number;
  readonly lines: readonly string[];
  readonly numbered: boolean;
}

export const readSpec: CommandSpec<ReadInput> = {
  id: "files.read",
  summary: "files.read.summary",
  examples: [
    "kiriya files read README.md",
    "kiriya files read app.log --tail 50",
    "kiriya files read query.sql --lines 10-20 --number",
  ],
  safety: "read",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "file", description: "files.read.arg.file", required: true, variadic: false }],
    options: {
      head: { type: "string", description: "files.read.option.head", valueName: "<n>" },
      tail: { type: "string", description: "files.read.option.tail", valueName: "<n>" },
      lines: { type: "string", description: "files.read.option.lines", valueName: "<from>-<to>" },
      number: { type: "boolean", description: "files.read.option.number" },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      const head = reader.string("head") === undefined ? undefined : reader.positiveInteger("head", 1);
      const tail = reader.string("tail") === undefined ? undefined : reader.positiveInteger("tail", 1);
      const lines = reader.string("lines");
      if ([head, tail, lines].filter((value) => value !== undefined).length > 1) {
        throw new UsageError("files.read.one-selection");
      }
      let range: ReadInput["range"];
      if (lines !== undefined) {
        const match = /^(\d+)-(\d+)$/.exec(lines.trim());
        const from = Number(match?.[1]);
        const to = Number(match?.[2]);
        if (match === null || from < 1 || to < 1) throw new UsageError("files.read.lines-format");
        if (to < from) throw new UsageError("files.read.lines-order");
        range = { from, to };
      }
      return { path: reader.positional(0) ?? "", head, tail, range, number: reader.flag("number") };
    },
  },
};

export class ReadText implements Command<ReadInput, ReadOutput> {
  readonly spec = readSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly content: FileContent,
  ) {}

  async execute(input: ReadInput, context: CommandContext): Promise<CommandResult<ReadOutput>> {
    const target = path.resolve(context.cwd, input.path);
    const stat = await this.fileSystem.stat(target);
    if (stat === null) throw new NotFoundError("core.fs.not-found", { path: target });
    if (stat.kind === "directory") throw new UsageError("files.read.is-folder", { path: target });
    const text = await readTextFile(this.fileSystem, this.content, target);
    if (text === null) {
      throw new OperationFailedError("files.read.not-text", { path: target, limit: formatBytes(MAX_TEXT_BYTES) });
    }

    const lines = splitLines(text.text);
    let first = 1;
    let last = lines.length;
    if (input.head !== undefined) last = Math.min(lines.length, input.head);
    if (input.tail !== undefined) first = Math.max(1, lines.length - input.tail + 1);
    if (input.range !== undefined) {
      first = input.range.from;
      last = Math.min(lines.length, input.range.to);
    }
    return done({
      path: target,
      encoding: text.encoding,
      first,
      last,
      totalLines: lines.length,
      lines: lines.slice(first - 1, Math.max(first - 1, last)),
      numbered: input.number,
    });
  }
}
