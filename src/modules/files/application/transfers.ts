import path from "node:path";
import { expandPaths, isInside, outermost } from "../../../core/application/paths.js";
import { UsageError } from "../../../core/domain/errors.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";

export interface Transfer {
  readonly source: string;
  readonly destination: string;
  /** Something else already exists at the destination. */
  readonly conflict: boolean;
}

/**
 * Where copy and move put things. Several sources, a target that is a folder, or a
 * target ending in a separator: into that folder. One source and a new name: at that name.
 */
export async function planTransfers(
  fileSystem: FileSystem,
  sourceArgs: readonly string[],
  targetArg: string,
  cwd: string,
  windows: boolean,
): Promise<Transfer[]> {
  const target = path.resolve(cwd, targetArg);
  const sources = outermost(await expandPaths(fileSystem, sourceArgs, cwd, false));
  const endsWithSeparator = targetArg.endsWith("/") || (windows && targetArg.endsWith("\\"));
  const only = sources.length === 1 ? sources[0] : undefined;
  const renamingCase = only !== undefined && (await fileSystem.sameEntry(only, target));
  const intoFolder =
    !renamingCase && (sources.length > 1 || endsWithSeparator || (await fileSystem.stat(target))?.kind === "directory");

  const seen = new Set<string>();
  const transfers: Transfer[] = [];
  for (const source of sources) {
    const destination = intoFolder ? path.join(target, path.basename(source)) : target;
    if (path.resolve(source) === path.resolve(destination)) {
      throw new UsageError("files.transfer.already-there", { path: source });
    }
    if (!renamingCase && isInside(destination, source)) {
      throw new UsageError("files.transfer.into-itself", { path: source });
    }
    // Compared without case, because two such names are one file on Windows and macOS.
    const key = destination.toLowerCase();
    if (seen.has(key)) throw new UsageError("files.transfer.same-destination", { path: destination });
    seen.add(key);
    const conflict =
      (await fileSystem.lstat(destination)) !== null && !(await fileSystem.sameEntry(source, destination));
    transfers.push({ source, destination, conflict });
  }
  return transfers;
}
