import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { createServer, type AddressInfo, type Socket } from "node:net";
import { test } from "node:test";
import { InterruptedError } from "../../../src/core/domain/errors.js";
import { NodeNetworkAdapter } from "../../../src/core/infrastructure/node/node-network.adapter.js";

const signal = (): AbortSignal => new AbortController().signal;

test("a listening port answers, and the same port refuses once it is closed", async () => {
  const server = createServer((socket) => socket.destroy());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const network = new NodeNetworkAdapter();

  const open = await network.connect("127.0.0.1", port, 5_000, signal());
  assert.deepEqual([open.ok, open.ok ? open.address : null], [true, "127.0.0.1"]);

  await new Promise<void>((resolve) => server.close(() => resolve()));
  const closed = await network.connect("127.0.0.1", port, 5_000, signal());
  assert.deepEqual([closed.ok, closed.ok ? null : closed.failure], [false, "refused"]);
});

test("an aborted signal stops a connection before it starts", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(new NodeNetworkAdapter().connect("127.0.0.1", 9, 5_000, controller.signal), InterruptedError);
});

test("localhost resolves through the system resolver, and this machine has a loopback address", async () => {
  const network = new NodeNetworkAdapter();
  const outcome = await network.lookup("localhost");
  assert.ok(outcome.ok, JSON.stringify(outcome));
  assert.ok(outcome.records.some((record) => record.value === "127.0.0.1" || record.value === "::1"));
  assert.ok(network.addresses().some((address) => address.internal));
});

test("a request settles on the status without reading the body, and is refused once the server is gone", async () => {
  const server = createHttpServer((request, response) => {
    response.writeHead(request.url === "/ready" ? 200 : 503, { "content-type": "text/plain" });
    response.end("x".repeat(100_000));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const network = new NodeNetworkAdapter();
  const base = `http://127.0.0.1:${port}`;

  const ready = await network.request(`${base}/ready`, 5_000, signal());
  const busy = await network.request(`${base}/busy`, 5_000, signal());
  assert.deepEqual([ready.ok && ready.status, busy.ok && busy.status], [200, 503]);

  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const closed = await network.request(`${base}/ready`, 5_000, signal());
  assert.deepEqual([closed.ok, closed.ok ? null : closed.failure], [false, "refused"]);
});

test("a server that accepts but never answers times out, and an aborted signal stops a request", async () => {
  const sockets = new Set<Socket>();
  const silent = createServer((socket) => sockets.add(socket));
  await new Promise<void>((resolve) => silent.listen(0, "127.0.0.1", resolve));
  const { port } = silent.address() as AddressInfo;
  const network = new NodeNetworkAdapter();
  try {
    const outcome = await network.request(`http://127.0.0.1:${port}/`, 300, signal());
    assert.deepEqual([outcome.ok, outcome.ok ? null : outcome.failure], [false, "timeout"]);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(network.request(`http://127.0.0.1:${port}/`, 5_000, controller.signal), InterruptedError);
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => silent.close(() => resolve()));
  }
});
