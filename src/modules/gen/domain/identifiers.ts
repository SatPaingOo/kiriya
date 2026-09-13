import { toHex } from "../../../core/domain/encodings.js";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function formatUuid(bytes: Uint8Array): string {
  const hex = toHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** A version 4 UUID from 16 random bytes: 122 random bits. */
export function uuidV4(random: Uint8Array): string {
  const bytes = Uint8Array.from(random.subarray(0, 16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  return formatUuid(bytes);
}

/** A version 7 UUID: 48 bits of Unix milliseconds, then 10 random bytes, so values sort by creation time. */
export function uuidV7(epochMs: number, random: Uint8Array): string {
  const bytes = new Uint8Array(16);
  let time = Math.max(0, Math.floor(epochMs));
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = time % 256;
    time = Math.floor(time / 256);
  }
  bytes.set(random.subarray(0, 10), 6);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  return formatUuid(bytes);
}

/** A ULID: 10 Crockford base32 characters of Unix milliseconds, then 16 of 10 random bytes. */
export function ulid(epochMs: number, random: Uint8Array): string {
  let time = "";
  let remaining = Math.max(0, Math.floor(epochMs));
  for (let index = 0; index < 10; index += 1) {
    time = CROCKFORD.charAt(remaining % 32) + time;
    remaining = Math.floor(remaining / 32);
  }
  let randomPart = "";
  let buffer = 0;
  let bits = 0;
  for (const byte of random.subarray(0, 10)) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      randomPart += CROCKFORD.charAt((buffer >> bits) & 31);
    }
    buffer &= (1 << bits) - 1;
  }
  return time + randomPart;
}

/**
 * The next random part for ULIDs made in the same millisecond: the previous one plus
 * one, so they still sort in the order they were made. null when it would overflow.
 */
export function incrementRandom(previous: Uint8Array): Uint8Array | null {
  const next = Uint8Array.from(previous);
  for (let index = next.length - 1; index >= 0; index -= 1) {
    const value = next[index] ?? 0;
    if (value < 255) {
      next[index] = value + 1;
      return next;
    }
    next[index] = 0;
  }
  return null;
}
