import type { CommandRegistry, RegisteredCommand } from "../../application/command-registry.js";
import { pathValues, type RootScope } from "../../application/root-scope.js";
import { KiriyaError } from "../../domain/errors.js";
import { message, type Message } from "../../domain/message.js";
import { byCodePoint } from "../../domain/names.js";
import type { Translator } from "../i18n/translator.js";
import { McpConfirmation } from "./mcp-confirmation.js";
import {
  INTERNAL_ERROR,
  INVALID_PARAMS,
  INVALID_REQUEST,
  isObject,
  LATEST_LEGACY_VERSION,
  LEGACY_VERSIONS,
  META_CLIENT_CAPABILITIES,
  META_PROTOCOL_VERSION,
  META_SERVER_INFO,
  METHOD_NOT_FOUND,
  MODERN_VERSIONS,
  PARSE_ERROR,
  ProtocolError,
  UNSUPPORTED_PROTOCOL_VERSION,
  type JsonObject,
  type RequestId,
} from "./protocol.js";
import { rawInputOf, toolDefinition, type ToolDefinition } from "./tool-definitions.js";
import { commandToolResult, errorToolResult, type ToolResult } from "./tool-results.js";

/** How long a client may keep the tool list, which changes only when the server starts again. */
const CACHE_TTL_MS = 300_000;
/** Output a program prints through a command, such as docker's logs, kept from its end. */
const OUTPUT_KEPT = 1_000_000;
const SERVER_CAPABILITIES = { tools: {} };

export interface McpServerOptions {
  readonly registry: CommandRegistry;
  readonly translator: Translator;
  readonly version: string;
  readonly scope: RootScope;
  /** The user's `mcp.allowWrite` setting: commands that change files become tools too. */
  readonly allowWrite: boolean;
  /** Sends one message to the client. */
  readonly send: (message: JsonObject) => void;
  /** Tells whoever reads the server's diagnostics, never the client. */
  readonly log: (message: Message) => void;
}

/** How a request is served: by its own `_meta`, or within the session `initialize` opened. */
interface Era {
  readonly modern: boolean;
  readonly capabilities: JsonObject;
}

interface Tool {
  readonly entry: RegisteredCommand;
  readonly definition: ToolDefinition;
}

/**
 * Read commands become tools, and write commands when the user allows it. A command that
 * runs a program the user names, or one only for a terminal, never does.
 */
function exposed(entry: RegisteredCommand, allowWrite: boolean): boolean {
  const { spec } = entry.command;
  if (spec.runsUserCommands || spec.terminalOnly === true) return false;
  return spec.safety === "read" || (spec.safety === "write" && allowWrite);
}

const keyOf = (id: RequestId): string => `${typeof id}:${id}`;

/**
 * The protocol, apart from how messages travel. It serves the 2026-07-28 version, whose
 * requests carry their own version, and the earlier ones, which begin with `initialize`.
 */
export class McpServer {
  private readonly tools = new Map<string, Tool>();
  private readonly running = new Map<string, AbortController>();
  private readonly pending = new Set<Promise<void>>();
  private legacy: Era | null = null;

  constructor(private readonly options: McpServerOptions) {
    const entries = options.registry
      .list()
      .flatMap((module) => [...module.commands.values()])
      .filter((entry) => exposed(entry, options.allowWrite))
      .sort((a, b) => byCodePoint(a.command.spec.id, b.command.spec.id));
    for (const entry of entries) {
      const { spec } = entry.command;
      try {
        this.tools.set(spec.id, { entry, definition: toolDefinition(spec, options.translator) });
      } catch (error) {
        options.log(message("core.mcp.tool-left-out", { tool: spec.id, detail: String(error) }));
      }
    }
  }

