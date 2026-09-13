import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { UsageError } from "../../../src/core/domain/errors.js";
import { NodeEnvironmentAdapter } from "../../../src/core/infrastructure/node/node-environment.adapter.js";
import { NodeFileSystemAdapter } from "../../../src/core/infrastructure/node/node-file-system.adapter.js";
import { CreatePaths, createSpec } from "../../../src/modules/files/application/create-paths.use-case.js";
import { commandContext, expectDone, layout, temporaryFolder } from "../../support/fakes.js";

const create = new CreatePaths(new NodeFileSystemAdapter(), new NodeEnvironmentAdapter());

test("creates files with missing parents, and folders from a trailing slash", async (t) => {
  const root = await temporaryFolder(t);
  const result = expectDone(
    await create.execute({ paths: ["a/b/c.txt", "src/"], directory: false, content: "hi" }, commandContext(root)),
  );
  assert.equal(await readFile(path.join(root, "a", "b", "c.txt"), "utf8"), "hi");
  assert.ok((await stat(path.join(root, "src"))).isDirectory());
  assert.deepEqual(
    result.data.items.map((item) => [item.kind, item.created]),
    [
      ["file", true],
      ["directory", true],
    ],
  );
  assert.deepEqual(result.failures, []);
});

test("--dir makes every path a folder", async (t) => {
  const root = await temporaryFolder(t);
  await create.execute({ paths: ["x", "y/z"], directory: true, content: undefined }, commandContext(root));
  assert.ok((await stat(path.join(root, "x"))).isDirectory());
  assert.ok((await stat(path.join(root, "y", "z"))).isDirectory());
});

test("never touches something that exists", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, { "notes.md": "keep" });
  const result = expectDone(
    await create.execute({ paths: ["notes.md"], directory: false, content: "new" }, commandContext(root)),
  );
  assert.deepEqual(
    result.failures.map((failure) => failure.key),
    ["core.fs.exists"],
  );
  assert.equal(await readFile(path.join(root, "notes.md"), "utf8"), "keep");
});

test("rejects names that would not work on every OS, and creates nothing for them", async (t) => {
  const root = await temporaryFolder(t);
  const result = expectDone(
    await create.execute(
      { paths: ["bad:name.txt", "CON.txt", "trail."], directory: false, content: undefined },
      commandContext(root),
    ),
  );
  assert.deepEqual(
    result.failures.map((failure) => failure.key),
    ["core.name.characters", "core.name.reserved", "core.name.trailing"],
  );
  assert.deepEqual(await readdir(root), []);
});

test("--content with --dir is a usage error", () => {
  assert.throws(
    () => createSpec.input.parse({ positionals: ["a"], options: { dir: true, content: "x" } }),
    (error: unknown) => error instanceof UsageError && error.detail.key === "files.new.content-with-dir",
  );
});
