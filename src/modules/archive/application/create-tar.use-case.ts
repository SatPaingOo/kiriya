import path from "node:path";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { ConflictError, InterruptedError, UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import type { Compression, CompressionStream } from "../../../core/domain/ports/compression.js";
import type { FileContent, FileWriter } from "../../../core/domain/ports/file-content.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import { TAR_END, tarCompression, tarHeader, tarPadding } from "../domain/tar-format.js";
import { collectSources, type PendingEntry } from "./archive-sources.js";

/** Files are read in pieces this size, so no file has to fit in memory. */
const CHUNK_BYTES = 1024 * 1024;

export interface TarInput {
  readonly paths: readonly string[];
  readonly to: string;
  readonly lean: boolean;
  readonly all: boolean;
}

export interface TarOutput {
  readonly archive: string;
  readonly entries: number;
  readonly bytesIn: number;
  readonly bytesOut: number;
  readonly skippedLinks: number;
  readonly compressed: boolean;
}

export const tarSpec: CommandSpec<TarInput> = {
  id: "archive.tar",
  summary: "archive.tar.summary",
  examples: [
    "kiriya archive tar my-project --to my-project.tar.gz --lean",
    'kiriya archive tar "logs/*.log" --to logs.tgz',
    "kiriya archive tar dist --to dist.tar",
  ],
  safety: "write",
  idempotent: false,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "paths", description: "archive.tar.arg.paths", required: true, variadic: true }],
    options: {
      to: { type: "string", description: "archive.tar.option.to", valueName: "<file.tar.gz>" },
      lean: { type: "boolean", description: "archive.tar.option.lean" },
      all: { type: "boolean", description: "archive.tar.option.all" },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      const to = reader.string("to");
      if (to === undefined) throw new UsageError("archive.tar.to-required");
      return { paths: reader.positionalsFrom(0), to, lean: reader.flag("lean"), all: reader.flag("all") };
    },
  },
};

/** The archive file, written through gzip when there is one. */
class ArchiveSink {
  bytesOut = 0;

  constructor(
    private readonly writer: FileWriter,
    private readonly gzip: CompressionStream | null,
  ) {}

  async write(bytes: Uint8Array): Promise<void> {
    if (bytes.length === 0) return;
    await this.emit(this.gzip === null ? bytes : await this.gzip.push(bytes));
  }

  async finish(): Promise<void> {
    if (this.gzip !== null) await this.emit(await this.gzip.end());
    await this.writer.close();
  }

  private async emit(bytes: Uint8Array): Promise<void> {
    if (bytes.length === 0) return;
    await this.writer.write(bytes);
    this.bytesOut += bytes.length;
  }
}

export class CreateTar implements Command<TarInput, TarOutput> {
  readonly spec = tarSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly content: FileContent,
    private readonly compression: Compression,
  ) {}

  async execute(input: TarInput, context: CommandContext): Promise<CommandResult<TarOutput>> {
    const archive = path.resolve(context.cwd, input.to);
    const compressed = tarCompression(archive);
    if (compressed === null) throw new UsageError("archive.tar.extension", { path: input.to });
    if ((await this.fileSystem.lstat(archive)) !== null) throw new ConflictError("core.fs.exists", { path: archive });
    const { entries, skippedLinks } = await collectSources(this.fileSystem, input.paths, context.cwd, input);

    const writer = await this.content.createExclusive(archive);
    const sink = new ArchiveSink(writer, compressed ? this.compression.gzip() : null);
    let bytesIn = 0;
    try {
      for (const entry of entries) {
        if (context.signal.aborted) throw new InterruptedError("core.error.interrupted");
        bytesIn += await this.add(sink, entry);
      }
      await sink.write(TAR_END);
      await sink.finish();
    } catch (error) {
      // A failed archive leaves nothing behind.
      await writer.discard();
      throw error;
    }
    return done({ archive, entries: entries.length, bytesIn, bytesOut: sink.bytesOut, skippedLinks, compressed });
  }

  /** One entry's header and content. The size is taken when the file opens, in case it changed since it was listed. */
  private async add(sink: ArchiveSink, entry: PendingEntry): Promise<number> {
    if (entry.path === null) {
      await sink.write(
        tarHeader({ name: entry.name, isDirectory: true, size: 0, mode: 0o755, modifiedMs: entry.modifiedMs }),
      );
      return 0;
    }
    const reader = await this.content.openForReading(entry.path);
    try {
      // Executable files stay executable; everything else is readable by all and writable by its owner.
      const mode = (entry.mode & 0o111) !== 0 ? 0o755 : 0o644;
      const size = reader.size;
      await sink.write(tarHeader({ name: entry.name, isDirectory: false, size, mode, modifiedMs: entry.modifiedMs }));
      for (let position = 0; position < size; position += CHUNK_BYTES) {
        await sink.write(await reader.readAt(position, Math.min(CHUNK_BYTES, size - position)));
      }
      await sink.write(new Uint8Array(tarPadding(size)));
      return size;
    } finally {
      await reader.close();
    }
  }
}
