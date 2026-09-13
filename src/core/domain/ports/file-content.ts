/** What is inside files. Paths, folders and metadata belong to FileSystem. */
export interface FileContent {
  /** The whole file. The port sets no limit, so callers check the size first. */
  read(path: string): Promise<Uint8Array>;
  /** Replaces the file's content, creating the file when it is missing. */
  write(path: string, data: Uint8Array): Promise<void>;
  /** For formats read by position, such as ZIP. */
  openForReading(path: string): Promise<FileReader>;
  /** A file that must not exist yet; ConflictError when it does. */
  createExclusive(path: string): Promise<FileWriter>;
}

export interface FileReader {
  readonly size: number;
  /** Exactly `length` bytes from `position`; OperationFailedError when the file ends first. */
  readAt(position: number, length: number): Promise<Uint8Array>;
  close(): Promise<void>;
}

export interface FileWriter {
  /** Appends at the end of what was written so far. */
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
  /** Closes and removes the partly written file. */
  discard(): Promise<void>;
}
