import assert from "node:assert/strict";
import { test } from "node:test";
import { UsageError } from "../../../src/core/domain/errors.js";
import type { InputSchema, RawInput } from "../../../src/core/domain/input-schema.js";
import { isMessage } from "../../../src/core/domain/message.js";
import { parseCommandArguments, splitGlobalFlags } from "../../../src/core/presentation/cli/argv.js";

const schema: InputSchema<RawInput> = {
  positionals: [{ name: "path", description: "files.list.arg.path", required: true, variadic: false }],
  options: {
    all: { type: "boolean", description: "files.option.all" },
    name: { type: "string", description: "files.find.option.name" },
    ext: { type: "string", description: "files.find.option.ext", multiple: true },
    yes: { type: "boolean", description: "files.delete.option.yes", short: "y" },
  },
  parse: (raw) => raw,
};

function usage(key: string, check: (params: UsageError["detail"]["params"]) => boolean = () => true) {
  return (error: unknown) => error instanceof UsageError && error.detail.key === key && check(error.detail.params);
}

test("global flags are taken from anywhere before --", () => {
  const { flags, rest } = splitGlobalFlags(["files", "--json", "list", "-V", "--", "--json"]);
  assert.equal(flags.json, true);
  assert.equal(flags.version, true);
  assert.equal(flags.help, false);
  assert.deepEqual(rest, ["files", "list", "--", "--json"]);
});

test("arguments are parsed against the schema", () => {
  const raw = parseCommandArguments(schema, ["x", "--all", "--ext", ".ts", "--ext", ".md", "-y", "--name=*.ts"]);
  assert.deepEqual(raw.positionals, ["x"]);
  assert.equal(raw.options["all"], true);
  assert.equal(raw.options["yes"], true);
  assert.equal(raw.options["name"], "*.ts");
  assert.deepEqual(raw.options["ext"], [".ts", ".md"]);
});

test("an unknown option is a usage error with a suggestion when one is close", () => {
  assert.throws(
    () => parseCommandArguments(schema, ["x", "--al"]),
    usage("core.usage.unknown-option", (params) => {
      const hint = params["hint"];
      return params["option"] === "--al" && isMessage(hint) && hint.params["suggestion"] === "--all";
    }),
  );
  assert.throws(
    () => parseCommandArguments(schema, ["x", "--completely-different"]),
    usage("core.usage.unknown-option", (params) => params["hint"] === undefined),
  );
});

test("option values are checked", () => {
  assert.throws(
    () => parseCommandArguments(schema, ["x", "--name"]),
    usage("core.usage.expects-value", (p) => p["option"] === "name"),
  );
  assert.throws(
    () => parseCommandArguments(schema, ["x", "--all=1"]),
    usage("core.usage.takes-no-value", (p) => p["option"] === "all"),
  );
});

test("argument counts are checked", () => {
  assert.throws(
    () => parseCommandArguments(schema, ["x", "y"]),
    usage("core.usage.too-many-arguments", (p) => p["extra"] === "y"),
  );
  assert.throws(
    () => parseCommandArguments(schema, []),
    usage("core.usage.missing-argument", (p) => p["name"] === "path"),
  );
});
