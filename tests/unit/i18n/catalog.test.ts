import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { en } from "../../../src/i18n/locales/en.js";

const SOURCE_ROOT = fileURLToPath(new URL("../../../../src/", import.meta.url));

function sourceText(): string {
  return readdirSync(SOURCE_ROOT, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".ts") && !file.startsWith(path.join("i18n", "locales")))
    .map((file) => readFileSync(path.join(SOURCE_ROOT, file), "utf8"))
    .join("\n");
}

test("every catalog key is used somewhere in the source", () => {
  const source = sourceText();
  const unused = Object.keys(en).filter((key) => !source.includes(`"${key}"`));
  assert.deepEqual(unused, []);
});

test("placeholders are plain names", () => {
  const broken = Object.entries(en).filter(([, text]) => /\{(?![A-Za-z0-9]+\})/.test(text));
  assert.deepEqual(broken, []);
});
