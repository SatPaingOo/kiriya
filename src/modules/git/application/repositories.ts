import path from "node:path";
import { DEPENDENCY_DIRECTORIES } from "../../../config/dependency-directories.js";
import { KiriyaError, NotFoundError, UsageError } from "../../../core/domain/errors.js";
import { RawReader, type InputSchema } from "../../../core/domain/input-schema.js";
import { byCodePoint, isHiddenName } from "../../../core/domain/names.js";
import type { DirectoryEntry, FileSystem } from "../../../core/domain/ports/file-system.js";
import { DEFAULT_DEPTH, MAX_DEPTH } from "../domain/repository-status.js";

export interface FolderInput {
  readonly folder: string;
  readonly depth: number;
}

export function readDepth(reader: RawReader): number {
  const value = reader.string("depth");
  if (value === undefined) return DEFAULT_DEPTH;
  const depth = Number(value);
  if (!Number.isInteger(depth) || depth < 1 || depth > MAX_DEPTH) {
    throw new UsageError("git.option.depth-invalid", { value, max: MAX_DEPTH });
  }
  return depth;
}

export const folderInput: InputSchema<FolderInput> = {
  positionals: [{ name: "folder", description: "git.arg.folder", required: false, variadic: false, path: true }],
  options: { depth: { type: "string", description: "git.option.depth", valueName: "<1-10>" } },
  parse(raw) {
    const reader = new RawReader(raw);
    return { folder: reader.positional(0) ?? ".", depth: readDepth(reader) };
  },
};

/**
 * The folder itself when it is a repository; otherwise every repository below it, down
 * to `depth` folder levels. Hidden and dependency folders, and the inside of a
 * repository, are not searched.
 */
export async function repositoriesUnder(fileSystem: FileSystem, folder: string, depth: number): Promise<string[]> {
  if ((await fileSystem.lstat(path.join(folder, ".git"))) !== null) return [folder];
  const found: string[] = [];
  const visit = async (current: string, level: number): Promise<void> => {
    let entries: readonly DirectoryEntry[];
    try {
      entries = await fileSystem.readDirectory(current);
    } catch (error) {
      if (error instanceof KiriyaError) return;
      throw error;
    }
    for (const entry of entries) {
      if (entry.kind !== "directory" || isHiddenName(entry.name) || DEPENDENCY_DIRECTORIES.has(entry.name)) continue;
      const child = path.join(current, entry.name);
      if ((await fileSystem.lstat(path.join(child, ".git"))) !== null) found.push(child);
      else if (level < depth) await visit(child, level + 1);
    }
  };
  await visit(folder, 1);
  return found.sort(byCodePoint);
}

/** The folder a git command was given, checked, with the repositories in it. */
export async function repositoriesIn(
  fileSystem: FileSystem,
  cwd: string,
  input: FolderInput,
): Promise<{ readonly folder: string; readonly repositories: readonly string[] }> {
  const folder = path.resolve(cwd, input.folder);
  const stat = await fileSystem.stat(folder);
  if (stat === null) throw new NotFoundError("core.fs.not-found", { path: folder });
  if (stat.kind !== "directory") throw new NotFoundError("core.path.not-a-folder", { path: folder });
  return { folder, repositories: await repositoriesUnder(fileSystem, folder, input.depth) };
}
