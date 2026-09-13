export type EntryKind = "file" | "directory" | "symlink" | "other";

export interface FileStat {
  readonly kind: EntryKind;
  readonly size: number;
  readonly modifiedMs: number;
  readonly createdMs: number;
  readonly accessedMs: number;
  readonly mode: number;
  readonly device: number;
}

export interface DirectoryEntry {
  readonly name: string;
  readonly kind: EntryKind;
}

/** Paths, folders and metadata, asynchronous. Failures arrive as typed errors, never raw errno codes. */
export interface FileSystem {
  /** Without following a final symlink; null when nothing is there. */
  lstat(path: string): Promise<FileStat | null>;
  /** Following symlinks; null when nothing is there. */
  stat(path: string): Promise<FileStat | null>;
  readDirectory(path: string): Promise<readonly DirectoryEntry[]>;
  readLink(path: string): Promise<string>;
  /** Creates missing parents too; nothing happens when the folder exists. */
  createDirectory(path: string): Promise<void>;
  /** ConflictError when anything already exists at the path. */
  createFile(path: string, content: string): Promise<void>;
  /** Permanent and recursive. */
  remove(path: string): Promise<void>;
  /**
   * A file, or a folder with everything inside, keeping modification times and copying
   * symlinks as links. Without `overwrite`, ConflictError when anything exists at the
   * destination; with it, files of the same name are replaced and other files stay.
   */
  copy(source: string, destination: string, overwrite: boolean): Promise<void>;
  /** A rename, or across drives a copy and then removal. ConflictError when the destination exists. */
  move(source: string, destination: string): Promise<void>;
  setTimes(path: string, accessedMs: number, modifiedMs: number): Promise<void>;
  /** Permission bits; on Windows only whether the file is read-only follows them. */
  setMode(path: string, mode: number): Promise<void>;
  /** Both paths reach one entry, such as `readme.md` and `README.md` on a case-insensitive drive. */
  sameEntry(first: string, second: string): Promise<boolean>;
  /** Removes a folder only when it is empty; false when something is inside. */
  removeEmptyDirectory(path: string): Promise<boolean>;
}
