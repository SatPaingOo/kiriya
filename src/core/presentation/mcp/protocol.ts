/**
 * The parts of the Model Context Protocol kiriya's server relies on, checked against
 * the 2026-07-28 specification and its schema.
 */
import type { Message } from "../../domain/message.js";

/** Versions whose every request carries its version and client capabilities in `_meta`. */
export const MODERN_VERSIONS: readonly string[] = ["2026-07-28"];
/** Versions that open with the `initialize` handshake, newest first. */
export const LEGACY_VERSIONS: readonly string[] = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
export const LATEST_LEGACY_VERSION = "2025-11-25";

export const META_PROTOCOL_VERSION = "io.modelcontextprotocol/protocolVersion";
export const META_CLIENT_CAPABILITIES = "io.modelcontextprotocol/clientCapabilities";
export const META_SERVER_INFO = "io.modelcontextprotocol/serverInfo";

export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;
export const MISSING_REQUIRED_CLIENT_CAPABILITY = -32021;
export const UNSUPPORTED_PROTOCOL_VERSION = -32022;

export type RequestId = string | number;
export type JsonObject = { [key: string]: unknown };

export function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A request the server answers with a JSON-RPC error instead of a result. */
export class ProtocolError extends Error {
  constructor(
    readonly code: number,
    readonly detail: Message,
    readonly data?: unknown,
  ) {
    super(detail.key);
    this.name = "ProtocolError";
  }
}