  /** One line from the client. Requests run side by side, and each answer is sent when it is ready. */
  receive(line: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      this.fail(null, new ProtocolError(PARSE_ERROR, message("core.mcp.error.parse")));
      return;
    }
    const invalid = new ProtocolError(INVALID_REQUEST, message("core.mcp.error.invalid-request"));
    if (!isObject(parsed) || parsed["jsonrpc"] !== "2.0") {
      this.fail(null, invalid);
      return;
    }
    const { id, method, params } = parsed;
    if (typeof method !== "string") {
      // A response: the server sends no requests of its own, so there is nothing to match it with.
      if (!("result" in parsed) && !("error" in parsed)) this.fail(null, invalid);
      return;
    }
    if (id === undefined) {
      this.notification(method, params);
      return;
    }
    if (typeof id !== "string" && typeof id !== "number") {
      this.fail(null, invalid);
      return;
    }
    const work: Promise<void> = this.request(id, method, params).finally(() => this.pending.delete(work));
    this.pending.add(work);
  }

  /** Stops every running command and waits for it, as when the client closes the connection. */
  async close(): Promise<void> {
    for (const controller of this.running.values()) controller.abort();
    await Promise.allSettled([...this.pending]);
  }

  private async request(id: RequestId, method: string, params: unknown): Promise<void> {
    const key = keyOf(id);
    const controller = new AbortController();
    this.running.set(key, controller);
    try {
      const result = await this.dispatch(method, params, controller.signal);
      if (!controller.signal.aborted) this.options.send({ jsonrpc: "2.0", id, result });
    } catch (error) {
      // A cancelled request gets no answer at all.
      if (controller.signal.aborted) return;
      if (error instanceof ProtocolError) {
        this.fail(id, error);
      } else {
        const detail = error instanceof Error ? error.message : String(error);
        this.fail(id, new ProtocolError(INTERNAL_ERROR, message("core.error.unexpected", { detail })));
      }
    } finally {
      if (this.running.get(key) === controller) this.running.delete(key);
    }
  }

  private async dispatch(method: string, params: unknown, signal: AbortSignal): Promise<JsonObject> {
    const given = params ?? {};
    if (!isObject(given)) throw new ProtocolError(INVALID_PARAMS, message("core.mcp.error.params-not-object"));
    switch (method) {
      case "initialize":
        return this.initialize(given);
      case "ping":
        return {};
      case "server/discover":
        return this.discover(given);
      case "tools/list":
        return this.listTools(this.era(given), given);
      case "tools/call":
        return this.callTool(this.era(given), given, signal);
      default:
        throw new ProtocolError(METHOD_NOT_FOUND, message("core.mcp.error.unknown-method", { method }));
    }
  }

  private notification(method: string, params: unknown): void {
    if (method !== "notifications/cancelled" || !isObject(params)) return;
    const { requestId } = params;
    if (typeof requestId === "string" || typeof requestId === "number") this.running.get(keyOf(requestId))?.abort();
  }

  /** A modern request names its version and capabilities in `_meta`; one without belongs to the legacy session. */
  private era(params: JsonObject): Era {
    const meta = metaOf(params);
    const version = meta[META_PROTOCOL_VERSION];
    if (version === undefined) {
      if (this.legacy !== null) return this.legacy;
      throw new ProtocolError(INVALID_PARAMS, message("core.mcp.error.no-version"));
    }
    if (typeof version !== "string" || !MODERN_VERSIONS.includes(version)) {
      throw new ProtocolError(
        UNSUPPORTED_PROTOCOL_VERSION,
        message("core.mcp.error.unsupported-version", { version: String(version) }),
        { supported: [...MODERN_VERSIONS, ...LEGACY_VERSIONS], requested: version },
      );
    }
    const capabilities = meta[META_CLIENT_CAPABILITIES];
    if (!isObject(capabilities)) throw new ProtocolError(INVALID_PARAMS, message("core.mcp.error.no-capabilities"));
    return { modern: true, capabilities };
  }

  /** The handshake of the versions before 2026-07-28. The session it opens lasts as long as the process. */
  private initialize(params: JsonObject): JsonObject {
    const requested = params["protocolVersion"];
    const capabilities = params["capabilities"];
    this.legacy = { modern: false, capabilities: isObject(capabilities) ? capabilities : {} };
    return {
      protocolVersion:
        typeof requested === "string" && LEGACY_VERSIONS.includes(requested) ? requested : LATEST_LEGACY_VERSION,
      capabilities: SERVER_CAPABILITIES,
      serverInfo: this.serverInfo(),
      instructions: this.instructions(),
    };
  }

  /** Answers with or without `_meta`, since a client may probe with it; a version it names must still be supported. */
  private discover(params: JsonObject): JsonObject {
    if (metaOf(params)[META_PROTOCOL_VERSION] !== undefined) this.era(params);
    return this.complete(
      { modern: true, capabilities: {} },
      {
        supportedVersions: [...MODERN_VERSIONS],
        capabilities: SERVER_CAPABILITIES,
        instructions: this.instructions(),
        ttlMs: CACHE_TTL_MS,
        cacheScope: "private",
      },
    );
  }

  private listTools(era: Era, params: JsonObject): JsonObject {
    if (params["cursor"] !== undefined)
      throw new ProtocolError(INVALID_PARAMS, message("core.mcp.error.unknown-cursor"));
    const tools = [...this.tools.values()].map((tool) => tool.definition);
    return this.complete(era, era.modern ? { tools, ttlMs: CACHE_TTL_MS, cacheScope: "private" } : { tools });
  }

  /**
   * Runs the command as the CLI would, inside the roots. A failure the model can correct,
   * such as a bad value or a refused path, is a result with `isError`; an unknown tool is a protocol error.
   */
  private async callTool(era: Era, params: JsonObject, signal: AbortSignal): Promise<JsonObject> {
    const name = params["name"];
    if (typeof name !== "string") throw new ProtocolError(INVALID_PARAMS, message("core.mcp.error.no-tool-name"));
    const tool = this.tools.get(name);
    if (tool === undefined) throw new ProtocolError(INVALID_PARAMS, message("core.mcp.error.unknown-tool", { name }));

    const { command } = tool.entry;
    const { scope, translator, allowWrite } = this.options;
    let output = "";
    let result: ToolResult;
    try {
      const raw = rawInputOf(command.spec.input, params["arguments"]);
      await scope.refuseOutside(pathValues(command.spec.input, raw), command.spec.safety !== "read");
      const input = command.spec.input.parse(raw);
      const outcome = await command.execute(input, {
        cwd: scope.start,
        signal,
        confirmation: new McpConfirmation(allowWrite),
        passthrough: {
          write: (text) => {
            output = (output + text).slice(-OUTPUT_KEPT);
          },
        },
      });
      result = commandToolResult(command.spec.id, outcome, output, translator);
    } catch (error) {
      if (!(error instanceof KiriyaError)) throw error;
      result = errorToolResult(error, translator);
    }
    return this.complete(era, { ...result });
  }

  /** Results of the modern version say they are complete and name the server. */
  private complete(era: Era, body: JsonObject): JsonObject {
    return era.modern ? { resultType: "complete", ...body, _meta: { [META_SERVER_INFO]: this.serverInfo() } } : body;
  }

  private serverInfo(): JsonObject {
    return { name: "kiriya", version: this.options.version };
  }

  private instructions(): string {
    const { scope, translator, allowWrite } = this.options;
    const tools = message(allowWrite ? "core.mcp.instructions.write" : "core.mcp.instructions.read-only");
    return translator.text(
      message("core.mcp.instructions", { tools, start: scope.start, roots: scope.roots.join(", ") }),
    );
  }

  private fail(id: RequestId | null, error: ProtocolError): void {
    const detail = { code: error.code, message: this.options.translator.text(error.detail) };
    this.options.send({
      jsonrpc: "2.0",
      id,
      error: error.data === undefined ? detail : { ...detail, data: error.data },
    });
  }
}

function metaOf(params: JsonObject): JsonObject {
  const meta = params["_meta"];
  return isObject(meta) ? meta : {};
}
