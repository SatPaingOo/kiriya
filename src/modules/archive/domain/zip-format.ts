/**
 * The ZIP format as pure functions over bytes: stored and deflated entries with
 * UTF-8 names. ZIP64, which archives of 4 GB or 65,535 entries need, is detected
 * and refused by the caller rather than guessed.
 */

export const STORED = 0;
export const DEFLATED = 8;
export const ZIP32_LIMIT = 0xffffffff;
export const MAX_ENTRIES = 0xffff;
export const LOCAL_HEADER_LENGTH = 30;
export const END_RECORD_LENGTH = 22;
/** The end record sits within this many bytes of the end: its own length plus the longest comment. */
export const END_SEARCH_LENGTH = END_RECORD_LENGTH + 0xffff;

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
const CENTRAL_HEADER_LENGTH = 46;
const UTF8_NAMES = 0x0800;
const ENCRYPTED = 0x0001;
const DIRECTORY_ATTRIBUTE = 0x10;
const ARCHIVE_ATTRIBUTE = 0x20;

export interface EntryHeader {
  /** With `/` separators, and a trailing `/` for a folder. */
  readonly name: string;
  readonly isDirectory: boolean;
  readonly method: number;
  readonly crc: number;
  readonly compressedSize: number;
  readonly size: number;
  readonly modifiedMs: number;
}

export interface CentralEntry extends EntryHeader {
  readonly encrypted: boolean;
  readonly localOffset: number;
}

export interface DirectoryLocation {
  readonly count: number;
  readonly size: number;
  readonly offset: number;
}

