/** Compression applied piece by piece, so an archive never has to fit in memory. */
export interface CompressionStream {
  /** Takes the next input and returns the output that is ready, which may be nothing yet. */
  push(data: Uint8Array): Promise<Uint8Array>;
  /** Ends the input and returns the rest of the output; OperationFailedError when the data was damaged. */
  end(): Promise<Uint8Array>;
}

/** Raw deflate, as ZIP stores it, and gzip, as .tar.gz stores it. */
export interface Compression {
  deflateRaw(data: Uint8Array): Promise<Uint8Array>;
  /** OperationFailedError when the data is not valid deflate. */
  inflateRaw(data: Uint8Array): Promise<Uint8Array>;
  gzip(): CompressionStream;
  /** Its push or end fails with OperationFailedError when the data is not gzip. */
  gunzip(): CompressionStream;
}
