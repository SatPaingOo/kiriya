import assert from "node:assert/strict";
import { readdir, readFile, stat as nodeStat, utimes } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { ConflictError, NotFoundError } from "../../src/core/domain/errors.js";
import type { FileSystem } from "../../src/core/domain/ports/file-system.js";
import { NodeFileSystemAdapter } from "../../src/core/infrastructure/node/node-file-system.adapter.js";
import { layout, temporaryFolder } from "../support/fakes.js";

/** One suite for the port, run against every adapter of it. */
const ADAPTERS: ReadonlyArray<readonly [string, () => FileSystem]> = [["node", () => new NodeFileSystemAdapter()]];

const PAST = new Date("2024-03-04T05:06:08Z");

for (const [name, create] of ADAPTERS) {
  test(`${name}: a missing path is null for stat and not found for everything else`, async (t) => {
    const fileSystem = create();
    const root = await temporaryFolder(t);
    await layout(root, { "file.txt": "x" });
    assert.equal(await fileSystem.lstat(path.join(root, "missing")), null);
    assert.equal(await fileSystem.stat(path.join(root, "missing")), null);
    assert.equal(await fileSystem.stat(path.join(root, "file.txt", "below")), null);
    await assert.rejects(fileSystem.readDirectory(path.join(root, "missing")), NotFoundError);
    await assert.rejects(fileSystem.remove(path.join(root, "missing")), NotFoundError);
  });

  test(`${name}: entries carry their kind, and times are whole milliseconds`, async (t) => {
    const fileSystem = create();
    const root = await temporaryFolder(t);
    await layout(root, { "dir/": "", "file.txt": "abc" });
    const entries = [...(await fileSystem.readDirectory(root))].sort((a, b) => (a.name < b.name ? -1 : 1));
    assert.deepEqual(
      entries.map((entry) => [entry.name, entry.kind]),
      [
        ["dir", "directory"],
        ["file.txt", "file"],
      ],
    );
    const stat = await fileSystem.stat(path.join(root, "file.txt"));
    assert.equal(stat?.kind, "file");
    assert.equal(stat.size, 3);
    assert.ok(Number.isInteger(stat.modifiedMs));
  });

  test(`${name}: createDirectory makes parents and accepts an existing folder`, async (t) => {
    const fileSystem = create();
    const target = path.join(await temporaryFolder(t), "a", "b", "c");
    await fileSystem.createDirectory(target);
    await fileSystem.createDirectory(target);
    assert.equal((await fileSystem.stat(target))?.kind, "directory");
  });

  test(`${name}: createFile writes UTF-8 and never replaces anything`, async (t) => {
    const fileSystem = create();
    const root = await temporaryFolder(t);
    const target = path.join(root, "x.txt");
    await fileSystem.createFile(target, "héllo ✓");
    assert.equal(await readFile(target, "utf8"), "héllo ✓");
    await assert.rejects(fileSystem.createFile(target, "other"), ConflictError);
    assert.equal(await readFile(target, "utf8"), "héllo ✓");
    await assert.rejects(fileSystem.createFile(path.join(root, "missing", "y.txt"), ""), NotFoundError);
  });

  test(`${name}: remove deletes a folder with everything inside`, async (t) => {
    const fileSystem = create();
    const root = await temporaryFolder(t);
    await layout(root, { "tree/a/b.txt": "1" });
    await fileSystem.remove(path.join(root, "tree"));
    assert.equal(await fileSystem.lstat(path.join(root, "tree")), null);
  });

  test(`${name}: copy keeps modification times and refuses to replace unless asked`, async (t) => {
    const fileSystem = create();
    const root = await temporaryFolder(t);
    await layout(root, { "src/a.txt": "new", "src/sub/b.txt": "b", "dest/src/a.txt": "old", "dest/src/keep.txt": "k" });
    await utimes(path.join(root, "src", "a.txt"), PAST, PAST);

    await fileSystem.copy(path.join(root, "src"), path.join(root, "copy"), false);
    assert.equal(await readFile(path.join(root, "copy", "sub", "b.txt"), "utf8"), "b");
    const copied = await nodeStat(path.join(root, "copy", "a.txt"));
    assert.ok(Math.abs(copied.mtimeMs - PAST.getTime()) < 2000);

    await assert.rejects(fileSystem.copy(path.join(root, "src"), path.join(root, "dest", "src"), false), ConflictError);
    assert.equal(await readFile(path.join(root, "dest", "src", "a.txt"), "utf8"), "old");
    await fileSystem.copy(path.join(root, "src"), path.join(root, "dest", "src"), true);
    assert.equal(await readFile(path.join(root, "dest", "src", "a.txt"), "utf8"), "new");
    assert.equal(await readFile(path.join(root, "dest", "src", "keep.txt"), "utf8"), "k");
  });

  test(`${name}: move renames, and refuses an existing destination`, async (t) => {
    const fileSystem = create();
    const root = await temporaryFolder(t);
    await layout(root, { "a.txt": "a", "b.txt": "b", "folder/inner.txt": "i" });
    await fileSystem.move(path.join(root, "folder"), path.join(root, "renamed"));
    assert.equal(await readFile(path.join(root, "renamed", "inner.txt"), "utf8"), "i");
    await assert.rejects(fileSystem.move(path.join(root, "a.txt"), path.join(root, "b.txt")), ConflictError);
    assert.equal(await readFile(path.join(root, "b.txt"), "utf8"), "b");
    await assert.rejects(fileSystem.move(path.join(root, "missing"), path.join(root, "c.txt")), NotFoundError);
  });

  test(`${name}: setTimes, sameEntry and removeEmptyDirectory`, async (t) => {
    const fileSystem = create();
    const root = await temporaryFolder(t);
    await layout(root, { "a.txt": "a", "b.txt": "a", "empty/": "", "full/x.txt": "x" });
    await fileSystem.setTimes(path.join(root, "a.txt"), PAST.getTime(), PAST.getTime());
    assert.ok(Math.abs(((await fileSystem.stat(path.join(root, "a.txt")))?.modifiedMs ?? 0) - PAST.getTime()) < 2000);

    assert.equal(await fileSystem.sameEntry(path.join(root, "a.txt"), path.join(root, "a.txt")), true);
    assert.equal(await fileSystem.sameEntry(path.join(root, "a.txt"), path.join(root, "b.txt")), false);
    assert.equal(await fileSystem.sameEntry(path.join(root, "a.txt"), path.join(root, "missing")), false);

    assert.equal(await fileSystem.removeEmptyDirectory(path.join(root, "full")), false);
    assert.equal(await fileSystem.removeEmptyDirectory(path.join(root, "empty")), true);
    assert.deepEqual((await readdir(root)).sort(), ["a.txt", "b.txt", "full"]);
  });
}
