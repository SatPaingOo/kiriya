import assert from "node:assert/strict";
import { test } from "node:test";
import { pathValues } from "../../../src/core/application/root-scope.js";
import type { CommandSpec, SafetyLevel } from "../../../src/core/domain/command.js";
import { UsageError } from "../../../src/core/domain/errors.js";
import type { InputSchema } from "../../../src/core/domain/input-schema.js";
import { Translator } from "../../../src/core/presentation/i18n/translator.js";
import {
  annotationsOf,
  inputSchemaOf,
  rawInputOf,
  type ToolAccess,
} from "../../../src/core/presentation/mcp/tool-definitions.js";

/** Shows each key as its own text, so the tests do not depend on wording. */
const keys = new Translator({});

const GREP: InputSchema<unknown> = {
  positionals: [
    { name: "pattern", description: "files.grep.arg.pattern", required: true, variadic: false },
    { name: "paths", description: "files.grep.arg.paths", required: false, variadic: true, path: true },
  ],
  options: {
    to: { type: "string", description: "archive.zip.option.to", valueName: "<file.zip>", path: true },
    all: { type: "boolean", description: "files.option.all" },
    ext: { type: "string", description: "files.option.ext", valueName: "<extensions>", multiple: true },
    reveal: { type: "boolean", description: "env.show.option.reveal", terminalOnly: true },
  },
  parse: (raw) => raw,
};

function usageKey(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    if (error instanceof UsageError) return error.detail.key;
    throw error;
  }
  return undefined;
}

test("every argument and option but a terminal-only one is a property, and needed arguments are required", () => {
  assert.deepEqual(inputSchemaOf("files.grep", GREP, keys), {
    type: "object",
    properties: {
      pattern: { type: "string", description: "files.grep.arg.pattern" },
      paths: { type: "array", items: { type: "string" }, description: "files.grep.arg.paths" },
      to: { type: "string", description: "archive.zip.option.to <file.zip>" },
      all: { type: "boolean", description: "files.option.all" },
      ext: { type: "array", items: { type: "string" }, description: "files.option.ext <extensions>" },
    },
    required: ["pattern"],
    additionalProperties: false,
  });
  assert.deepEqual(inputSchemaOf("doctor", { positionals: [], options: {}, parse: () => undefined }, keys), {
    type: "object",
    properties: {},
    additionalProperties: false,
  });
});

test("choices become an enum, a needed list needs an item, and one name for two inputs is refused", () => {
  const positionals: InputSchema<unknown>["positionals"] = [
    { name: "shell", description: "completion.arg.shell", required: true, variadic: false, choices: ["bash", "fish"] },
    { name: "paths", description: "files.delete.arg.paths", required: true, variadic: true },
  ];
  assert.deepEqual(inputSchemaOf("x", { positionals, options: {}, parse: () => undefined }, keys)["properties"], {
    shell: { type: "string", enum: ["bash", "fish"], description: "completion.arg.shell" },
    paths: { type: "array", items: { type: "string" }, minItems: 1, description: "files.delete.arg.paths" },
  });
  const clash: InputSchema<unknown> = {
    positionals,
    options: { shell: { type: "boolean", description: "files.option.all" } },
    parse: () => undefined,
  };
  assert.throws(() => inputSchemaOf("x.y", clash, keys), /x\.y: shell is both an argument and an option/);
});

test("JSON arguments become the raw input argv would give", () => {
  assert.deepEqual(rawInputOf(GREP, { pattern: "TODO", paths: ["src", "docs"], to: "a.zip", all: true, ext: ["ts"] }), {
    positionals: ["TODO", "src", "docs"],
    options: { to: "a.zip", all: true, ext: ["ts"] },
  });
  assert.deepEqual(rawInputOf(GREP, { pattern: "TODO", paths: [], all: false }), {
    positionals: ["TODO"],
    options: {},
  });
});

