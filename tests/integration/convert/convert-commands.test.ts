import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { Command } from "../../../src/core/domain/command.js";
import { toBase64, utf8Bytes } from "../../../src/core/domain/encodings.js";
import { NotFoundError, OperationFailedError, UsageError } from "../../../src/core/domain/errors.js";
import type { RawInput } from "../../../src/core/domain/input-schema.js";
import { NodeFileContentAdapter } from "../../../src/core/infrastructure/node/node-file-content.adapter.js";
import { NodeFileSystemAdapter } from "../../../src/core/infrastructure/node/node-file-system.adapter.js";
import { ConvertCase } from "../../../src/modules/convert/application/convert-case.use-case.js";
import { ConvertCodec } from "../../../src/modules/convert/application/convert-codecs.use-case.js";
import type { InputSources } from "../../../src/modules/convert/application/convert-input.js";
import { ConvertJson } from "../../../src/modules/convert/application/convert-json.use-case.js";
import { ConvertTime } from "../../../src/modules/convert/application/convert-time.use-case.js";
import { DecodeJwt } from "../../../src/modules/convert/application/decode-jwt.use-case.js";
import { commandContext, expectDone, FakeStandardInput, FixedClock, temporaryFolder } from "../../support/fakes.js";

/** Real files, and `piped` as stdin; null stands for a terminal with nothing piped. */
function sources(piped: string | null = null): InputSources {
  return {
    stdin: new FakeStandardInput(piped),
    fileSystem: new NodeFileSystemAdapter(),
    content: new NodeFileContentAdapter(),
  };
}

function raw(positionals: readonly string[], options: RawInput["options"] = {}): RawInput {
  return { positionals, options };
}

/** Parses the raw values as the CLI would, then runs the command in `cwd`. */
async function run<Input, Output>(command: Command<Input, Output>, input: RawInput, cwd = process.cwd()) {
  return expectDone(await command.execute(command.spec.input.parse(input), commandContext(cwd)));
}

const isKey = (key: string) => (error: unknown) => error instanceof UsageError && error.detail.key === key;

test("base64 encodes an argument and decodes it back, with a URL-safe choice", async () => {
  assert.equal((await run(new ConvertCodec("base64", sources()), raw(["hello"]))).data.output, "aGVsbG8=");
  assert.equal(
    (await run(new ConvertCodec("base64", sources()), raw(["aGVsbG8"], { decode: true }))).data.output,
    "hello",
  );
  assert.equal((await run(new ConvertCodec("base64", sources()), raw(["??>"]))).data.output, "Pz8+");
  assert.equal((await run(new ConvertCodec("base64", sources()), raw(["??>"], { url: true }))).data.output, "Pz8-");
});

test("piped text loses one final line ending, whichever the shell wrote", async () => {
  for (const piped of ["hello\n", "hello\r\n", "hello"]) {
    assert.equal((await run(new ConvertCodec("base64", sources(piped)), raw([]))).data.output, "aGVsbG8=");
  }
  assert.equal((await run(new ConvertCodec("base64", sources("hello\n")), raw(["-"]))).data.output, "aGVsbG8=");
});

test("a file is encoded byte for byte, and decoded bytes that are not text are refused", async (t) => {
  const folder = await temporaryFolder(t);
  await writeFile(path.join(folder, "blob.bin"), Uint8Array.from([0xff, 0x00, 0x0a]));
  const base64 = new ConvertCodec("base64", sources());
  assert.equal((await run(base64, raw([], { file: "blob.bin" }), folder)).data.output, "/wAK");
  await assert.rejects(run(base64, raw(["/wAK"], { decode: true })), OperationFailedError);
  await assert.rejects(run(base64, raw(["x"], { file: "blob.bin" }), folder), isKey("core.input.twice"));
  await assert.rejects(run(base64, raw([], { file: "missing.bin" }), folder), NotFoundError);
});

test("with no argument and nothing piped, the command asks for input", async () => {
  await assert.rejects(run(new ConvertCodec("hex", sources()), raw([])), isKey("core.input.missing"));
});

