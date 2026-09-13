import type { Clock } from "../../domain/ports/clock.js";

export class SystemClockAdapter implements Clock {
  now(): number {
    return Date.now();
  }
}
