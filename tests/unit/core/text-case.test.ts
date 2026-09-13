import assert from "node:assert/strict";
import { test } from "node:test";
import { toCase, type TextCase } from "../../../src/core/domain/text-case.js";

test("text changes case at separators, case changes and digits", () => {
  const cases: ReadonlyArray<readonly [string, TextCase, string]> = [
    ["user profile id", "camel", "userProfileId"],
    ["OrderItems", "kebab", "order-items"],
    ["XMLHttpRequest", "snake", "xml_http_request"],
    ["api key v2", "constant", "API_KEY_V2"],
    ["hello_world", "title", "Hello World"],
    ["hello-world", "pascal", "HelloWorld"],
    ["ကိရိယာ toolbox", "kebab", "ကိရိယာ-toolbox"],
  ];
  for (const [text, style, expected] of cases) assert.equal(toCase(text, style), expected, `${text} -> ${style}`);
});

test("lower and upper keep everything but the case, and text without words stays as it is", () => {
  assert.equal(toCase("Mixed Case-Text", "lower"), "mixed case-text");
  assert.equal(toCase("Mixed Case-Text", "upper"), "MIXED CASE-TEXT");
  assert.equal(toCase("---", "kebab"), "---");
  assert.equal(toCase("", "camel"), "");
});
