/** The operating system's cryptographically secure random bytes. Tests inject a predictable source. */
export interface RandomSource {
  bytes(count: number): Uint8Array;
}
