import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyTarget, runsWhenOpened } from "../../../src/modules/open/domain/targets.js";

test("web and mail addresses open, other schemes are refused, and drive letters are paths", () => {
  assert.deepEqual(classifyTarget("https://example.com/docs"), { kind: "url", url: "https://example.com/docs" });
  assert.deepEqual(classifyTarget("MAILTO:dev@example.com"), { kind: "url", url: "MAILTO:dev@example.com" });
  assert.deepEqual(classifyTarget("javascript:alert(1)"), { kind: "refused", scheme: "javascript" });
  assert.deepEqual(classifyTarget("file:///etc/passwd"), { kind: "refused", scheme: "file" });
  assert.deepEqual(classifyTarget("ms-settings:privacy"), { kind: "refused", scheme: "ms-settings" });
  assert.deepEqual(classifyTarget("C:\\Users\\dev\\notes.txt"), { kind: "path", path: "C:\\Users\\dev\\notes.txt" });
  assert.deepEqual(classifyTarget("docs/readme.md"), { kind: "path", path: "docs/readme.md" });
});

test("files that each OS would run as a program are recognised", () => {
  assert.equal(runsWhenOpened("setup.EXE", "windows"), true);
  assert.equal(runsWhenOpened("build.js", "windows"), true);
  assert.equal(runsWhenOpened("build.js", "linux"), false);
  assert.equal(runsWhenOpened("Terminal.app", "macos"), true);
  assert.equal(runsWhenOpened("deploy.command", "macos"), true);
  assert.equal(runsWhenOpened("editor.desktop", "linux"), true);
  assert.equal(runsWhenOpened("report.pdf", "windows"), false);
});
