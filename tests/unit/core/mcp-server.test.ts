import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { CommandRegistry } from "../../../src/core/application/command-registry.js";
import { RootScope } from "../../../src/core/application/root-scope.js";
import { done, type Command, type CommandSpec } from "../../../src/core/domain/command.js";
import { RefusedError } from "../../../src/core/domain/errors.js";
import { message, type Message } from "../../../src/core/domain/message.js";
import type { CorePorts } from "../../../src/core/domain/module.js";
import type { FileSystem } from "../../../src/core/domain/ports/file-system.js";
import { Translator } from "../../../src/core/presentation/i18n/translator.js";
import { McpServer } from "../../../src/core/presentation/mcp/mcp-server.js";
import type { JsonObject, RequestId } from "../../../src/core/presentation/mcp/protocol.js";
import { en } from "../../../src/i18n/locales/en.js";

const ROOT = path.resolve(path.sep, "work");
const MODERN = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {},
};

/** Every folder exists as itself, which is all the root checks need. */
const plainFileSystem = {
  stat: () => Promise.resolve({ kind: "directory" }),
  lstat: () => Promise.resolve(null),
  realPath: (target: string) => Promise.resolve(target),
} as unknown as FileSystem;

function command(
  spec: Partial<CommandSpec<unknown>> & { readonly id: string },
  execute: Command<unknown, unknown>["execute"] = () => Promise.resolve(done({})),
): Command<unknown, unknown> {
  return {
    spec: {
      summary: "files.list.summary",
      examples: [],
      safety: "read",
      idempotent: true,
      usesNetwork: false,
      runsUserCommands: false,
      input: {
        positionals: [
          { name: "path", description: "files.list.arg.path", required: false, variadic: false, path: true },
        ],
        options: {},
        parse: (raw) => raw,
      },
      ...spec,
    },
    execute,
  };
}

async function serve(): Promise<{ server: McpServer; sent: JsonObject[]; logged: Message[]; ran: string[] }> {
  const ran: string[] = [];
  const registry = new CommandRegistry();
  registry.register(
    {
      id: "files",
      summary: "files.summary",
      register(registrar) {
        const list = command({ id: "files.list" }, (input, context) => {
          ran.push(`files.list in ${context.cwd}`);
          return Promise.resolve(done({ input }));
        });
        const wait = command({ id: "files.wait", idempotent: false, usesNetwork: true }, (_input, context) => {
          return new Promise((resolve) => {
            const stop = (): void => {
              ran.push("files.wait stopped");
              resolve(done({}));
            };
            if (context.signal.aborted) stop();
            else context.signal.addEventListener("abort", stop, { once: true });
          });
        });
        const clash = command({
          id: "files.clash",
          input: {
            positionals: [{ name: "all", description: "files.list.arg.path", required: false, variadic: false }],
            options: { all: { type: "boolean", description: "files.option.all" } },
            parse: (raw) => raw,
          },
        });
        registrar.add(list, () => []);
        registrar.add(wait, () => []);
        registrar.add(clash, () => []);
        registrar.add(
          command({ id: "files.fail" }, () => Promise.reject(new RefusedError("core.confirm.declined"))),
          () => [],
        );
        registrar.add(command({ id: "files.copy", safety: "write" }), () => []);
        registrar.add(command({ id: "files.delete", safety: "destroy" }), () => []);
        registrar.add(command({ id: "files.watch", runsUserCommands: true }), () => []);
      },
    },
    {} as CorePorts,
  );

  const sent: JsonObject[] = [];
  const logged: Message[] = [];
  const server = new McpServer({
    registry,
    translator: new Translator(en),
    version: "9.9.9",
    scope: await RootScope.open(plainFileSystem, [], ROOT),
    send: (item) => sent.push(item),
    log: (item) => logged.push(item),
  });
  return { server, sent, logged, ran };
}

/** Sends one line and waits for the answer with the expected id; undefined when none comes. */
async function exchange(
  server: McpServer,
  sent: JsonObject[],
  line: string | JsonObject,
  expectedId: RequestId | null = typeof line === "string" ? null : ((line["id"] as RequestId | undefined) ?? null),
): Promise<JsonObject | undefined> {
  server.receive(typeof line === "string" ? line : JSON.stringify(line));
  for (let turn = 0; turn < 50; turn += 1) {
    const index = sent.findIndex((item) => item["id"] === expectedId);
    if (index >= 0) return sent.splice(index, 1)[0];
    await new Promise((resolve) => setImmediate(resolve));
  }
  return undefined;
}

