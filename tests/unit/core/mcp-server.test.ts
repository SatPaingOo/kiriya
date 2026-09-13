import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { CommandRegistry } from "../../../src/core/application/command-registry.js";
import { RootScope } from "../../../src/core/application/root-scope.js";
import { requireApproval, requireTypedConfirmation } from "../../../src/core/application/safety.js";
import { done, type Command, type CommandSpec } from "../../../src/core/domain/command.js";
import { RefusedError } from "../../../src/core/domain/errors.js";
import type { PositionalSpec, RawInput } from "../../../src/core/domain/input-schema.js";
import { message, type Message } from "../../../src/core/domain/message.js";
import type { CorePorts } from "../../../src/core/domain/module.js";
import type { FileSystem } from "../../../src/core/domain/ports/file-system.js";
import { Translator } from "../../../src/core/presentation/i18n/translator.js";
import { McpServer } from "../../../src/core/presentation/mcp/mcp-server.js";
import type { JsonObject, RequestId } from "../../../src/core/presentation/mcp/protocol.js";
import { REQUEST_STATE_TTL_MS } from "../../../src/core/presentation/mcp/request-state.js";
import { en } from "../../../src/i18n/locales/en.js";

const ROOT = path.resolve(path.sep, "work");
const CONFIG = path.join(ROOT, "kiriya", "config.json");
const MODERN: JsonObject = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {},
};
/** A modern client that can ask its user in form mode. */
const ELICITING: JsonObject = { ...MODERN, "io.modelcontextprotocol/clientCapabilities": { elicitation: {} } };

/** Every folder exists as itself, which is all the root checks need. */
const plainFileSystem = {
  stat: () => Promise.resolve({ kind: "directory" }),
  lstat: () => Promise.resolve(null),
  realPath: (target: string) => Promise.resolve(target),
} as unknown as FileSystem;

const pathInput: PositionalSpec = {
  name: "path",
  description: "files.list.arg.path",
  required: false,
  variadic: false,
  path: true,
};

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
      input: { positionals: [pathInput], options: {}, parse: (raw) => raw },
      ...spec,
    },
    execute,
  };
}

interface Served {
  readonly server: McpServer;
  readonly sent: JsonObject[];
  readonly logged: Message[];
  readonly ran: string[];
  readonly clock: { now: number };
}

async function serve(settings: { allowWrite?: boolean; allowDestroy?: boolean } = {}): Promise<Served> {
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
        const move = command(
          {
            id: "files.move",
            safety: "write",
            input: {
              positionals: [pathInput],
              options: { overwrite: { type: "boolean", description: "files.transfer.option.overwrite" } },
              parse: (raw) => raw,
            },
          },
          async (input, context) => {
            await requireApproval(context, message("files.rename.ask", { count: 1 }), false);
            ran.push("files.move approved");
            if ((input as RawInput).options["overwrite"] === true) {
              await requireTypedConfirmation(context, message("files.rename.ask", { count: 1 }), "1", undefined);
            }
            return done({});
          },
        );
        const remove = command(
          {
            id: "files.delete",
            safety: "destroy",
            input: {
              positionals: [pathInput],
              options: { permanent: { type: "boolean", description: "files.delete.option.permanent" } },
              parse: (raw) => raw,
            },
          },
          async (input, context) => {
            if ((input as RawInput).options["permanent"] === true) {
              await requireTypedConfirmation(context, message("files.rename.ask", { count: 1 }), "1", undefined);
              ran.push("files.delete removed");
            } else {
              await requireApproval(context, message("files.rename.ask", { count: 1 }), false);
              ran.push("files.delete trashed");
            }
            return done({});
          },
        );
        registrar.add(list, () => []);
        registrar.add(wait, () => []);
        registrar.add(clash, () => []);
        registrar.add(move, () => []);
        registrar.add(remove, () => []);
        registrar.add(command({ id: "files.secret", terminalOnly: true }), () => []);
        registrar.add(command({ id: "files.peek", sensitive: true }), () => []);
        registrar.add(
          command({ id: "files.fail" }, () => Promise.reject(new RefusedError("core.confirm.declined"))),
          () => [],
        );
        registrar.add(command({ id: "files.copy", safety: "write" }), () => []);
        registrar.add(command({ id: "files.watch", runsUserCommands: true }), () => []);
      },
    },
    {} as CorePorts,
  );

  const sent: JsonObject[] = [];
  const logged: Message[] = [];
  const clock = { now: 1_000_000 };
  const server = new McpServer({
    registry,
    translator: new Translator(en),
    version: "9.9.9",
    scope: await RootScope.open(plainFileSystem, [], ROOT, [CONFIG]),
    allowWrite: settings.allowWrite ?? false,
    allowDestroy: settings.allowDestroy ?? false,
    secret: new Uint8Array(32).fill(7),
    now: () => clock.now,
    send: (item) => sent.push(item),
    log: (item) => logged.push(item),
  });
  return { server, sent, logged, ran, clock };
}

