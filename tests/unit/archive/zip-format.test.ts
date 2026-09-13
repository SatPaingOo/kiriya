import assert from "node:assert/strict";
import { test } from "node:test";
import { crc32 } from "../../../src/modules/archive/domain/crc32.js";
import {
  centralHeader,
  dataOffset,
  DEFLATED,
  endRecord,
  findDirectory,
  localHeader,
  parseDirectory,
  safeEntrySegments,
  STORED,
  usesZip64,
  type EntryHeader,
} from "../../../src/modules/archive/domain/zip-format.js";

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

test("crc32 gives the standard check value", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("headers that are written are read back from the central directory", () => {
  const modifiedMs = new Date(2026, 0, 31, 13, 45, 30).getTime();
  const entries: EntryHeader[] = [
    { name: "pack/", isDirectory: true, method: STORED, crc: 0, compressedSize: 0, size: 0, modifiedMs },
    {
      name: "pack/မှတ်စု.txt",
      isDirectory: false,
      method: DEFLATED,
      crc: 0x12345678,
      compressedSize: 3,
      size: 10,
      modifiedMs,
    },
  ];
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    central.push(centralHeader(entry, offset));
    const local = localHeader(entry);
    parts.push(local, new Uint8Array(entry.compressedSize));
    offset += local.length + entry.compressedSize;
  }
  const size = central.reduce((sum, bytes) => sum + bytes.length, 0);
  const archive = concat([...parts, ...central, endRecord({ count: entries.length, size, offset })]);

  const location = findDirectory(archive);
  assert.deepEqual(location, { count: 2, size, offset });
  assert.equal(usesZip64({ count: 2, size, offset }), false);
  const parsed = parseDirectory(archive.subarray(offset, offset + size), 2);
  assert.ok(parsed !== null);
  assert.deepEqual(
    parsed.map((entry) => [entry.name, entry.isDirectory, entry.method, entry.crc, entry.size, entry.modifiedMs]),
    [
      ["pack/", true, STORED, 0, 0, modifiedMs],
      ["pack/မှတ်စု.txt", false, DEFLATED, 0x12345678, 10, modifiedMs],
    ],
  );
  const second = parsed[1];
  assert.ok(second !== undefined);
  const nameBytes = new TextEncoder().encode(second.name).length;
  assert.equal(
    dataOffset(second.localOffset, archive.subarray(second.localOffset)),
    second.localOffset + 30 + nameBytes,
  );
});

test("foreign or damaged bytes are recognised", () => {
  assert.equal(findDirectory(new Uint8Array(100)), null);
  assert.equal(parseDirectory(new Uint8Array(46), 1), null);
  assert.equal(dataOffset(0, new Uint8Array(30)), null);
  assert.equal(usesZip64({ count: 0xffff, size: 0, offset: 0 }), true);
});

test("entry names that would escape the target folder are refused", () => {
  assert.equal(safeEntrySegments("../evil.txt"), null);
  assert.equal(safeEntrySegments("/etc/passwd"), null);
  assert.equal(safeEntrySegments("C:/Windows/x"), null);
  assert.equal(safeEntrySegments("a\\..\\..\\b"), null);
  assert.deepEqual(safeEntrySegments("./a//b.txt"), ["a", "b.txt"]);
});
