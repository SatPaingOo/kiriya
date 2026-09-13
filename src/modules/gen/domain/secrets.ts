import { toBase64, toHex } from "../../../core/domain/encodings.js";

export const LOWER = "abcdefghijklmnopqrstuvwxyz";
export const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const DIGITS = "0123456789";
/** Symbols that need no quoting in most shells, URLs and configuration formats. */
export const SYMBOLS = "!#%*+-=?@^_~";

export const TOKEN_FORMATS = ["hex", "base64", "base64url"] as const;
export type TokenFormat = (typeof TOKEN_FORMATS)[number];

/**
 * Characters drawn from an alphabet without bias: a random byte at or past the last
 * whole multiple of the alphabet's length is thrown away and another is drawn.
 */
export function pickCharacters(alphabet: string, count: number, randomBytes: (count: number) => Uint8Array): string {
  const limit = 256 - (256 % alphabet.length);
  let text = "";
  while (text.length < count) {
    for (const byte of randomBytes(count - text.length + 8)) {
      if (byte >= limit) continue;
      text += alphabet.charAt(byte % alphabet.length);
      if (text.length === count) break;
    }
  }
  return text;
}

/**
 * A password with at least one character of every class. Candidates are drawn whole
 * and kept only when they have every class, so each allowed password is equally likely.
 */
export function password(
  length: number,
  classes: readonly string[],
  randomBytes: (count: number) => Uint8Array,
): string {
  const alphabet = classes.join("");
  for (;;) {
    const candidate = pickCharacters(alphabet, length, randomBytes);
    if (classes.every((characters) => [...candidate].some((char) => characters.includes(char)))) return candidate;
  }
}

export function formatToken(bytes: Uint8Array, format: TokenFormat): string {
  if (format === "hex") return toHex(bytes);
  return toBase64(bytes, format === "base64url");
}
