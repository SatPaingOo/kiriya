import path from "node:path";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { NotFoundError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import type { Clock } from "../../../core/domain/ports/clock.js";
import type { EntryKind, FileSystem } from "../../../core/domain/ports/file-system.js";
import { globToRegExp } from "../../../core/domain/glob.js";
import { parseExtensions } from "../domain/filters.js";
import { parseSize, parseTime } from "../domain/values.js";
import { walk } from "../../../core/application/walk.js";

export const FIND_TYPES = ["file", "dir"] as const;

export interface FindInput {
  readonly folder: string;
  readonly name: string | undefined;
  readonly extensions: readonly string[];
  readonly type: (typeof FIND_TYPES)[number] | undefined;
  readonly larger: number | undefined;
  readonly smaller: number | undefined;
  readonly newer: string | undefined;
  readonly older: string | undefined;
  readonly empty: boolean;
  readonly all: boolean;
  readonly limit: number;
}

export interface FoundEntry {
  readonly path: string;
  readonly kind: EntryKind;
  readonly size: number;
  readonly modifiedMs: number;
}

export interface FindOutput {
  readonly folder: string;
  /** At most `limit` entries. */
  readonly matches: readonly FoundEntry[];
  readonly total: number;
  readonly totalBytes: number;
}

export const findSpec: CommandSpec<FindInput> = {
  id: "files.find",
  summary: "files.find.summary",
  examples: [
    'kiriya files find --name "*.test.ts"',
    "kiriya files find src --ext .ts,.tsx --newer 7d",
    "kiriya files find --type dir --empty",
  ],
  safety: "read",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "folder", description: "files.find.arg.folder", required: false, variadic: false }],
    options: {
      name: { type: "string", description: "files.find.option.name", valueName: "<glob>" },
      ext: { type: "string", description: "files.find.option.ext", valueName: "<extensions>", multiple: true },
      type: { type: "string", description: "files.find.option.type", valueName: "<file|dir>" },
      larger: { type: "string", description: "files.find.option.larger", valueName: "<size>" },
      smaller: { type: "string", description: "files.find.option.smaller", valueName: "<size>" },
      newer: { type: "string", description: "files.find.option.newer", valueName: "<time>" },
      older: { type: "string", description: "files.find.option.older", valueName: "<time>" },
      empty: { type: "boolean", description: "files.find.option.empty" },
      all: { type: "boolean", description: "files.option.all" },
      limit: { type: "string", description: "files.find.option.limit", valueName: "<n>" },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      const type = reader.string("type") === undefined ? undefined : reader.choice("type", FIND_TYPES, "file");
      const larger = reader.string("larger");
      const smaller = reader.string("smaller");
      return {
        folder: reader.positional(0) ?? ".",
        name: reader.string("name"),
        extensions: parseExtensions(reader.strings("ext")),
        type,
        larger: larger === undefined ? undefined : parseSize(larger),
        smaller: smaller === undefined ? undefined : parseSize(smaller),
        newer: reader.string("newer"),
        older: reader.string("older"),
        empty: reader.flag("empty"),
        all: reader.flag("all"),
        limit: reader.positiveInteger("limit", 200),
      };
    },
  },
};

export class FindFiles implements Command<FindInput, FindOutput> {
  readonly spec = findSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly clock: Clock,
  ) {}

  async execute(input: FindInput, context: CommandContext): Promise<CommandResult<FindOutput>> {
    const folder = path.resolve(context.cwd, input.folder);
    const stat = await this.fileSystem.stat(folder);
    if (stat === null) throw new NotFoundError("core.fs.not-found", { path: folder });
    if (stat.kind !== "directory") throw new NotFoundError("core.path.not-a-folder", { path: folder });

    const now = this.clock.now();
    const newer = input.newer === undefined ? undefined : parseTime(input.newer, now);
    const older = input.older === undefined ? undefined : parseTime(input.older, now);
    const pattern = input.name === undefined ? undefined : globToRegExp(input.name);
    const patternHasSlash = input.name?.includes("/") === true;
    const extensions = new Set(input.extensions);
    const sizeFilter = input.larger !== undefined || input.smaller !== undefined;

    const matches: FoundEntry[] = [];
    let total = 0;
    let totalBytes = 0;
    for await (const entry of walk(this.fileSystem, folder, { all: input.all })) {
      if (context.signal.aborted) break;
      const isDirectory = entry.kind === "directory";
      if (input.type === "file" && isDirectory) continue;
      if (input.type === "dir" && !isDirectory) continue;
      if (pattern !== undefined && !pattern.test(patternHasSlash ? entry.rel : entry.name)) continue;
      if (extensions.size > 0 && (isDirectory || !extensions.has(path.extname(entry.name).toLowerCase()))) continue;
      if (sizeFilter && isDirectory) continue;

      const entryStat = await this.fileSystem.lstat(entry.path);
      if (entryStat === null) continue;
      if (input.larger !== undefined && entryStat.size <= input.larger) continue;
      if (input.smaller !== undefined && entryStat.size >= input.smaller) continue;
      if (newer !== undefined && entryStat.modifiedMs < newer) continue;
      if (older !== undefined && entryStat.modifiedMs > older) continue;
      if (input.empty) {
        const empty = isDirectory
          ? (await this.fileSystem.readDirectory(entry.path)).length === 0
          : entryStat.size === 0;
        if (!empty) continue;
      }

      total += 1;
      if (!isDirectory) totalBytes += entryStat.size;
      if (matches.length < input.limit) {
        matches.push({
          path: entry.path,
          kind: entry.kind,
          size: isDirectory ? 0 : entryStat.size,
          modifiedMs: entryStat.modifiedMs,
        });
      }
    }
    return done({ folder, matches, total, totalBytes });
  }
}
