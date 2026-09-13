import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { NotFoundError, OperationFailedError } from "../../src/core/domain/errors.js";
import { NodeCompressionAdapter } from "../../src/core/infrastructure/node/node-compression.adapter.js";
import { NodeHasherAdapter } from "../../src/core/infrastructure/node/node-hasher.adapter.js";
import { layout, temporaryFolder } from "../support/fakes.js";

const SHA256_ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

test("hasher: known digests, and a limit hashes only the first bytes", async (t) => {
  const hasher = new NodeHasherAdapter();
  const root = await temporaryFolder(t);
  await layout(root, { "abc.txt": "abc", "longer.txt": "abcdef", "empty.txt": "" });
  assert.equal(await hasher.hashFile(path.join(root, "abc.txt"), "sha256"), SHA256_ABC);
  assert.equal(await hasher.hashFile(path.join(root, "abc.txt"), "md5"), "900150983cd24fb0d6963f7d28e17f72");
  assert.equal(await hasher.hashFile(path.join(root, "longer.txt"), "sha256", 3), SHA256_ABC);
  assert.equal(
    await hasher.hashFile(path.join(root, "empty.txt"), "sha256"),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
  await assert.rejects(hasher.hashFile(path.join(root, "missing"), "sha1"), NotFoundError);
});

test("compression: inflate returns what deflate took, and damaged data is an error", async () => {
  const compression = new NodeCompressionAdapter();
  const data = new TextEncoder().encode("hello ".repeat(1000));
  const deflated = await compression.deflateRaw(data);
  assert.ok(deflated.length < data.length);
  assert.deepEqual(new Uint8Array(await compression.inflateRaw(deflated)), data);
  await assert.rejects(compression.inflateRaw(new Uint8Array([0xff, 0xff, 0xff])), OperationFailedError);
});
