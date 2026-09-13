import assert from "node:assert/strict";
import { test } from "node:test";
import { PathGuard } from "../../../src/core/application/path-guard.js";
import { FakeEnvironment } from "../../support/fakes.js";

function reasons(guard: PathGuard, cwd: string, targets: readonly string[]): Array<string | null> {
  return targets.map((target) => guard.reasonFor(target, cwd)?.key ?? null);
}

test("Windows rules, case-insensitive, on any host", () => {
  const guard = new PathGuard(
    new FakeEnvironment("windows", "C:\\Users\\dev", {
      SystemRoot: "C:\\Windows",
      ProgramFiles: "C:\\Program Files",
      ProgramData: "C:\\ProgramData",
      USERPROFILE: "C:\\Users\\dev",
    }),
  );
  assert.deepEqual(
    reasons(guard, "C:\\work\\app", [
      "C:\\",
      "D:\\",
      "c:\\users\\DEV",
      "C:\\work",
      "C:\\work\\app",
      "C:\\work\\app\\src",
      "C:\\Windows\\System32",
      "c:\\program files\\Git",
      "C:\\ProgramData",
      "C:\\ProgramData\\tool",
      "D:\\Users",
    ]),
    [
      "core.guard.drive-root",
      "core.guard.drive-root",
      "core.guard.home",
      "core.guard.working-folder",
      "core.guard.working-folder",
      null,
      "core.guard.system-folder",
      "core.guard.system-folder",
      "core.guard.system-location",
      null,
      "core.guard.system-location",
    ],
  );
});

test("Linux rules are case-sensitive", () => {
  const guard = new PathGuard(new FakeEnvironment("linux", "/home/dev"));
  assert.deepEqual(
    reasons(guard, "/home/dev/app", [
      "/",
      "/home/dev",
      "/home",
      "/usr/lib",
      "/tmp",
      "/tmp/x",
      "/HOME/dev",
      "/srv/data",
    ]),
    [
      "core.guard.drive-root",
      "core.guard.home",
      "core.guard.working-folder",
      "core.guard.system-folder",
      "core.guard.system-location",
      null,
      null,
      null,
    ],
  );
});

test("macOS rules are case-insensitive", () => {
  const guard = new PathGuard(new FakeEnvironment("macos", "/Users/dev"));
  assert.deepEqual(reasons(guard, "/Users/dev/app", ["/users/DEV", "/System/Library", "/opt", "/opt/homebrew"]), [
    "core.guard.home",
    "core.guard.system-folder",
    "core.guard.system-location",
    null,
  ]);
});
