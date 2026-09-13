import path from "node:path";
import { REBUILDABLE_DIRECTORIES } from "../../../config/rebuildable-directories.js";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { KiriyaError, NotFoundError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { byCodePoint } from "../../../core/domain/names.js";
import type { DirectoryEntry, FileSystem } from "../../../core/domain/ports/file-system.js";

export interface SizeInput {
  readonly folder: string;
  readonly top: number;
}

export interface SizeRow {
  readonly name: string;
  readonly path: string;
  readonly bytes: number;
  /** Bytes inside dependency, build and cache folders. */
  readonly rebuildableBytes: number;
}

export interface SizeOutput {
  readonly folder: string;
  readonly bytes: number;
  readonly rebuildableBytes: number;
  /** Files directly in the folder. */
  readonly looseBytes: number;
  /** How many rows the text view shows; JSON has every row. */
  readonly top: number;
  /** Every subfolder, largest first. */
  readonly rows: readonly SizeRow[];
}

interface Measured {
  total: number;
  rebuildable: number;
}

export const sizeSpec: CommandSpec<SizeInput> = {
  id: "files.size",
  summary: "files.size.summary",
  examples: ["kiriya files size", "kiriya files size ~/projects --top 30", "kiriya files size --json"],
  safety: "read",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "folder", description: "files.size.arg.folder", required: false, variadic: false }],
    options: { top: { type: "string", description: "files.size.option.top", valueName: "<n>" } },
    parse(raw) {
      const reader = new RawReader(raw);
      return { folder: reader.positional(0) ?? ".", top: reader.positiveInteger("top", 15) };
    },
  },
};

export class MeasureFolders implements Command<SizeInput, SizeOutput> {
  readonly spec = sizeSpec;

  constructor(private readonly fileSystem: FileSystem) {}

  async execute(input: SizeInput, context: CommandContext): Promise<CommandResult<SizeOutput>> {
    const folder = path.resolve(context.cwd, input.folder);
    const stat = await this.fileSystem.stat(folder);
    if (stat === null) throw new NotFoundError("core.fs.not-found", { path: folder });
    if (stat.kind !== "directory") throw new NotFoundError("core.path.not-a-folder", { path: folder });

    const rows: SizeRow[] = [];
    let looseBytes = 0;
    for (const entry of await this.fileSystem.readDirectory(folder)) {
      if (context.signal.aborted) break;
      const entryPath = path.join(folder, entry.name);
      if (entry.kind === "directory") {
        const size = await this.measure(entryPath, REBUILDABLE_DIRECTORIES.has(entry.name));
        rows.push({ name: entry.name, path: entryPath, bytes: size.total, rebuildableBytes: size.rebuildable });
      } else if (entry.kind === "file") {
        looseBytes += await this.sizeOf(entryPath);
      }
    }
    rows.sort((a, b) => b.bytes - a.bytes || byCodePoint(a.name, b.name));
    return done({
      folder,
      bytes: rows.reduce((sum, row) => sum + row.bytes, looseBytes),
      rebuildableBytes: rows.reduce((sum, row) => sum + row.rebuildableBytes, 0),
      looseBytes,
      top: input.top,
      rows,
    });
  }

  /** Symlinks are skipped, so a link can never count a folder twice or loop. */
  private async measure(folder: string, rebuildable: boolean): Promise<Measured> {
    const size: Measured = { total: 0, rebuildable: 0 };
    let entries: readonly DirectoryEntry[];
    try {
      entries = await this.fileSystem.readDirectory(folder);
    } catch (error) {
      if (error instanceof KiriyaError) return size;
      throw error;
    }
    for (const entry of entries) {
      const entryPath = path.join(folder, entry.name);
      if (entry.kind === "directory") {
        const inner = await this.measure(entryPath, rebuildable || REBUILDABLE_DIRECTORIES.has(entry.name));
        size.total += inner.total;
        size.rebuildable += inner.rebuildable;
      } else if (entry.kind === "file") {
        const bytes = await this.sizeOf(entryPath);
        size.total += bytes;
        if (rebuildable) size.rebuildable += bytes;
      }
    }
    return size;
  }

  private async sizeOf(file: string): Promise<number> {
    try {
      return (await this.fileSystem.lstat(file))?.size ?? 0;
    } catch (error) {
      if (error instanceof KiriyaError) return 0;
      throw error;
    }
  }
}