/** Waits for a message the server sent that matches; undefined when none comes. */
async function waitFor(sent: JsonObject[], match: (item: JsonObject) => boolean): Promise<JsonObject | undefined> {
  for (let turn = 0; turn < 50; turn += 1) {
    const index = sent.findIndex(match);
    if (index >= 0) return sent.splice(index, 1)[0];
    await new Promise((resolve) => setImmediate(resolve));
  }
  return undefined;
}

/** Sends one line and waits for the answer with the expected id; undefined when none comes. */
function exchange(
  server: McpServer,
  sent: JsonObject[],
  line: string | JsonObject,
  expectedId: RequestId | null = typeof line === "string" ? null : ((line["id"] as RequestId | undefined) ?? null),
): Promise<JsonObject | undefined> {
  server.receive(typeof line === "string" ? line : JSON.stringify(line));
  return waitFor(sent, (item) => item["id"] === expectedId && !("method" in item));
}

const resultOf = (answer: JsonObject | undefined): JsonObject => answer?.["result"] as JsonObject;
const errorOf = (answer: JsonObject | undefined): { code: number; message: string; data?: unknown } =>
  answer?.["error"] as { code: number; message: string; data?: unknown };
const errorKeyOf = (result: JsonObject): string =>
  ((result["structuredContent"] as JsonObject)["error"] as { message: { key: string } }).message.key;

function callTool(
  id: RequestId,
  name: string,
  args: JsonObject = {},
  meta: JsonObject = MODERN,
  more = {},
): JsonObject {
  return { jsonrpc: "2.0", id, method: "tools/call", params: { _meta: meta, name, arguments: args, ...more } };
}

