const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Base64 with padding, or the URL-safe alphabet without it. */
export function toBase64(bytes: Uint8Array, urlSafe = false): string {
  const alphabet = urlSafe ? BASE64_URL : BASE64;
  const pad = urlSafe ? "" : "=";
  let text = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const triple = ((bytes[index] ?? 0) << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0);
    text += alphabet.charAt((triple >> 18) & 63) + alphabet.charAt((triple >> 12) & 63);
    text += index + 1 < bytes.length ? alphabet.charAt((triple >> 6) & 63) : pad;
    text += index + 2 < bytes.length ? alphabet.charAt(triple & 63) : pad;
  }
  return text;
}

/** Standard or URL-safe base64, padded or not, with whitespace ignored; null when it is not base64. */
export function fromBase64(text: string): Uint8Array | null {
  const clean = text
    .replace(/\s+/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .replace(/={0,2}$/, "");
  if (!/^[A-Za-z0-9+/]*$/.test(clean) || clean.length % 4 === 1) return null;
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let written = 0;
  for (const char of clean) {
    buffer = (buffer << 6) | BASE64.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[written] = (buffer >> bits) & 0xff;
      written += 1;
      buffer &= (1 << bits) - 1;
    }
  }
  return bytes;
}

export function toHex(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += byte.toString(16).padStart(2, "0");
  return text;
}

/** Hexadecimal digits in pairs, with whitespace and a leading 0x ignored; null when it is not hexadecimal. */
export function fromHex(text: string): Uint8Array | null {
  const clean = text.replace(/\s+/g, "").replace(/^0x/i, "");
  if (clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) return null;
  const bytes = new Uint8Array(clean.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** The bytes as UTF-8 text, or null when they are not valid UTF-8. */
export function utf8Text(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return null;
  }
}
