import assert from "node:assert/strict";
import { test } from "node:test";
import { utf8Bytes, utf8Text } from "../../../src/core/domain/encodings.js";
import { KiriyaError } from "../../../src/core/domain/errors.js";
import {
  TAR_BLOCK,
  TAR_END,
  tarCompression,
  tarHeader,
  tarPadding,
} from "../../../src/modules/archive/domain/tar-format.js";
import { TarFormatError, TarParser } from "../../../src/modules/archive/domain/tar-stream.js";

const MTIME = 1_700_000_000_000;

interface Sample {
  readonly name: string;
  readonly text?: string;
  readonly directory?: boolean;
  readonly mode?: number;
}

function entryBytes(sample: Sample): Uint8Array[] {
  const data = utf8Bytes(sample.text ?? "");
  const directory = sample.directory === true;
  const header = tarHeader({
    name: sample.name,
    isDirectory: directory,
    size: directory ? 0 : data.length,
    mode: sample.mode ?? 0o644,
    modifiedMs: MTIME,
  });
  return directory ? [header] : [header, data, new Uint8Array(tarPadding(data.length))];
}

function archiveOf(samples: readonly Sample[], end = true): Uint8Array {
  return Buffer.concat([...samples.flatMap(entryBytes), ...(end ? [TAR_END] : [])]);
}

interface Parsed {
  readonly name: string;
  readonly type: string;
  readonly mode: number;
  readonly modifiedMs: number;
  text: string;
}

/** Every entry with its text, feeding the parser pieces of `size` bytes. */
function parse(bytes: Uint8Array, size: number): Parsed[] {
  const parser = new TarParser();
  const parsed: Parsed[] = [];
  let chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.length; offset += size) {
    for (const event of parser.push(bytes.slice(offset, offset + size))) {
      if (event.kind === "entry") {
        const { name, type, mode, modifiedMs } = event.entry;
        parsed.push({ name, type, mode, modifiedMs, text: "" });
        chunks = [];
      } else if (event.kind === "data") {
        chunks.push(event.bytes);
      } else {
        const last = parsed.at(-1);
        if (last !== undefined) last.text = utf8Text(Buffer.concat(chunks)) ?? "";
      }
    }
  }
  parser.finish();
  return parsed;
}

/** Rewrites a header's checksum after a test has changed one of its bytes. */
function reseal(block: Uint8Array): void {
  block.fill(0x20, 148, 156);
  const digits = block
    .reduce((total, byte) => total + byte, 0)
    .toString(8)
    .padStart(6, "0");
  for (let index = 0; index < 6; index += 1) block[148 + index] = digits.charCodeAt(index);
  block[154] = 0;
}

const failsWith = (key: string) => (error: unknown) =>
  error instanceof TarFormatError && error instanceof KiriyaError && error.detail.key === key;

test("entries round-trip through the writer and the parser, fed in pieces of any size", () => {
  const longName = `proj/${"deep/".repeat(30)}file.txt`;
  const samples: Sample[] = [
    { name: "proj", directory: true },
    { name: "proj/readme.txt", text: "hello\n" },
    { name: "proj/ဓာတ်ပုံ.txt", text: "ကိရိယာ" },
    { name: longName, text: "x".repeat(1500) },
    { name: "proj/run.sh", text: "#!/bin/sh\n", mode: 0o755 },
    { name: "proj/empty.txt", text: "" },
  ];
  const bytes = archiveOf(samples);
  const expected = [
    { name: "proj/", type: "directory", mode: 0o644, modifiedMs: MTIME, text: "" },
    { name: "proj/readme.txt", type: "file", mode: 0o644, modifiedMs: MTIME, text: "hello\n" },
    { name: "proj/ဓာတ်ပုံ.txt", type: "file", mode: 0o644, modifiedMs: MTIME, text: "ကိရိယာ" },
    { name: longName, type: "file", mode: 0o644, modifiedMs: MTIME, text: "x".repeat(1500) },
    { name: "proj/run.sh", type: "file", mode: 0o755, modifiedMs: MTIME, text: "#!/bin/sh\n" },
    { name: "proj/empty.txt", type: "file", mode: 0o644, modifiedMs: MTIME, text: "" },
  ];
  for (const size of [1, 7, 511, 512, 513, 4096, bytes.length]) {
    assert.deepEqual(parse(bytes, size), expected, `pieces of ${size}`);
  }
});

