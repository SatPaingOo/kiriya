import { OperationFailedError } from "../../../core/domain/errors.js";
import type { Compression } from "../../../core/domain/ports/compression.js";
import type { FileContent, FileReader } from "../../../core/domain/ports/file-content.js";
import { crc32 } from "../domain/crc32.js";
import {
  dataOffset,
  DEFLATED,
  END_SEARCH_LENGTH,
  findDirectory,
  LOCAL_HEADER_LENGTH,
  parseDirectory,
  STORED,
  usesZip64,
  type CentralEntry,
} from "../domain/zip-format.js";

/** An open archive: its entries from the central directory, and each entry's bytes on request. */
export class ZipReader {
  private constructor(
    private readonly file: FileReader,
    private readonly compression: Compression,
    readonly entries: readonly CentralEntry[],
  ) {}

  static async open(content: FileContent, compression: Compression, archive: string): Promise<ZipReader> {
    const file = await content.openForReading(archive);
    try {
      const tailLength = Math.min(file.size, END_SEARCH_LENGTH);
      const location = findDirectory(await file.readAt(file.size - tailLength, tailLength));
      if (location === null) throw new OperationFailedError("archive.read.not-a-zip", { path: archive });
      if (usesZip64(location)) throw new OperationFailedError("archive.read.zip64", { path: archive });
      if (location.offset + location.size > file.size) {
        throw new OperationFailedError("archive.read.damaged", { path: archive });
      }
      const entries = parseDirectory(await file.readAt(location.offset, location.size), location.count);
      if (entries === null) throw new OperationFailedError("archive.read.damaged", { path: archive });
      return new ZipReader(file, compression, entries);
    } catch (error) {
      await file.close();
      throw error;
    }
  }

  /** One entry's bytes, checked against its CRC-32. */
  async read(entry: CentralEntry): Promise<Uint8Array> {
    if (entry.encrypted) throw new OperationFailedError("archive.unzip.encrypted", { name: entry.name });
    if (entry.method !== STORED && entry.method !== DEFLATED) {
      throw new OperationFailedError("archive.unzip.method", { name: entry.name, method: entry.method });
    }
    const header = await this.file.readAt(entry.localOffset, LOCAL_HEADER_LENGTH);
    const start = dataOffset(entry.localOffset, header);
    if (start === null) throw new OperationFailedError("archive.unzip.damaged-entry", { name: entry.name });
    const raw = await this.file.readAt(start, entry.compressedSize);
    const data = entry.method === DEFLATED ? await this.compression.inflateRaw(raw) : raw;
    if (crc32(data) !== entry.crc) throw new OperationFailedError("archive.unzip.checksum", { name: entry.name });
    return data;
  }

  close(): Promise<void> {
    return this.file.close();
  }
}