async function toolNames(served: Served, id: RequestId, meta: JsonObject): Promise<string[]> {
  const answer = await exchange(served.server, served.sent, {
    jsonrpc: "2.0",
    id,
    method: "tools/list",
    params: { _meta: meta },
  });
  return (resultOf(answer)["tools"] as Array<{ name: string }>).map((tool) => tool.name);
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
      instructions: new Translator(en).text(
        message("core.mcp.instructions", {
          tools: message("core.mcp.instructions.read-only"),
          start: ROOT,
          roots: ROOT,
        }),
      ),
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
    params: { _meta: ELICITING },
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
  const names = [
    "files.nope",
    "files.copy",
    "files.delete",
    "files.watch",
    "files.clash",
    "files.secret",
    "files.peek",
    "files.move",
  ];
  for (const [index, name] of names.entries()) {
    const error = errorOf(await exchange(server, sent, callTool(index, name, {}, ELICITING)));
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

test("with mcp.allowWrite, write tools are offered and their questions answered, but work that cannot be undone is refused", async () => {
  const served = await serve({ allowWrite: true });
  const { server, sent, ran } = served;
  assert.deepEqual(await toolNames(served, 1, ELICITING), [
    "files.copy",
    "files.fail",
    "files.list",
    "files.move",
    "files.peek",
    "files.wait",
  ]);
  assert.equal(resultOf(await exchange(server, sent, callTool(2, "files.move", { path: "a" })))["isError"], false);
  const overwrite = resultOf(await exchange(server, sent, callTool(3, "files.move", { path: "a", overwrite: true })));
  assert.equal(overwrite["isError"], true);
  assert.equal(errorKeyOf(overwrite), "core.mcp.cannot-confirm");
  assert.deepEqual(ran, ["files.move approved", "files.move approved"]);
});

test("work that changes something may not reach kiriya's configuration file, while reading it may", async () => {
  const { server, sent, ran } = await serve({ allowWrite: true });
  for (const [id, value] of ["kiriya/config.json", "kiriya", "."].entries()) {
    const refused = resultOf(await exchange(server, sent, callTool(id, "files.move", { path: value })));
    assert.equal(errorKeyOf(refused), "core.mcp.guarded", value);
  }
  const read = resultOf(await exchange(server, sent, callTool(9, "files.list", { path: "kiriya/config.json" })));
  assert.equal(read["isError"], false);
  assert.deepEqual(ran, [`files.list in ${ROOT}`]);
});

test("a client that cannot ask its user in form mode is never offered a destroy tool, and a call names what it lacks", async () => {
  const served = await serve({ allowDestroy: true });
  const urlOnly = { ...MODERN, "io.modelcontextprotocol/clientCapabilities": { elicitation: { url: {} } } };
  assert.ok(!(await toolNames(served, 1, MODERN)).includes("files.delete"));
  assert.ok(!(await toolNames(served, 2, urlOnly)).includes("files.delete"));
  assert.ok((await toolNames(served, 3, ELICITING)).includes("files.delete"));

  const error = errorOf(await exchange(served.server, served.sent, callTool(4, "files.delete", { path: "old" })));
  assert.equal(error.code, -32021);
  assert.deepEqual(error.data, { requiredCapabilities: { elicitation: { form: {} } } });
  assert.deepEqual(served.ran, []);
});

test("over 2026-07-28 a destroy tool asks in its result, and runs only when a retry brings back the typed value", async () => {
  const { server, sent, ran } = await serve({ allowDestroy: true });
  const args = { path: "old", permanent: true };
  const first = resultOf(await exchange(server, sent, callTool(1, "files.delete", args, ELICITING)));
  assert.equal(first["resultType"], "input_required");
  const request = (first["inputRequests"] as JsonObject)["confirm-1"] as {
    method: string;
    params: { mode: string; message: string; requestedSchema: JsonObject };
  };
  assert.deepEqual([request.method, request.params.mode], ["elicitation/create", "form"]);
  assert.match(request.params.message, /Type 1 to go ahead\./);
  assert.deepEqual(request.params.requestedSchema["required"], ["value"]);
  assert.equal(typeof first["requestState"], "string");
  assert.deepEqual(ran, []);

  const retry = async (id: number, response?: JsonObject): Promise<JsonObject> => {
    const more = {
      requestState: first["requestState"],
      ...(response === undefined ? {} : { inputResponses: { "confirm-1": response } }),
    };
    return resultOf(await exchange(server, sent, callTool(id, "files.delete", args, ELICITING, more)));
  };
  assert.equal(errorKeyOf(await retry(2, { action: "accept", content: { value: "2" } })), "core.confirm.declined");
  assert.equal(errorKeyOf(await retry(3, { action: "decline" })), "core.confirm.declined");
  assert.equal((await retry(4))["resultType"], "input_required");
  assert.deepEqual(ran, []);

  const accepted = await retry(5, { action: "accept", content: { value: " 1 " } });
  assert.deepEqual([accepted["resultType"], accepted["isError"]], ["complete", false]);
  assert.deepEqual(ran, ["files.delete removed"]);
});

test("even a destroy tool's yes-or-no question goes to the user", async () => {
  const { server, sent, ran } = await serve({ allowDestroy: true });
  const first = resultOf(await exchange(server, sent, callTool(1, "files.delete", { path: "old" }, ELICITING)));
  const request = (first["inputRequests"] as JsonObject)["confirm-1"] as { params: { requestedSchema: JsonObject } };
  assert.deepEqual(request.params.requestedSchema, { type: "object", properties: {} });
  assert.deepEqual(ran, []);

  const more = { requestState: first["requestState"], inputResponses: { "confirm-1": { action: "accept" } } };
  const accepted = resultOf(
    await exchange(server, sent, callTool(2, "files.delete", { path: "old" }, ELICITING, more)),
  );
  assert.equal(accepted["isError"], false);
  assert.deepEqual(ran, ["files.delete trashed"]);
});

test("a request state that was altered, belongs to other arguments or has expired is refused", async () => {
  const { server, sent, clock, ran } = await serve({ allowDestroy: true });
  const args = { path: "old", permanent: true };
  const first = resultOf(await exchange(server, sent, callTool(1, "files.delete", args, ELICITING)));
  const state = first["requestState"] as string;
  const accept = { "confirm-1": { action: "accept", content: { value: "1" } } };
  const altered = `${state.slice(0, -2)}${state.endsWith("AA") ? "BB" : "AA"}`;
  const attempts: Array<[string, JsonObject]> = [
    [altered, args],
    [state, { path: "other", permanent: true }],
    ["not-a-state", args],
  ];
  for (const [index, [requestState, callArgs]] of attempts.entries()) {
    const more = { requestState, inputResponses: accept };
    const error = errorOf(await exchange(server, sent, callTool(index + 2, "files.delete", callArgs, ELICITING, more)));
    assert.equal(error.code, -32602, requestState);
  }
  clock.now += REQUEST_STATE_TTL_MS + 1;
  const late = { requestState: state, inputResponses: accept };
  assert.equal(errorOf(await exchange(server, sent, callTool(9, "files.delete", args, ELICITING, late))).code, -32602);
  assert.deepEqual(ran, []);
});

test("before 2026-07-28 the server asks the client with a request of its own and waits for the answer", async () => {
  const { server, sent, ran } = await serve({ allowDestroy: true });
  await exchange(server, sent, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: { elicitation: {} } },
  });
  const call = (id: number): string =>
    JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name: "files.delete", arguments: { path: "old", permanent: true } },
    });
  const question = (): Promise<JsonObject | undefined> =>
    waitFor(sent, (item) => item["method"] === "elicitation/create");

  server.receive(call(2));
  const first = await question();
  assert.equal(first?.["id"], "kiriya-1");
  const params = first?.["params"] as JsonObject;
  assert.equal(params["mode"], undefined);
  assert.match(String(params["message"]), /Type 1 to go ahead\./);
  server.receive(JSON.stringify({ jsonrpc: "2.0", id: "kiriya-1", result: { action: "decline" } }));
  assert.equal(errorKeyOf(resultOf(await waitFor(sent, (item) => item["id"] === 2))), "core.confirm.declined");

  server.receive(call(3));
  const second = await question();
  server.receive(
    JSON.stringify({ jsonrpc: "2.0", id: second?.["id"], result: { action: "accept", content: { value: "1" } } }),
  );
  assert.equal(resultOf(await waitFor(sent, (item) => item["id"] === 3))["isError"], false);
  assert.deepEqual(ran, ["files.delete removed"]);
});
