import path from "node:path";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { NotFoundError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import type { EntryKind, FileSystem } from "../../../core/domain/ports/file-system.js";
import { byCodePoint, isHiddenName } from "../../../core/domain/names.js";

export const LIST_SORTS = ["name", "size", "time"] as const;

export interface ListInput {
  readonly path: string;
  readonly all: boolean;
  readonly sort: (typeof LIST_SORTS)[number];
  readonly reverse: boolean;
}

export interface ListedEntry {
  readonly name: string;
  readonly path: string;
  readonly kind: EntryKind;
  /** Bytes for files; 0 for everything else. */
  readonly size: number;
  readonly modifiedMs: number;
  /** Where a symlink points; null for everything else. */
  readonly target: string | null;
}

export interface ListOutput {
  readonly path: string;
  readonly entries: readonly ListedEntry[];
  readonly hidden: number;
}

export const listSpec: CommandSpec<ListInput> = {
  id: "files.list",
  summary: "files.list.summary",
  examples: ["kiriya files list", "kiriya files list src --sort size", "kiriya files list --all --json"],
  safety: "read",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "path", description: "files.list.arg.path", required: false, variadic: false }],
    options: {
      all: { type: "boolean", description: "files.option.all" },
      sort: { type: "string", description: "files.list.option.sort", valueName: "<name|size|time>" },
      reverse: { type: "boolean", description: "files.list.option.reverse" },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      return {
        path: reader.positional(0) ?? ".",
        all: reader.flag("all"),
        sort: reader.choice("sort", LIST_SORTS, "name"),
        reverse: reader.flag("reverse"),
      };
    },
  },
};

export class ListEntries implements Command<ListInput, ListOutput> {
  readonly spec = listSpec;

  constructor(private readonly fileSystem: FileSystem) {}

  async execute(input: ListInput, context: CommandContext): Promise<CommandResult<ListOutput>> {
    const target = path.resolve(context.cwd, input.path);
    const stat = await this.fileSystem.lstat(target);
    if (stat === null) throw new NotFoundError("core.fs.not-found", { path: target });

    const entries: ListedEntry[] = [];
    let hidden = 0;
    if (stat.kind === "directory") {
      for (const entry of await this.fileSystem.readDirectory(target)) {
        if (!input.all && isHiddenName(entry.name)) {
          hidden += 1;
          continue;
        }
        const listed = await this.describe(path.join(target, entry.name), entry.name);
        if (listed !== null) entries.push(listed);
      }
    } else {
      const listed = await this.describe(target, path.basename(target));
      if (listed !== null) entries.push(listed);
    }

    const byName = (a: ListedEntry, b: ListedEntry): number =>
      Number(b.kind === "directory") - Number(a.kind === "directory") || byCodePoint(a.name, b.name);
    const order =
      input.sort === "size"
        ? (a: ListedEntry, b: ListedEntry) => b.size - a.size || byName(a, b)
        : input.sort === "time"
          ? (a: ListedEntry, b: ListedEntry) => b.modifiedMs - a.modifiedMs || byName(a, b)
          : byName;
    entries.sort(order);
    if (input.reverse) entries.reverse();
    return done({ path: target, entries, hidden });
  }

  private async describe(entryPath: string, name: string): Promise<ListedEntry | null> {
    const stat = await this.fileSystem.lstat(entryPath);
    if (stat === null) return null;
    return {
      name,
      path: entryPath,
      kind: stat.kind,
      size: stat.kind === "file" ? stat.size : 0,
      modifiedMs: stat.modifiedMs,
      target: stat.kind === "symlink" ? await this.fileSystem.readLink(entryPath) : null,
    };
  }
}
