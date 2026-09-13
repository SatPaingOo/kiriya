import { open, readFile, rm, writeFile, type FileHandle } from "node:fs/promises";
import { OperationFailedError } from "../../domain/errors.js";
import type { FileContent, FileReader, FileWriter } from "../../domain/ports/file-content.js";
import { translateFsError } from "./fs-errors.js";

class NodeFileReader implements FileReader {
  constructor(
    private readonly handle: FileHandle,
    private readonly path: string,
    readonly size: number,
  ) {}

  async readAt(position: number, length: number): Promise<Uint8Array> {
    const buffer = new Uint8Array(length);
    let done = 0;
    try {
      while (done < length) {
        const { bytesRead } = await this.handle.read(buffer, done, length - done, position + done);
        if (bytesRead === 0) throw new OperationFailedError("core.fs.truncated", { path: this.path });
        done += bytesRead;
      }
    } catch (error) {
      if (error instanceof OperationFailedError) throw error;
      translateFsError(error, this.path);
    }
    return buffer;
  }

  close(): Promise<void> {
    return this.handle.close();
  }
}

class NodeFileWriter implements FileWriter {
  constructor(
    private readonly handle: FileHandle,
    private readonly path: string,
  ) {}

  async write(data: Uint8Array): Promise<void> {
    try {
      let done = 0;
      while (done < data.length) {
        const { bytesWritten } = await this.handle.write(data, done, data.length - done);
        done += bytesWritten;
      }
    } catch (error) {
      translateFsError(error, this.path);
    }
  }

  close(): Promise<void> {
    return this.handle.close();
  }

  async discard(): Promise<void> {
    // The handle may already be closed by a failed write; removing the file is what matters.
    await this.handle.close().catch(() => undefined);
    await rm(this.path, { force: true });
  }
}

export class NodeFileContentAdapter implements FileContent {
  async read(path: string): Promise<Uint8Array> {
    try {
      return await readFile(path);
    } catch (error) {
      return translateFsError(error, path);
    }
  }

  async write(path: string, data: Uint8Array): Promise<void> {
    try {
      await writeFile(path, data);
    } catch (error) {
      translateFsError(error, path);
    }
  }

  async openForReading(path: string): Promise<FileReader> {
    try {
      const handle = await open(path, "r");
      const { size } = await handle.stat();
      return new NodeFileReader(handle, path, size);
    } catch (error) {
      return translateFsError(error, path);
    }
  }

  async createExclusive(path: string): Promise<FileWriter> {
    try {
      return new NodeFileWriter(await open(path, "wx"), path);
    } catch (error) {
      return translateFsError(error, path);
    }
  }
}
