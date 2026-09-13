import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { isObject, type JsonObject } from "./protocol.js";

/** How long a question asked over MCP stays open for its answer. */
export const REQUEST_STATE_TTL_MS = 15 * 60_000;

/** A JSON value as text with its keys sorted, so equal arguments always give the same digest. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isObject(value)) {
    const members = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`);
    return `{${members.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Names one call: the tool and its arguments. */
export function callDigest(tool: string, args: unknown): string {
  return createHash("sha256")
    .update(`${tool}\n${canonical(args ?? {})}`)
    .digest("base64url");
}

/**
 * The opaque `requestState` of a multi round-trip request. The client carries it between
 * rounds, so it is signed with a secret of this process and dated: a state the process
 * did not issue, one that was altered, and one past its time are all rejected.
 */
export class RequestStates {
  constructor(
    private readonly secret: Uint8Array,
    private readonly now: () => number,
  ) {}

  issue(payload: JsonObject): string {
    const body = Buffer.from(JSON.stringify({ ...payload, expires: this.now() + REQUEST_STATE_TTL_MS })).toString(
      "base64url",
    );
    return `${body}.${this.sign(body)}`;
  }

  /** The payload, or null for a state that is forged, altered or expired. */
  read(state: unknown): JsonObject | null {
    if (typeof state !== "string") return null;
    const [body, signature, ...rest] = state.split(".");
    if (body === undefined || signature === undefined || rest.length > 0) return null;
    const expected = Buffer.from(this.sign(body));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    } catch {
      return null;
    }
    if (!isObject(payload)) return null;
    const expires = payload["expires"];
    return typeof expires === "number" && expires >= this.now() ? payload : null;
  }

  private sign(body: string): string {
    return createHmac("sha256", this.secret).update(body).digest("base64url");
  }
}
