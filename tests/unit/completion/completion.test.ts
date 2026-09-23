import assert from "node:assert/strict";
import { test } from "node:test";
import type { CommandSpec } from "../../../src/core/domain/command.js";
import { UsageError } from "../../../src/core/domain/errors.js";
import { GLOBAL_OPTIONS } from "../../../src/core/domain/global-options.js";
import type { OptionSpec, PositionalSpec } from "../../../src/core/domain/input-schema.js";
import type { CatalogModule } from "../../../src/core/domain/ports/command-catalog.js";
import { PrintScript, scriptSpec } from "../../../src/modules/completion/application/print-script.use-case.js";
import { SHELLS } from "../../../src/modules/completion/domain/scripts.js";
import { suggest } from "../../../src/modules/completion/domain/suggest.js";
import { expectDone } from "../../support/fakes.js";

function spec(
  id: string,
  options: Record<string, OptionSpec> = {},
  positionals: PositionalSpec[] = [],
): CommandSpec<unknown> {
  return {
    id,
    summary: "files.list.summary",
    examples: [],
    safety: "read",
    idempotent: true,
    usesNetwork: false,
    runsUserCommands: false,
    input: { positionals, options, parse: () => ({}) },
  };
}

const paths: PositionalSpec = { name: "paths", description: "files.list.summary", required: false, variadic: true };
const CATALOG: readonly CatalogModule[] = [
  {
    id: "archive",
    summary: "archive.summary",
    commands: [
      {
        verb: "zip",
        spec: spec(
          "archive.zip",
          {
            to: { type: "string", description: "archive.zip.option.to", valueName: "<file.zip>" },
            lean: { type: "boolean", description: "archive.zip.option.lean" },
          },
          [paths],
        ),
      },
    ],
  },
  {
    id: "completion",
    summary: "completion.summary",
    commands: [
      {
        verb: "",
        spec: spec("completion", {}, [
          { name: "shell", description: "completion.arg.shell", required: true, variadic: false, choices: SHELLS },
        ]),
      },
      { verb: "suggest", spec: spec("completion.suggest") },
    ],
  },
  {
    id: "files",
    summary: "files.summary",
    commands: [
      {
        verb: "list",
        spec: spec(
          "files.list",
          {
            all: { type: "boolean", description: "files.list.summary" },
            sort: { type: "string", description: "files.list.summary", choices: ["name", "size", "time"] },
          },
          [paths],
        ),
      },
      { verb: "find", spec: spec("files.find") },
    ],
  },
  { id: "open", summary: "open.summary", commands: [{ verb: "", spec: spec("open", {}, [paths]) }] },
];

const values = (words: readonly string[], current: string): string[] =>
  suggest(CATALOG, GLOBAL_OPTIONS, words, current).map((suggestion) => suggestion.value);
const GLOBALS = ["--json", "--no-color", "--no-input", "--debug", "--help", "--version"];

test("the first word is a module, help or mcp, and the next a module's command, past global options", () => {
  assert.deepEqual(values([], ""), ["archive", "completion", "files", "open", "help", "mcp"]);
  assert.deepEqual(values(["mcp"], ""), []);
  assert.deepEqual(values([], "f"), ["files"]);
  assert.deepEqual(values(["files"], ""), ["list", "find"]);
  assert.deepEqual(values(["--json", "files"], "l"), ["list"]);
  const described = suggest(CATALOG, GLOBAL_OPTIONS, [], "he")[0];
  assert.deepEqual(described, { value: "help", description: "completion.help-word" });
});

test("options come from the command, then the global ones, and an option's listed values follow it", () => {
  assert.deepEqual(values(["files", "list"], "--"), ["--all", "--sort", ...GLOBALS]);
  assert.deepEqual(values(["files", "list"], "--s"), ["--sort"]);
  assert.deepEqual(values(["files", "list", "--sort"], ""), ["name", "size", "time"]);
  assert.deepEqual(values(["files", "list"], "--sort=s"), ["--sort=size"]);
  assert.deepEqual(values(["files", "list", "--sort", "size"], ""), []);
});

test("free values, such as paths, are left to the shell's file name completion", () => {
  assert.deepEqual(values(["archive", "zip", "--to"], ""), []);
  assert.deepEqual(values(["archive", "zip", "--to", "out.zip"], ""), []);
  assert.deepEqual(values(["open"], ""), []);
  assert.deepEqual(values(["open"], "--"), GLOBALS);
});

test("a module that is one command offers its argument's choices beside its other commands", () => {
  assert.deepEqual(values(["completion"], ""), ["suggest", "bash", "zsh", "fish", "powershell"]);
  assert.deepEqual(values(["completion"], "z"), ["zsh"]);
});

test("help completes modules and their commands; unknown words and words after -- get nothing", () => {
  assert.deepEqual(values(["help"], "c"), ["completion"]);
  assert.deepEqual(values(["help", "files"], "f"), ["find"]);
  assert.deepEqual(values(["help", "files", "list"], ""), []);
  assert.deepEqual(values(["nope"], ""), []);
  assert.deepEqual(values(["files", "list", "--"], "-"), []);
});

test("every shell gets a script that asks kiriya and says how to load it; other shells are refused", async () => {
  for (const shell of SHELLS) {
    const { data } = expectDone(
      await new PrintScript().execute(scriptSpec.input.parse({ positionals: [shell], options: {} })),
    );
    assert.match(data.script, /kiriya completion suggest/);
    assert.match(data.script, new RegExp(`kiriya completion ${shell}`));
  }
  assert.throws(() => scriptSpec.input.parse({ positionals: ["tcsh"], options: {} }), UsageError);
});
