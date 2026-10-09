import assert from "node:assert/strict";
import { test } from "node:test";
import { done } from "../../../src/core/domain/command.js";
import { message } from "../../../src/core/domain/message.js";
import { resultJson } from "../../../src/core/presentation/cli/json-output.js";
import { Translator } from "../../../src/core/presentation/i18n/translator.js";
import { en, type MessageKey } from "../../../src/i18n/locales/en.js";

const translator = new Translator(en);

test("placeholders are filled from parameters", () => {
  assert.equal(translator.text(message("core.fs.not-found", { path: "a.txt" })), "Not found: a.txt");
  assert.equal(translator.text(message("files.find.total", { count: 3, size: "1 KB" })), "3 found, 1 KB in files");
});

test("a message inside a parameter is translated in place", () => {
  const nested = message("files.delete.failed", { path: "a", reason: message("core.trash.other-device") });
  assert.equal(translator.text(nested), "a: it is on another drive than the trash; use --permanent");
});

test("a missing parameter stays visible instead of vanishing", () => {
  assert.equal(translator.text(message("core.fs.not-found")), "Not found: {path}");
});

/**
 * A plugin names its own keys and writes its own placeholders, and both are looked up in a
 * plain object. `constructor` and the rest of `Object.prototype` answered with a function:
 * as a template that threw, because a function has no `replace`, and as a parameter it
 * printed JavaScript source into a message.
 */
test("a key or placeholder named after one of JavaScript's own members reads as absent", () => {
  // A plugin's keys are real at runtime but are not in kiriya's own union, as here.
  const key = (name: string): MessageKey => name as MessageKey;
  const fromPlugin = new Translator({ "plugin.greet": "hello {constructor}" });

  assert.equal(fromPlugin.text(message(key("plugin.greet"), { name: "x" })), "hello {constructor}");
  assert.equal(fromPlugin.text(message(key("plugin.greet"), { constructor: "world" })), "hello world");
  // A key the catalog does not hold shows as the key, which is what any missing one must do.
  assert.equal(fromPlugin.text(message(key("constructor"))), "constructor");
  assert.equal(fromPlugin.text(message(key("toString"))), "toString");
});

test("JSON keeps keys and parameters of nested messages and adds their text", () => {
  const failure = message("files.delete.failed", { path: "a", reason: message("core.trash.other-device") });
  const json = JSON.parse(resultJson("files.delete", done({ n: 1 }, { failures: [failure] }), translator)) as {
    ok: boolean;
    kind: string;
    data: { n: number };
    failures: Array<{ key: string; text: string; params: { path: string; reason: { key: string; text: string } } }>;
  };
  assert.equal(json.ok, false);
  assert.equal(json.kind, "done");
  assert.deepEqual(json.data, { n: 1 });
  assert.equal(json.failures[0]?.key, "files.delete.failed");
  assert.equal(json.failures[0]?.params.path, "a");
  assert.equal(json.failures[0]?.params.reason.key, "core.trash.other-device");
  assert.equal(json.failures[0]?.params.reason.text, "it is on another drive than the trash; use --permanent");
});
