import path from "node:path";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { ConflictError, InterruptedError, OperationFailedError, UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import type { Compression } from "../../../core/domain/ports/compression.js";
import type { FileContent } from "../../../core/domain/ports/file-content.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import { crc32 } from "../domain/crc32.js";
import {
  centralHeader,
  DEFLATED,
  endRecord,
  localHeader,
  MAX_ENTRIES,
  STORED,
  ZIP32_LIMIT,
  type EntryHeader,
} from "../domain/zip-format.js";
import { collectSources } from "./archive-sources.js";

export interface ZipInput {
  readonly paths: readonly string[];
  readonly to: string;
  readonly lean: boolean;
  readonly all: boolean;
}

export interface ZipOutput {
  readonly archive: string;
  readonly entries: number;
  readonly bytesIn: number;
  readonly bytesOut: number;
  readonly skippedLinks: number;
}

export const zipSpec: CommandSpec<ZipInput> = {
  id: "archive.zip",
  summary: "archive.zip.summary",
  examples: [
    "kiriya archive zip my-project --to my-project.zip --lean",
    'kiriya archive zip "reports/*.pdf" --to reports.zip',
    "kiriya archive zip src docs README.md --to handover.zip",
  ],
  safety: "write",
  idempotent: false,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "paths", description: "archive.zip.arg.paths", required: true, variadic: true }],
    options: {
      to: { type: "string", description: "archive.zip.option.to", valueName: "<file.zip>" },
      lean: { type: "boolean", description: "archive.zip.option.lean" },
      all: { type: "boolean", description: "archive.zip.option.all" },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      const to = reader.string("to");
      if (to === undefined) throw new UsageError("archive.zip.to-required");
      return { paths: reader.positionalsFrom(0), to, lean: reader.flag("lean"), all: reader.flag("all") };
    },
  },
};

export class CreateZip implements Command<ZipInput, ZipOutput> {
  readonly spec = zipSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly content: FileContent,
    private readonly compression: Compression,
  ) {}

  async execute(input: ZipInput, context: CommandContext): Promise<CommandResult<ZipOutput>> {
    const archive = path.resolve(context.cwd, input.to);
    if ((await this.fileSystem.lstat(archive)) !== null) throw new ConflictError("core.fs.exists", { path: archive });
    const { entries, skippedLinks } = await collectSources(this.fileSystem, input.paths, context.cwd, input);
    if (entries.length >= MAX_ENTRIES) {
      throw new OperationFailedError("archive.zip.too-many-entries", { count: entries.length });
    }

    const writer = await this.content.createExclusive(archive);
    let offset = 0;
    let bytesIn = 0;
    const write = async (bytes: Uint8Array): Promise<void> => {
      await writer.write(bytes);
      offset += bytes.length;
    };
    try {
      const central: Uint8Array[] = [];
      for (const entry of entries) {
        if (context.signal.aborted) throw new InterruptedError("core.error.interrupted");
        if (entry.size >= ZIP32_LIMIT)
          throw new OperationFailedError("archive.zip.entry-too-large", { name: entry.name });
        if (offset >= ZIP32_LIMIT) throw new OperationFailedError("archive.zip.archive-too-large", { path: archive });
        const data = entry.path === null ? new Uint8Array(0) : await this.content.read(entry.path);
        if (data.length >= ZIP32_LIMIT)
          throw new OperationFailedError("archive.zip.entry-too-large", { name: entry.name });
        const deflated = entry.path === null ? data : await this.compression.deflateRaw(data);
        const method = entry.path !== null && deflated.length < data.length ? DEFLATED : STORED;
        const stored = method === DEFLATED ? deflated : data;
        const header: EntryHeader = {
          name: entry.name,
          isDirectory: entry.path === null,
          method,
          crc: crc32(data),
          compressedSize: stored.length,
          size: data.length,
          modifiedMs: entry.modifiedMs,
        };
        central.push(centralHeader(header, offset));
        await write(localHeader(header));
        await write(stored);
        bytesIn += data.length;
      }
      const directoryOffset = offset;
      for (const bytes of central) await write(bytes);
      if (offset >= ZIP32_LIMIT) throw new OperationFailedError("archive.zip.archive-too-large", { path: archive });
      await write(endRecord({ count: entries.length, size: offset - directoryOffset, offset: directoryOffset }));
      await writer.close();
    } catch (error) {
      // A failed archive leaves nothing behind.
      await writer.discard();
      throw error;
    }
    return done({ archive, entries: entries.length, bytesIn, bytesOut: offset, skippedLinks });
  }
}
