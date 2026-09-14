import { InterruptedError } from "../../domain/errors.js";
import type { Clock } from "../../domain/ports/clock.js";

export class SystemClockAdapter implements Clock {
  now(): number {
    return Date.now();
  }

  sleep(ms: number, signal: AbortSignal): Promise<void> {
    if (signal.aborted) return Promise.reject(new InterruptedError("core.error.interrupted"));
    return new Promise((resolve, reject) => {
      const onAbort = (): void => {
        clearTimeout(timer);
        reject(new InterruptedError("core.error.interrupted"));
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }
}
