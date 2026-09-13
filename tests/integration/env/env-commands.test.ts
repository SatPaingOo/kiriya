import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { NotFoundError } from "../../../src/core/domain/errors.js";
import type { RawInput } from "../../../src/core/domain/input-schema.js";
import { NodeEnvironmentAdapter } from "../../../src/core/infrastructure/node/node-environment.adapter.js";
import { NodeFileContentAdapter } from "../../../src/core/infrastructure/node/node-file-content.adapter.js";
import { NodeFileSystemAdapter } from "../../../src/core/infrastructure/node/node-file-system.adapter.js";
import { CheckDotenv, checkSpec } from "../../../src/modules/env/application/check-dotenv.use-case.js";
import { InspectPath, pathSpec } from "../../../src/modules/env/application/inspect-path.use-case.js";
import { commandContext, expectDone, FakeEnvironment, layout, temporaryFolder } from "../../support/fakes.js";

const OS = new NodeEnvironmentAdapter().os;
const raw = (positionals: readonly string[], options: RawInput["options"] = {}): RawInput => ({ positionals, options });

test("env path marks empty, relative, missing, non-folder and duplicate entries", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, { "bin/": "", "tools/": "", "notes.txt": "x" });
  const bin = path.join(root, "bin");
  const entries = [
    bin,
    path.join(root, "tools"),
    "",
    path.join("relative", "bin"),
    path.join(root, "gone"),
    path.join(root, "notes.txt"),
    `${bin}${path.sep}`,
  ];
  const environment = new FakeEnvironment(OS, root, { PATH: entries.join(OS === "windows" ? ";" : ":") });
  const inspect = new InspectPath(environment, new NodeFileSystemAdapter());

  const result = expectDone(await inspect.execute(pathSpec.input.parse(raw([]))));
  assert.deepEqual(
    result.data.entries.map((entry) => [entry.status, entry.duplicateOf]),
    [
      ["ok", null],
      ["ok", null],
      ["empty", null],
      ["relative", null],
      ["missing", null],
      ["not-a-folder", null],
      ["duplicate", 1],
    ],
  );
  assert.deepEqual(result.warnings, [{ key: "env.path.problems", params: { count: 5, total: 7 } }]);
  await assert.rejects(inspect.execute(pathSpec.input.parse(raw(["KIRIYA_NOT_SET_ANYWHERE"]))), NotFoundError);
});

test("env check compares names only, and no value reaches the output", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, {
    ".env.example": "API_URL=\nAPI_KEY=\nDEBUG=false\n",
    ".env": "API_URL=https://first.example\nAPI_KEY=\nLOCAL_ONLY=1\nAPI_URL=https://second.example\nbroken line\n",
    "fresh/.env.example": "A=\nB=\n",
  });
  const check = new CheckDotenv(new NodeFileSystemAdapter(), new NodeFileContentAdapter());

  const result = expectDone(await check.execute(checkSpec.input.parse(raw([])), commandContext(root)));
  assert.deepEqual(result.data, {
    file: ".env",
    example: ".env.example",
    fileExists: true,
    expected: 3,
    missing: ["DEBUG"],
    empty: ["API_KEY"],
    extra: ["LOCAL_ONLY"],
    duplicates: ["API_URL"],
    malformed: [{ path: ".env", line: 5 }],
  });
  assert.deepEqual(
    result.failures.map((failure) => failure.key),
    ["env.check.missing"],
  );
  assert.deepEqual(
    result.warnings.map((warning) => warning.key),
    ["env.check.empty", "env.check.extra", "env.check.duplicates", "env.check.malformed"],
  );
  assert.ok(!JSON.stringify(result).includes("https://"));

  const fresh = expectDone(
    await check.execute(checkSpec.input.parse(raw([])), commandContext(path.join(root, "fresh"))),
  );
  assert.deepEqual([fresh.data.fileExists, fresh.data.missing], [false, ["A", "B"]]);
  assert.deepEqual(
    fresh.failures.map((failure) => failure.key),
    ["env.check.no-file", "env.check.missing"],
  );

  await assert.rejects(
    check.execute(checkSpec.input.parse(raw([], { example: "nope.example" })), commandContext(root)),
    NotFoundError,
  );
});
