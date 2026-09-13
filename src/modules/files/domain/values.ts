import { UsageError } from "../../../core/domain/errors.js";

const SIZE_UNITS: Readonly<Record<string, number>> = { "": 1, b: 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3, t: 1024 ** 4 };

/** "500", "10KB", "1.5 MB", "2g" -> bytes, with 1 KB = 1024 bytes. */
export function parseSize(text: string): number {
  const match = /^(\d+(?:[.]\d+)?)\s*([bkmgt]?)(?:i?b)?$/i.exec(text.trim());
  const unit = SIZE_UNITS[(match?.[2] ?? "").toLowerCase()];
  if (match === null || unit === undefined) throw new UsageError("files.value.size", { value: text });
  return Math.round(Number(match[1]) * unit);
}

const AGE_UNITS: Readonly<Record<string, number>> = {
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 7 * 86_400_000,
  y: 365 * 86_400_000,
};

/** "30m", "12h", "7d", "2w", "1y" before `now`, or a date such as 2026-01-31, as epoch milliseconds. */
export function parseTime(text: string, now: number): number {
  const age = /^(\d+)\s*([mhdwy])$/i.exec(text.trim());
  if (age !== null) return now - Number(age[1]) * (AGE_UNITS[(age[2] ?? "").toLowerCase()] ?? 0);
  const date = Date.parse(text);
  if (Number.isNaN(date)) throw new UsageError("files.value.time", { value: text });
  return date;
}
