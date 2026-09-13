import { utf8Text } from "../../../core/domain/encodings.js";
import { OperationFailedError } from "../../../core/domain/errors.js";

const BLOCK = 512;
/** Extended headers hold a name and a few numbers; anything larger is no real archive. */
const META_LIMIT = 1024 * 1024;

export type TarEntryType = "file" | "directory" | "link" | "other";

export interface TarEntry {
  readonly name: string;
  readonly type: TarEntryType;
  readonly size: number;
  readonly mode: number;
  readonly modifiedMs: number;
}

export type TarEvent =
  | { readonly kind: "entry"; readonly entry: TarEntry }
  | { readonly kind: "data"; readonly bytes: Uint8Array }
  | { readonly kind: "entry-end" };

/** Tar data that cannot be read; its detail is the reason, such as a checksum that does not match. */
export class TarFormatError extends OperationFailedError {}

type State = "header" | "data" | "meta" | "padding" | "done";

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let text = "";
  for (let index = offset; index < offset + length; index += 1) text += String.fromCharCode(bytes[index] ?? 0);
  return text;
}

/** Text up to the first NUL: UTF-8, or Latin-1 from tools that wrote names in another encoding. */
function nameText(bytes: Uint8Array): string {
  const end = bytes.indexOf(0);
  const raw = end < 0 ? bytes : bytes.subarray(0, end);
  return utf8Text(raw) ?? ascii(raw, 0, raw.length);
}

function trimmedField(bytes: Uint8Array, offset: number, length: number): string {
  return ascii(bytes, offset, length).replace(/^[ \0]+|[ \0]+$/g, "");
}

/** An octal field, or GNU's base-256 form, which sets the top bit of the first byte. */
function readNumber(block: Uint8Array, offset: number, length: number): number {
  const first = block[offset] ?? 0;
  if ((first & 0x80) !== 0) {
    let value = first & 0x7f;
    for (let index = 1; index < length; index += 1) value = value * 256 + (block[offset + index] ?? 0);
    return value;
  }
  const text = trimmedField(block, offset, length);
  if (text === "") return 0;
  if (!/^[0-7]+$/.test(text)) throw new TarFormatError("archive.tar.bad-header");
  return parseInt(text, 8);
}

/** Old tools summed header bytes as signed numbers, so either sum is accepted. */
function checksumMatches(block: Uint8Array): boolean {
  const text = trimmedField(block, 148, 8);
  if (!/^[0-7]+$/.test(text)) return false;
  let unsigned = 0;
  let signed = 0;
  for (let index = 0; index < BLOCK; index += 1) {
    const byte = index >= 148 && index < 156 ? 0x20 : (block[index] ?? 0);
    unsigned += byte;
    signed += byte > 127 ? byte - 256 : byte;
  }
  const stored = parseInt(text, 8);
  return stored === unsigned || stored === signed;
}

/** Records of "LENGTH key=value" and a newline. */
function parsePax(bytes: Uint8Array): Map<string, string> {
  const records = new Map<string, string>();
  let position = 0;
  while (position < bytes.length) {
    const space = bytes.indexOf(0x20, position);
    const length = space < 0 ? Number.NaN : Number(ascii(bytes, position, space - position));
    if (!Number.isInteger(length) || length <= space - position || position + length > bytes.length) {
      throw new TarFormatError("archive.tar.bad-header");
    }
    const record = utf8Text(bytes.subarray(space + 1, position + length - 1)) ?? "";
    const equals = record.indexOf("=");
    if (equals > 0) records.set(record.slice(0, equals), record.slice(equals + 1));
    position += length;
  }
  return records;
}

function entryType(typeflag: string, name: string): TarEntryType {
  if (typeflag === "5") return "directory";
  if (typeflag === "0" || typeflag === "7" || typeflag === String.fromCharCode(0)) {
    return name.endsWith("/") ? "directory" : "file";
  }
  return typeflag === "1" || typeflag === "2" ? "link" : "other";
}

function concat(first: Uint8Array, second: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(first.length + second.length);
  bytes.set(first);
  bytes.set(second, first.length);
  return bytes;
}

/**
 * Reads a tar stream from pieces of any size: POSIX ustar, pax extended headers and GNU
 * long names, as GNU tar, bsdtar and most other tools write them. It never touches a file:
 * each entry, its data and its end arrive as events for the caller to act on.
 */
