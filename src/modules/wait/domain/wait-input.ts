import { UsageError } from "../../../core/domain/errors.js";
import type { OptionSpec, RawReader } from "../../../core/domain/input-schema.js";
import { parseTarget, type Target } from "../../../core/domain/targets.js";

export const DEFAULT_TIMEOUT_SECONDS = 60;
export const MAX_TIMEOUT_SECONDS = 3_600;

export const TIMEOUT_OPTION: OptionSpec = {
  type: "string",
  description: "wait.option.timeout",
  valueName: "<seconds>",
};

/** --timeout in whole seconds: 60 by default, and at most an hour. */
export function readTimeout(reader: RawReader): number {
  const seconds = reader.positiveInteger("timeout", DEFAULT_TIMEOUT_SECONDS);
  if (seconds > MAX_TIMEOUT_SECONDS) throw new UsageError("wait.timeout-range", { max: MAX_TIMEOUT_SECONDS });
  return seconds;
}

/** A port on this machine, such as 5432, or what net check takes: host:port, [IPv6]:port or a URL; null for anything else. */
export function parsePortTarget(text: string): Target | null {
  const value = text.trim();
  if (!/^\d+$/.test(value)) return parseTarget(value);
  const port = Number(value);
  return value.length <= 5 && port >= 1 && port <= 65_535 ? { host: "localhost", port } : null;
}

/** An http or https address as the URL parser writes it; null for anything else. */
export function parseHttpAddress(text: string): string | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "" ? url.href : null;
}

/** The statuses --status names, each a code from 100 to 599. */
export function readStatuses(reader: RawReader): readonly number[] {
  return reader.strings("status").map((value) => {
    const status = Number(value);
    if (!/^\d{3}$/.test(value) || status < 100 || status > 599) {
      throw new UsageError("wait.url.bad-status", { value });
    }
    return status;
  });
}

/** Any 2xx status is ready, unless --status names the statuses that are. */
export function statusIsReady(status: number, wanted: readonly number[]): boolean {
  return wanted.length === 0 ? status >= 200 && status < 300 : wanted.includes(status);
}
