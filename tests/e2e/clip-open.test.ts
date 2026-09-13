import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { runKiriya } from "../support/cli.js";
import { layout, temporaryFolder } from "../support/fakes.js";

/** A file each OS would run when opened. */
const PROGRAM_FILE =
  process.platform === "win32" ? "run.bat" : process.platform === "darwin" ? "run.command" : "run.desktop";
const HAS_DISPLAY =
  process.platform !== "linux" ||
  (process.env["WAYLAND_DISPLAY"] ?? "") !== "" ||
  (process.env["DISPLAY"] ?? "") !== "";

test("open refuses other schemes, files that would run and missing files, without starting anything", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, { [PROGRAM_FILE]: "x" });
  const expected: ReadonlyArray<readonly [string, RegExp]> = [
    ["javascript:alert(1)", /only http, https and mailto/],
    [PROGRAM_FILE, /would run it as a program/],
    ["missing.txt", /missing\.txt/],
  ];
  for (const [target, pattern] of expected) {
    const run = runKiriya(root, ["open", target]);
    assert.equal(run.code, 1, `${target}: ${run.stdout}${run.stderr}`);
    assert.match(run.stderr, pattern);
  }
});

test(
  "without a display, clip says this session has no clipboard",
  { skip: process.platform === "linux" && !HAS_DISPLAY ? false : "Linux without a display only" },
  () => {
    const run = runKiriya(tmpdir(), ["clip", "paste"]);
    assert.equal(run.code, 1);
    assert.match(run.stderr, /no display/);
  },
);

test("clip copy with nothing to copy is a usage error", () => {
  const run = runKiriya(tmpdir(), ["clip", "copy", ""]);
  assert.equal(run.code, 2, run.stderr);
  assert.match(run.stderr, /no text to copy/);
});
