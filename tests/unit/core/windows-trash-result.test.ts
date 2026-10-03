import assert from "node:assert/strict";
import { test } from "node:test";
import { CapabilityUnavailableError } from "../../../src/core/domain/errors.js";
import { readTrashResult } from "../../../src/core/infrastructure/platform/windows/windows-trash.adapter.js";

// Reproducing Constrained Language Mode needs a WDAC or AppLocker policy, which neither this
// machine nor a CI runner has, so the branch is reached through the output it would produce.
// The lines are the ones the adapter's own PowerShell prints.

const PATHS = ["C:\\work\\a.txt", "C:\\work\\b.txt"];

test("Constrained Language Mode is reported as a missing capability, naming the mode", () => {
  const thrown = (): unknown => readTrashResult("mode|ConstrainedLanguage", "", PATHS);
  assert.throws(thrown, (error: unknown) => {
    assert.ok(error instanceof CapabilityUnavailableError);
    assert.equal(error.detail.key, "core.trash.windows.language-mode");
    assert.equal(error.detail.params["mode"], "ConstrainedLanguage");
    return true;
  });
});

test("any mode that is not FullLanguage is refused, including one that was never printed", () => {
  for (const mode of ["RestrictedLanguage", "NoLanguage", ""]) {
    assert.throws(() => readTrashResult(`mode|${mode}`, "", PATHS), CapabilityUnavailableError, `mode ${mode}`);
  }
  // No mode line at all, as a PowerShell that died before the first write would leave.
  assert.throws(
    () => readTrashResult("", "something broke", PATHS),
    (error: unknown) => {
      assert.ok(error instanceof CapabilityUnavailableError);
      assert.equal(error.detail.params["mode"], "unknown");
      return true;
    },
  );
});

test("under FullLanguage each path gets its own outcome, in the order they were given", () => {
  const outcomes = readTrashResult("mode|FullLanguage\nok|0\nok|1", "", PATHS);
  assert.deepEqual(outcomes, [
    { path: PATHS[0], ok: true },
    { path: PATHS[1], ok: true },
  ]);
});

test("a network share, a removable drive and a failure each say why", () => {
  const outcomes = readTrashResult(
    "mode|FullLanguage\nnetwork|0\ndrive|1|Removable\nerror|2|SHFileOperation returned 124",
    "",
    [...PATHS, "E:\\pen\\c.txt"],
  );
  assert.equal(outcomes[0]?.ok, false);
  assert.equal(outcomes[0]?.ok === false ? outcomes[0].reason.key : null, "core.trash.windows.network");
  assert.equal(outcomes[1]?.ok === false ? outcomes[1].reason.key : null, "core.trash.windows.drive");
  assert.equal(outcomes[1]?.ok === false ? outcomes[1].reason.params["drive"] : null, "Removable");
  assert.equal(outcomes[2]?.ok === false ? outcomes[2].reason.key : null, "core.trash.failed");
});

test("a path the script said nothing about fails with the first line of stderr", () => {
  const outcomes = readTrashResult("mode|FullLanguage\nok|0", "Access is denied\nand more", PATHS);
  assert.equal(outcomes[0]?.ok, true);
  assert.equal(outcomes[1]?.ok, false);
  assert.equal(outcomes[1]?.ok === false ? outcomes[1].reason.params["detail"] : null, "Access is denied");
});

test("carriage returns and blank lines, as PowerShell actually writes them, are read the same", () => {
  const outcomes = readTrashResult("mode|FullLanguage\r\n\r\nok|0\r\nok|1\r\n", "", PATHS);
  assert.deepEqual(
    outcomes.map((outcome) => outcome.ok),
    [true, true],
  );
});
