import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { runKiriya } from "../support/cli.js";
import { layout, temporaryFolder } from "../support/fakes.js";
import { LineClient, MODERN_META, type Json } from "../support/mcp.js";

type Tool = { name: string; inputSchema: { properties: Json }; annotations: Json };
type ToolError = { kind: string; message: { key: string } };

/**
 * A fresh folder to start servers in. Every server is stopped before the folder is
 * removed, since Windows cannot remove the working folder of a running process.
 */
async function serverFolder(
  t: TestContext,
  entries: Readonly<Record<string, string>>,
): Promise<{ base: string; start: (args?: readonly string[]) => LineClient }> {
  const base = await mkdtemp(path.join(tmpdir(), "kiriya-test-"));
  const clients: LineClient[] = [];
  t.after(async () => {
    await Promise.all(clients.map((client) => client.stop()));
    await rm(base, { recursive: true, force: true });
  });
  await layout(base, entries);
  return {
    base,
    start: (args = []) => {
      const client = LineClient.start(base, args);
      clients.push(client);
      return client;
    },
  };
}

const errorOf = (result: Json): ToolError => (result["structuredContent"] as Json)["error"] as ToolError;

test("an MCP client lists the read commands as tools and runs one in the folder the server started in", async (t) => {
  const mcp = (await serverFolder(t, { "notes.md": "hi", "src/app.ts": "x" })).start();

  const discovered = (await mcp.request("server/discover", { _meta: MODERN_META }))["result"] as Json;
  assert.deepEqual(discovered["supportedVersions"], ["2026-07-28"]);

  const { tools } = (await mcp.request("tools/list", { _meta: MODERN_META }))["result"] as { tools: Tool[] };
  const names = tools.map((tool) => tool.name);
  assert.deepEqual(names, [...names].sort());
  for (const name of ["files.list", "files.read", "git.status", "port.who", "env.show", "convert.base64"]) {
    assert.ok(names.includes(name), `${name} is listed`);
  }
  for (const name of ["files.delete", "files.copy", "config.set", "port.kill", "docker.up", "archive.zip"]) {
    assert.ok(!names.includes(name), `${name} is kept back`);
  }
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  assert.deepEqual(byName.get("files.list")?.annotations, {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  });
  assert.equal(byName.get("net.check")?.annotations["openWorldHint"], true);
  assert.equal(Object.hasOwn(byName.get("env.show")?.inputSchema.properties ?? {}, "reveal"), false);
  assert.equal(Object.hasOwn(byName.get("proc.list")?.inputSchema.properties ?? {}, "full"), false);
  assert.ok(!names.includes("open") && !names.includes("clip.paste"), "sensitive reads are kept back");

  const listed = await mcp.call("files.list");
  assert.equal(listed["isError"], false);
  const { entries } = (listed["structuredContent"] as Json)["data"] as { entries: Array<{ name: string }> };
  assert.deepEqual(
    entries.map((entry) => entry.name),
    ["src", "notes.md"],
  );
  assert.equal(await mcp.close(), 0);
});

test("a path outside the roots is refused, whether it climbs with .., is absolute or starts a glob", async (t) => {
  const folder = await serverFolder(t, { "project/readme.md": "r", "other/secret.txt": "s" });
  const mcp = folder.start(["--root", "project"]);

  const refused = [
    await mcp.call("files.read", { file: "../other/secret.txt" }),
    await mcp.call("files.list", { path: path.join(folder.base, "other") }),
    await mcp.call("files.grep", { pattern: "s", paths: ["../other/*.txt"] }),
  ];
  for (const result of refused) {
    assert.equal(result["isError"], true);
    assert.deepEqual([errorOf(result).kind, errorOf(result).message.key], ["refused", "core.mcp.outside-roots"]);
  }
  assert.equal((await mcp.call("files.read", { file: "readme.md" }))["isError"], false);
  assert.equal(await mcp.close(), 0);
});

test("over MCP no command reads stdin, which carries the protocol", async (t) => {
  const mcp = (await serverFolder(t, {})).start();
  const missing = await mcp.call("convert.base64");
  assert.equal(missing["isError"], true);
  assert.equal(errorOf(missing).message.key, "core.input.missing");
  const encoded = await mcp.call("convert.base64", { value: "hi" });
  assert.equal(encoded["isError"], false);
  assert.equal(await mcp.close(), 0);
});

test("a client that still opens with initialize is served too", async (t) => {
  const mcp = (await serverFolder(t, {})).start();
  const opened = await mcp.request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "kiriya-test", version: "1.0.0" },
  });
  assert.equal((opened["result"] as Json)["protocolVersion"], "2025-06-18");
  mcp.notify("notifications/initialized");
  const { tools } = (await mcp.request("tools/list"))["result"] as { tools: Tool[] };
  assert.ok(tools.some((tool) => tool.name === "files.list"));
  const called = (await mcp.request("tools/call", { name: "files.list", arguments: {} }))["result"] as Json;
  assert.equal(called["isError"], false);
  assert.equal(await mcp.close(), 0);
});

test("kiriya mcp explains itself, and stops at once when a root is not a folder", async (t) => {
  const root = await temporaryFolder(t);
  const help = runKiriya(root, ["mcp", "--help"]);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /kiriya mcp \[folders\.\.\.\] \[--root <folder>\]\.\.\./);
  assert.equal(runKiriya(root, ["help", "mcp"]).stdout, help.stdout);
  assert.match(runKiriya(root, []).stdout, /kiriya mcp --help/);

  const missing = runKiriya(root, ["mcp", "--root", "missing"]);
  assert.equal(missing.code, 1);
  assert.equal(missing.stdout, "");
  assert.match(missing.stderr, /No folder at .*missing to serve as a root/);
});
