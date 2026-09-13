import assert from "node:assert/strict";
import { test } from "node:test";
import { globToRegExp, hasGlob } from "../../../src/core/domain/glob.js";

function matches(pattern: string, paths: readonly string[]): string[] {
  const regex = globToRegExp(pattern);
  return paths.filter((item) => regex.test(item));
}

const PATHS = ["a.ts", "b.tsx", "README.md", "src/a.ts", "src/deep/c.TS", "a+b.txt", "axb.txt"];

test("* and ? stay within one folder", () => {
  assert.deepEqual(matches("*.ts", PATHS), ["a.ts"]);
  assert.deepEqual(matches("?.ts", PATHS), ["a.ts"]);
  assert.deepEqual(matches("src/*.ts", PATHS), ["src/a.ts"]);
});

test("** crosses folders, including none", () => {
  assert.deepEqual(matches("**/*.ts", PATHS), ["a.ts", "src/a.ts", "src/deep/c.TS"]);
  assert.deepEqual(matches("src/**", PATHS), ["src/a.ts", "src/deep/c.TS"]);
});

test("case is ignored", () => {
  assert.deepEqual(matches("readme.*", PATHS), ["README.md"]);
});

test("braces and brackets work as in bash", () => {
  assert.deepEqual(matches("*.{ts,tsx}", PATHS), ["a.ts", "b.tsx"]);
  assert.deepEqual(matches("[ab].ts", PATHS), ["a.ts"]);
  assert.deepEqual(matches("[!a].tsx", PATHS), ["b.tsx"]);
});

test("regular expression characters are literal", () => {
  assert.deepEqual(matches("a+b.txt", PATHS), ["a+b.txt"]);
});

test("hasGlob spots glob characters", () => {
  assert.equal(hasGlob("src/*.ts"), true);
  assert.equal(hasGlob("{a,b}"), true);
  assert.equal(hasGlob("plain/name.txt"), false);
});
