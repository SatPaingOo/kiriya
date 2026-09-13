import path from "node:path";
import { walk } from "../../../core/application/walk.js";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { KiriyaError, NotFoundError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { byCodePoint } from "../../../core/domain/names.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import type { Hasher } from "../../../core/domain/ports/hasher.js";
import { parseSize } from "../domain/values.js";

/** Files are grouped by size, then by a hash of this many first bytes, then by a full hash. */
const PREFIX_BYTES = 64 * 1024;

export interface DupesInput {
  readonly folder: string;
  readonly minSize: number;
  readonly all: boolean;
}

export interface DuplicateGroup {
  readonly size: number;
  readonly paths: readonly string[];
}

export interface DupesOutput {
  readonly folder: string;
  readonly checked: number;
  /** Largest waste first. */
  readonly groups: readonly DuplicateGroup[];
  readonly extraBytes: number;
}

interface SizedFile {
  readonly path: string;
  readonly size: number;
}

async function groupBy<T>(items: readonly T[], key: (item: T) => Promise<string>): Promise<T[][]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const value = await key(item);
    const group = groups.get(value);
    if (group === undefined) groups.set(value, [item]);
    else group.push(item);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

const extraBytes = (group: readonly SizedFile[]): number => (group[0]?.size ?? 0) * (group.length - 1);

export const dupesSpec: CommandSpec<DupesInput> = {
  id: "files.dupes",
  summary: "files.dupes.summary",
  examples: ["kiriya files dupes ~/Downloads", "kiriya files dupes photos --min-size 1MB", "kiriya files dupes --json"],
  safety: "read",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [
      { name: "folder", description: "files.dupes.arg.folder", required: false, variadic: false, path: true },
    ],
    options: {
      "min-size": { type: "string", description: "files.dupes.option.min-size", valueName: "<size>" },
      all: { type: "boolean", description: "files.option.all" },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      const minSize = reader.string("min-size");
      return {
        folder: reader.positional(0) ?? ".",
        minSize: Math.max(1, minSize === undefined ? 1 : parseSize(minSize)),
        all: reader.flag("all"),
      };
    },
  },
};

export class FindDuplicates implements Command<DupesInput, DupesOutput> {
  readonly spec = dupesSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly hasher: Hasher,
  ) {}

  async execute(input: DupesInput, context: CommandContext): Promise<CommandResult<DupesOutput>> {
    const folder = path.resolve(context.cwd, input.folder);
    const stat = await this.fileSystem.stat(folder);
    if (stat === null) throw new NotFoundError("core.fs.not-found", { path: folder });
    if (stat.kind !== "directory") throw new NotFoundError("core.path.not-a-folder", { path: folder });

    const files: SizedFile[] = [];
    for await (const entry of walk(this.fileSystem, folder, { all: input.all })) {
      if (context.signal.aborted) break;
      if (entry.kind !== "file") continue;
      const size = (await this.fileSystem.lstat(entry.path))?.size ?? 0;
      if (size >= input.minSize) files.push({ path: entry.path, size });
    }

    // An unreadable file gets a key of its own, so it never joins a group.
    const digest = async (file: SizedFile, limitBytes?: number): Promise<string> => {
      try {
        return await this.hasher.hashFile(file.path, "sha256", limitBytes);
      } catch (error) {
        if (error instanceof KiriyaError) return `unreadable:${file.path}`;
        throw error;
      }
    };
    const groups: SizedFile[][] = [];
    for (const sameSize of await groupBy(files, (file) => Promise.resolve(String(file.size)))) {
      for (const sameStart of await groupBy(sameSize, (file) => digest(file, PREFIX_BYTES))) {
        const small = (sameStart[0]?.size ?? 0) <= PREFIX_BYTES;
        groups.push(...(small ? [sameStart] : await groupBy(sameStart, (file) => digest(file))));
      }
    }
    groups.sort((a, b) => extraBytes(b) - extraBytes(a));

    return done({
      folder,
      checked: files.length,
      groups: groups.map((group) => ({
        size: group[0]?.size ?? 0,
        paths: group.map((file) => file.path).sort(byCodePoint),
      })),
      extraBytes: groups.reduce((sum, group) => sum + extraBytes(group), 0),
    });
  }
}
