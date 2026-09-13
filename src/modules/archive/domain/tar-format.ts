import { utf8Bytes } from "../../../core/domain/encodings.js";

export const TAR_BLOCK = 512;
/** Two empty blocks end an archive. */
export const TAR_END = new Uint8Array(TAR_BLOCK * 2);
/** The largest number eleven octal digits hold, just under 8 GB; a larger size goes in a pax record. */
const OCTAL_SIZE_LIMIT = 8 ** 11 - 1;
const NAME_BYTES = 100;

export interface TarEntrySpec {
  /** With `/`; a folder's name may end with `/`. */
  readonly name: string;
  readonly isDirectory: boolean;
  readonly size: number;
  readonly mode: number;
  readonly modifiedMs: number;
}

/** gzip for .tar.gz and .tgz, none for .tar, and null for any other name. */
export function tarCompression(archive: string): boolean | null {
  const lower = archive.toLowerCase();
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) return true;
  return lower.endsWith(".tar") ? false : null;
}

/** Zero bytes that bring `size` up to a whole block. */
export function tarPadding(size: number): number {
  return (TAR_BLOCK - (size % TAR_BLOCK)) % TAR_BLOCK;
}

function isPlainAscii(text: string): boolean {
  return [...text].every((char) => char >= " " && char <= "~");
}

function writeAscii(block: Uint8Array, offset: number, length: number, text: string): void {
  for (let index = 0; index < Math.min(length, text.length); index += 1) {
    block[offset + index] = text.charCodeAt(index);
  }
}

/** Zero-padded octal digits, with the field's last byte left as NUL. */
function writeOctal(block: Uint8Array, offset: number, length: number, value: number): void {
  writeAscii(
    block,
    offset,
    length - 1,
    Math.floor(value)
      .toString(8)
      .padStart(length - 1, "0"),
  );
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

/** One ustar header block. No user or group names are written, so an archive says nothing about who made it. */
function header(name: string, typeflag: string, size: number, mode: number, mtimeSeconds: number): Uint8Array {
  const block = new Uint8Array(TAR_BLOCK);
  writeAscii(block, 0, NAME_BYTES, name);
  writeOctal(block, 100, 8, mode & 0o7777);
  writeOctal(block, 108, 8, 0);
  writeOctal(block, 116, 8, 0);
  writeOctal(block, 124, 12, size);
  writeOctal(block, 136, 12, mtimeSeconds);
  block[156] = typeflag.charCodeAt(0);
  writeAscii(block, 257, 5, "ustar");
  writeAscii(block, 263, 2, "00");
  // The checksum counts its own field as spaces, then takes six octal digits, a NUL and a space.
  block.fill(0x20, 148, 156);
  const sum = block.reduce((total, byte) => total + byte, 0);
  writeAscii(block, 148, 6, sum.toString(8).padStart(6, "0"));
  block[154] = 0;
  return block;
}

/** "LENGTH key=value" and a newline, where LENGTH counts the whole record, its own digits included. */
function paxRecord(key: string, value: string): Uint8Array {
  const body = utf8Bytes(` ${key}=${value}\n`).length;
  let length = body + 1;
  while (String(length).length + body !== length) length = String(length).length + body;
  return utf8Bytes(`${length} ${key}=${value}\n`);
}

/** A plain ASCII stand-in for tools that ignore pax records, keeping the end, where the file name is. */
function asciiName(name: string): string {
  const ascii = [...name].map((char) => (char >= " " && char <= "~" ? char : "_")).join("");
  return ascii.length <= NAME_BYTES ? ascii : ascii.slice(-NAME_BYTES);
}

/**
 * The header blocks for one entry, in POSIX ustar form. A name longer than 100 bytes
 * or not plain ASCII, and a size of 8 GB or more, go in a pax extended header before
 * it, which GNU tar, bsdtar and 7-Zip all read.
 */
export function tarHeader(entry: TarEntrySpec): Uint8Array {
  const name = entry.isDirectory && !entry.name.endsWith("/") ? `${entry.name}/` : entry.name;
  const mtime = Math.max(0, Math.floor(entry.modifiedMs / 1000));
  const plainName = isPlainAscii(name) && name.length <= NAME_BYTES;
  const largeSize = entry.size > OCTAL_SIZE_LIMIT;
  const records: Uint8Array[] = [];
  if (!plainName) records.push(paxRecord("path", name));
  if (largeSize) records.push(paxRecord("size", String(entry.size)));

  const typeflag = entry.isDirectory ? "5" : "0";
  const main = header(plainName ? name : asciiName(name), typeflag, largeSize ? 0 : entry.size, entry.mode, mtime);
  if (records.length === 0) return main;
  const pax = concat(records);
  const paxHeader = header(asciiName(`PaxHeader/${name}`), "x", pax.length, 0o644, mtime);
  return concat([paxHeader, pax, new Uint8Array(tarPadding(pax.length)), main]);
}
