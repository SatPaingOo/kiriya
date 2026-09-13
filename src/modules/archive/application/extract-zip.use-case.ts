import path from "node:path";
import { isInside } from "../../../core/application/paths.js";
import { requireTypedConfirmation } from "../../../core/application/safety.js";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { ConflictError, KiriyaError, NotFoundError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message, type Message } from "../../../core/domain/message.js";
import { invalidNameReason } from "../../../core/domain/names.js";
import type { Compression } from "../../../core/domain/ports/compression.js";
import type { FileContent } from "../../../core/domain/ports/file-content.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import { safeEntrySegments, type CentralEntry } from "../domain/zip-format.js";
import { ZipReader } from "./zip-reader.js";

/** Names listed per kind of problem before the rest are counted. */
const REPORT_LIMIT = 20;

export interface UnzipInput {
  readonly archive: string;
  readonly to: string | undefined;
  readonly list: boolean;
  readonly overwrite: boolean;
  readonly confirm: string | undefined;
}

export interface ListedEntry {
  readonly name: string;
  readonly isDirectory: boolean;
  readonly size: number;
  readonly compressedSize: number;
  readonly modifiedMs: number;
}

export type UnzipOutput =
  | {
      readonly mode: "list";
      readonly archive: string;
      readonly entries: readonly ListedEntry[];
      readonly bytes: number;
    }
  | {
      readonly mode: "extract";
      readonly archive: string;
      readonly target: string;
      readonly extracted: boolean;
      readonly files: number;
      readonly bytes: number;
      /** Names that would land outside the target; any of them stops the extraction. */
      readonly unsafe: readonly string[];
      /** Names no OS could create, such as `what?.txt`; skipped. */
      readonly skipped: readonly string[];
      /** Existing files that --overwrite would replace. */
      readonly conflicts: readonly string[];
    };

export const unzipSpec: CommandSpec<UnzipInput> = {
  id: "archive.unzip",
  summary: "archive.unzip.summary",
  examples: [
    "kiriya archive unzip release.zip",
    "kiriya archive unzip release.zip --list",
    "kiriya archive unzip release.zip --to vendor/tool --overwrite",
  ],
  safety: "destroy",
  idempotent: false,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "archive", description: "archive.unzip.arg.archive", required: true, variadic: false }],
    options: {
      to: { type: "string", description: "archive.unzip.option.to", valueName: "<folder>" },
      list: { type: "boolean", description: "archive.unzip.option.list" },
      overwrite: { type: "boolean", description: "archive.unzip.option.overwrite" },
      confirm: { type: "string", description: "archive.unzip.option.confirm", valueName: "<count>" },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      return {
        archive: reader.positional(0) ?? "",
        to: reader.string("to"),
        list: reader.flag("list"),
        overwrite: reader.flag("overwrite"),
        confirm: reader.string("confirm"),
      };
    },
  },
};

interface PlannedEntry {
  readonly entry: CentralEntry;
  readonly destination: string;
}

