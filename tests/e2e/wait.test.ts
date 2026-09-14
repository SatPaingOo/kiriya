import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer, type AddressInfo } from "node:net";
import path from "node:path";
import { test } from "node:test";
import { runKiriyaAsync } from "../support/cli.js";
import { temporaryFolder } from "../support/fakes.js";

/** A port that nothing listens on when it is returned. */
async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const { port } = probe.address() as AddressInfo;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}

/** Closes a server whether or not it ever started listening. */
const close = (server: { close(callback: () => void): unknown }): Promise<void> =>
  new Promise((resolve) => {
    server.close(() => resolve());
  });

test("wait port returns once a server starts listening, and exits with 1 when none does in time", async (t) => {
  const root = await temporaryFolder(t);
  const port = await freePort();
  const server = createServer((socket) => socket.destroy());
  const starting = setTimeout(() => server.listen(port, "127.0.0.1"), 700);
  try {
    const run = await runKiriyaAsync(root, ["wait", "port", `127.0.0.1:${port}`, "--timeout", "30"]);
    assert.equal(run.code, 0, run.stderr);
    assert.ok(run.stdout.startsWith(`127.0.0.1:${port} is listening`), run.stdout);
  } finally {
    clearTimeout(starting);
    await close(server);
  }

  const closed = await freePort();
  const late = await runKiriyaAsync(root, ["wait", "port", `127.0.0.1:${closed}`, "--timeout", "1", "--json"]);
  assert.equal(late.code, 1, late.stderr);
  const json = JSON.parse(late.stdout) as { ok: boolean; data: { ready: boolean }; failures: Array<{ key: string }> };
  assert.deepEqual([json.ok, json.data.ready, json.failures[0]?.key], [false, false, "wait.port.timed-out"]);
});

test("wait url returns when the address answers 200, and wait file when the file appears", async (t) => {
  const root = await temporaryFolder(t);
  let calls = 0;
  const server = createHttpServer((_request, response) => {
    calls += 1;
    response.writeHead(calls < 3 ? 503 : 200).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const url = `http://127.0.0.1:${port}/health`;
    const run = await runKiriyaAsync(root, ["wait", "url", url, "--timeout", "30"]);
    assert.equal(run.code, 0, run.stderr);
    assert.ok(run.stdout.startsWith(`${url} answered 200`), run.stdout);
    assert.equal(calls, 3);
  } finally {
    server.closeAllConnections();
    await close(server);
  }

  const appearing = setTimeout(() => writeFileSync(path.join(root, "ready.txt"), "ok"), 700);
  try {
    const run = await runKiriyaAsync(root, ["wait", "file", "ready.txt", "--timeout", "30"]);
    assert.equal(run.code, 0, run.stderr);
    assert.match(run.stdout, /^ready\.txt exists, after \d+\.\d s/);
  } finally {
    clearTimeout(appearing);
  }
});
