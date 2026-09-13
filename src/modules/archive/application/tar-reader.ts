import { InterruptedError, OperationFailedError } from "../../../core/domain/errors.js";
import type { Compression } from "../../../core/domain/ports/compression.js";
import type { FileContent } from "../../../core/domain/ports/file-content.js";
import { TarFormatError, TarParser, type TarEvent } from "../domain/tar-stream.js";

/** The archive is read in pieces this size, so it never has to fit in memory. */
const CHUNK_BYTES = 1024 * 1024;

/**
 * Streams a .tar, .tar.gz or .tgz, whichever its first bytes show it to be, and hands
 * each event to `handle` in order. Damaged gzip or tar data becomes one error naming the archive.
 */
export async function readTar(
  content: FileContent,
  compression: Compression,
  archive: string,
  signal: AbortSignal,
  handle: (event: TarEvent) => Promise<void>,
): Promise<void> {
  const reader = await content.openForReading(archive);
  try {
    const head = await reader.readAt(0, Math.min(2, reader.size));
    const gunzip = head[0] === 0x1f && head[1] === 0x8b ? compression.gunzip() : null;
    const parser = new TarParser();
    const feed = async (bytes: Uint8Array): Promise<void> => {
      for (const event of parser.push(bytes)) await handle(event);
    };
    try {
      for (let position = 0; position < reader.size && !parser.ended; position += CHUNK_BYTES) {
        if (signal.aborted) throw new InterruptedError("core.error.interrupted");
        const raw = await reader.readAt(position, Math.min(CHUNK_BYTES, reader.size - position));
        await feed(gunzip === null ? raw : await gunzip.push(raw));
      }
      if (gunzip !== null && !parser.ended) await feed(await gunzip.end());
      // What follows the end blocks does not matter, even when it is not valid gzip.
      if (gunzip !== null && parser.ended) await gunzip.end().catch(() => undefined);
      parser.finish();
    } catch (error) {
      const damaged =
        error instanceof TarFormatError ||
        (error instanceof OperationFailedError && error.detail.key === "core.compression.failed");
      if (!damaged) throw error;
      throw new OperationFailedError(
        "archive.untar.damaged",
        { path: archive, reason: error.detail },
        { cause: error },
      );
    }
  } finally {
    await reader.close();
  }
}
