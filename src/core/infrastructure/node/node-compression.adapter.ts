import { deflateRaw, inflateRaw } from "node:zlib";
import { OperationFailedError } from "../../domain/errors.js";
import type { Compression } from "../../domain/ports/compression.js";

export class NodeCompressionAdapter implements Compression {
  deflateRaw(data: Uint8Array): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      deflateRaw(data, { level: 6 }, (error, result) => {
        if (error === null) resolve(result);
        else reject(new OperationFailedError("core.compression.failed", { detail: error.message }, { cause: error }));
      });
    });
  }

  inflateRaw(data: Uint8Array): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      inflateRaw(data, (error, result) => {
        if (error === null) resolve(result);
        else reject(new OperationFailedError("core.compression.failed", { detail: error.message }, { cause: error }));
      });
    });
  }
}
