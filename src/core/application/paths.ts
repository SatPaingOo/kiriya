import path from "node:path";
import { DEPENDENCY_DIRECTORIES } from "../../config/dependency-directories.js";
import { NotFoundError, UsageError } from "../domain/errors.js";
import type { FileSystem } from "../domain/ports/file-system.js";
import { globToRegExp, hasGlob } from "../domain/glob.js";
import { byCodePoint, isHiddenName } from "../domain/names.js";
import { walk } from "./walk.js";

/** True when `child` is `parent` or anywhere below it. */
export function isInside(child: string, parent: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/**
 * Paths from command arguments. An argument that exists is taken literally;
 * otherwise kiriya expands the glob itself, so a quoted `"src/**\/*.ts"` means
 * the same in PowerShell, cmd and bash. Globs skip hidden and dependency folders
 * unless `all` is set or the pattern names one.
 */
export async function expandPaths(
  fileSystem: FileSystem,
  args: readonly string[],
  cwd: string,
  all: boolean,
): Promise<string[]> {
  const found = new Set<string>();
  for (const arg of args) {
    const literal = path.resolve(cwd, arg);
    if ((await fileSystem.lstat(literal)) !== null) {
      found.add(literal);
      continue;
    }
    if (!hasGlob(arg)) throw new NotFoundError("core.fs.not-found", { path: literal });

    const normalized = path.sep === "\\" ? arg.split("\\").join("/") : arg;
    const segments = normalized.split("/");
    const firstGlob = segments.findIndex((segment) => hasGlob(segment));
    const base = path.resolve(cwd, segments.slice(0, firstGlob).join("/") || ".");
    const rest = segments.slice(firstGlob).join("/");
    const namesHidden = rest.split("/").some((segment) => isHiddenName(segment) || DEPENDENCY_DIRECTORIES.has(segment));
    const pattern = globToRegExp(rest);
    let matched = 0;
    for await (const entry of walk(fileSystem, base, { all: all || namesHidden })) {
      if (pattern.test(entry.rel)) {
        found.add(entry.path);
        matched += 1;
      }
    }
    if (matched === 0) throw new UsageError("core.glob.no-match", { pattern: arg });
  }
  return [...found].sort(byCodePoint);
}

/** Drops paths inside another selected folder, so nothing is handled twice. */
export function outermost(paths: readonly string[]): string[] {
  const kept: string[] = [];
  for (const candidate of [...paths].sort((a, b) => a.length - b.length)) {
    if (!kept.some((parent) => parent !== candidate && isInside(candidate, parent))) kept.push(candidate);
  }
  return kept.sort(byCodePoint);
}

export interface TreeSize {
  readonly bytes: number;
  readonly files: number;
  readonly directories: number;
}

/** Total size of a file or folder, counting everything inside; symlinks count as entries, never followed. */
export async function measure(fileSystem: FileSystem, target: string): Promise<TreeSize> {
  const stat = await fileSystem.lstat(target);
  if (stat === null) return { bytes: 0, files: 0, directories: 0 };
  if (stat.kind !== "directory") return { bytes: stat.size, files: 1, directories: 0 };
  let bytes = 0;
  let files = 0;
  let directories = 0;
  for await (const entry of walk(fileSystem, target, { all: true })) {
    if (entry.kind === "directory") {
      directories += 1;
    } else {
      files += 1;
      bytes += (await fileSystem.lstat(entry.path))?.size ?? 0;
    }
  }
  return { bytes, files, directories };
}
