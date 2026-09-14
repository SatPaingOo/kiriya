import assert from "node:assert/strict";
import { test } from "node:test";
import { UsageError } from "../../../src/core/domain/errors.js";
import type { RawInput } from "../../../src/core/domain/input-schema.js";
import type {
  ConnectOutcome,
  HttpOutcome,
  LookupOutcome,
  Network,
  NetworkAddress,
} from "../../../src/core/domain/ports/network.js";
import { CheckConnection, checkSpec } from "../../../src/modules/net/application/check-connection.use-case.js";
import { addressesSpec, ListAddresses } from "../../../src/modules/net/application/list-addresses.use-case.js";
import { dnsSpec, LookupName } from "../../../src/modules/net/application/lookup-name.use-case.js";
import { formatTarget, parseTarget } from "../../../src/core/domain/targets.js";
import { commandContext, expectDone } from "../../support/fakes.js";

const raw = (positionals: readonly string[], options: RawInput["options"] = {}): RawInput => ({ positionals, options });

/** Answers every call the same way and records what it was asked. */
class FakeNetwork implements Network {
  readonly calls: string[] = [];

  constructor(
    private readonly connected: ConnectOutcome = { ok: true, address: "127.0.0.1", ms: 3 },
    private readonly found: LookupOutcome = { ok: true, records: [{ type: "A", value: "127.0.0.1", priority: null }] },
  ) {}

  addresses(): readonly NetworkAddress[] {
    return [
      {
        interfaceName: "lo",
        family: "IPv4",
        address: "127.0.0.1",
        cidr: "127.0.0.1/8",
        mac: "00:00:00:00:00:00",
        internal: true,
      },
      {
        interfaceName: "eth0",
        family: "IPv4",
        address: "192.0.2.10",
        cidr: "192.0.2.10/24",
        mac: "02:00:00:00:00:01",
        internal: false,
      },
    ];
  }

  connect(host: string, port: number, timeoutMs: number): Promise<ConnectOutcome> {
    this.calls.push(`connect ${host} ${port} ${timeoutMs}`);
    return Promise.resolve(this.connected);
  }

  request(url: string, timeoutMs: number): Promise<HttpOutcome> {
    this.calls.push(`request ${url} ${timeoutMs}`);
    return Promise.resolve({ ok: true, status: 200, ms: 3 });
  }

  lookup(name: string): Promise<LookupOutcome> {
    this.calls.push(`lookup ${name}`);
    return Promise.resolve(this.found);
  }

  resolve(name: string, type: string, timeoutMs: number): Promise<LookupOutcome> {
    this.calls.push(`resolve ${name} ${type} ${timeoutMs}`);
    return Promise.resolve(this.found);
  }
}

test("a target is host:port, [IPv6]:port, or a URL whose scheme gives the port", () => {
  assert.deepEqual(parseTarget("localhost:5432"), { host: "localhost", port: 5432 });
  assert.deepEqual(parseTarget("[::1]:8080"), { host: "::1", port: 8080 });
  assert.deepEqual(parseTarget("https://example.com/path"), { host: "example.com", port: 443 });
  assert.deepEqual(parseTarget("http://example.com:8080"), { host: "example.com", port: 8080 });
  assert.deepEqual(parseTarget("ssh://[2001:db8::1]"), { host: "2001:db8::1", port: 22 });
  for (const text of ["example.com", "host:0", "host:65536", "::1:80", "gopher://example.com", "host:80x", ""]) {
    assert.equal(parseTarget(text), null, text);
  }
  assert.equal(formatTarget({ host: "::1", port: 80 }), "[::1]:80");
  assert.equal(formatTarget({ host: "db", port: 5432 }), "db:5432");
});

test("net ip leaves loopback addresses out unless --all", async () => {
  const list = new ListAddresses(new FakeNetwork());
  const plain = expectDone(await list.execute(addressesSpec.input.parse(raw([]))));
  assert.deepEqual(
    plain.data.addresses.map((address) => address.interfaceName),
    ["eth0"],
  );
  const all = expectDone(await list.execute(addressesSpec.input.parse(raw([], { all: true }))));
  assert.equal(all.data.addresses.length, 2);
});

test("net check reports a port that answers, and a refused one as a failure", async () => {
  const reachable = new FakeNetwork();
  const input = checkSpec.input.parse(raw(["db:5432"], { timeout: "2" }));
  const ok = expectDone(await new CheckConnection(reachable).execute(input, commandContext("/")));
  assert.deepEqual(reachable.calls, ["connect db 5432 2000"]);
  assert.deepEqual([ok.data.reachable, ok.data.address, ok.failures], [true, "127.0.0.1", []]);

  const refused = new FakeNetwork({ ok: false, failure: "refused", code: "ECONNREFUSED", ms: 1 });
  const failed = expectDone(
    await new CheckConnection(refused).execute(checkSpec.input.parse(raw(["[::1]:9"])), commandContext("/")),
  );
  assert.deepEqual(failed.data, {
    host: "::1",
    port: 9,
    reachable: false,
    address: null,
    ms: 1,
    failure: "refused",
    code: "ECONNREFUSED",
  });
  assert.deepEqual(failed.failures, [
    { key: "net.check.refused", params: { target: "[::1]:9", host: "::1", seconds: 5, code: "ECONNREFUSED" } },
  ]);
});

test("net check needs a port and a timeout from 1 to 120 seconds", () => {
  assert.throws(() => checkSpec.input.parse(raw(["example.com"])), UsageError);
  assert.throws(() => checkSpec.input.parse(raw(["example.com:443"], { timeout: "121" })), UsageError);
  assert.throws(() => checkSpec.input.parse(raw(["example.com:443"], { timeout: "0" })), UsageError);
});

test("net dns asks the OS by default and the DNS servers for a record type", async () => {
  const network = new FakeNetwork();
  await new LookupName(network).execute(dnsSpec.input.parse(raw(["example.com"])));
  await new LookupName(network).execute(dnsSpec.input.parse(raw(["example.com"], { type: "mx" })));
  assert.deepEqual(network.calls, ["lookup example.com", "resolve example.com mx 5000"]);

  const missing = new FakeNetwork(undefined, { ok: false, failure: "not-found", code: "ENOTFOUND" });
  const result = expectDone(await new LookupName(missing).execute(dnsSpec.input.parse(raw(["nowhere.invalid"]))));
  assert.deepEqual(result.failures, [
    { key: "net.dns.not-found", params: { name: "nowhere.invalid", type: "address", code: "ENOTFOUND" } },
  ]);
  assert.throws(() => dnsSpec.input.parse(raw(["example.com"], { type: "srv" })), UsageError);
});
