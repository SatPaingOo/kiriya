import assert from "node:assert/strict";
import { test } from "node:test";
import {
  firstLine,
  majorityBranch,
  parseLeftRight,
  syncState,
} from "../../../src/modules/git/domain/repository-status.js";

test("the left-right count is behind, then ahead", () => {
  assert.deepEqual(parseLeftRight("2\t5\n"), { behind: 2, ahead: 5 });
  assert.equal(parseLeftRight(null), null);
  assert.equal(parseLeftRight("fatal: no upstream"), null);
});

test("sync state tells no upstream, in sync, and diverged apart", () => {
  assert.deepEqual(syncState({ ahead: null, behind: null }), { kind: "no-upstream" });
  assert.deepEqual(syncState({ ahead: 0, behind: 0 }), { kind: "in-sync" });
  assert.deepEqual(syncState({ ahead: 1, behind: 3 }), { kind: "diverged", ahead: 1, behind: 3 });
});

test("the majority branch exists only when repositories disagree", () => {
  assert.equal(majorityBranch(["main", "main"]), null);
  assert.equal(majorityBranch([]), null);
  assert.equal(majorityBranch(["main", "develop", "main"]), "main");
  assert.equal(majorityBranch(["main", "develop"]), "develop", "a tie goes to the first in code-point order");
});

test("the first line with text is trimmed", () => {
  assert.equal(firstLine("\n  fatal: could not read  \nmore"), "fatal: could not read");
  assert.equal(firstLine(""), "");
});
