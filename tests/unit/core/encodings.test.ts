import assert from "node:assert/strict";
import { test } from "node:test";
import { fromBase64, fromHex, toBase64, toHex, utf8Bytes, utf8Text } from "../../../src/core/domain/encodings.js";

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);

test("base64 matches the RFC 4648 test vectors", () => {
  const vectors = [
    ["", ""],
    ["f", "Zg=="],
    ["fo", "Zm8="],
    ["foo", "Zm9v"],
    ["foob", "Zm9vYg=="],
    ["fooba", "Zm9vYmE="],
    ["foobar", "Zm9vYmFy"],
  ] as const;
  for (const [text, encoded] of vectors) {
    assert.equal(toBase64(utf8Bytes(text)), encoded);
    assert.equal(utf8Text(fromBase64(encoded) ?? bytes()), text);
  }
});

test("base64 has a URL-safe alphabet without padding, and decoding accepts either", () => {
  assert.equal(toBase64(bytes(0xfb, 0xff)), "+/8=");
  assert.equal(toBase64(bytes(0xfb, 0xff), true), "-_8");
  assert.deepEqual(fromBase64("-_8"), bytes(0xfb, 0xff));
  assert.deepEqual(fromBase64(" +/8=\n"), bytes(0xfb, 0xff));
});

test("text that is not base64 decodes to null", () => {
  for (const text of ["abc$", "a", "Zg===", "Zg==Zg=="]) assert.equal(fromBase64(text), null, text);
});

test("hex goes both ways and ignores spaces and a 0x prefix", () => {
  assert.equal(toHex(bytes(0, 15, 16, 255)), "000f10ff");
  assert.deepEqual(fromHex("0x00 0F 10 ff"), bytes(0, 15, 16, 255));
  assert.equal(fromHex("abc"), null);
  assert.equal(fromHex("zz"), null);
});

test("bytes that are not UTF-8 have no text", () => {
  assert.equal(utf8Text(bytes(0xff)), null);
  assert.equal(utf8Text(utf8Bytes("ကိရိယာ")), "ကိရိယာ");
});
