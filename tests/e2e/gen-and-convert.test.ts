import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { runKiriya } from "../support/cli.js";

const CWD = tmpdir();
const PLAIN = { KIRIYA_NO_COLOR: "1" };

test("gen prints one value per line, and --json wraps them", () => {
  const plain = runKiriya(CWD, ["gen", "uuid", "--count", "3"]);
  assert.equal(plain.code, 0, plain.stderr);
  const lines = plain.stdout.trimEnd().split(/\r?\n/);
  assert.equal(lines.length, 3);
  for (const line of lines) assert.match(line, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

  const json = runKiriya(CWD, ["gen", "password", "--length", "16", "--json"]);
  assert.equal(json.code, 0, json.stderr);
  const parsed = JSON.parse(json.stdout) as { ok: boolean; command: string; data: { values: string[] } };
  assert.deepEqual([parsed.ok, parsed.command, parsed.data.values[0]?.length], [true, "gen.password", 16]);
});

test("gen refuses a count it will not make", () => {
  assert.equal(runKiriya(CWD, ["gen", "token", "--count", "1001"]).code, 2);
});

test("convert reads what is piped in, and - names it", () => {
  const encoded = runKiriya(CWD, ["convert", "base64"], PLAIN, "hello\n");
  assert.equal(encoded.code, 0, encoded.stderr);
  assert.equal(encoded.stdout.trimEnd(), "aGVsbG8=");
  const decoded = runKiriya(CWD, ["convert", "base64", "-d", "-"], PLAIN, "aGVsbG8=");
  assert.equal(decoded.code, 0, decoded.stderr);
  assert.equal(decoded.stdout.trimEnd(), "hello");
});

test("convert json --check fails with the line and column of the error", () => {
  const text = runKiriya(CWD, ["convert", "json", "--check"], PLAIN, '{"a":1,}');
  assert.equal(text.code, 1);
  assert.match(text.stdout + text.stderr, /line 1, column 8/);
  const json = runKiriya(CWD, ["convert", "json", "--check", "--json"], PLAIN, '{"a":1,}');
  const parsed = JSON.parse(json.stdout) as { ok: boolean; data: { line: number; column: number } };
  assert.deepEqual([parsed.ok, parsed.data.line, parsed.data.column], [false, 1, 8]);
});

test("convert jwt decodes a piped token and says the signature was not checked", () => {
  const segment = (value: object): string => Buffer.from(JSON.stringify(value)).toString("base64url");
  const run = runKiriya(CWD, ["convert", "jwt"], PLAIN, `${segment({ alg: "none" })}.${segment({ sub: "42" })}.`);
  assert.equal(run.code, 0, run.stderr);
  assert.match(run.stdout, /"sub": "42"/);
  assert.match(run.stdout + run.stderr, /signature was not checked/);
});

test("convert time and convert case take arguments", () => {
  const time = runKiriya(CWD, ["convert", "time", "1767225600", "--json"]);
  assert.equal(time.code, 0, time.stderr);
  assert.equal((JSON.parse(time.stdout) as { data: { iso: string } }).data.iso, "2026-01-01T00:00:00.000Z");
  const cased = runKiriya(CWD, ["convert", "case", "user profile id", "--to", "pascal"]);
  assert.equal(cased.code, 0, cased.stderr);
  assert.equal(cased.stdout.trimEnd(), "UserProfileId");
});
