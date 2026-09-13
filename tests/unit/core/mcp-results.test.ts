import assert from "node:assert/strict";
import { test } from "node:test";
import { done } from "../../../src/core/domain/command.js";
import { RefusedError } from "../../../src/core/domain/errors.js";
import { message } from "../../../src/core/domain/message.js";
import { Translator } from "../../../src/core/presentation/i18n/translator.js";
import { commandToolResult, errorToolResult, limitDocument } from "../../../src/core/presentation/mcp/tool-results.js";

/** Shows each key as its own text, so the tests do not depend on wording. */
const keys = new Translator({});

test("a document that fits is left whole", () => {
  const document = { ok: true, data: { names: ["a", "b"], note: "short" } };
  assert.deepEqual(limitDocument(document, { items: 200, characters: 40_000 }), document);
});

test("a long list keeps its first items and says how many were left out", () => {
  const list = Array.from({ length: 500 }, (_, index) => index);
  assert.deepEqual(limitDocument({ ok: true, data: { list } }, { items: 200, characters: 1_000_000 }), {
    ok: true,
    data: { list: list.slice(0, 200) },
    truncated: [{ at: "data.list", omitted: 300, unit: "items" }],
  });
});

test("a long text is cut tighter each round until the whole document fits", () => {
  const limited = limitDocument({ ok: true, data: { text: "x".repeat(10_000) } }, { items: 200, characters: 2000 });
  assert.ok(JSON.stringify(limited).length <= 2000);
  assert.deepEqual(limited["truncated"], [{ at: "data.text", omitted: 9000, unit: "characters" }]);
});

test("a result repeats its JSON as text, adds what a program printed, and is an error when something failed", () => {
  const listed = commandToolResult("files.list", done({ names: ["a"] }), "", keys);
  assert.equal(listed.isError, false);
  assert.deepEqual(listed.structuredContent, {
    ok: true,
    command: "files.list",
    kind: "done",
    data: { names: ["a"] },
    warnings: [],
    failures: [],
  });
  assert.deepEqual(listed.content, [{ type: "text", text: JSON.stringify(listed.structuredContent) }]);

  const failure = message("files.delete.failed", { path: "a", reason: "b" });
  const logs = commandToolResult(
    "docker.logs",
    done({ project: "app" }, { failures: [failure] }),
    "api | ready\n",
    keys,
  );
  assert.equal(logs.isError, true);
  assert.equal(logs.structuredContent["ok"], false);
  assert.equal(logs.structuredContent["output"], "api | ready\n");
});

test("a typed error is an error result that names its kind and message", () => {
  const result = errorToolResult(new RefusedError("core.mcp.outside-roots", { path: "../x", roots: "/work" }), keys);
  assert.equal(result.isError, true);
  assert.deepEqual(result.structuredContent, {
    ok: false,
    error: {
      kind: "refused",
      message: {
        key: "core.mcp.outside-roots",
        params: { path: "../x", roots: "/work" },
        text: "core.mcp.outside-roots",
      },
    },
  });
});
