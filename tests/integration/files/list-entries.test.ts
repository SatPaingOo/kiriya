import assert from "node:assert/strict";
import { test } from "node:test";
import { NotFoundError } from "../../../src/core/domain/errors.js";
import { NodeFileSystemAdapter } from "../../../src/core/infrastructure/node/node-file-system.adapter.js";
import { ListEntries, type ListInput } from "../../../src/modules/files/application/list-entries.use-case.js";
import { commandContext, expectDone, layout, temporaryFolder } from "../../support/fakes.js";

const list = new ListEntries(new NodeFileSystemAdapter());

function input(overrides: Partial<ListInput> = {}): ListInput {
  return { path: ".", all: false, sort: "name", reverse: false, ...overrides };
}

async function names(root: string, overrides: Partial<ListInput> = {}): Promise<string[]> {
  const result = expectDone(await list.execute(input(overrides), commandContext(root)));
  return result.data.entries.map((entry) => entry.name);
}

test("folders first, then code-point order; hidden entries counted but not shown", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, { "b.txt": "12345", "A.txt": "1", "sub/": "", ".hidden": "" });
  assert.deepEqual(await names(root), ["sub", "A.txt", "b.txt"]);
  const result = expectDone(await list.execute(input(), commandContext(root)));
  assert.equal(result.data.hidden, 1);
  assert.deepEqual(await names(root, { all: true }), ["sub", ".hidden", "A.txt", "b.txt"]);
});

test("sorting by size and reversing", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, { "b.txt": "12345", "A.txt": "1", "sub/": "" });
  assert.deepEqual(await names(root, { sort: "size" }), ["b.txt", "A.txt", "sub"]);
  assert.deepEqual(await names(root, { reverse: true }), ["b.txt", "A.txt", "sub"]);
});

test("a file lists itself, and a missing path is not found", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, { "b.txt": "12345" });
  const result = expectDone(await list.execute(input({ path: "b.txt" }), commandContext(root)));
  assert.deepEqual(
    result.data.entries.map((entry) => [entry.name, entry.kind, entry.size]),
    [["b.txt", "file", 5]],
  );
  await assert.rejects(list.execute(input({ path: "missing" }), commandContext(root)), NotFoundError);
});
