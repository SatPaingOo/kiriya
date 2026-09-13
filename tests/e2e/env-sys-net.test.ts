import assert from "node:assert/strict";
import { createServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { runKiriya } from "../support/cli.js";
import { layout, temporaryFolder } from "../support/fakes.js";

const CWD = tmpdir();

test("env show hides a secret-looking value unless --reveal is given", () => {
  // A prefix no other variable has: CI itself sets KIRIYA_TEST_REAL_TRASH.
  const environment = { KIRIYA_NO_COLOR: "1", KIRIYA_E2E_ENV_SHOW_API_TOKEN: "not-a-real-token" };
  const hidden = runKiriya(CWD, ["env", "show", "KIRIYA_E2E_ENV_SHOW", "--json"], environment);
  assert.equal(hidden.code, 0, hidden.stderr);
  const { data } = JSON.parse(hidden.stdout) as { data: { variables: unknown[] } };
  assert.deepEqual(data.variables, [{ name: "KIRIYA_E2E_ENV_SHOW_API_TOKEN", value: null, secret: true }]);
  assert.ok(!hidden.stdout.includes("not-a-real-token"));

  const shown = runKiriya(CWD, ["env", "show", "KIRIYA_E2E_ENV_SHOW", "--reveal"], environment);
  assert.equal(shown.code, 0, shown.stderr);
  assert.match(shown.stdout, /^KIRIYA_E2E_ENV_SHOW_API_TOKEN=not-a-real-token$/m);
});

test("env check exits 1 and names the variables that are missing", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, { ".env.example": "A=\nB=\n", ".env": "A=1\n" });
  const run = runKiriya(root, ["env", "check"]);
  assert.equal(run.code, 1);
  assert.match(run.stdout + run.stderr, /missing in \.env: B/);
});

test("sys info describes this machine, and sys report leaves out its host name", () => {
  const info = runKiriya(CWD, ["sys", "info", "--json"]);
  assert.equal(info.code, 0, info.stderr);
  const { data } = JSON.parse(info.stdout) as { data: { hostname: string; cpuCount: number; node: string } };
  assert.equal(data.node, process.version);
  assert.ok(data.cpuCount >= 1);

  const report = runKiriya(CWD, ["sys", "report"]);
  assert.equal(report.code, 0, report.stderr);
  assert.match(report.stdout, /^- \*\*Node\.js:\*\* /m);
  // A very short host name could appear inside other words by chance.
  if (data.hostname.length >= 4) assert.ok(!report.stdout.includes(data.hostname), report.stdout);
});

test("net check fails with exit 1 on a closed port, and exit 2 without a port", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));

  const refused = runKiriya(CWD, ["net", "check", `127.0.0.1:${port}`]);
  assert.equal(refused.code, 1, refused.stdout);
  assert.match(refused.stdout + refused.stderr, /refused the connection/);
  assert.equal(runKiriya(CWD, ["net", "check", "example.com"]).code, 2);
});

test("net dns resolves localhost and net ip lists addresses", () => {
  const dns = runKiriya(CWD, ["net", "dns", "localhost", "--json"]);
  assert.equal(dns.code, 0, dns.stderr);
  assert.ok((JSON.parse(dns.stdout) as { data: { records: unknown[] } }).data.records.length > 0);
  const ip = runKiriya(CWD, ["net", "ip", "--all", "--json"]);
  assert.equal(ip.code, 0, ip.stderr);
  assert.ok((JSON.parse(ip.stdout) as { data: { addresses: unknown[] } }).data.addresses.length > 0);
});
