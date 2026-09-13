import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { CommandRegistry } from "../../../src/core/application/command-registry.js";
import { PluginLoader } from "../../../src/core/application/plugin-loader.js";
import type { CorePorts } from "../../../src/core/domain/module.js";
import { NodePluginSource } from "../../../src/core/infrastructure/node/node-plugin-source.adapter.js";
import { layout, temporaryFolder } from "../../support/fakes.js";

const ports = {} as CorePorts;
const EXAMPLE = fileURLToPath(new URL("../../../../examples/plugins/hello", import.meta.url));

/** A plugin with one command, `<id> run`, as an ES module's source. */
function plugin(
  id: string,
  commandId = `${id}.run`,
  messages = `"${id}.summary": "S", "${id}.run.summary": "R"`,
): string {
  const spec = `{ id: "${commandId}", summary: "${id}.run.summary", examples: [], safety: "read", idempotent: true, usesNetwork: false, runsUserCommands: false, input: { positionals: [], options: {}, parse: () => ({}) } }`;
  const command = `{ spec: ${spec}, execute: () => Promise.resolve({ kind: "done", data: {}, warnings: [], failures: [] }) }`;
  return `export default { id: "${id}", summary: "${id}.summary", messages: { ${messages} }, register(registrar) { registrar.add(${command}, () => []); } };\n`;
}

test("the example plugin loads, registers its command, and brings its messages", async () => {
  const registry = new CommandRegistry();
  const loader = new PluginLoader();
  await loader.load([EXAMPLE], path.dirname(EXAMPLE), new NodePluginSource(), registry, ports);
  assert.deepEqual(loader.problems(), []);
  assert.deepEqual(
    loader.loaded().map((item) => [item.id, item.name, item.version, item.commands]),
    [["hello", "kiriya-plugin-hello", "1.0.0", 1]],
  );
  assert.ok(registry.module("hello")?.commands.has("greet"));
  assert.equal(loader.messages["hello.greet.text"], "Hello, {name}!");
});

test("paths are relative to the configuration's folder, and package names are found in node_modules", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, {
    "plugins/one/package.json": JSON.stringify({
      name: "one-plugin",
      version: "2.0.0",
      type: "module",
      exports: { ".": { import: "./lib/main.js" } },
    }),
    "plugins/one/lib/main.js": plugin("one"),
    "node_modules/kiriya-plugin-two/package.json": JSON.stringify({ type: "module", main: "entry.js" }),
    "node_modules/kiriya-plugin-two/entry.js": plugin("two"),
  });
  const loader = new PluginLoader();
  await loader.load(["./plugins/one", "kiriya-plugin-two"], root, new NodePluginSource(), new CommandRegistry(), ports);
  assert.deepEqual(loader.problems(), []);
  assert.deepEqual(
    loader.loaded().map((item) => [item.id, item.name, item.version]),
    [
      ["one", "one-plugin", "2.0.0"],
      ["two", null, null],
    ],
  );
});

test("each broken plugin is recorded with its reason and skipped, and the rest still load", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, {
    "syntax.mjs": "export default {",
    "number.mjs": "export default 42;\n",
    "bad-id.mjs": plugin("Bad_Id"),
    "no-messages.mjs": 'export default { id: "quiet", summary: "quiet.summary", register() {} };\n',
    "bad-key.mjs": plugin("keys", "keys.run", '"keys.summary": "S", "other.thing": "T"'),
    "taken.mjs": plugin("files"),
    "reserved.mjs": plugin("help"),
    "stray.mjs": plugin("stray", "elsewhere.run"),
    "good.mjs": plugin("good"),
  });
  const registry = new CommandRegistry();
  registry.register({ id: "files", summary: "files.summary", register: () => undefined }, ports);
  const loader = new PluginLoader();
  const entries = [
    "./missing",
    "./syntax.mjs",
    "./number.mjs",
    "./bad-id.mjs",
    "./no-messages.mjs",
    "./bad-key.mjs",
    "./taken.mjs",
    "./reserved.mjs",
    "./stray.mjs",
    "./good.mjs",
  ];
  await loader.load(entries, root, new NodePluginSource(), registry, ports);

  assert.deepEqual(
    loader.loaded().map((item) => item.id),
    ["good"],
  );
  assert.deepEqual(
    loader.problems().map((problem) => [problem.entry, problem.reason.key]),
    [
      ["./missing", "core.plugin.not-found"],
      ["./syntax.mjs", "core.plugin.import-failed"],
      ["./number.mjs", "core.plugin.no-module"],
      ["./bad-id.mjs", "core.plugin.bad-id"],
      ["./no-messages.mjs", "core.plugin.no-messages"],
      ["./bad-key.mjs", "core.plugin.bad-message"],
      ["./taken.mjs", "core.plugin.taken"],
      ["./reserved.mjs", "core.plugin.taken"],
      ["./stray.mjs", "core.plugin.register-failed"],
    ],
  );
  assert.equal(registry.module("stray"), undefined);
  assert.equal(loader.messages["keys.summary"], undefined);
});
