import assert from "node:assert/strict";
import { test } from "node:test";
import { BUILT_IN_MODULES } from "../../../src/config/modules.js";
import { CommandRegistry } from "../../../src/core/application/command-registry.js";
import { done, type Command, type CommandSpec } from "../../../src/core/domain/command.js";
import type { CorePorts } from "../../../src/core/domain/module.js";
import { Translator } from "../../../src/core/presentation/i18n/translator.js";
import { en } from "../../../src/i18n/locales/en.js";
import type { OutputShapes, Shape } from "../../../src/core/domain/output-shape.js";
import {
  anchorsOf,
  brokenLinks,
  fillBlocks,
  moduleProblems,
  moduleReference,
  moduleTable,
  shapeRows,
} from "../../../tools/docs-reference.js";

const ports = {} as CorePorts;
const translator = new Translator(en);
/** The demo module is not in src, so nothing read a shape for it. */
const NO_SHAPES: OutputShapes = { records: {}, commands: {} };
const ALL = "Include hidden entries and dependency folders such as node_modules.";

function command(spec: Partial<CommandSpec<undefined>> & { readonly id: string }): Command<undefined, undefined> {
  return {
    spec: {
      summary: "open.summary",
      input: { positionals: [], options: {}, parse: () => undefined },
      examples: [],
      safety: "read",
      idempotent: true,
      usesNetwork: false,
      runsUserCommands: false,
      ...spec,
    },
    execute: () => Promise.resolve(done(undefined)),
  };
}

function demoRegistry(): CommandRegistry {
  const registry = new CommandRegistry();
  registry.register(
    {
      id: "demo",
      summary: "files.summary",
      examples: ["kiriya other run"],
      register(registrar) {
        const pick = command({
          id: "demo.pick",
          safety: "destroy",
          examples: ["kiriya demo pick bash --all"],
          input: {
            positionals: [
              {
                name: "target",
                description: "open.arg.target",
                required: true,
                variadic: false,
                choices: ["bash", "zsh"],
              },
            ],
            options: {
              type: { type: "string", description: "files.option.all", valueName: "<file|dir>" },
              confirm: { type: "string", description: "files.option.all", valueName: "<count>", terminalOnly: true },
              ext: { type: "string", description: "files.option.all", valueName: "<extensions>", multiple: true },
            },
            parse: () => undefined,
          },
        });
        registrar.add(pick, () => []);
        registrar.add(command({ id: "demo.up", safety: "write", usesNetwork: true, runsUserCommands: true }), () => []);
      },
    },
    ports,
  );
  registry.register(
    { id: "solo", summary: "open.summary", register: (registrar) => registrar.add(command({ id: "solo" }), () => []) },
    ports,
  );
  return registry;
}

test("every built-in module has a paragraph, examples of its own and the address of its guide", () => {
  const registry = new CommandRegistry();
  for (const module of BUILT_IN_MODULES) registry.register(module, ports);
  assert.deepEqual(registry.list().flatMap(moduleProblems), []);
});

test("a module is told what it lacks for help and its guide", () => {
  const demo = demoRegistry().module("demo");
  assert.ok(demo);
  assert.deepEqual(moduleProblems(demo), [
    "demo: no about paragraph for kiriya help demo",
    "demo: its guide should be https://github.com/SatPaingOo/kiriya/blob/main/docs/modules/demo.md",
    'demo: the example "kiriya other run" is another module\'s',
  ]);
});

const LISTENER: Shape = {
  kind: "record",
  fields: {
    address: { kind: "string", description: "The local address." },
    pid: { kind: "number", nullable: true, description: "null when the owner is hidden." },
  },
};

test("each field of data is a row, and a list is marked so the path reads as --get writes it", () => {
  const shapes: OutputShapes = { records: { "port.OwnedListener": LISTENER }, commands: {} };
  const rows = shapeRows(shapes, {
    kind: "record",
    fields: {
      port: { kind: "number", nullable: true },
      listeners: { kind: "list", of: { kind: "ref", named: "port.OwnedListener" } },
    },
  });
  assert.deepEqual(rows, [
    { path: "port", type: "number or null", description: "" },
    // The list itself only says it is one; the item's fields are the rows below it.
    { path: "listeners", type: "list", description: "" },
    { path: "listeners[].address", type: "string", description: "The local address." },
    { path: "listeners[].pid", type: "number or null", description: "null when the owner is hidden." },
  ]);
});

test("a list of plain values stays one row, and a choice names its values", () => {
  const rows = shapeRows(NO_SHAPES, {
    kind: "record",
    fields: {
      names: { kind: "list", of: { kind: "string" } },
      mode: { kind: "choice", of: ["list", "extract"] },
      anything: { kind: "unknown" },
    },
  });
  assert.deepEqual(rows, [
    { path: "names", type: "list of string", description: "" },
    { path: "mode", type: "one of `list`, `extract`", description: "" },
    { path: "anything", type: "anything", description: "" },
  ]);
});

test("a type that contains itself is named once and not opened again", () => {
  const shapes: OutputShapes = {
    records: {
      "core.Message": {
        kind: "record",
        fields: { key: { kind: "string" }, inner: { kind: "ref", named: "core.Message" } },
      },
    },
    commands: {},
  };
  const rows = shapeRows(shapes, { kind: "ref", named: "core.Message" });
  assert.deepEqual(
    rows.map((row) => row.path),
    ["key", "inner"],
    "inner is named but its own fields are not listed again",
  );
});

