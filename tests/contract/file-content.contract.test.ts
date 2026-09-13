import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { ConflictError, NotFoundError, OperationFailedError } from "../../src/core/domain/errors.js";
import type { FileContent } from "../../src/core/domain/ports/file-content.js";
import { NodeFileContentAdapter } from "../../src/core/infrastructure/node/node-file-content.adapter.js";
import { layout, temporaryFolder } from "../support/fakes.js";

const ADAPTERS: ReadonlyArray<readonly [string, () => FileContent]> = [["node", () => new NodeFileContentAdapter()]];

for (const [name, create] of ADAPTERS) {
  test(`${name}: write replaces the content and read returns it`, async (t) => {
    const content = create();
    const root = await temporaryFolder(t);
    const target = path.join(root, "a.bin");
    await content.write(target, new Uint8Array([1, 2, 3]));
    await content.write(target, new Uint8Array([4, 5]));
    assert.deepEqual([...(await content.read(target))], [4, 5]);
    await assert.rejects(content.read(path.join(root, "missing")), NotFoundError);
  });

  test(`${name}: reads by position, and an early end is an error`, async (t) => {
    const content = create();
    const root = await temporaryFolder(t);
    await layout(root, { "ten.txt": "0123456789" });
    const reader = await content.openForReading(path.join(root, "ten.txt"));
    try {
      assert.equal(reader.size, 10);
      assert.equal(new TextDecoder().decode(await reader.readAt(3, 4)), "3456");
      await assert.rejects(reader.readAt(8, 5), OperationFailedError);
    } finally {
      await reader.close();
    }
  });

  test(`${name}: an exclusive file refuses an existing path, and a discarded one leaves nothing`, async (t) => {
    const content = create();
    const root = await temporaryFolder(t);
    const target = path.join(root, "new.zip");
    const writer = await content.createExclusive(target);
    await writer.write(new Uint8Array([1]));
    await writer.write(new Uint8Array([2, 3]));
    await writer.close();
    assert.deepEqual([...(await content.read(target))], [1, 2, 3]);
    await assert.rejects(content.createExclusive(target), ConflictError);

    const partial = path.join(root, "partial.zip");
    const discarded = await content.createExclusive(partial);
    await discarded.write(new Uint8Array([9]));
    await discarded.discard();
    await assert.rejects(access(partial));
  });
}
