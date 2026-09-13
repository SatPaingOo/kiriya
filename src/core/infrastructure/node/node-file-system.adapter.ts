import type { Dirent, Stats } from "node:fs";
import { cp, lstat, mkdir, readdir, readlink, rename, rm, rmdir, stat, utimes, writeFile } from "node:fs/promises";
import { ConflictError } from "../../domain/errors.js";
import type { DirectoryEntry, EntryKind, FileStat, FileSystem } from "../../domain/ports/file-system.js";
import { errorCode, isMissing, translateFsError } from "./fs-errors.js";

function kindOf(entry: Stats | Dirent): EntryKind {
  if (entry.isSymbolicLink()) return "symlink";
  if (entry.isDirectory()) return "directory";
  if (entry.isFile()) return "file";
  return "other";
}

function toStat(stats: Stats): FileStat {
  return {
    kind: kindOf(stats),
    size: stats.size,
    modifiedMs: Math.floor(stats.mtimeMs),
    createdMs: Math.floor(stats.birthtimeMs),
    accessedMs: Math.floor(stats.atimeMs),
    mode: stats.mode,
    device: stats.dev,
  };
}

export class NodeFileSystemAdapter implements FileSystem {
  async lstat(path: string): Promise<FileStat | null> {
    try {
      return toStat(await lstat(path));
    } catch (error) {
      if (isMissing(error)) return null;
      return translateFsError(error, path);
    }
  }

  async stat(path: string): Promise<FileStat | null> {
    try {
      return toStat(await stat(path));
    } catch (error) {
      if (isMissing(error)) return null;
      return translateFsError(error, path);
    }
  }

  async readDirectory(path: string): Promise<readonly DirectoryEntry[]> {
    try {
      const entries = await readdir(path, { withFileTypes: true });
      return entries.map((entry) => ({ name: entry.name, kind: kindOf(entry) }));
    } catch (error) {
      return translateFsError(error, path);
    }
  }

  async readLink(path: string): Promise<string> {
    try {
      return await readlink(path);
    } catch (error) {
      return translateFsError(error, path);
    }
  }

  async createDirectory(path: string): Promise<void> {
    try {
      await mkdir(path, { recursive: true });
    } catch (error) {
      translateFsError(error, path);
    }
  }

  async createFile(path: string, content: string): Promise<void> {
    try {
      await writeFile(path, content, { encoding: "utf8", flag: "wx" });
    } catch (error) {
      translateFsError(error, path);
    }
  }

  async remove(path: string): Promise<void> {
    try {
      await rm(path, { recursive: true, force: false, maxRetries: 3 });
    } catch (error) {
      translateFsError(error, path);
    }
  }

  async copy(source: string, destination: string, overwrite: boolean): Promise<void> {
    try {
      await cp(source, destination, {
        recursive: true,
        preserveTimestamps: true,
        force: overwrite,
        errorOnExist: !overwrite,
        verbatimSymlinks: true,
      });
    } catch (error) {
      translateFsError(error, destination);
    }
  }

  async move(source: string, destination: string): Promise<void> {
    // rename replaces an existing file on Linux and macOS, so the check comes first.
    if ((await this.lstat(destination)) !== null) throw new ConflictError("core.fs.exists", { path: destination });
    try {
      await rename(source, destination);
      return;
    } catch (error) {
      if (errorCode(error) !== "EXDEV") translateFsError(error, source);
    }
    try {
      await this.copy(source, destination, false);
      await rm(source, { recursive: true, force: true, maxRetries: 3 });
    } catch (error) {
      translateFsError(error, source);
    }
  }

  async setTimes(path: string, accessedMs: number, modifiedMs: number): Promise<void> {
    try {
      await utimes(path, new Date(accessedMs), new Date(modifiedMs));
    } catch (error) {
      translateFsError(error, path);
    }
  }

  async sameEntry(first: string, second: string): Promise<boolean> {
    try {
      const [a, b] = await Promise.all([lstat(first, { bigint: true }), lstat(second, { bigint: true })]);
      // Some file systems, such as FAT, report no file ids at all.
      return a.ino !== 0n && a.ino === b.ino && a.dev === b.dev;
    } catch {
      return false;
    }
  }

  async removeEmptyDirectory(path: string): Promise<boolean> {
    try {
      await rmdir(path);
      return true;
    } catch (error) {
      const code = errorCode(error);
      if (code === "ENOTEMPTY" || code === "EEXIST") return false;
      return translateFsError(error, path);
    }
  }
}
