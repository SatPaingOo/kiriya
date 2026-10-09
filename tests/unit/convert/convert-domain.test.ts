import assert from "node:assert/strict";
import { test } from "node:test";
import { toBase64, utf8Bytes } from "../../../src/core/domain/encodings.js";
import { isJsonPath, lookupJsonPath } from "../../../src/modules/convert/domain/json-path.js";
import { findJsonProblem } from "../../../src/modules/convert/domain/json-syntax.js";
import { claimTime, decodeJwt } from "../../../src/modules/convert/domain/jwt.js";
import { parseMoment } from "../../../src/modules/convert/domain/moments.js";

const SAMPLES = [
  "{}",
  "[]",
  '""',
  "0",
  "-0.5e-3",
  "true",
  " null ",
  '{"a":[1,{"b":null}],"c":"\\u00e9\\n\\/"}',
  "[\n]",
  "\t\r\n{}\n",
  "",
  " ",
  "{",
  "[1,]",
  '{"a":1,}',
  "01",
  "1.",
  ".5",
  "+1",
  "1e",
  "-",
  "tru",
  "nul",
  "'a'",
  '"a',
  '"\\x"',
  '"\\u12"',
  '"tab\there"',
  "[1 2]",
  '{"a" 1}',
  "{a:1}",
  "[] []",
  "\uFEFF{}",
  "NaN",
  "Infinity",
];

function parses(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

test("JSON is judged valid exactly when JSON.parse accepts it", () => {
  for (const sample of SAMPLES) assert.equal(findJsonProblem(sample) === null, parses(sample), JSON.stringify(sample));
});

test("a JSON problem points at the first character that cannot belong there", () => {
  assert.deepEqual(findJsonProblem('{"a":1,}'), { offset: 7, line: 1, column: 8 });
  assert.deepEqual(findJsonProblem('{\n  "a": tru\n}'), { offset: 9, line: 2, column: 8 });
  assert.deepEqual(findJsonProblem("[1] x"), { offset: 4, line: 1, column: 5 });
  assert.deepEqual(findJsonProblem(""), { offset: 0, line: 1, column: 1 });
});

test("deeply nested JSON does not overflow the stack", () => {
  const depth = 100_000;
  assert.equal(findJsonProblem("[".repeat(depth) + "]".repeat(depth)), null);
  assert.equal(findJsonProblem("[".repeat(depth))?.offset, depth);
});

function segment(value: unknown): string {
  return toBase64(utf8Bytes(JSON.stringify(value)), true);
}

test("a dotted path either names segments or names nothing at all", () => {
  for (const path of ["version", "data.listeners.0.pid", ".version", "a.0"]) {
    assert.equal(isJsonPath(path), true, path);
  }
  for (const path of ["", ".", "a..b", "a.", ".."]) {
    assert.equal(isJsonPath(path), false, path);
  }
});

test("a path walks objects by key and arrays by index", () => {
  const root: unknown = JSON.parse('{"data":{"listeners":[{"pid":7},{"pid":8}],"name":"x","on":false,"none":null}}');
  const at = (path: string) => lookupJsonPath(root, path);
  assert.deepEqual(at("data.listeners.1.pid"), { found: true, value: 8 });
  assert.deepEqual(at(".data.name"), { found: true, value: "x" });
  assert.deepEqual(at("data.listeners.0"), { found: true, value: { pid: 7 } });
  // false and null are values; neither may read as nothing being there.
  assert.deepEqual(at("data.on"), { found: true, value: false });
  assert.deepEqual(at("data.none"), { found: true, value: null });
});

test("a miss names the part of the path that was not there, which is the fixable fact", () => {
  const root: unknown = JSON.parse('{"data":{"listeners":[{"pid":7}]}}');
  assert.deepEqual(lookupJsonPath(root, "nope.deeper"), { found: false, at: "nope" });
  assert.deepEqual(lookupJsonPath(root, "data.ports"), { found: false, at: "data.ports" });
  assert.deepEqual(lookupJsonPath(root, "data.listeners.1"), { found: false, at: "data.listeners.1" });
  // Walking into a number stops there rather than inventing something past it.
  assert.deepEqual(lookupJsonPath(root, "data.listeners.0.pid.more"), {
    found: false,
    at: "data.listeners.0.pid.more",
  });
});

/** Own entries only: a lookup that answered `constructor` with a function would print source. */
test("a path reaches what the JSON holds and never JavaScript's own members", () => {
  const object: unknown = JSON.parse('{"a":1}');
  for (const name of ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__"]) {
    assert.deepEqual(lookupJsonPath(object, name), { found: false, at: name }, name);
  }
  // An array answers an index and nothing else, so `length` is out of reach as well.
  const array: unknown = JSON.parse("[1,2]");
  assert.deepEqual(lookupJsonPath(array, "length"), { found: false, at: "length" });
  assert.deepEqual(lookupJsonPath(array, "1"), { found: true, value: 2 });
  // A key really named like one of them is reachable, because it really is there.
  assert.deepEqual(lookupJsonPath(JSON.parse('{"constructor":"mine"}'), "constructor"), {
    found: true,
    value: "mine",
  });
  assert.deepEqual(lookupJsonPath(JSON.parse('{"__proto__":1}'), "__proto__"), { found: true, value: 1 });
});

test("a JWT's header and payload decode without the signature", () => {
  const token = `${segment({ alg: "HS256", typ: "JWT" })}.${segment({ sub: "42", exp: 1767225600, nbf: "soon" })}.sig`;
  const decoded = decodeJwt(token);
  assert.deepEqual(decoded?.header, { alg: "HS256", typ: "JWT" });
  assert.equal(claimTime(decoded?.payload ?? {}, "exp"), 1767225600000);
  assert.equal(claimTime(decoded?.payload ?? {}, "nbf"), null);
  assert.equal(claimTime(decoded?.payload ?? {}, "iat"), null);
});

test("text that is not a JWT decodes to null", () => {
  for (const token of ["a.b", "x.y.z", `${segment([1])}.${segment({})}.s`, `${segment({})}.${segment("text")}.s`]) {
    assert.equal(decodeJwt(token), null, token);
  }
});

test("a moment is read from Unix seconds, milliseconds or a date", () => {
  const newYear = Date.parse("2026-01-01T00:00:00Z");
  assert.equal(parseMoment("1767225600", "auto"), newYear);
  assert.equal(parseMoment("1767225600000", "auto"), newYear);
  assert.equal(parseMoment("1767225600", "ms"), 1767225600);
  // JavaScript dates end 8.64e15 milliseconds after 1970.
  assert.equal(parseMoment("9000000000000", "seconds"), null);
  assert.equal(parseMoment(" 2026-01-01T00:00:00Z ", "auto"), newYear);
  assert.equal(parseMoment("yesterday", "auto"), null);
});