test("a header is ustar: magic, octal fields and a checksum other tools accept", () => {
  const block = tarHeader({ name: "a.txt", isDirectory: false, size: 5, mode: 0o644, modifiedMs: MTIME });
  assert.equal(block.length, TAR_BLOCK);
  const ascii = (offset: number, length: number): string =>
    Buffer.from(block.subarray(offset, offset + length)).toString("latin1");
  assert.equal(ascii(257, 6), "ustar\0");
  assert.equal(ascii(263, 2), "00");
  assert.equal(ascii(124, 12), "00000000005\0");
  assert.equal(ascii(100, 8), "0000644\0");
  const copy = Uint8Array.from(block);
  reseal(copy);
  assert.deepEqual(copy, block);
  // A name that ustar cannot hold gets a pax header of its own first.
  const long = tarHeader({ name: "ကိရိယာ.txt", isDirectory: false, size: 1, mode: 0o644, modifiedMs: MTIME });
  assert.equal(long.length, TAR_BLOCK * 3);
  assert.equal(String.fromCharCode(long[156] ?? 0), "x");
});

test("GNU long names and base-256 sizes, as GNU tar writes them, are read", () => {
  const longName = `${"gnu/".repeat(40)}name.txt`;
  const nameData = utf8Bytes(`${longName}\0`);
  const longLink = tarHeader({
    name: "././@LongLink",
    isDirectory: false,
    size: nameData.length,
    mode: 0o644,
    modifiedMs: MTIME,
  });
  longLink[156] = "L".charCodeAt(0);
  reseal(longLink);
  const main = tarHeader({ name: "short.txt", isDirectory: false, size: 3, mode: 0o644, modifiedMs: MTIME });
  main.fill(0, 124, 136);
  main[124] = 0x80;
  main[135] = 3;
  reseal(main);
  const bytes = Buffer.concat([
    longLink,
    nameData,
    new Uint8Array(tarPadding(nameData.length)),
    main,
    utf8Bytes("abc"),
    new Uint8Array(tarPadding(3)),
    TAR_END,
  ]);
  assert.deepEqual(
    parse(bytes, 100).map((entry) => [entry.name, entry.text]),
    [[longName, "abc"]],
  );
});

test("damage is reported: not a tar, a changed header, a cut-off archive", () => {
  assert.throws(() => parse(utf8Bytes("not a tar archive at all".repeat(40)), 512), failsWith("archive.tar.not-tar"));
  assert.throws(() => parse(new Uint8Array(0), 512), failsWith("archive.tar.not-tar"));

  const bytes = archiveOf([
    { name: "a.txt", text: "a" },
    { name: "b.txt", text: "b" },
  ]);
  const damaged = Uint8Array.from(bytes);
  damaged[TAR_BLOCK * 2 + 3] = 0x41;
  assert.throws(() => parse(damaged, 512), failsWith("archive.tar.bad-checksum"));
  assert.throws(() => parse(bytes.slice(0, TAR_BLOCK + 1), 512), failsWith("archive.tar.truncated"));

  // An archive that stops cleanly after an entry, without end blocks, and one with no entries at all, are fine.
  assert.deepEqual(
    parse(archiveOf([{ name: "a.txt", text: "a" }], false), 512).map((entry) => entry.name),
    ["a.txt"],
  );
  assert.deepEqual(parse(TAR_END, 512), []);
});

test("the archive name says whether it is compressed", () => {
  assert.equal(tarCompression("release.tar.gz"), true);
  assert.equal(tarCompression("RELEASE.TGZ"), true);
  assert.equal(tarCompression("release.tar"), false);
  assert.equal(tarCompression("release.zip"), null);
});
