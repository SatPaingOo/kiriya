import assert from "node:assert/strict";
import { test } from "node:test";
import { InterruptedError } from "../../../src/core/domain/errors.js";
import { SystemClockAdapter } from "../../../src/core/infrastructure/node/system-clock.adapter.js";

test("sleep resolves after its time, and an abort ends it at once with InterruptedError", async () => {
  const clock = new SystemClockAdapter();
  const started = performance.now();
  await clock.sleep(50, new AbortController().signal);
  assert.ok(performance.now() - started >= 40);

  const controller = new AbortController();
  const sleeping = clock.sleep(60_000, controller.signal);
  controller.abort();
  await assert.rejects(sleeping, InterruptedError);

  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(clock.sleep(10, aborted.signal), InterruptedError);
});
