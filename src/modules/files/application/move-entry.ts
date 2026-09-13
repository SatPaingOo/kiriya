import type { FileSystem } from "../../../core/domain/ports/file-system.js";

/**
 * Renames or moves without replacing anything. A change of case alone goes through a
 * temporary name, because case-insensitive drives on Windows and macOS see one entry.
 */
export async function moveEntry(fileSystem: FileSystem, from: string, to: string): Promise<void> {
  if (from === to) return;
  if (await fileSystem.sameEntry(from, to)) {
    let temporary = `${to}.kiriya-rename`;
    for (let attempt = 1; (await fileSystem.lstat(temporary)) !== null; attempt += 1) {
      temporary = `${to}.kiriya-rename-${attempt}`;
    }
    await fileSystem.move(from, temporary);
    await fileSystem.move(temporary, to);
    return;
  }
  await fileSystem.move(from, to);
}