const encoder = new TextEncoder();

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** ZIP stores local time in two-second steps from 1980. */
function toDos(epochMs: number): { time: number; date: number } {
  const d = new Date(Math.max(epochMs, new Date(1980, 0, 1).getTime()));
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

function fromDos(time: number, date: number): number {
  return new Date(
    ((date >> 9) & 0x7f) + 1980,
    ((date >> 5) & 0x0f) - 1,
    date & 0x1f,
    (time >> 11) & 0x1f,
    (time >> 5) & 0x3f,
    (time & 0x1f) * 2,
  ).getTime();
}

export function localHeader(entry: EntryHeader): Uint8Array {
  const name = encoder.encode(entry.name);
  const bytes = new Uint8Array(LOCAL_HEADER_LENGTH + name.length);
  const fields = view(bytes);
  const { time, date } = toDos(entry.modifiedMs);
  fields.setUint32(0, LOCAL_SIGNATURE, true);
  fields.setUint16(4, 20, true);
  fields.setUint16(6, UTF8_NAMES, true);
  fields.setUint16(8, entry.method, true);
  fields.setUint16(10, time, true);
  fields.setUint16(12, date, true);
  fields.setUint32(14, entry.crc, true);
  fields.setUint32(18, entry.compressedSize, true);
  fields.setUint32(22, entry.size, true);
  fields.setUint16(26, name.length, true);
  bytes.set(name, LOCAL_HEADER_LENGTH);
  return bytes;
}

export function centralHeader(entry: EntryHeader, localOffset: number): Uint8Array {
  const name = encoder.encode(entry.name);
  const bytes = new Uint8Array(CENTRAL_HEADER_LENGTH + name.length);
  const fields = view(bytes);
  const { time, date } = toDos(entry.modifiedMs);
  fields.setUint32(0, CENTRAL_SIGNATURE, true);
  fields.setUint16(4, 20, true);
  fields.setUint16(6, 20, true);
  fields.setUint16(8, UTF8_NAMES, true);
  fields.setUint16(10, entry.method, true);
  fields.setUint16(12, time, true);
  fields.setUint16(14, date, true);
  fields.setUint32(16, entry.crc, true);
  fields.setUint32(20, entry.compressedSize, true);
  fields.setUint32(24, entry.size, true);
  fields.setUint16(28, name.length, true);
  fields.setUint32(38, entry.isDirectory ? DIRECTORY_ATTRIBUTE : ARCHIVE_ATTRIBUTE, true);
  fields.setUint32(42, localOffset, true);
  bytes.set(name, CENTRAL_HEADER_LENGTH);
  return bytes;
}

export function endRecord(location: DirectoryLocation): Uint8Array {
  const bytes = new Uint8Array(END_RECORD_LENGTH);
  const fields = view(bytes);
  fields.setUint32(0, END_SIGNATURE, true);
  fields.setUint16(8, location.count, true);
  fields.setUint16(10, location.count, true);
  fields.setUint32(12, location.size, true);
  fields.setUint32(16, location.offset, true);
  return bytes;
}

/** The central directory's place, from the last bytes of an archive; null when they hold no end record. */
export function findDirectory(tail: Uint8Array): DirectoryLocation | null {
  const fields = view(tail);
  for (let index = tail.length - END_RECORD_LENGTH; index >= 0; index -= 1) {
    if (fields.getUint32(index, true) === END_SIGNATURE) {
      return {
        count: fields.getUint16(index + 10, true),
        size: fields.getUint32(index + 12, true),
        offset: fields.getUint32(index + 16, true),
      };
    }
  }
  return null;
}

export function usesZip64(location: DirectoryLocation): boolean {
  return location.count === MAX_ENTRIES || location.offset === ZIP32_LIMIT || location.size === ZIP32_LIMIT;
}

/** Every entry in central directory bytes; null when the directory is damaged. */
export function parseDirectory(bytes: Uint8Array, count: number): CentralEntry[] | null {
  const fields = view(bytes);
  const entries: CentralEntry[] = [];
  let position = 0;
  for (let index = 0; index < count; index += 1) {
    if (position + CENTRAL_HEADER_LENGTH > bytes.length) return null;
    if (fields.getUint32(position, true) !== CENTRAL_SIGNATURE) return null;
    const flags = fields.getUint16(position + 8, true);
    const nameLength = fields.getUint16(position + 28, true);
    const extraLength = fields.getUint16(position + 30, true);
    const commentLength = fields.getUint16(position + 32, true);
    const nameStart = position + CENTRAL_HEADER_LENGTH;
    if (nameStart + nameLength > bytes.length) return null;
    const name = new TextDecoder(flags & UTF8_NAMES ? "utf-8" : "latin1").decode(
      bytes.subarray(nameStart, nameStart + nameLength),
    );
    entries.push({
      name,
      isDirectory: name.endsWith("/") || (fields.getUint32(position + 38, true) & DIRECTORY_ATTRIBUTE) !== 0,
      method: fields.getUint16(position + 10, true),
      encrypted: (flags & ENCRYPTED) !== 0,
      crc: fields.getUint32(position + 16, true),
      compressedSize: fields.getUint32(position + 20, true),
      size: fields.getUint32(position + 24, true),
      modifiedMs: fromDos(fields.getUint16(position + 12, true), fields.getUint16(position + 14, true)),
      localOffset: fields.getUint32(position + 42, true),
    });
    position = nameStart + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Where an entry's data starts, from its local header; null when the header is damaged. */
export function dataOffset(localOffset: number, header: Uint8Array): number | null {
  if (header.length < LOCAL_HEADER_LENGTH) return null;
  const fields = view(header);
  if (fields.getUint32(0, true) !== LOCAL_SIGNATURE) return null;
  return localOffset + LOCAL_HEADER_LENGTH + fields.getUint16(26, true) + fields.getUint16(28, true);
}

/**
 * The folder names an entry may be written under, or null for a name that would
 * escape the target folder: absolute, with a drive letter, or with a `..` segment.
 */
export function safeEntrySegments(name: string): string[] | null {
  const normalized = name.split(String.fromCharCode(92)).join("/");
  if (normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)) return null;
  const segments = normalized.split("/").filter((segment) => segment !== "" && segment !== ".");
  if (segments.some((segment) => segment === "..")) return null;
  return segments;
}
