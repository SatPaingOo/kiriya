export interface Clock {
  /** Milliseconds since the epoch. */
  now(): number;
  /** Resolves after `ms` milliseconds. Aborting the signal throws InterruptedError at once. */
  sleep(ms: number, signal: AbortSignal): Promise<void>;
}
