import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { NotFoundError, UsageError } from "../../../src/core/domain/errors.js";
import { NodeFileSystemAdapter } from "../../../src/core/infrastructure/node/node-file-system.adapter.js";
import { expandPaths, measure, outermost } from "../../../src/core/application/paths.js";
import { layout, relativeTo, temporaryFolder } from "../../support/fakes.js";

const fileSystem = new NodeFileSystemAdapter();

test("an existing path is literal, even with glob characters in its name", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, { "[draft].md": "", "d.md": "" });
  assert.deepEqual(relativeTo(root, await expandPaths(fileSystem, ["[draft].md"], root, false)), ["[draft].md"]);
});

test("globs are expanded by kiriya, skipping hidden entries unless asked", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, { "a.txt": "", "b.txt": "", "sub/c.txt": "", ".env": "", "a.env": "" });
  const expand = async (args: readonly string[], all = false) =>
    relativeTo(root, await expandPaths(fileSystem, args, root, all));
  assert.deepEqual(await expand(["*.txt"]), ["a.txt", "b.txt"]);
  assert.deepEqual(await expand(["**/*.txt"]), ["a.txt", "b.txt", "sub/c.txt"]);
  assert.deepEqual(await expand(["sub/*.txt"]), ["sub/c.txt"]);
  assert.deepEqual(await expand(["*.env"]), ["a.env"]);
  assert.deepEqual(await expand([".*"]), [".env"]);
  assert.deepEqual(await expand(["*.env"], true), [".env", "a.env"]);
  assert.deepEqual(await expand(["a.txt", "*.txt"]), ["a.txt", "b.txt"]);
});

test("backslashes separate folders in a Windows glob", { skip: process.platform !== "win32" }, async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, { "sub/c.txt": "" });
  assert.deepEqual(relativeTo(root, await expandPaths(fileSystem, ["sub\\*.txt"], root, false)), ["sub/c.txt"]);
});

test("a missing literal is not found; a glob without matches is a usage error", async (t) => {
  const root = await temporaryFolder(t);
  await assert.rejects(expandPaths(fileSystem, ["nope.txt"], root, false), NotFoundError);
  await assert.rejects(
    expandPaths(fileSystem, ["*.zzz"], root, false),
    (error: unknown) => error instanceof UsageError && error.detail.key === "core.glob.no-match",
  );
});

test("outermost drops paths inside other selected folders", () => {
  const a = path.resolve("r", "a");
  assert.deepEqual(outermost([path.join(a, "b"), a, path.resolve("r", "ab")]), [a, path.resolve("r", "ab")]);
});

test("measure counts everything inside a folder", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, { "m/one.txt": "123", "m/sub/two.txt": "12345" });
  assert.deepEqual(await measure(fileSystem, path.join(root, "m")), { bytes: 8, files: 2, directories: 1 });
  assert.deepEqual(await measure(fileSystem, path.join(root, "m", "one.txt")), { bytes: 3, files: 1, directories: 0 });
  assert.deepEqual(await measure(fileSystem, path.join(root, "missing")), { bytes: 0, files: 0, directories: 0 });
});
