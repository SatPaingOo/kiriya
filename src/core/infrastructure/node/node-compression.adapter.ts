import type { Transform } from "node:stream";
import { createGunzip, createGzip, deflateRaw, inflateRaw } from "node:zlib";
import { OperationFailedError } from "../../domain/errors.js";
import type { Compression, CompressionStream } from "../../domain/ports/compression.js";

function failed(error: Error): OperationFailedError {
  return new OperationFailedError("core.compression.failed", { detail: error.message }, { cause: error });
}

/** A zlib transform whose output is collected as it arrives and handed back on each push. */
class ZlibStream implements CompressionStream {
  private ready: Buffer[] = [];
  private failure: Error | null = null;
  private readonly finished: Promise<void>;

  constructor(private readonly transform: Transform) {
    transform.on("data", (chunk: Buffer) => this.ready.push(chunk));
    this.finished = new Promise((resolve) => {
      transform.once("end", () => resolve());
      transform.once("error", (error) => {
        this.failure = error;
        resolve();
      });
    });
  }

  push(data: Uint8Array): Promise<Uint8Array> {
    if (this.failure !== null) return Promise.reject(failed(this.failure));
    return new Promise((resolve, reject) => {
      // zlib destroys itself on damaged data without calling back the write in progress, so its error settles this too.
      const onError = (error: Error): void => reject(failed(error));
      this.transform.once("error", onError);
      this.transform.write(data, (error) => {
        this.transform.off("error", onError);
        const problem = error ?? this.failure;
        if (problem === null || problem === undefined) resolve(this.take());
        else reject(failed(problem));
      });
    });
  }

  async end(): Promise<Uint8Array> {
    if (this.failure === null) this.transform.end();
    await this.finished;
    if (this.failure !== null) throw failed(this.failure);
    return this.take();
  }

  private take(): Uint8Array {
    const output = Buffer.concat(this.ready);
    this.ready = [];
    return output;
  }
}

export class NodeCompressionAdapter implements Compression {
  deflateRaw(data: Uint8Array): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      deflateRaw(data, { level: 6 }, (error, result) => {
        if (error === null) resolve(result);
        else reject(failed(error));
      });
    });
  }

  inflateRaw(data: Uint8Array): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      inflateRaw(data, (error, result) => {
        if (error === null) resolve(result);
        else reject(failed(error));
      });
    });
  }

  gzip(): CompressionStream {
    return new ZlibStream(createGzip({ level: 6 }));
  }

  gunzip(): CompressionStream {
    return new ZlibStream(createGunzip());
  }
}
