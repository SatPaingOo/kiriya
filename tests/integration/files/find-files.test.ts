import assert from "node:assert/strict";
import { utimes } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { NotFoundError } from "../../../src/core/domain/errors.js";
import { NodeFileSystemAdapter } from "../../../src/core/infrastructure/node/node-file-system.adapter.js";
import { FindFiles, type FindInput } from "../../../src/modules/files/application/find-files.use-case.js";
import { commandContext, expectDone, FixedClock, layout, relativeTo, temporaryFolder } from "../../support/fakes.js";

const DAY = 86_400_000;
const find = new FindFiles(new NodeFileSystemAdapter(), new FixedClock(Date.now()));

function input(overrides: Partial<FindInput> = {}): FindInput {
  return {
    folder: ".",
    name: undefined,
    extensions: [],
    type: undefined,
    larger: undefined,
    smaller: undefined,
    newer: undefined,
    older: undefined,
    empty: false,
    all: false,
    limit: 200,
    ...overrides,
  };
}

async function tree(t: TestContext): Promise<string> {
  const root = await temporaryFolder(t);
  await layout(root, {
    "src/app.ts": "x".repeat(100),
    "src/app.test.ts": "",
    "src/deep/util.TS": "abc",
    "node_modules/pkg/index.ts": "",
    "docs/": "",
    "readme.md": "hello",
  });
  const old = new Date(Date.now() - 400 * DAY);
  await utimes(path.join(root, "readme.md"), old, old);
  return root;
}

async function found(root: string, overrides: Partial<FindInput>): Promise<string[]> {
  const result = expectDone(await find.execute(input(overrides), commandContext(root)));
  return relativeTo(
    root,
    result.data.matches.map((match) => match.path),
  );
}

test("by name: a glob matches the name, or the relative path when it has a slash", async (t) => {
  const root = await tree(t);
  assert.deepEqual(await found(root, { name: "*.test.ts" }), ["src/app.test.ts"]);
  assert.deepEqual(await found(root, { name: "src/**/*.ts" }), ["src/app.test.ts", "src/app.ts", "src/deep/util.TS"]);
});

test("by extension, ignoring case, skipping dependency folders unless --all", async (t) => {
  const root = await tree(t);
  assert.deepEqual(await found(root, { extensions: [".ts"] }), ["src/app.test.ts", "src/app.ts", "src/deep/util.TS"]);
  assert.deepEqual(await found(root, { extensions: [".ts"], all: true }), [
    "node_modules/pkg/index.ts",
    "src/app.test.ts",
    "src/app.ts",
    "src/deep/util.TS",
  ]);
});

test("by type and emptiness", async (t) => {
  const root = await tree(t);
  assert.deepEqual(await found(root, { type: "dir", empty: true }), ["docs"]);
  assert.deepEqual(await found(root, { type: "file", empty: true }), ["src/app.test.ts"]);
});

test("by size and age", async (t) => {
  const root = await tree(t);
  assert.deepEqual(await found(root, { larger: 50 }), ["src/app.ts"]);
  assert.deepEqual(await found(root, { smaller: 4 }), ["src/app.test.ts", "src/deep/util.TS"]);
  assert.deepEqual(await found(root, { older: "1y" }), ["readme.md"]);
  assert.deepEqual(await found(root, { newer: "1y", type: "file" }), [
    "src/app.test.ts",
    "src/app.ts",
    "src/deep/util.TS",
  ]);
});

test("--limit caps the list but not the totals", async (t) => {
  const root = await tree(t);
  const result = expectDone(await find.execute(input({ extensions: [".ts"], limit: 1 }), commandContext(root)));
  assert.equal(result.data.matches.length, 1);
  assert.equal(result.data.total, 3);
  assert.equal(result.data.totalBytes, 103);
});

test("the folder must exist and be a folder", async (t) => {
  const root = await tree(t);
  await assert.rejects(find.execute(input({ folder: "missing" }), commandContext(root)), NotFoundError);
  await assert.rejects(
    find.execute(input({ folder: "readme.md" }), commandContext(root)),
    (error: unknown) => error instanceof NotFoundError && error.detail.key === "core.path.not-a-folder",
  );
});
