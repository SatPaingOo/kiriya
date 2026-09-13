/** Raw deflate, as ZIP stores it. */
export interface Compression {
  deflateRaw(data: Uint8Array): Promise<Uint8Array>;
  /** OperationFailedError when the data is not valid deflate. */
  inflateRaw(data: Uint8Array): Promise<Uint8Array>;
}
