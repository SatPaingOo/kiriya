import assert from "node:assert/strict";
import { test } from "node:test";
import { runProgram } from "../../../src/core/infrastructure/node/run-program.js";

test("a program that exits without reading its input does not crash the caller", async () => {
  // Writing to a pipe whose reader has gone raises EPIPE, which once escaped as an unhandled error.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await runProgram(process.execPath, ["-e", "process.exit(0)"], {
      input: "x".repeat(4 * 1024 * 1024),
    });
    assert.equal(result.code, 0);
  }
});

test("a program run without input sees its input end at once", async () => {
  const script = "process.stdin.resume(); process.stdin.on('end', () => process.stdout.write('ended'))";
  const result = await runProgram(process.execPath, ["-e", script], { timeoutMs: 10_000 });
  assert.deepEqual([result.code, result.stdout], [0, "ended"]);
});
