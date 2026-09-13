import { expandPaths } from "../../../core/application/paths.js";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import type { FileContent } from "../../../core/domain/ports/file-content.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import { parseExtensions } from "../domain/filters.js";
import { escapeRegExp } from "../domain/text-encoding.js";
import { readTextFile, selectFiles } from "./text-files.js";

/** Longer matching lines are cut here, so one minified file cannot flood the terminal. */
const LINE_LIMIT = 240;

export interface GrepInput {
  readonly pattern: string;
  readonly paths: readonly string[];
  readonly literal: boolean;
  readonly ignoreCase: boolean;
  readonly extensions: readonly string[];
  readonly name: string | undefined;
  readonly filesOnly: boolean;
  readonly count: boolean;
  readonly all: boolean;
  readonly limit: number;
}

export interface GrepLine {
  readonly path: string;
  readonly line: number;
  readonly text: string;
}

export interface GrepFile {
  readonly path: string;
  readonly count: number;
}

export interface GrepOutput {
  readonly mode: "lines" | "files" | "count";
  /** Matching lines, trimmed, at most `limit`; only in lines mode. */
  readonly lines: readonly GrepLine[];
  /** Every file with at least one match. */
  readonly files: readonly GrepFile[];
  readonly matches: number;
  readonly checked: number;
  /** Binary files and files over 50 MB. */
  readonly skipped: number;
}

export const grepSpec: CommandSpec<GrepInput> = {
  id: "files.grep",
  summary: "files.grep.summary",
  examples: [
    'kiriya files grep "TODO|FIXME"',
    "kiriya files grep useState src --ext .tsx",
    'kiriya files grep "connection string" --literal -i -l',
  ],
  safety: "read",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [
      { name: "pattern", description: "files.grep.arg.pattern", required: true, variadic: false },
      { name: "paths", description: "files.grep.arg.paths", required: false, variadic: true },
    ],
    options: {
      literal: { type: "boolean", description: "files.grep.option.literal" },
      "ignore-case": { type: "boolean", description: "files.grep.option.ignore-case", short: "i" },
      ext: { type: "string", description: "files.option.ext", valueName: "<extensions>", multiple: true },
      name: { type: "string", description: "files.option.name", valueName: "<glob>" },
      "files-only": { type: "boolean", description: "files.grep.option.files-only", short: "l" },
      count: { type: "boolean", description: "files.grep.option.count", short: "c" },
      all: { type: "boolean", description: "files.option.all" },
      limit: { type: "string", description: "files.grep.option.limit", valueName: "<n>" },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      const pattern = reader.positional(0) ?? "";
      if (pattern === "") throw new UsageError("files.grep.empty-pattern");
      const literal = reader.flag("literal");
      if (!literal) {
        try {
          new RegExp(pattern);
        } catch {
          throw new UsageError("files.grep.bad-pattern", { pattern });
        }
      }
      return {
        pattern,
        paths: reader.positionalsFrom(1),
        literal,
        ignoreCase: reader.flag("ignore-case"),
        extensions: parseExtensions(reader.strings("ext")),
        name: reader.string("name"),
        filesOnly: reader.flag("files-only"),
        count: reader.flag("count"),
        all: reader.flag("all"),
        limit: reader.positiveInteger("limit", 500),
      };
    },
  },
};

export class SearchText implements Command<GrepInput, GrepOutput> {
  readonly spec = grepSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly content: FileContent,
  ) {}

  async execute(input: GrepInput, context: CommandContext): Promise<CommandResult<GrepOutput>> {
    const regex = new RegExp(input.literal ? escapeRegExp(input.pattern) : input.pattern, input.ignoreCase ? "i" : "");
    const mode: GrepOutput["mode"] = input.filesOnly ? "files" : input.count ? "count" : "lines";
    const targets = input.paths.length === 0 ? ["."] : input.paths;
    const paths = await expandPaths(this.fileSystem, targets, context.cwd, input.all);
    const files = await selectFiles(this.fileSystem, paths, {
      all: input.all,
      extensions: input.extensions,
      name: input.name,
    });

    const lines: GrepLine[] = [];
    const matched: GrepFile[] = [];
    let matches = 0;
    let skipped = 0;
    for (const file of files) {
      if (context.signal.aborted) break;
      const text = await readTextFile(this.fileSystem, this.content, file);
      if (text === null) {
        skipped += 1;
        continue;
      }
      let inFile = 0;
      text.text.split(/\r?\n/).forEach((line, index) => {
        if (!regex.test(line)) return;
        inFile += 1;
        if (mode !== "lines" || lines.length >= input.limit) return;
        const trimmed = line.trim();
        const clipped = trimmed.length > LINE_LIMIT ? `${trimmed.slice(0, LINE_LIMIT)}…` : trimmed;
        lines.push({ path: file, line: index + 1, text: clipped });
      });
      if (inFile === 0) continue;
      matches += inFile;
      matched.push({ path: file, count: inFile });
    }
    return done({ mode, lines, files: matched, matches, checked: files.length, skipped });
  }
}
