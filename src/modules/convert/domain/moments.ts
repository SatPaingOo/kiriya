export const EPOCH_UNITS = ["auto", "seconds", "ms"] as const;
export type EpochUnit = (typeof EPOCH_UNITS)[number];

/** JavaScript dates reach 8.64e15 milliseconds either side of 1970. */
const LIMIT_MS = 8.64e15;

/**
 * A moment as epoch milliseconds, from a number or a date; null when it is neither.
 * With `auto`, numbers below 10^11 are seconds: 10^11 seconds is the year 5138,
 * while 10^11 milliseconds is only 1973.
 */
export function parseMoment(value: string, unit: EpochUnit): number | null {
  const trimmed = value.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const number = Number(trimmed);
    const seconds = unit === "seconds" || (unit === "auto" && Math.abs(number) < 1e11);
    const ms = Math.round(seconds ? number * 1000 : number);
    return Math.abs(ms) <= LIMIT_MS ? ms : null;
  }
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}
