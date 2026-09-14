import { InterruptedError } from "../../../core/domain/errors.js";
import type { Clock } from "../../../core/domain/ports/clock.js";

/** The time between attempts. */
export const INTERVAL_MS = 500;
/** The least time an attempt is given, so the last one, made at the deadline, can still succeed. */
export const LEAST_ATTEMPT_MS = 250;

export interface Attempt<T> {
  readonly ready: boolean;
  readonly value: T;
}

export interface Polled<T> {
  readonly ready: boolean;
  /** What the last attempt found. */
  readonly last: T;
  readonly attempts: number;
  readonly waitedMs: number;
}

/**
 * Tries at once, then every INTERVAL_MS, until an attempt is ready or timeoutMs has passed.
 * Each attempt is told how long it may take. Aborting the signal throws InterruptedError.
 */
export async function poll<T>(
  clock: Clock,
  timeoutMs: number,
  signal: AbortSignal,
  attempt: (allowedMs: number) => Promise<Attempt<T>>,
): Promise<Polled<T>> {
  const started = clock.now();
  const deadline = started + timeoutMs;
  let attempts = 0;
  for (;;) {
    if (signal.aborted) throw new InterruptedError("core.error.interrupted");
    attempts += 1;
    const outcome = await attempt(Math.max(deadline - clock.now(), LEAST_ATTEMPT_MS));
    const left = deadline - clock.now();
    if (outcome.ready || left <= 0) {
      return { ready: outcome.ready, last: outcome.value, attempts, waitedMs: clock.now() - started };
    }
    await clock.sleep(Math.min(INTERVAL_MS, left), signal);
  }
}
