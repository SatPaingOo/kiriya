import assert from "node:assert/strict";
import { test } from "node:test";
import { findSecrets, redactSecret } from "../../../src/core/domain/secrets.js";
import { isAllowed } from "../../../src/modules/secrets/domain/allow-marker.js";

const GITHUB = `ghp_${"a".repeat(20)}`;
const AWS = "AKIAIOSFODNN7EXAMPLE"; // kiriya:allow-secret
const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MiJ9.sig"; // kiriya:allow-secret
const URL_WITH_PASSWORD = "postgres://me:pw@db:5432/app"; // kiriya:allow-secret

test("each shape a secret has is found, with where it starts", () => {
  const kinds = (text: string): string[] => findSecrets(text).map((match) => match.kind);
  assert.deepEqual(kinds(`const t = "${GITHUB}";`), ["token"]);
  assert.deepEqual(kinds(`key: ${AWS}`), ["token"]);
  assert.deepEqual(kinds(JWT), ["jwt"]);
  assert.deepEqual(kinds(URL_WITH_PASSWORD), ["url-credentials"]);
  assert.deepEqual(kinds("-----BEGIN RSA PRIVATE KEY-----"), ["private-key"]); // kiriya:allow-secret

  const line = `token = "${GITHUB}"`;
  const found = findSecrets(line);
  assert.equal(found.length, 1);
  assert.equal(found[0]?.start, line.indexOf(GITHUB), "points at the token, not at the line");
  assert.equal(found[0]?.length, GITHUB.length, "covers the token and nothing around it");
});

// The reason the assignment pattern is not scanned for: run over kiriya itself it matched 42
// lines and every one was syntax. These are three of them, verbatim.
test("a line of ordinary code that merely mentions a secret is not a finding", () => {
  for (const line of [
    'if (token === "--") passthrough = true;',
    "export function decodeJwt(token: string): DecodedJwt | null {",
    "  readonly secret: Uint8Array;",
    "const DB_PASSWORD = process.env.DB_PASSWORD;",
    "// Set your api_key: in the dashboard",
  ]) {
    assert.deepEqual(findSecrets(line), [], line);
  }
});

test("two secrets on one line are both found, and neither is counted twice", () => {
  const line = `a=${GITHUB} b=${AWS}`;
  const found = findSecrets(line);
  assert.equal(found.length, 2);
  const [first, second] = found;
  assert.ok(first && second);
  assert.ok(first.start < second.start, "earliest first");
  assert.ok(first.start + first.length <= second.start, "no overlap");
});

test("what is printed can identify the secret but never carries it", () => {
  const cases: readonly [string, string][] = [
    [`t = "${GITHUB}"`, "ghp_****"],
    [`key: ${AWS}`, "AKIA****"],
    [JWT, "eyJ****"],
    [URL_WITH_PASSWORD, "postgres://me:****@"], // kiriya:allow-secret
  ];
  for (const [line, expected] of cases) {
    const match = findSecrets(line)[0];
    assert.ok(match, line);
    const sample = redactSecret(line, match);
    assert.equal(sample, expected);
    const value = line.slice(match.start, match.start + match.length);
    assert.ok(!sample.includes(value), `the sample must not be the secret: ${sample}`);
  }
  // A private key's marker line is not itself secret, and it is what names what you found.
  const key = "-----BEGIN RSA PRIVATE KEY-----"; // kiriya:allow-secret
  const keyMatch = findSecrets(key)[0];
  assert.ok(keyMatch);
  assert.equal(redactSecret(key, keyMatch), key);
});

test("a marker excuses its own line and either neighbour, and nothing further", () => {
  const lines = [
    "const above = 1;",
    "// kiriya:allow-secret",
    "const below = 2;",
    "const far = 3;",
    "const alsoFar = 4;",
    "const own = 5; // kiriya:allow-secret",
  ];
  assert.equal(isAllowed(lines, 1), true, "the marker's own line");
  assert.equal(isAllowed(lines, 0), true, "the line above it");
  assert.equal(isAllowed(lines, 2), true, "the line below it");
  assert.equal(isAllowed(lines, 3), false, "two lines away is too far");
  assert.equal(isAllowed(lines, 5), true, "a marker at the end of the line");
  assert.equal(isAllowed(lines, 99), false, "a line that does not exist");
});

// Prettier reflowed a trailing marker onto the next line and silently unmarked the fixture it
// excused. Whichever side the formatter leaves it on, it must still count.
test("a marker a formatter has moved to the next line still excuses the secret", () => {
  const moved = ['for (const secret of ["-----BEGIN RSA PRIVATE KEY-----"]) {', "  // kiriya:allow-secret"];
  assert.equal(isAllowed(moved, 0), true);
});
