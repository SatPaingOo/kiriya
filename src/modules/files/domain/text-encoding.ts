export const TEXT_ENCODINGS = ["utf8", "utf8-bom", "utf16le", "utf16be"] as const;
export type TextEncoding = (typeof TEXT_ENCODINGS)[number];

export interface TextFile {
  readonly text: string;
  readonly encoding: TextEncoding;
}

/** Text files larger than this are skipped by grep and replace and refused by read. */
export const MAX_TEXT_BYTES = 50 * 1024 * 1024;

const BOM = String.fromCharCode(0xfeff);
const NUL = String.fromCharCode(0);

function swapPairs(bytes: Uint8Array): Uint8Array {
  const swapped = new Uint8Array(bytes.length - (bytes.length % 2));
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    swapped[index] = bytes[index + 1] ?? 0;
    swapped[index + 1] = bytes[index] ?? 0;
  }
  return swapped;
}

/** A NUL anywhere, or more than 10% control characters in the first 8000, means the bytes are not text. */
function looksBinary(text: string): boolean {
  if (text.includes(NUL)) return true;
  const sample = text.slice(0, 8000);
  let control = 0;
  for (let index = 0; index < sample.length; index += 1) {
    const code = sample.charCodeAt(index);
    if (code < 32 && code !== 9 && code !== 10 && code !== 12 && code !== 13 && code !== 27) control += 1;
  }
  return sample.length > 0 && control / sample.length > 0.1;
}

/** Text with the encoding it was stored in, or null when the bytes are not text. */
export function decodeText(bytes: Uint8Array): TextFile | null {
  const checked = (text: string, encoding: TextEncoding): TextFile | null =>
    looksBinary(text) ? null : { text, encoding };
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return checked(new TextDecoder("utf-16le", { ignoreBOM: true }).decode(bytes.subarray(2)), "utf16le");
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return checked(new TextDecoder("utf-16le", { ignoreBOM: true }).decode(swapPairs(bytes.subarray(2))), "utf16be");
  }
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bom ? bytes.subarray(3) : bytes);
    return checked(text, bom ? "utf8-bom" : "utf8");
  } catch {
    return null;
  }
}

function utf16(text: string, littleEndian: boolean): Uint8Array {
  const bytes = new Uint8Array(text.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < text.length; index += 1) view.setUint16(index * 2, text.charCodeAt(index), littleEndian);
  return bytes;
}

/** The bytes decodeText read: the encoding and its byte-order mark are kept. */
export function encodeText(file: TextFile): Uint8Array {
  switch (file.encoding) {
    case "utf8":
      return new TextEncoder().encode(file.text);
    case "utf8-bom":
      return new TextEncoder().encode(BOM + file.text);
    case "utf16le":
      return utf16(BOM + file.text, true);
    case "utf16be":
      return utf16(BOM + file.text, false);
  }
}

/** Lines without their endings; a final line ending does not start another line. */
export function splitLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
