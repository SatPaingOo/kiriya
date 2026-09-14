import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { RawInput } from "../../../src/core/domain/input-schema.js";
import { message } from "../../../src/core/domain/message.js";
import { NodeFileSystemAdapter } from "../../../src/core/infrastructure/node/node-file-system.adapter.js";
import { WaitForFile, waitFileSpec } from "../../../src/modules/wait/application/wait-file.use-case.js";
import { commandContext, expectDone, SteppingClock, temporaryFolder } from "../../support/fakes.js";

const parse = (positionals: readonly string[], options: RawInput["options"] = {}) =>
  waitFileSpec.input.parse({ positionals, options });

test("a file that appears after the second sleep is ready on the third attempt, found from the working folder", async (t) => {
  const root = await temporaryFolder(t);
  const target = path.join(root, "dist", "app.js");
  const clock = new SteppingClock(0, async (count) => {
    if (count !== 2) return;
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, "ready");
  });
  const result = expectDone(
    await new WaitForFile(new NodeFileSystemAdapter(), clock).execute(parse(["dist/app.js"]), commandContext(root)),
  );
  assert.deepEqual(result.data, { path: target, gone: false, ready: true, attempts: 3, waitedMs: 1_000 });
  assert.deepEqual(result.failures, []);
});

test("--gone waits until a path is removed, and a timeout names what is still there or never came", async (t) => {
  const root = await temporaryFolder(t);
  const lock = path.join(root, ".build.lock");
  await writeFile(lock, "");
  const files = new NodeFileSystemAdapter();

  const removing = new SteppingClock(0, () => rm(lock, { force: true }));
  const gone = expectDone(
    await new WaitForFile(files, removing).execute(parse([".build.lock"], { gone: true }), commandContext(root)),
  );
  assert.deepEqual([gone.data.ready, gone.data.gone, gone.data.attempts], [true, true, 2]);

  await writeFile(lock, "");
  const stays = expectDone(
    await new WaitForFile(files, new SteppingClock(0)).execute(
      parse([".build.lock"], { gone: true, timeout: "1" }),
      commandContext(root),
    ),
  );
  assert.deepEqual(stays.failures, [message("wait.file.still-there", { path: lock, seconds: 1 })]);

  const missing = expectDone(
    await new WaitForFile(files, new SteppingClock(0)).execute(
      parse(["never.txt"], { timeout: "1" }),
      commandContext(root),
    ),
  );
  assert.deepEqual(missing.failures, [
    message("wait.file.timed-out", { path: path.join(root, "never.txt"), seconds: 1 }),
  ]);
});
