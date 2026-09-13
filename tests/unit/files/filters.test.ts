import assert from "node:assert/strict";
import { test } from "node:test";
import { parseExtensions } from "../../../src/modules/files/domain/filters.js";

test("extension flags become a lower-case list with dots", () => {
  assert.deepEqual(parseExtensions([".ts,tsx", " .MD "]), [".ts", ".tsx", ".md"]);
  assert.deepEqual(parseExtensions(["a,,b"]), [".a", ".b"]);
  assert.deepEqual(parseExtensions([]), []);
});
