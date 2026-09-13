import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import type { HashAlgorithm, Hasher } from "../../domain/ports/hasher.js";
import { translateFsError } from "./fs-errors.js";

const CHUNK_BYTES = 1024 * 1024;

export class NodeHasherAdapter implements Hasher {
  async hashFile(path: string, algorithm: HashAlgorithm, limitBytes = Number.POSITIVE_INFINITY): Promise<string> {
    const hash = createHash(algorithm);
    const handle = await open(path, "r").catch((error: unknown) => translateFsError(error, path));
    try {
      const buffer = new Uint8Array(CHUNK_BYTES);
      let total = 0;
      for (;;) {
        const wanted = Math.min(buffer.length, limitBytes - total);
        if (wanted <= 0) break;
        const { bytesRead } = await handle.read(buffer, 0, wanted, null);
        if (bytesRead === 0) break;
        hash.update(buffer.subarray(0, bytesRead));
        total += bytesRead;
      }
      return hash.digest("hex");
    } catch (error) {
      return translateFsError(error, path);
    } finally {
      await handle.close();
    }
  }
}
