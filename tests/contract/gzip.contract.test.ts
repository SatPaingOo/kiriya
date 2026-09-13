import assert from "node:assert/strict";
import { test } from "node:test";
import { gunzipSync, gzipSync } from "node:zlib";
import { utf8Bytes } from "../../src/core/domain/encodings.js";
import { OperationFailedError } from "../../src/core/domain/errors.js";
import type { CompressionStream } from "../../src/core/domain/ports/compression.js";
import { NodeCompressionAdapter } from "../../src/core/infrastructure/node/node-compression.adapter.js";

async function run(stream: CompressionStream, data: Uint8Array, pieceBytes: number): Promise<Uint8Array> {
  const output: Uint8Array[] = [];
  for (let offset = 0; offset < data.length; offset += pieceBytes) {
    output.push(await stream.push(data.subarray(offset, offset + pieceBytes)));
  }
  output.push(await stream.end());
  return new Uint8Array(Buffer.concat(output));
}

test("gzip streams: zlib reads what gzip writes, and gunzip reads what zlib writes", async () => {
  const compression = new NodeCompressionAdapter();
  const data = utf8Bytes("kiriya ကိရိယာ ".repeat(20_000));

  const compressed = await run(compression.gzip(), data, 7000);
  assert.ok(compressed.length < data.length);
  assert.deepEqual(new Uint8Array(gunzipSync(compressed)), data);

  assert.deepEqual(await run(compression.gunzip(), gzipSync(data), 1000), data);
});

test("gunzip reports data that is not gzip, or stops in the middle", async () => {
  const compression = new NodeCompressionAdapter();
  const notGzip = utf8Bytes("this is not gzip at all");
  await assert.rejects(run(compression.gunzip(), notGzip, 8), OperationFailedError);
  const cut = gzipSync(utf8Bytes("x".repeat(100_000))).subarray(0, 60);
  await assert.rejects(run(compression.gunzip(), cut, 20), OperationFailedError);
});
