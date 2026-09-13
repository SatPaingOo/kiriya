import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { layout } from "../support/fakes.js";

/**
 * kiriya's MCP server against a client built with the official TypeScript SDK, which
 * BLUEPRINT.md section 9 asks of phase 4. The SDK is a development dependency only.
 */

const MAIN = fileURLToPath(new URL("../../src/main.js", import.meta.url));

type Mode = "auto" | "legacy";

/** What the test's user answers when the server asks, given the question's text. */
type Answer = { action: "accept" | "decline" | "cancel"; content?: Record<string, string> };

/** The test's environment, with kiriya's configuration file pointed at `config`. */
function environment(config: string): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined && name !== "FORCE_COLOR") variables[name] = value;
  }
  return { ...variables, KIRIYA_CONFIG: config, KIRIYA_NO_COLOR: "1" };
}

/**
 * A fresh folder to serve. Every client is closed before the folder is removed, since
 * Windows cannot remove the working folder of a server that still runs.
 */
async function servedFolder(
  t: TestContext,
  entries: Readonly<Record<string, string>>,
): Promise<{
  base: string;
  connect: (
    mode: Mode,
    settings?: Readonly<Record<string, string>>,
    answer?: (text: string) => Answer,
  ) => Promise<Client>;
}> {
  const base = await mkdtemp(path.join(tmpdir(), "kiriya-test-"));
  const clients: Client[] = [];
  t.after(async () => {
    await Promise.all(clients.map((client) => client.close()));
    await rm(base, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  });
  await layout(base, entries);
  const config = path.join(base, "kiriya-config.json");
  return {
    base,
    connect: async (mode, settings, answer) => {
      if (settings !== undefined) await writeFile(config, JSON.stringify(settings));
      const client = new Client(
        { name: "kiriya-test", version: "1.0.0" },
        {
          ...(mode === "auto" ? { versionNegotiation: { mode: "auto" as const } } : {}),
          ...(answer === undefined ? {} : { capabilities: { elicitation: { form: {} } } }),
        },
      );
      if (answer !== undefined) {
        client.setRequestHandler("elicitation/create", (request) => Promise.resolve(answer(request.params.message)));
      }
      clients.push(client);
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [MAIN, "mcp"],
        cwd: base,
        env: environment(config),
        stderr: "ignore",
      });
      await client.connect(transport);
      return client;
    },
  };
}

const document = (result: { structuredContent?: unknown }): string => JSON.stringify(result.structuredContent);

for (const mode of ["auto", "legacy"] as const) {
  test(`an SDK client in ${mode} mode lists every tool with its annotations, runs one, and is refused outside the root`, async (t) => {
    const served = await servedFolder(t, { "notes.md": "hi", "src/app.ts": "x" });
    const client = await served.connect(mode);
    assert.equal(client.getProtocolEra(), mode === "auto" ? "modern" : "legacy");

    const { tools } = await client.listTools();
    assert.ok(tools.length > 20, `${tools.length} tools`);
    for (const tool of tools) {
      assert.deepEqual(
        Object.keys(tool.annotations ?? {}).sort(),
        ["destructiveHint", "idempotentHint", "openWorldHint", "readOnlyHint"],
        tool.name,
      );
      assert.equal(tool.annotations?.readOnlyHint, true, tool.name);
    }

    const listed = await client.callTool({ name: "files.list", arguments: {} });
    assert.equal(listed.isError, false, document(listed));
    const { entries } = (listed.structuredContent as { data: { entries: Array<{ name: string }> } }).data;
    assert.deepEqual(
      entries.map((entry) => entry.name),
      ["src", "notes.md"],
    );

    const outside = await client.callTool({ name: "files.read", arguments: { file: "../notes.md" } });
    assert.equal(outside.isError, true);
    assert.match(document(outside), /core\.mcp\.outside-roots/);
  });
}