export class ExtractZip implements Command<UnzipInput, UnzipOutput> {
  readonly spec = unzipSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly content: FileContent,
    private readonly compression: Compression,
  ) {}

  async execute(input: UnzipInput, context: CommandContext): Promise<CommandResult<UnzipOutput>> {
    const archive = path.resolve(context.cwd, input.archive);
    if ((await this.fileSystem.lstat(archive)) === null)
      throw new NotFoundError("core.fs.not-found", { path: archive });
    const reader = await ZipReader.open(this.content, this.compression, archive);
    try {
      if (input.list) {
        const entries = reader.entries.map((entry) => ({
          name: entry.name,
          isDirectory: entry.isDirectory,
          size: entry.size,
          compressedSize: entry.compressedSize,
          modifiedMs: entry.modifiedMs,
        }));
        return done({ mode: "list", archive, entries, bytes: entries.reduce((sum, entry) => sum + entry.size, 0) });
      }
      return await this.extract(reader, archive, input, context);
    } finally {
      await reader.close();
    }
  }

  private async extract(
    reader: ZipReader,
    archive: string,
    input: UnzipInput,
    context: CommandContext,
  ): Promise<CommandResult<UnzipOutput>> {
    const defaultTarget = path.join(path.dirname(archive), path.basename(archive, path.extname(archive)));
    const target = path.resolve(context.cwd, input.to ?? defaultTarget);
    const plan: PlannedEntry[] = [];
    const unsafe: string[] = [];
    const skipped: string[] = [];
    const failures: Message[] = [];
    for (const entry of reader.entries) {
      const segments = safeEntrySegments(entry.name);
      if (segments === null) {
        unsafe.push(entry.name);
        continue;
      }
      if (segments.length === 0) continue;
      // A tool that could not encode a name may have stored "?" in it, which no Windows folder accepts.
      const invalid = segments
        .map((segment) => ({ segment, reason: invalidNameReason(segment) }))
        .find((item) => item.reason !== null);
      if (invalid !== undefined && invalid.reason !== null) {
        skipped.push(entry.name);
        const reason = message(invalid.reason, { name: invalid.segment });
        failures.push(message("archive.unzip.invalid-name", { name: entry.name, reason }));
        continue;
      }
      const destination = path.join(target, ...segments);
      if (isInside(destination, target)) plan.push({ entry, destination });
      else unsafe.push(entry.name);
    }

    const result = {
      mode: "extract" as const,
      archive,
      target,
      extracted: false,
      files: 0,
      bytes: 0,
      unsafe,
      skipped,
      conflicts: [] as string[],
    };
    if (unsafe.length > 0) {
      const names = unsafe.slice(0, REPORT_LIMIT).map((name) => message("archive.unzip.unsafe-name", { name }));
      return done(result, { failures: [...names, message("archive.unzip.unsafe-archive")] });
    }

    const conflicts: string[] = [];
    for (const item of plan) {
      if (!item.entry.isDirectory && (await this.fileSystem.lstat(item.destination)) !== null) {
        conflicts.push(item.destination);
      }
    }
    if (conflicts.length > 0) {
      if (!input.overwrite) {
        const existing = conflicts
          .slice(0, REPORT_LIMIT)
          .map((conflict) => message("core.fs.exists", { path: conflict }));
        const warnings =
          conflicts.length > REPORT_LIMIT
            ? [
                message("core.list.more", { count: conflicts.length - REPORT_LIMIT }),
                message("archive.unzip.nothing-extracted"),
              ]
            : [message("archive.unzip.nothing-extracted")];
        return done({ ...result, conflicts }, { failures: [...failures, ...existing], warnings });
      }
      const warning = message("archive.unzip.warn-overwrite", { count: conflicts.length, target });
      await requireTypedConfirmation(context, warning, String(conflicts.length), input.confirm);
    }

    let files = 0;
    let bytes = 0;
    for (const { entry, destination } of plan) {
      if (context.signal.aborted) break;
      try {
        if (entry.isDirectory) {
          await this.fileSystem.createDirectory(destination);
          continue;
        }
        if ((await this.fileSystem.stat(destination))?.kind === "directory") {
          throw new ConflictError("archive.unzip.folder-in-the-way", { name: entry.name });
        }
        await this.fileSystem.createDirectory(path.dirname(destination));
        const data = await reader.read(entry);
        await this.content.write(destination, data);
        await this.fileSystem.setTimes(destination, entry.modifiedMs, entry.modifiedMs);
        files += 1;
        bytes += data.length;
      } catch (error) {
        if (!(error instanceof KiriyaError)) throw error;
        failures.push(message("archive.unzip.entry-failed", { name: entry.name, reason: error.detail }));
      }
    }
    return done({ ...result, conflicts, extracted: true, files, bytes }, { failures });
  }
}