const resultOf = (answer: JsonObject | undefined): JsonObject => answer?.["result"] as JsonObject;
const errorOf = (answer: JsonObject | undefined): { code: number; message: string; data?: unknown } =>
  answer?.["error"] as { code: number; message: string; data?: unknown };

function callTool(id: RequestId, name: string, args: JsonObject = {}): JsonObject {
  return { jsonrpc: "2.0", id, method: "tools/call", params: { _meta: MODERN, name, arguments: args } };
}

test("server/discover names the modern version, the tools capability and the server", async () => {
  const { server, sent } = await serve();
  const answer = await exchange(server, sent, {
    jsonrpc: "2.0",
    id: 1,
    method: "server/discover",
    params: { _meta: MODERN },
  });
  assert.deepEqual(answer, {
    jsonrpc: "2.0",
    id: 1,
    result: {
      resultType: "complete",
      supportedVersions: ["2026-07-28"],
      capabilities: { tools: {} },
      instructions: new Translator(en).text(message("core.mcp.instructions", { start: ROOT, roots: ROOT })),
      ttlMs: 300_000,
      cacheScope: "private",
      _meta: { "io.modelcontextprotocol/serverInfo": { name: "kiriya", version: "9.9.9" } },
    },
  });
});

test("tools/list offers read commands in code-point order with all four annotations, and keeps back the rest", async () => {
  const { server, sent, logged } = await serve();
  const answer = await exchange(server, sent, {
    jsonrpc: "2.0",
    id: "list",
    method: "tools/list",
    params: { _meta: MODERN },
  });
  const listed = resultOf(answer) as { tools: Array<{ name: string; annotations: unknown }> } & JsonObject;
  assert.deepEqual(
    listed.tools.map((tool) => tool.name),
    ["files.fail", "files.list", "files.wait"],
  );
  assert.deepEqual(listed.tools[2]?.annotations, {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  });
  assert.deepEqual([listed["resultType"], listed["ttlMs"], listed["cacheScope"]], ["complete", 300_000, "private"]);
  assert.deepEqual(
    logged.map((item) => [item.key, item.params["tool"]]),
    [["core.mcp.tool-left-out", "files.clash"]],
  );
});

test("a request without a version, with one the server lacks, or without capabilities is refused before it runs", async () => {
  const { server, sent, ran } = await serve();
  const withMeta = (id: number, meta: JsonObject | undefined): JsonObject => ({
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name: "files.list", arguments: {}, ...(meta === undefined ? {} : { _meta: meta }) },
  });
  assert.equal(errorOf(await exchange(server, sent, withMeta(1, undefined))).code, -32602);
  const unsupported = errorOf(
    await exchange(server, sent, withMeta(2, { ...MODERN, "io.modelcontextprotocol/protocolVersion": "1900-01-01" })),
  );
  assert.equal(unsupported.code, -32022);
  assert.deepEqual(unsupported.data, {
    supported: ["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"],
    requested: "1900-01-01",
  });
  const noCapabilities = withMeta(3, { "io.modelcontextprotocol/protocolVersion": "2026-07-28" });
  assert.equal(errorOf(await exchange(server, sent, noCapabilities)).code, -32602);
  assert.deepEqual(ran, []);
});

test("a client of an earlier version opens with initialize and is then served without _meta", async () => {
  const { server, sent } = await serve();
  const opened = resultOf(
    await exchange(server, sent, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "old", version: "1" } },
    }),
  );
  assert.equal(opened["protocolVersion"], "2025-06-18");
  assert.deepEqual(opened["capabilities"], { tools: {} });
  assert.deepEqual(opened["serverInfo"], { name: "kiriya", version: "9.9.9" });
  assert.equal(await exchange(server, sent, { jsonrpc: "2.0", method: "notifications/initialized" }), undefined);

  const listed = resultOf(await exchange(server, sent, { jsonrpc: "2.0", id: 2, method: "tools/list" }));
  assert.equal(listed["resultType"], undefined);
  assert.equal((listed["tools"] as unknown[]).length, 3);
  const called = resultOf(
    await exchange(server, sent, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "files.list" } }),
  );
  assert.deepEqual([called["resultType"], called["isError"]], [undefined, false]);

  const newer = await exchange(server, sent, {
    jsonrpc: "2.0",
    id: 4,
    method: "initialize",
    params: { protocolVersion: "2099-01-01" },
  });
  assert.equal(resultOf(newer)["protocolVersion"], "2025-11-25");
});

