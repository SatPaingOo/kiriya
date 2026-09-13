import path from "node:path";
import { isInside } from "../../../core/application/paths.js";
import { requireTypedConfirmation } from "../../../core/application/safety.js";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { ConflictError, KiriyaError, NotFoundError, OperationFailedError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message, type Message } from "../../../core/domain/message.js";
import { invalidNameReason } from "../../../core/domain/names.js";
import type { Compression } from "../../../core/domain/ports/compression.js";
import type { FileContent, FileWriter } from "../../../core/domain/ports/file-content.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import type { TarEntry, TarEntryType } from "../domain/tar-stream.js";
import { safeEntrySegments } from "../domain/zip-format.js";
import { readTar } from "./tar-reader.js";

/** Names listed per kind of problem before the rest are counted. */
const REPORT_LIMIT = 20;

export interface UntarInput {
  readonly archive: string;
  readonly to: string | undefined;
  readonly list: boolean;
  readonly overwrite: boolean;
  readonly confirm: string | undefined;
}

export interface ListedTarEntry {
  readonly name: string;
  readonly type: TarEntryType;
  readonly size: number;
  readonly modifiedMs: number;
}

export type UntarOutput =
  | {
      readonly mode: "list";
      readonly archive: string;
      readonly entries: readonly ListedTarEntry[];
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
      /** Symbolic and hard links, devices and pipes, which are never created. */
      readonly skippedLinks: number;
    };

