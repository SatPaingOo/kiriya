import assert from "node:assert/strict";
import { test } from "node:test";
import { planSync, type TreeSnapshot } from "../../../src/modules/files/domain/sync-plan.js";

function tree(files: Readonly<Record<string, readonly [number, number]>>, directories: string[] = []): TreeSnapshot {
  return {
    files: new Map(Object.entries(files).map(([rel, [size, modifiedMs]]) => [rel, { size, modifiedMs }])),
    directories: new Set(directories),
  };
}

test("new files are copied and changed ones updated, within a 2-second tolerance", () => {
  const plan = planSync(
    tree({
      "b.txt": [1, 10_000],
      "a.txt": [5, 10_000],
      "same.txt": [3, 10_000],
      "fat.txt": [3, 10_000],
      "newer.txt": [3, 20_000],
    }),
    tree({ "same.txt": [3, 10_000], "fat.txt": [3, 11_999], "newer.txt": [3, 10_000], "a.txt": [4, 10_000] }),
    false,
  );
  assert.deepEqual(plan.copy, ["b.txt"]);
  assert.deepEqual(plan.update, ["a.txt", "newer.txt"]);
  assert.equal(plan.bytes, 9);
  assert.deepEqual(plan.remove, []);
  assert.deepEqual(plan.removeDirectories, []);
});

test("with delete, files only in the target go, and their folders deepest first", () => {
  const plan = planSync(
    tree({ "keep.txt": [1, 0] }, ["kept"]),
    tree({ "keep.txt": [1, 0], "old/deep/x.txt": [1, 0], "z.txt": [2, 0] }, ["kept", "old", "old/deep"]),
    true,
  );
  assert.deepEqual(plan.remove, ["old/deep/x.txt", "z.txt"]);
  assert.deepEqual(plan.removeDirectories, ["old/deep", "old"]);
});
