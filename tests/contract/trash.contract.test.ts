import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import type { Trash } from "../../src/core/domain/ports/trash.js";
import { NodeEnvironmentAdapter } from "../../src/core/infrastructure/node/node-environment.adapter.js";
import { NodeFileSystemAdapter } from "../../src/core/infrastructure/node/node-file-system.adapter.js";
import { FreedesktopTrashAdapter } from "../../src/core/infrastructure/platform/linux/freedesktop-trash.adapter.js";
import { MacosTrashAdapter } from "../../src/core/infrastructure/platform/macos/macos-trash.adapter.js";
import { WindowsTrashAdapter } from "../../src/core/infrastructure/platform/windows/windows-trash.adapter.js";
import { layout, temporaryFolder } from "../support/fakes.js";

/**
 * Uses the real trash of the machine it runs on, so it only runs when asked:
 * KIRIYA_TEST_REAL_TRASH=1. CI sets it; a developer's own trash stays untouched.
 */
const SKIP =
  process.env["KIRIYA_TEST_REAL_TRASH"] === "1" ? false : "set KIRIYA_TEST_REAL_TRASH=1 to use the real trash";

function osTrash(): Trash {
  const environment = new NodeEnvironmentAdapter();
  switch (environment.os) {
    case "windows":
      return new WindowsTrashAdapter();
    case "macos":
      return new MacosTrashAdapter(environment);
    case "linux":
      return new FreedesktopTrashAdapter(environment);
  }
}

test("the trash takes a file and a folder, and reports each one", { skip: SKIP }, async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, { "kiriya-contract-file.txt": "x", "kiriya-contract-folder/inner.txt": "y" });
  const targets = [path.join(root, "kiriya-contract-file.txt"), path.join(root, "kiriya-contract-folder")];

  const outcomes = await osTrash().send(targets);

  assert.deepEqual(
    outcomes.map((outcome) => [outcome.path, outcome.ok]),
    targets.map((target) => [target, true]),
  );
  const fileSystem = new NodeFileSystemAdapter();
  for (const target of targets) assert.equal(await fileSystem.lstat(target), null);
});

test("the trash names its location with a catalog key", () => {
  assert.match(osTrash().location, /^core\.trash\.location\./);
});
