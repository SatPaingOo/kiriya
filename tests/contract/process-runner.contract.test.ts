import assert from "node:assert/strict";
import { realpath } from "node:fs/promises";
import { test } from "node:test";
import { CapabilityUnavailableError } from "../../src/core/domain/errors.js";
import { NodeProcessRunnerAdapter } from "../../src/core/infrastructure/node/node-process-runner.adapter.js";
import { temporaryFolder } from "../support/fakes.js";

const MISSING = "kiriya-no-such-program-4f1c";

test("process runner: arguments reach the program untouched, with its output and exit code", async () => {
  const runner = new NodeProcessRunnerAdapter();
  const script = "process.stdout.write(process.argv[1]); process.stderr.write('e'); process.exit(3)";
  const result = await runner.run(process.execPath, ["-e", script, "a b; echo $HOME & dir"]);
  assert.deepEqual(result, { code: 3, stdout: "a b; echo $HOME & dir", stderr: "e" });
});

test("process runner: runs in the folder it is given", async (t) => {
  const runner = new NodeProcessRunnerAdapter();
  const root = await temporaryFolder(t);
  const result = await runner.run(process.execPath, ["-e", "process.stdout.write(process.cwd())"], { cwd: root });
  assert.equal(await realpath(result.stdout), await realpath(root));
});

test("process runner: a program that is not installed is found nowhere and cannot start", async () => {
  const runner = new NodeProcessRunnerAdapter();
  assert.equal(await runner.find(MISSING), null);
  await assert.rejects(runner.run(MISSING, []), CapabilityUnavailableError);
});

test("process runner: finds node on PATH", async () => {
  assert.notEqual(await new NodeProcessRunnerAdapter().find("node"), null);
});
