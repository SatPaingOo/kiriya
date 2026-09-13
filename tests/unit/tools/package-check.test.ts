import assert from "node:assert/strict";
import { test } from "node:test";
import { packageProblems } from "../../../tools/package-check.js";

test("a package with the program, the readme, the licence and the changelog, and nothing else, passes", () => {
  const files = [
    "package.json",
    "README.md",
    "LICENSE",
    "CHANGELOG.md",
    "dist/src/main.js",
    "dist/src/core/domain/command.js",
  ];
  assert.deepEqual(packageProblems(files), []);
});

test("missing files, and tests, tools, sources and source maps, are problems", () => {
  const files = [
    "package.json",
    "dist/src/main.js",
    "dist/src/main.js.map",
    "dist/tests/unit/a.test.js",
    "dist/tools/check-package.js",
    "src/main.ts",
    "spike/README.md",
  ];
  assert.deepEqual(packageProblems(files), [
    "missing: README.md",
    "missing: LICENSE",
    "missing: CHANGELOG.md",
    "must not be published: dist/src/main.js.map",
    "must not be published: dist/tests/unit/a.test.js",
    "must not be published: dist/tools/check-package.js",
    "must not be published: src/main.ts",
    "must not be published: spike/README.md",
  ]);
});