export class TarParser {
  private buffer: Uint8Array = new Uint8Array(0);
  private state: State = "header";
  private remaining = 0;
  private padding = 0;
  private metaType = "";
  private meta: Uint8Array[] = [];
  private pax = new Map<string, string>();
  private longName: string | null = null;
  private headers = 0;
  private emptyBlocks = 0;

  /** The two empty blocks that end an archive have been read. */
  get ended(): boolean {
    return this.state === "done";
  }

  push(chunk: Uint8Array): TarEvent[] {
    const events: TarEvent[] = [];
    const data = this.buffer.length === 0 ? chunk : concat(this.buffer, chunk);
    let offset = 0;
    while (this.state !== "done") {
      const available = data.length - offset;
      if (this.state === "data" || this.state === "meta") {
        if (this.remaining === 0) {
          if (this.state === "data") events.push({ kind: "entry-end" });
          else this.applyMeta();
          this.state = this.padding > 0 ? "padding" : "header";
          continue;
        }
        const take = Math.min(this.remaining, available);
        if (take === 0) break;
        const bytes = data.slice(offset, offset + take);
        if (this.state === "data") events.push({ kind: "data", bytes });
        else this.meta.push(bytes);
        offset += take;
        this.remaining -= take;
        continue;
      }
      if (this.state === "padding") {
        const take = Math.min(this.padding, available);
        if (take === 0) break;
        offset += take;
        this.padding -= take;
        if (this.padding === 0) this.state = "header";
        continue;
      }
      if (available < BLOCK) break;
      const event = this.readHeader(data.subarray(offset, offset + BLOCK));
      offset += BLOCK;
      if (event !== null) events.push(event);
    }
    this.buffer = data.slice(offset);
    return events;
  }

  /** Called when the input is over. An archive that stops cleanly after an entry, without its end blocks, still counts. */
  finish(): void {
    if (this.state === "done") return;
    if (this.state === "header" && this.buffer.length === 0 && this.headers > 0) {
      this.state = "done";
      return;
    }
    throw new TarFormatError(this.headers === 0 ? "archive.tar.not-tar" : "archive.tar.truncated");
  }

  private readHeader(block: Uint8Array): TarEvent | null {
    if (block.every((byte) => byte === 0)) {
      this.emptyBlocks += 1;
      if (this.emptyBlocks === 2) this.state = "done";
      return null;
    }
    this.emptyBlocks = 0;
    if (!checksumMatches(block)) {
      throw new TarFormatError(this.headers === 0 ? "archive.tar.not-tar" : "archive.tar.bad-checksum");
    }
    this.headers += 1;

    const typeflag = String.fromCharCode(block[156] ?? 0);
    const isMeta = "xgLK".includes(typeflag);
    const paxSize = this.pax.get("size");
    const size = !isMeta && paxSize !== undefined ? Number(paxSize) : readNumber(block, 124, 12);
    if (!Number.isSafeInteger(size) || size < 0) throw new TarFormatError("archive.tar.bad-header");
    this.remaining = size;
    this.padding = (BLOCK - (size % BLOCK)) % BLOCK;
    if (isMeta) {
      if (size > META_LIMIT) throw new TarFormatError("archive.tar.meta-too-large");
      this.state = "meta";
      this.metaType = typeflag;
      this.meta = [];
      return null;
    }

    let name = nameText(block.subarray(0, 100));
    // Only POSIX ustar keeps a name prefix here; GNU's older format stores times in the same place.
    if (ascii(block, 257, 5) === "ustar" && block[262] === 0) {
      const prefix = nameText(block.subarray(345, 500));
      if (prefix !== "") name = `${prefix}/${name}`;
    }
    name = this.pax.get("path") ?? this.longName ?? name;
    const mtime = Number(this.pax.get("mtime") ?? readNumber(block, 136, 12));
    const entry: TarEntry = {
      name,
      type: entryType(typeflag, name),
      size,
      mode: readNumber(block, 100, 8),
      modifiedMs: Number.isFinite(mtime) ? Math.round(mtime * 1000) : 0,
    };
    this.pax = new Map();
    this.longName = null;
    this.state = "data";
    return { kind: "entry", entry };
  }

  private applyMeta(): void {
    const bytes = this.meta.reduce((joined, part) => concat(joined, part), new Uint8Array(0));
    this.meta = [];
    if (this.metaType === "x") this.pax = parsePax(bytes);
    if (this.metaType === "L") this.longName = nameText(bytes);
    // Global pax headers (g) and GNU long link names (K) change nothing kiriya extracts.
  }
}