test("tools/call runs the command at the root and answers with its JSON document, repeated as text", async () => {
  const { server, sent, ran } = await serve();
  const result = resultOf(await exchange(server, sent, callTool(5, "files.list", { path: "src" })));
  assert.deepEqual(ran, [`files.list in ${ROOT}`]);
  assert.deepEqual([result["resultType"], result["isError"]], ["complete", false]);
  assert.deepEqual(result["structuredContent"], {
    ok: true,
    command: "files.list",
    kind: "done",
    data: { input: { positionals: ["src"], options: {} } },
    warnings: [],
    failures: [],
  });
  assert.deepEqual(result["content"], [{ type: "text", text: JSON.stringify(result["structuredContent"]) }]);
});

test("a refused command, a bad argument and a path outside the root are error results, and nothing runs outside", async () => {
  const { server, sent, ran } = await serve();
  const errorIn = async (line: JsonObject): Promise<{ kind: string; message: { key: string } }> => {
    const result = resultOf(await exchange(server, sent, line));
    assert.equal(result["isError"], true);
    return (result["structuredContent"] as JsonObject)["error"] as { kind: string; message: { key: string } };
  };
  assert.equal((await errorIn(callTool(1, "files.fail"))).kind, "refused");
  assert.equal((await errorIn(callTool(2, "files.list", { nope: true }))).message.key, "core.mcp.unknown-argument");
  const outside = await errorIn(callTool(3, "files.list", { path: "../etc" }));
  assert.deepEqual([outside.kind, outside.message.key], ["refused", "core.mcp.outside-roots"]);
  assert.deepEqual(ran, []);
});

test("an unknown tool, or one kept back, is a protocol error", async () => {
  const { server, sent } = await serve();
  for (const [index, name] of ["files.nope", "files.copy", "files.delete", "files.watch", "files.clash"].entries()) {
    const error = errorOf(await exchange(server, sent, callTool(index, name)));
    assert.deepEqual([error.code, error.message], [-32602, `Unknown tool: ${name}`]);
  }
});

test("a cancelled call stops its command and gets no answer, and the server goes on", async () => {
  const { server, sent, ran } = await serve();
  server.receive(JSON.stringify(callTool(9, "files.wait")));
  const cancel = { jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 9, reason: "user" } };
  assert.equal(await exchange(server, sent, cancel), undefined);
  assert.deepEqual(ran, ["files.wait stopped"]);
  assert.deepEqual(sent, []);
  assert.deepEqual(await exchange(server, sent, { jsonrpc: "2.0", id: 10, method: "ping" }), {
    jsonrpc: "2.0",
    id: 10,
    result: {},
  });
});

test("closing the server stops what is running", async () => {
  const { server, sent, ran } = await serve();
  server.receive(JSON.stringify(callTool(1, "files.wait")));
  await new Promise((resolve) => setImmediate(resolve));
  await server.close();
  assert.deepEqual(ran, ["files.wait stopped"]);
  assert.deepEqual(sent, []);
});

test("malformed messages get JSON-RPC errors, while notifications and responses get nothing", async () => {
  const { server, sent } = await serve();
  assert.deepEqual(await exchange(server, sent, "{not json"), {
    jsonrpc: "2.0",
    id: null,
    error: { code: -32700, message: "The message is not valid JSON" },
  });
  assert.equal(errorOf(await exchange(server, sent, { id: 1, method: "ping" }, null)).code, -32600);
  assert.equal(errorOf(await exchange(server, sent, { jsonrpc: "2.0", id: 2, method: "resources/list" })).code, -32601);
  const badParams = { jsonrpc: "2.0", id: 3, method: "tools/list", params: [] };
  assert.equal(errorOf(await exchange(server, sent, badParams)).code, -32602);
  const cursor = { jsonrpc: "2.0", id: 4, method: "tools/list", params: { _meta: MODERN, cursor: "2" } };
  assert.equal(errorOf(await exchange(server, sent, cursor)).code, -32602);
  assert.equal(await exchange(server, sent, { jsonrpc: "2.0", method: "notifications/unknown" }), undefined);
  assert.equal(await exchange(server, sent, { jsonrpc: "2.0", id: 5, result: {} }), undefined);
  assert.deepEqual(sent, []);
});
