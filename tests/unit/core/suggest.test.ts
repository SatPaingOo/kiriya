import assert from "node:assert/strict";
import { test } from "node:test";
import { closest } from "../../../src/core/presentation/cli/suggest.js";

test("the closest name within two edits is suggested", () => {
  assert.equal(closest("lst", ["delete", "find", "list", "new"]), "list");
  assert.equal(closest("FILES", ["files"]), "files");
  assert.equal(closest("zzzz", ["delete", "find", "list", "new"]), undefined);
});
