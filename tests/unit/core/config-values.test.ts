import assert from "node:assert/strict";
import { test } from "node:test";
import { checkConfigTypes, pluginEntries } from "../../../src/core/application/config-values.js";
import { OperationFailedError } from "../../../src/core/domain/errors.js";

test("a known setting of the wrong type names the file and the field; unknown settings pass", () => {
  assert.throws(
    () => checkConfigTypes({ plugins: "one" }, "/cfg.json"),
    (error: unknown) =>
      error instanceof OperationFailedError &&
      error.detail.key === "core.config.wrong-type" &&
      error.detail.params["field"] === "plugins",
  );
  assert.doesNotThrow(() => checkConfigTypes({ plugins: ["one"], someday: "x" }, "/cfg.json"));
});

test("plugin entries come from the plugins list, and from nothing else", () => {
  assert.deepEqual(pluginEntries({ plugins: ["a", "./b"] }), ["a", "./b"]);
  assert.deepEqual(pluginEntries({ plugins: "a" }), []);
  assert.deepEqual(pluginEntries({}), []);
});
