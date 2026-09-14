import assert from "node:assert/strict";
import { test } from "node:test";
import { BUILT_IN_MODULES } from "../../../src/config/modules.js";
import { CommandRegistry } from "../../../src/core/application/command-registry.js";
import { done, type Command, type CommandSpec } from "../../../src/core/domain/command.js";
import type { CorePorts } from "../../../src/core/domain/module.js";
import { Translator } from "../../../src/core/presentation/i18n/translator.js";
import { en } from "../../../src/i18n/locales/en.js";
import {
  anchorsOf,
  brokenLinks,
  fillBlocks,
  moduleProblems,
  moduleReference,
  moduleTable,
} from "../../../tools/docs-reference.js";

const ports = {} as CorePorts;
const translator = new Translator(en);
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

test("the reference shows each command's usage, arguments, options and their notes, safety, MCP and examples", () => {
  const demo = demoRegistry().module("demo");
  assert.ok(demo);
  const reference = moduleReference(demo, translator);
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
