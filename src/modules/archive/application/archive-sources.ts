import path from "node:path";
import { DEPENDENCY_DIRECTORIES } from "../../../config/dependency-directories.js";
import { expandPaths, outermost } from "../../../core/application/paths.js";
import { walk, type WalkOptions } from "../../../core/application/walk.js";
import { UsageError } from "../../../core/domain/errors.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";

export interface PendingEntry {
  /** With `/`, and a trailing `/` for a folder. */
  readonly name: string;
  /** null for a folder. */
  readonly path: string | null;
  readonly size: number;
  readonly modifiedMs: number;
  /** Permission bits as the file system reports them. */
  readonly mode: number;
}

export interface SourceOptions {
  /** Leave dependency and build folders out. */
  readonly lean: boolean;
  /** Let globs match hidden entries and dependency folders. */
  readonly all: boolean;
}

/** Every entry to store, gathered before writing starts, so a new archive never ends up inside itself. */
export async function collectSources(
  fileSystem: FileSystem,
  paths: readonly string[],
  cwd: string,
  options: SourceOptions,
): Promise<{ entries: PendingEntry[]; skippedLinks: number }> {
  const sources = outermost(await expandPaths(fileSystem, paths, cwd, options.all));
  const entries: PendingEntry[] = [];
  const topNames = new Set<string>();
  let skippedLinks = 0;
  for (const source of sources) {
    const name = path.basename(source);
    if (topNames.has(name.toLowerCase())) throw new UsageError("archive.same-name", { name });
    topNames.add(name.toLowerCase());
    const stat = await fileSystem.lstat(source);
    if (stat === null) continue;
    if (stat.kind === "symlink") {
      skippedLinks += 1;
      continue;
    }
    if (stat.kind !== "directory") {
      entries.push({ name, path: source, size: stat.size, modifiedMs: stat.modifiedMs, mode: stat.mode });
      continue;
    }
    // A folder keeps its own name and everything inside it, hidden files included.
    entries.push({ name: `${name}/`, path: null, size: 0, modifiedMs: stat.modifiedMs, mode: stat.mode });
    const walkOptions: WalkOptions = options.lean
      ? { all: true, skipDirectories: DEPENDENCY_DIRECTORIES }
      : { all: true };
    for await (const entry of walk(fileSystem, source, walkOptions)) {
      if (entry.kind === "symlink") {
        skippedLinks += 1;
        continue;
      }
      if (entry.kind !== "directory" && entry.kind !== "file") continue;
      const entryStat = await fileSystem.lstat(entry.path);
      if (entryStat === null) continue;
      const isFolder = entry.kind === "directory";
      entries.push({
        name: `${name}/${entry.rel}${isFolder ? "/" : ""}`,
        path: isFolder ? null : entry.path,
        size: isFolder ? 0 : entryStat.size,
        modifiedMs: entryStat.modifiedMs,
        mode: entryStat.mode,
      });
    }
  }
  return { entries, skippedLinks };
}
