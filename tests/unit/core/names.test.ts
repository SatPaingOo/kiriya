import assert from "node:assert/strict";
import { test } from "node:test";
import { byCodePoint, invalidNameReason, isHiddenName } from "../../../src/core/domain/names.js";

test("names that work on every OS pass", () => {
  for (const name of ["notes.md", "console.log", ".env", "a b", "résumé.txt"])
    assert.equal(invalidNameReason(name), null, name);
});

test("names that fail somewhere are rejected with the reason", () => {
  assert.equal(invalidNameReason(""), "core.name.empty");
  assert.equal(invalidNameReason(".."), "core.name.empty");
  assert.equal(invalidNameReason("a:b"), "core.name.characters");
  assert.equal(invalidNameReason(`a${String.fromCharCode(1)}`), "core.name.characters");
  assert.equal(invalidNameReason("file."), "core.name.trailing");
  assert.equal(invalidNameReason("file "), "core.name.trailing");
  assert.equal(invalidNameReason("con"), "core.name.reserved");
  assert.equal(invalidNameReason("LPT1.log"), "core.name.reserved");
});

test("code-point order ignores locale", () => {
  assert.deepEqual(["b", "a", "_", "B"].sort(byCodePoint), ["B", "_", "a", "b"]);
});

test("a leading dot hides a name", () => {
  assert.equal(isHiddenName(".git"), true);
  assert.equal(isHiddenName("git"), false);
});
