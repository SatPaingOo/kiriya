import path from "node:path";
import { DEPENDENCY_DIRECTORIES } from "../../config/dependency-directories.js";
import { KiriyaError } from "../domain/errors.js";
import type { EntryKind, FileSystem } from "../domain/ports/file-system.js";
import { byCodePoint, isHiddenName } from "../domain/names.js";

export interface WalkEntry {
  readonly path: string;
  /** Relative to the walk root, always with `/`. */
  readonly rel: string;
  readonly name: string;
  /** 1 for the root's own entries. */
  readonly depth: number;
  readonly kind: EntryKind;
}

export interface WalkOptions {
  /** Include hidden entries and dependency folders. */
  readonly all: boolean;
  readonly maxDepth?: number;
  /** Folder names never listed or entered, even with `all`. */
  readonly skipDirectories?: ReadonlySet<string>;
}

/** Every entry below root in code-point order. Symlinks are listed, never followed; unreadable folders are skipped. */
export async function* walk(fileSystem: FileSystem, root: string, options: WalkOptions): AsyncGenerator<WalkEntry> {
  const maxDepth = options.maxDepth ?? Number.POSITIVE_INFINITY;

  async function* visit(dir: string, rel: string, depth: number): AsyncGenerator<WalkEntry> {
    let entries;
    try {
      entries = [...(await fileSystem.readDirectory(dir))];
    } catch (error) {
      if (error instanceof KiriyaError) return;
      throw error;
    }
    entries.sort((a, b) => byCodePoint(a.name, b.name));
    for (const entry of entries) {
      const skipped =
        isHiddenName(entry.name) || (entry.kind === "directory" && DEPENDENCY_DIRECTORIES.has(entry.name));
      if (!options.all && skipped) continue;
      if (entry.kind === "directory" && options.skipDirectories?.has(entry.name) === true) continue;
      const childPath = path.join(dir, entry.name);
      const childRel = rel === "" ? entry.name : `${rel}/${entry.name}`;
      yield { path: childPath, rel: childRel, name: entry.name, depth, kind: entry.kind };
      if (entry.kind === "directory" && depth < maxDepth) yield* visit(childPath, childRel, depth + 1);
    }
  }

  yield* visit(root, "", 1);
}
