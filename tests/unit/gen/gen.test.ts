import assert from "node:assert/strict";
import { test } from "node:test";
import { UsageError } from "../../../src/core/domain/errors.js";
import type { RawInput } from "../../../src/core/domain/input-schema.js";
import { NodeRandomSource } from "../../../src/core/infrastructure/node/node-random-source.adapter.js";
import { GeneratePasswords, passwordSpec } from "../../../src/modules/gen/application/generate-passwords.use-case.js";
import { GenerateTokens, tokenSpec } from "../../../src/modules/gen/application/generate-tokens.use-case.js";
import { GenerateUlids, ulidSpec } from "../../../src/modules/gen/application/generate-ulids.use-case.js";
import { GenerateUuids, uuidSpec } from "../../../src/modules/gen/application/generate-uuids.use-case.js";
import { incrementRandom, ulid, uuidV4, uuidV7 } from "../../../src/modules/gen/domain/identifiers.js";
import {
  DIGITS,
  formatToken,
  LOWER,
  password,
  pickCharacters,
  SYMBOLS,
  UPPER,
} from "../../../src/modules/gen/domain/secrets.js";
import { CountingRandomSource, expectDone, FixedClock } from "../../support/fakes.js";

const counting = (count: number): Uint8Array => Uint8Array.from({ length: count }, (_, index) => index);
const raw = (options: RawInput["options"] = {}): RawInput => ({ positionals: [], options });
const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test("a v4 UUID sets the version and variant bits over random bytes", () => {
  assert.equal(uuidV4(counting(16)), "00010203-0405-4607-8809-0a0b0c0d0e0f");
});

test("a v7 UUID starts with the Unix time in milliseconds, as in RFC 9562's example", () => {
  assert.equal(uuidV7(0x017f22e279b0, counting(10)), "017f22e2-79b0-7001-8203-040506070809");
});

test("a ULID is the time in Crockford base32, then 80 random bits", () => {
  assert.equal(ulid(1469918176385, new Uint8Array(10)), "01ARYZ6S410000000000000000");
  assert.equal(ulid(0, new Uint8Array(10).fill(255)), "0000000000ZZZZZZZZZZZZZZZZ");
});

test("the random part of a ULID counts up and reports overflow", () => {
  assert.deepEqual(incrementRandom(Uint8Array.from([0, 255])), Uint8Array.from([1, 0]));
  assert.equal(incrementRandom(new Uint8Array(2).fill(255)), null);
});

test("characters are drawn without modulo bias", () => {
  const queue = [255, 3, 250, 7, 249];
  const next = (count: number): Uint8Array => Uint8Array.from(queue.splice(0, count));
  // With ten characters, bytes from 250 up would favour 0 to 5, so they are skipped.
  assert.equal(pickCharacters(DIGITS, 3, next), "379");
});

test("a password always has a character of every class", () => {
  const random = new NodeRandomSource();
  const classes = [LOWER, UPPER, DIGITS, SYMBOLS];
  for (let round = 0; round < 50; round += 1) {
    const value = password(8, classes, (count) => random.bytes(count));
    assert.equal(value.length, 8);
    for (const characters of classes) {
      assert.ok(
        [...value].some((char) => characters.includes(char)),
        value,
      );
    }
  }
});

test("tokens are hex, base64 or URL-safe base64", () => {
  assert.equal(formatToken(Uint8Array.from([0xfb, 0xff]), "hex"), "fbff");
  assert.equal(formatToken(Uint8Array.from([0xfb, 0xff]), "base64"), "+/8=");
  assert.equal(formatToken(Uint8Array.from([0xfb, 0xff]), "base64url"), "-_8");
});

test("gen uuid makes as many as asked, random or time-ordered", async () => {
  const uuids = new GenerateUuids(new CountingRandomSource(), new FixedClock(0));
  const random = expectDone(await uuids.execute(uuidSpec.input.parse(raw({ count: "3" }))));
  assert.equal(new Set(random.data.values).size, 3);
  for (const value of random.data.values) assert.match(value, V4);
  const ordered = expectDone(await uuids.execute(uuidSpec.input.parse(raw({ v7: true }))));
  assert.match(ordered.data.values[0] ?? "", /^00000000-0000-7[0-9a-f]{3}-[89ab]/);
});

test("gen ulid keeps the order of values made in the same millisecond", async () => {
  const ulids = new GenerateUlids(new CountingRandomSource(250), new FixedClock(1469918176385));
  const { data } = expectDone(await ulids.execute(ulidSpec.input.parse(raw({ count: "20" }))));
  assert.equal(new Set(data.values).size, 20);
  assert.deepEqual([...data.values].sort(), data.values);
});

test("gen password and gen token follow their options", async () => {
  const passwords = new GeneratePasswords(new NodeRandomSource());
  const input = passwordSpec.input.parse(raw({ length: "40", "no-symbols": true, count: "5" }));
  const { data } = expectDone(await passwords.execute(input));
  assert.equal(data.values.length, 5);
  for (const value of data.values) assert.match(value, /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{40}$/);

  const tokens = new GenerateTokens(new CountingRandomSource());
  const token = expectDone(await tokens.execute(tokenSpec.input.parse(raw({ bytes: "8", format: "hex" }))));
  assert.deepEqual(token.data.values, ["0001020304050607"]);
});

test("counts, lengths and formats out of range are usage errors", () => {
  assert.throws(() => uuidSpec.input.parse(raw({ count: "1001" })), UsageError);
  assert.throws(() => ulidSpec.input.parse(raw({ count: "0" })), UsageError);
  assert.throws(() => passwordSpec.input.parse(raw({ length: "7" })), UsageError);
  assert.throws(() => tokenSpec.input.parse(raw({ bytes: "2000" })), UsageError);
  assert.throws(() => tokenSpec.input.parse(raw({ format: "base32" })), UsageError);
});
