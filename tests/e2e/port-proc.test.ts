import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { runKiriya, runKiriyaAsync } from "../support/cli.js";
import { exited, startListener, startMarker } from "../support/processes.js";

const CWD = tmpdir();

test("port who names the process listening on a port", async (t) => {
  const { pid, port } = await startListener(t);
  const run = runKiriya(CWD, ["port", "who", String(port), "--json"]);
  assert.equal(run.code, 0, run.stderr);
  const { data } = JSON.parse(run.stdout) as {
    data: { listeners: Array<{ pid: number | null; name: string | null }> };
  };
  assert.ok(
    data.listeners.some((listener) => listener.pid === pid && /node/i.test(listener.name ?? "")),
    run.stdout,
  );
});

test("port kill refuses without a typed confirmation, and ends the listener with one", async (t) => {
  const { child, port } = await startListener(t);
  const refused = await runKiriyaAsync(CWD, ["port", "kill", String(port)]);
  assert.equal(refused.code, 1, refused.stdout + refused.stderr);
  assert.equal(child.exitCode, null);

  const gone = exited(child);
  const ended = await runKiriyaAsync(CWD, ["port", "kill", String(port), `--confirm=${port}`]);
  assert.equal(ended.code, 0, ended.stdout + ended.stderr);
  await gone;
});

test("proc find finds a process by its command line, and proc tree shows it under its parent", async (t) => {
  const marker = `kiriya-e2e-marker-${process.pid}`;
  const { pid } = await startMarker(t, marker);
  const found = await runKiriyaAsync(CWD, ["proc", "find", marker, "--json"]);
  assert.equal(found.code, 0, found.stderr);
  const listed = JSON.parse(found.stdout) as { data: { processes: Array<{ pid: number }> } };
  assert.deepEqual(
    listed.data.processes.map((entry) => entry.pid),
    [pid],
  );

  const tree = await runKiriyaAsync(CWD, ["proc", "tree", String(process.pid), "--json"]);
  assert.equal(tree.code, 0, tree.stderr);
  const { rows } = (JSON.parse(tree.stdout) as { data: { rows: Array<{ pid: number; depth: number }> } }).data;
  assert.equal(rows[0]?.pid, process.pid);
  assert.ok(rows.some((row) => row.pid === pid && row.depth === 1));
});

test("proc kill stops on a --confirm that does not match and ends the process on one that does", async (t) => {
  const { child, pid } = await startMarker(t, "kiriya-e2e-kill");
  const mismatch = await runKiriyaAsync(CWD, ["proc", "kill", String(pid), "--confirm=0"]);
  assert.equal(mismatch.code, 1);
  assert.match(mismatch.stdout + mismatch.stderr, /does not match/);

  const gone = exited(child);
  const ended = await runKiriyaAsync(CWD, ["proc", "kill", String(pid), `--confirm=${pid}`, "--force"]);
  assert.equal(ended.code, 0, ended.stdout + ended.stderr);
  await gone;
});

test("port free prints one port number, from --from on", () => {
  const free = runKiriya(CWD, ["port", "free", "--from", "45000"]);
  assert.equal(free.code, 0, free.stderr);
  assert.match(free.stdout, /^\d+\n$/);
  assert.ok(Number(free.stdout) >= 45_000);
});
