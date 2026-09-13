import path from "node:path";
import { walk } from "../../../core/application/walk.js";
import { KiriyaError } from "../../../core/domain/errors.js";
import { globToRegExp } from "../../../core/domain/glob.js";
import type { FileContent } from "../../../core/domain/ports/file-content.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import { decodeText, MAX_TEXT_BYTES, type TextFile } from "../domain/text-encoding.js";

/** A text file, or null when it is binary, larger than MAX_TEXT_BYTES, or unreadable. */
export async function readTextFile(
  fileSystem: FileSystem,
  content: FileContent,
  target: string,
): Promise<TextFile | null> {
  try {
    const stat = await fileSystem.stat(target);
    if (stat?.kind !== "file" || stat.size > MAX_TEXT_BYTES) return null;
    return decodeText(await content.read(target));
  } catch (error) {
    if (error instanceof KiriyaError) return null;
    throw error;
  }
}

export interface FileSelection {
  readonly all: boolean;
  /** Lower case with dots; empty means every extension. */
  readonly extensions: readonly string[];
  readonly name: string | undefined;
}

/**
 * Files at or below the given paths. A file named directly is always kept; files
 * found inside folders must pass the extension list and the name glob, which
 * matches the name, or the path relative to the folder when the glob has a `/`.
 */
export async function selectFiles(
  fileSystem: FileSystem,
  paths: readonly string[],
  selection: FileSelection,
): Promise<string[]> {
  const extensions = new Set(selection.extensions);
  const pattern = selection.name === undefined ? null : globToRegExp(selection.name);
  const patternHasSlash = selection.name?.includes("/") === true;
  const keep = (name: string, rel: string): boolean =>
    (extensions.size === 0 || extensions.has(path.extname(name).toLowerCase())) &&
    (pattern === null || pattern.test(patternHasSlash ? rel : name));

  const files: string[] = [];
  for (const target of paths) {
    const stat = await fileSystem.lstat(target);
    if (stat?.kind === "file") {
      files.push(target);
    } else if (stat?.kind === "directory") {
      for await (const entry of walk(fileSystem, target, { all: selection.all })) {
        if (entry.kind === "file" && keep(entry.name, entry.rel)) files.push(entry.path);
      }
    }
  }
  return files;
}
