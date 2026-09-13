import assert from "node:assert/strict";
import { test } from "node:test";
import { UsageError } from "../../../src/core/domain/errors.js";
import { parseSize, parseTime } from "../../../src/modules/files/domain/values.js";

const usage = (key: string) => (error: unknown) => error instanceof UsageError && error.detail.key === key;

test("sizes use 1024-based units", () => {
  assert.equal(parseSize("500"), 500);
  assert.equal(parseSize("10KB"), 10_240);
  assert.equal(parseSize("1.5 MB"), 1_572_864);
  assert.equal(parseSize("2g"), 2_147_483_648);
  assert.equal(parseSize("1KiB"), 1024);
  assert.throws(() => parseSize("big"), usage("files.value.size"));
  assert.throws(() => parseSize("10XB"), usage("files.value.size"));
});

test("times are ages before now or dates", () => {
  const now = Date.parse("2026-06-15T12:00:00Z");
  assert.equal(parseTime("30m", now), now - 30 * 60_000);
  assert.equal(parseTime("7d", now), now - 7 * 86_400_000);
  assert.equal(parseTime("2W", now), now - 14 * 86_400_000);
  assert.equal(parseTime("2026-01-31", now), Date.parse("2026-01-31"));
  assert.throws(() => parseTime("soon", now), usage("files.value.time"));
});
