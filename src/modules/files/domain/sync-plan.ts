import { byCodePoint } from "../../../core/domain/names.js";

export interface FileSnapshot {
  readonly size: number;
  readonly modifiedMs: number;
}

/** Every file and folder below a root, keyed by a relative path with `/`. */
export interface TreeSnapshot {
  readonly files: ReadonlyMap<string, FileSnapshot>;
  readonly directories: ReadonlySet<string>;
}

export interface SyncPlan {
  readonly copy: readonly string[];
  readonly update: readonly string[];
  readonly remove: readonly string[];
  /** Deepest first, so a folder is removed after what was inside it. */
  readonly removeDirectories: readonly string[];
  readonly bytes: number;
}

/** FAT and network shares store modification times in 2-second steps. */
export const MODIFIED_TOLERANCE_MS = 2000;

/** Files are compared by size and modification time. */
export function planSync(source: TreeSnapshot, target: TreeSnapshot, withDelete: boolean): SyncPlan {
  const copy: string[] = [];
  const update: string[] = [];
  let bytes = 0;
  for (const [rel, entry] of source.files) {
    const existing = target.files.get(rel);
    if (existing === undefined) {
      copy.push(rel);
      bytes += entry.size;
    } else if (
      existing.size !== entry.size ||
      Math.abs(existing.modifiedMs - entry.modifiedMs) > MODIFIED_TOLERANCE_MS
    ) {
      update.push(rel);
      bytes += entry.size;
    }
  }
  const remove = withDelete ? [...target.files.keys()].filter((rel) => !source.files.has(rel)) : [];
  const removeDirectories = withDelete
    ? [...target.directories]
        .filter((rel) => !source.directories.has(rel))
        .sort((a, b) => b.split("/").length - a.split("/").length || byCodePoint(a, b))
    : [];
  return {
    copy: copy.sort(byCodePoint),
    update: update.sort(byCodePoint),
    remove: remove.sort(byCodePoint),
    removeDirectories,
    bytes,
  };
}
