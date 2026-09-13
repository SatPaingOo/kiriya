import { fromBase64, utf8Text } from "../../../core/domain/encodings.js";

export type JsonObject = Readonly<Record<string, unknown>>;

export interface DecodedJwt {
  readonly header: JsonObject;
  readonly payload: JsonObject;
}

function jsonObject(segment: string): JsonObject | null {
  const bytes = fromBase64(segment);
  const text = bytes === null ? null : utf8Text(bytes);
  if (text === null) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as JsonObject) : null;
  } catch {
    return null;
  }
}

/** A JWT's header and payload, without looking at its signature; null when it is not a JWT. */
export function decodeJwt(token: string): DecodedJwt | null {
  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;
  const header = jsonObject(parts[0] ?? "");
  const payload = jsonObject(parts[1] ?? "");
  return header === null || payload === null ? null : { header, payload };
}

/** A NumericDate claim such as `exp`, in seconds, as epoch milliseconds; null when absent or not a number. */
export function claimTime(payload: JsonObject, claim: string): number | null {
  const value = payload[claim];
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 1000) : null;
}