test("arguments that do not fit the schema are usage errors the model can correct", () => {
  assert.equal(
    usageKey(() => rawInputOf(GREP, undefined)),
    "core.usage.missing-argument",
  );
  assert.equal(
    usageKey(() => rawInputOf(GREP, [])),
    "core.mcp.arguments-not-object",
  );
  assert.equal(
    usageKey(() => rawInputOf(GREP, { pattern: "x", nope: 1 })),
    "core.mcp.unknown-argument",
  );
  assert.equal(
    usageKey(() => rawInputOf(GREP, { pattern: "x", reveal: true })),
    "core.mcp.unknown-argument",
  );
  assert.equal(
    usageKey(() => rawInputOf(GREP, { pattern: 3 })),
    "core.mcp.expects-text",
  );
  assert.equal(
    usageKey(() => rawInputOf(GREP, { pattern: "x", paths: "src" })),
    "core.mcp.expects-list",
  );
  assert.equal(
    usageKey(() => rawInputOf(GREP, { pattern: "x", ext: [1] })),
    "core.mcp.expects-list",
  );
  assert.equal(
    usageKey(() => rawInputOf(GREP, { pattern: "x", all: "yes" })),
    "core.mcp.expects-boolean",
  );

  const twoOptional: InputSchema<unknown> = {
    positionals: [
      { name: "a", description: "files.compare.arg.a", required: false, variadic: false },
      { name: "b", description: "files.compare.arg.b", required: false, variadic: false },
    ],
    options: {},
    parse: () => undefined,
  };
  assert.equal(
    usageKey(() => rawInputOf(twoOptional, { b: "x" })),
    "core.usage.missing-argument",
  );
});

test("only the values of path inputs are held to the roots", () => {
  const raw = rawInputOf(GREP, { pattern: "../TODO", paths: ["src", "../docs"], to: "out.zip", ext: ["../ts"] });
  assert.deepEqual(pathValues(GREP, raw), ["src", "../docs", "out.zip"]);
});

test("all four annotations follow the spec", () => {
  const spec = (safety: SafetyLevel, idempotent: boolean, usesNetwork: boolean): CommandSpec<unknown> => ({
    id: "x.y",
    summary: "files.list.summary",
    input: GREP,
    examples: [],
    safety,
    idempotent,
    usesNetwork,
    runsUserCommands: false,
  });
  assert.deepEqual(annotationsOf(spec("read", true, false)), {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  });
  assert.deepEqual(annotationsOf(spec("write", false, true)), {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  });
  assert.deepEqual(annotationsOf(spec("destroy", false, false)), {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  });
});

test("a sensitive option is offered only when the user allows it, and one reaching hidden folders only to tools that change nothing", () => {
  const schema: InputSchema<unknown> = {
    positionals: [],
    options: {
      full: { type: "boolean", description: "proc.list.option.full", sensitive: true },
      all: { type: "boolean", description: "files.option.all", reachesHidden: true },
    },
    parse: (raw) => raw,
  };
  const names = (access: ToolAccess): string[] =>
    Object.keys(inputSchemaOf("x", schema, keys, access)["properties"] as Record<string, unknown>);
  assert.deepEqual(names({ sensitive: false, changes: false }), ["all"]);
  assert.deepEqual(names({ sensitive: true, changes: false }), ["full", "all"]);
  assert.deepEqual(names({ sensitive: true, changes: true }), ["full"]);
  assert.equal(
    usageKey(() => rawInputOf(schema, { full: true })),
    "core.mcp.unknown-argument",
  );
  assert.equal(
    usageKey(() => rawInputOf(schema, { all: true }, { sensitive: true, changes: true })),
    "core.mcp.unknown-argument",
  );
  assert.deepEqual(rawInputOf(schema, { full: true, all: true }, { sensitive: true, changes: false }), {
    positionals: [],
    options: { full: true, all: true },
  });
});