export const untarSpec: CommandSpec<UntarInput> = {
  id: "archive.untar",
  summary: "archive.untar.summary",
  examples: [
    "kiriya archive untar release.tar.gz",
    "kiriya archive untar release.tgz --list",
    "kiriya archive untar node.tar.gz --to vendor/node --overwrite",
  ],
  safety: "destroy",
  idempotent: false,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "archive", description: "archive.untar.arg.archive", required: true, variadic: false }],
    options: {
      to: { type: "string", description: "archive.untar.option.to", valueName: "<folder>" },
      list: { type: "boolean", description: "archive.untar.option.list" },
      overwrite: { type: "boolean", description: "archive.untar.option.overwrite" },
      confirm: { type: "string", description: "archive.untar.option.confirm", valueName: "<count>" },
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

/** The default folder: the archive's name without .tar.gz, .tgz or .tar, next to it. */
export function defaultTarget(archive: string): string {
  const name = path.basename(archive);
  let base = name.replace(/(\.tar\.gz|\.tgz|\.tar)$/i, "");
  if (base === name) base = path.basename(name, path.extname(name));
  if (base === name || base === "") base = `${name}-extracted`;
  return path.join(path.dirname(archive), base);
}

interface OpenEntry {
  readonly entry: TarEntry;
  readonly destination: string;
  /** null once writing this entry has failed; its remaining data is passed over. */
  writer: FileWriter | null;
}

export class ExtractTar implements Command<UntarInput, UntarOutput> {
  readonly spec = untarSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly content: FileContent,
    private readonly compression: Compression,
  ) {}

  async execute(input: UntarInput, context: CommandContext): Promise<CommandResult<UntarOutput>> {
    const archive = path.resolve(context.cwd, input.archive);
    if ((await this.fileSystem.lstat(archive)) === null) {
      throw new NotFoundError("core.fs.not-found", { path: archive });
    }
    // A first pass reads only the headers, so nothing is written before every name has been checked.
    const entries: TarEntry[] = [];
    await readTar(this.content, this.compression, archive, context.signal, (event) => {
      if (event.kind === "entry") entries.push(event.entry);
      return Promise.resolve();
    });
    if (input.list) {
      const listed = entries.map(({ name, type, size, modifiedMs }) => ({ name, type, size, modifiedMs }));
      const bytes = entries.reduce((sum, entry) => sum + (entry.type === "file" ? entry.size : 0), 0);
      return done({ mode: "list", archive, entries: listed, bytes });
    }
    return this.extract(entries, archive, input, context);
  }

  private async extract(
    entries: readonly TarEntry[],
    archive: string,
    input: UntarInput,
    context: CommandContext,
  ): Promise<CommandResult<UntarOutput>> {
    const target = path.resolve(context.cwd, input.to ?? defaultTarget(archive));
    const plan = new Map<number, string>();
    const unsafe: string[] = [];
    const skipped: string[] = [];
    const failures: Message[] = [];
    let skippedLinks = 0;
    entries.forEach((entry, index) => {
      // A link can point anywhere, so extracting one could let later entries escape the target.
      if (entry.type === "link" || entry.type === "other") {
        skippedLinks += 1;
        return;
      }
      const segments = safeEntrySegments(entry.name);
      if (segments === null) {
        unsafe.push(entry.name);
        return;
      }
      if (segments.length === 0) return;
      const invalid = segments
        .map((segment) => ({ segment, reason: invalidNameReason(segment) }))
        .find((item) => item.reason !== null);
      if (invalid !== undefined && invalid.reason !== null) {
        skipped.push(entry.name);
        const reason = message(invalid.reason, { name: invalid.segment });
        failures.push(message("archive.unzip.invalid-name", { name: entry.name, reason }));
        return;
      }
      const destination = path.join(target, ...segments);
      if (isInside(destination, target)) plan.set(index, destination);
      else unsafe.push(entry.name);
    });

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
      skippedLinks,
    };
    if (unsafe.length > 0) {
      const names = unsafe.slice(0, REPORT_LIMIT).map((name) => message("archive.unzip.unsafe-name", { name }));
      return done(result, { failures: [...names, message("archive.unzip.unsafe-archive")] });
    }

    const conflicts: string[] = [];
    for (const [index, destination] of plan) {
      if (entries[index]?.type === "file" && (await this.fileSystem.lstat(destination)) !== null) {
        conflicts.push(destination);
      }
    }
    if (conflicts.length > 0) {
      if (!input.overwrite) {
        const existing = conflicts
          .slice(0, REPORT_LIMIT)
          .map((conflict) => message("core.fs.exists", { path: conflict }));
        const more =
          conflicts.length > REPORT_LIMIT
            ? [message("core.list.more", { count: conflicts.length - REPORT_LIMIT })]
            : [];
        return done(
          { ...result, conflicts },
          { failures: [...failures, ...existing], warnings: [...more, message("archive.unzip.nothing-extracted")] },
        );
      }
      const warning = message("archive.unzip.warn-overwrite", { count: conflicts.length, target });
      await requireTypedConfirmation(context, warning, String(conflicts.length), input.confirm);
    }

    const written = await this.write(entries, plan, archive, failures, context.signal);
    return done({ ...result, conflicts, extracted: true, ...written }, { failures });
  }

  /** The second pass: the same entries again, now with their data written out. */
  private async write(
    entries: readonly TarEntry[],
    plan: ReadonlyMap<number, string>,
    archive: string,
    failures: Message[],
    signal: AbortSignal,
  ): Promise<{ files: number; bytes: number }> {
    const progress: { index: number; open: OpenEntry | null; files: number; bytes: number } = {
      index: -1,
      open: null,
      files: 0,
      bytes: 0,
    };
    const fail = async (current: OpenEntry, error: unknown): Promise<void> => {
      if (!(error instanceof KiriyaError)) throw error;
      failures.push(message("archive.unzip.entry-failed", { name: current.entry.name, reason: error.detail }));
      await current.writer?.discard();
      current.writer = null;
    };
    try {
      await readTar(this.content, this.compression, archive, signal, async (event) => {
        if (event.kind === "entry") {
          progress.index += 1;
          const expected = entries[progress.index];
          if (expected?.name !== event.entry.name || expected.size !== event.entry.size) {
            throw new OperationFailedError("archive.untar.changed", { path: archive });
          }
          const destination = plan.get(progress.index);
          const next = destination === undefined ? null : { entry: event.entry, destination, writer: null };
          progress.open = next;
          if (next !== null) await this.begin(next).catch((error: unknown) => fail(next, error));
          return;
        }
        const current = progress.open;
        // A folder, an entry that is not extracted, or a file whose writing already failed.
        if (current?.writer === null || current?.writer === undefined) return;
        const writer = current.writer;
        if (event.kind === "data") {
          await writer.write(event.bytes).catch((error: unknown) => fail(current, error));
          return;
        }
        progress.open = null;
        try {
          await writer.close();
          current.writer = null;
          await this.fileSystem.setTimes(current.destination, current.entry.modifiedMs, current.entry.modifiedMs);
          // The owner keeps read and write access, whatever the archive says.
          await this.fileSystem.setMode(current.destination, (current.entry.mode & 0o777) | 0o600);
          progress.files += 1;
          progress.bytes += current.entry.size;
        } catch (error) {
          await fail(current, error);
        }
      });
    } catch (error) {
      await progress.open?.writer?.discard();
      throw error;
    }
    return { files: progress.files, bytes: progress.bytes };
  }

  /** Makes the folder, or opens the file for writing, replacing a file already there. */
  private async begin(open: OpenEntry): Promise<void> {
    if (open.entry.type === "directory") {
      await this.fileSystem.createDirectory(open.destination);
      return;
    }
    const existing = await this.fileSystem.lstat(open.destination);
    if (existing?.kind === "directory") {
      throw new ConflictError("archive.unzip.folder-in-the-way", { name: open.entry.name });
    }
    await this.fileSystem.createDirectory(path.dirname(open.destination));
    if (existing !== null) await this.fileSystem.remove(open.destination);
    open.writer = await this.content.createExclusive(open.destination);
  }
}
