import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decodeText,
  encodeText,
  escapeRegExp,
  splitLines,
  TEXT_ENCODINGS,
} from "../../../src/modules/files/domain/text-encoding.js";

const SAMPLE = "line one\r\nမင်္ဂလာပါ\n";

test("every encoding survives a round trip, byte-order mark included", () => {
  for (const encoding of TEXT_ENCODINGS) {
    assert.deepEqual(decodeText(encodeText({ text: SAMPLE, encoding })), { text: SAMPLE, encoding }, encoding);
  }
  assert.deepEqual([...encodeText({ text: "A", encoding: "utf16be" })], [0xfe, 0xff, 0x00, 0x41]);
  assert.deepEqual([...encodeText({ text: "A", encoding: "utf16le" })], [0xff, 0xfe, 0x41, 0x00]);
  assert.deepEqual([...encodeText({ text: "A", encoding: "utf8-bom" })], [0xef, 0xbb, 0xbf, 0x41]);
});

test("bytes that are not text are refused", () => {
  assert.equal(decodeText(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0xff])), null);
  assert.equal(decodeText(new Uint8Array([0xc3, 0x28])), null, "invalid UTF-8");
  assert.equal(decodeText(new Uint8Array(20).fill(1)), null, "control characters");
});

test("an empty file is empty UTF-8 text", () => {
  assert.deepEqual(decodeText(new Uint8Array(0)), { text: "", encoding: "utf8" });
});

test("lines split on both endings, without a phantom last line", () => {
  assert.deepEqual(splitLines("a\r\nb\n"), ["a", "b"]);
  assert.deepEqual(splitLines("a"), ["a"]);
  assert.deepEqual(splitLines(""), [""]);
});

test("regular expression characters are escaped", () => {
  assert.equal(new RegExp(escapeRegExp("a.b*(c)")).test("a.b*(c)"), true);
  assert.equal(new RegExp(escapeRegExp("a.b")).test("axb"), false);
});
