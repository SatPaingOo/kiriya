import assert from "node:assert/strict";
import { test } from "node:test";
import { releaseProblems } from "../../../tools/release-check.js";

const CHANGELOG = "# Changelog\n\n## [Unreleased]\n\n## [0.1.0] - 2026-10-01\n\n### Added\n\n- Everything.\n";

test("a public version whose tag and changelog section match may be published", () => {
  assert.deepEqual(releaseProblems({ tag: "v0.1.0", version: "0.1.0", isPrivate: false, changelog: CHANGELOG }), []);
});

test("a tag without v, a private package and a missing changelog section each stop the release", () => {
  assert.deepEqual(releaseProblems({ tag: "0.1.1", version: "0.1.1", isPrivate: true, changelog: CHANGELOG }), [
    "the tag 0.1.1 is not v0.1.1, the version in package.json",
    'package.json still says "private": true',
    'CHANGELOG.md has no "## [0.1.1] - YYYY-MM-DD" section',
  ]);
});

test("the unreleased 0.0.0 is never published, and a section heading must carry its date", () => {
  const problems = releaseProblems({
    tag: "v0.0.0",
    version: "0.0.0",
    isPrivate: false,
    changelog: "## [0.0.0]\n",
  });
  assert.deepEqual(problems, [
    "0.0.0 is not a version to release",
    'CHANGELOG.md has no "## [0.0.0] - YYYY-MM-DD" section',
  ]);
  assert.equal(releaseProblems({ tag: undefined, version: "1.0.0", isPrivate: false, changelog: CHANGELOG }).length, 2);
});