test("hex and url encode and decode, and refuse what they cannot decode", async () => {
  const hex = new ConvertCodec("hex", sources());
  assert.equal((await run(hex, raw(["hello"]))).data.output, "68656c6c6f");
  assert.equal((await run(hex, raw(["0x68 65 6C 6C 6F"], { decode: true }))).data.output, "hello");
  await assert.rejects(run(hex, raw(["abc"], { decode: true })), isKey("convert.hex.invalid"));

  const url = new ConvertCodec("url", sources());
  assert.equal((await run(url, raw(["a b&c/ü"]))).data.output, "a%20b%26c%2F%C3%BC");
  assert.equal((await run(url, raw(["a%20b%26c%2F%C3%BC"], { decode: true }))).data.output, "a b&c/ü");
  await assert.rejects(run(url, raw(["%E0%A4%A"], { decode: true })), isKey("convert.url.invalid"));
});

test("json formats, minifies and checks, and names the line and column of an error", async (t) => {
  const pretty = await run(new ConvertJson(sources('{"b":1,"a":[1,2]}\n')), raw([]));
  assert.equal(pretty.data.output, '{\n  "b": 1,\n  "a": [\n    1,\n    2\n  ]\n}');
  const minified = await run(new ConvertJson(sources()), raw(['{ "a" : [ 1 , 2 ] }'], { minify: true }));
  assert.equal(minified.data.output, '{"a":[1,2]}');
  const checked = await run(new ConvertJson(sources()), raw(['{"a":1}'], { check: true }));
  assert.deepEqual(checked.data, { valid: true, output: null, line: null, column: null });

  const broken = await run(new ConvertJson(sources()), raw(['{\n  "a": 1,\n}']));
  assert.deepEqual(broken.data, { valid: false, output: null, line: 3, column: 1 });
  assert.deepEqual(broken.failures, [{ key: "convert.json.invalid", params: { line: 3, column: 1 } }]);

  const folder = await temporaryFolder(t);
  await writeFile(path.join(folder, "bom.json"), '\uFEFF{"a":true}');
  const withBom = await run(new ConvertJson(sources()), raw([], { file: "bom.json", minify: true }), folder);
  assert.equal(withBom.data.output, '{"a":true}');
});

function jwt(payload: object): string {
  const segment = (value: object): string => toBase64(utf8Bytes(JSON.stringify(value)), true);
  return `${segment({ alg: "HS256", typ: "JWT" })}.${segment(payload)}.signature`;
}

test("jwt decodes the claims, times them by the clock, and warns about what it cannot know", async () => {
  const token = jwt({ sub: "42", iat: 1767222000, exp: 1767225600 });
  const clock = new FixedClock(Date.parse("2026-01-01T00:00:00Z"));
  const piped = await run(new DecodeJwt(sources(`${token}\n`), clock), raw([]));
  assert.deepEqual(piped.data, {
    header: { alg: "HS256", typ: "JWT" },
    payload: { sub: "42", iat: 1767222000, exp: 1767225600 },
    issuedAt: "2025-12-31T23:00:00.000Z",
    notBefore: null,
    expiresAt: "2026-01-01T00:00:00.000Z",
    expired: true,
  });
  assert.deepEqual(
    piped.warnings.map((warning) => warning.key),
    ["convert.jwt.unverified"],
  );
  const argument = await run(new DecodeJwt(sources(), clock), raw([token]));
  assert.deepEqual(
    argument.warnings.map((warning) => warning.key),
    ["convert.jwt.unverified", "convert.jwt.from-argument"],
  );
  await assert.rejects(run(new DecodeJwt(sources(), clock), raw(["not.a.jwt"])), isKey("convert.jwt.invalid"));
});

test("time reads seconds, milliseconds and dates, and shows now without a value", async () => {
  const now = Date.parse("2026-01-31T12:00:00Z");
  const time = new ConvertTime(new FixedClock(now));
  assert.deepEqual((await run(time, raw([]))).data, {
    iso: "2026-01-31T12:00:00.000Z",
    epochSeconds: now / 1000,
    epochMs: now,
  });
  assert.equal((await run(time, raw(["1767225600"]))).data.iso, "2026-01-01T00:00:00.000Z");
  assert.equal((await run(time, raw(["1767225600000"]))).data.iso, "2026-01-01T00:00:00.000Z");
  assert.equal((await run(time, raw(["1767225600"], { unit: "ms" }))).data.iso, "1970-01-21T10:53:45.600Z");
  await assert.rejects(run(time, raw(["yesterday"])), isKey("convert.time.invalid"));
});

test("case changes every line on its own and needs --to", async () => {
  const result = await run(new ConvertCase(sources("userId\nOrderItems\n")), raw([], { to: "snake" }));
  assert.equal(result.data.output, "user_id\norder_items");
  assert.throws(() => new ConvertCase(sources()).spec.input.parse(raw(["x"])), isKey("convert.case.to-required"));
});