test("with mcp.allowWrite an SDK client runs a write tool, is never offered config set, and cannot change kiriya's settings", async (t) => {
  const served = await servedFolder(t, { "a.txt": "a", "b.txt": "b" });
  const client = await served.connect("auto", { "mcp.allowWrite": "true" });

  const names = (await client.listTools()).tools.map((tool) => tool.name);
  for (const name of ["files.new", "files.move", "files.rename", "git.switch"]) {
    assert.ok(names.includes(name), `${name} is offered`);
  }
  for (const name of ["config.set", "config.unset", "docker.up", "files.delete", "files.copy"]) {
    assert.ok(!names.includes(name), `${name} is kept back`);
  }

  const tools = (await client.listTools()).tools;
  const propertiesOf = (name: string): object => tools.find((tool) => tool.name === name)?.inputSchema.properties ?? {};
  assert.ok(names.includes("open") && names.includes("clip.paste"), "sensitive reads are offered");
  assert.ok(Object.hasOwn(propertiesOf("proc.list"), "full"));
  assert.ok(!Object.hasOwn(propertiesOf("files.replace"), "all"));
  const hook = await client.callTool({
    name: "files.new",
    arguments: { paths: [".git/hooks/post-checkout"], content: "#!/bin/sh" },
  });
  assert.equal(hook.isError, true);
  assert.match(document(hook), /core.mcp.git-folder/);

  const created = await client.callTool({ name: "files.new", arguments: { paths: ["made.txt"], content: "hi" } });
  assert.equal(created.isError, false, document(created));
  assert.equal(await readFile(path.join(served.base, "made.txt"), "utf8"), "hi");

  const moved = await client.callTool({
    name: "files.move",
    arguments: { sources: ["a.txt"], target: "b.txt", overwrite: true },
  });
  assert.equal(moved.isError, true);
  assert.match(document(moved), /core\.mcp\.cannot-confirm/);
  assert.equal(await readFile(path.join(served.base, "b.txt"), "utf8"), "b");

  const settings = await client.callTool({ name: "files.new", arguments: { paths: ["kiriya-config.json"] } });
  assert.equal(settings.isError, true);
  assert.match(document(settings), /core\.mcp\.guarded/);
  const read = await client.callTool({ name: "files.read", arguments: { file: "kiriya-config.json" } });
  assert.equal(read.isError, false, document(read));
});

for (const mode of ["auto", "legacy"] as const) {
  test(`with mcp.allowDestroy an SDK client in ${mode} mode must accept the elicitation before a destroy tool runs`, async (t) => {
    const served = await servedFolder(t, { "old.txt": "x" });
    const asked: string[] = [];
    let reply: Answer = { action: "decline" };
    const client = await served.connect(mode, { "mcp.allowDestroy": "true" }, (text) => {
      asked.push(text);
      return reply;
    });
    assert.ok((await client.listTools()).tools.some((tool) => tool.name === "files.delete"));

    const target = path.join(served.base, "old.txt");
    const call = { name: "files.delete", arguments: { paths: ["old.txt"], permanent: true } };
    const declined = await client.callTool(call);
    assert.equal(declined.isError, true);
    assert.match(document(declined), /core\.confirm\.declined/);
    assert.equal(await readFile(target, "utf8"), "x");

    reply = { action: "accept", content: { value: "1" } };
    const deleted = await client.callTool(call);
    assert.equal(deleted.isError, false, document(deleted));
    await assert.rejects(readFile(target, "utf8"));
    assert.equal(asked.length, 2);
    assert.match(asked[0] ?? "", /Type 1 to go ahead\./);
  });
}

test("with mcp.allowDestroy a client that cannot ask its user is never offered a destroy tool", async (t) => {
  const served = await servedFolder(t, {});
  const client = await served.connect("auto", { "mcp.allowDestroy": "true" });
  const names = (await client.listTools()).tools.map((tool) => tool.name);
  assert.ok(names.includes("files.list"));
  assert.ok(!names.includes("files.delete"));
});