test("a command that answers in two modes gets a table per mode, labelled by what tells them apart", () => {
  const variants: Shape = {
    kind: "variants",
    of: [
      { kind: "record", fields: { mode: { kind: "choice", of: ["list"] }, entries: { kind: "number" } } },
      { kind: "record", fields: { mode: { kind: "choice", of: ["extract"] }, files: { kind: "number" } } },
    ],
  };
  const registry = new CommandRegistry();
  registry.register(
    {
      id: "demo",
      summary: "files.summary",
      examples: ["kiriya demo run"],
      register: (registrar) => registrar.add(command({ id: "demo.run" }), () => []),
    },
    ports,
  );
  const demo = registry.module("demo");
  assert.ok(demo);
  const reference = moduleReference(demo, translator, { records: {}, commands: { "demo.run": variants } });

  assert.match(reference, /With `--json`, `data` holds one of these:/);
  assert.match(reference, /When `mode` is `list`:/);
  assert.match(reference, /When `mode` is `extract`:/);
  assert.ok(reference.indexOf("`entries`") < reference.indexOf("When `mode` is `extract`:"), "each mode's own fields");
});

test("the reference shows each command's usage, arguments, options and their notes, safety, MCP and examples", () => {
  const demo = demoRegistry().module("demo");
  assert.ok(demo);
  const reference = moduleReference(demo, translator, NO_SHAPES);
  const pick = reference.indexOf("### `kiriya demo pick`");
  const up = reference.indexOf("### `kiriya demo up`");
  assert.ok(reference.startsWith("<!-- Written by `npm run docs`"));
  assert.ok(pick > 0 && up > pick, "commands in order of their verbs");
  for (const line of [
    "```text\nkiriya demo pick <target> [options]\n```",
    "| `target` | A file, a folder, or an http, https or mailto address. One of `bash`, `zsh`. |",
    `| \`--type <file\\|dir>\` | ${ALL} |`,
    `| \`--confirm <count>\` | ${ALL} Only at a terminal. |`,
    `| \`--ext <extensions>\` | ${ALL} Can be given more than once. |`,
    "- **Safety:** `destroy`, can do work that cannot be undone, and asks for a typed confirmation first",
    "- **MCP:** offered to AI agents with elicitation when `mcp.allowDestroy` is `true`",
    "```bash\nkiriya demo pick bash --all\n```",
    "- **Network:** uses the network\n- **Programs:** runs programs the user names",
    "- **MCP:** never offered to AI agents, because it runs programs the user names",
  ]) {
    assert.ok(reference.includes(line), line);
  }
});

test("module tables link each guide, and list commands with a module's own command by its name", () => {
  const modules = demoRegistry().list();
  const summary = translator.text({ key: "files.summary", params: {} });
  const brief = moduleTable(modules, translator, { folder: "docs/modules/", commands: false });
  assert.ok(brief.includes(`| [\`demo\`](docs/modules/demo.md) | ${summary}. |`), brief);
  const full = moduleTable(modules, translator, { folder: "", commands: true });
  assert.ok(full.includes(`| [\`demo\`](demo.md) | ${summary}. | \`pick\` \`up\` |`), full);
  assert.ok(full.includes("| `kiriya solo` |"), full);
});

test("blocks between markers are replaced, and missing markers are named", () => {
  const page = "# Title\n\n<!-- kiriya:reference -->\nold\n<!-- /kiriya:reference -->\n\nAfter\n";
  const filled = fillBlocks(page, { reference: "new", other: "x" });
  assert.deepEqual(filled, {
    text: "# Title\n\n<!-- kiriya:reference -->\nnew\n<!-- /kiriya:reference -->\n\nAfter\n",
    missing: ["other"],
  });
  assert.equal(fillBlocks(filled.text, { reference: "new" }).text, filled.text);
});

test("anchors are made as GitHub makes them, and headings in code blocks make none", () => {
  const anchors = anchorsOf(
    "# kiriya — Design\n### `kiriya files delete`\n## Notes\n## Notes\n```\n# not a heading\n```\n",
  );
  assert.deepEqual([...anchors], ["kiriya--design", "kiriya-files-delete", "notes", "notes-1"]);
});

test("links to missing files, missing headings and outside the repository are reported with their line", () => {
  const page = {
    path: "docs/usage.md",
    text: [
      "# Usage",
      "[ok](modules/files.md#kiriya-files-delete) and [self](#usage) and [up](../README.md)",
      "[missing](nowhere.md)",
      "[bad anchor](modules/files.md#nope)",
      "[web](https://example.com/nowhere.md) and `[code](ignored.md)`",
      "```",
      "[fenced](ignored.md)",
      "```",
      "[out](../../outside.md)",
    ].join("\n"),
  };
  const files: Readonly<Record<string, string>> = {
    "docs/usage.md": page.text,
    "docs/modules/files.md": "## Reference\n### `kiriya files delete`\n",
    "README.md": "# kiriya\n",
  };
  assert.deepEqual(
    brokenLinks(page, (repositoryPath) => files[repositoryPath] ?? null),
    [
      "docs/usage.md:3: nowhere.md does not exist",
      "docs/usage.md:4: modules/files.md#nope has no such heading",
      "docs/usage.md:9: ../../outside.md leads outside the repository",
    ],
  );
});
