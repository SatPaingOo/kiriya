import assert from "node:assert/strict";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { OperationFailedError } from "../../src/core/domain/errors.js";
import type { ConfigStore } from "../../src/core/domain/ports/config-store.js";
import { JsonConfigStore } from "../../src/core/infrastructure/node/json-config-store.adapter.js";
import { temporaryFolder } from "../support/fakes.js";

const ADAPTERS: ReadonlyArray<readonly [string, (file: string) => ConfigStore]> = [
  ["json", (file) => new JsonConfigStore(file)],
];

const failsWith = (key: string) => (error: unknown) =>
  error instanceof OperationFailedError && error.detail.key === key;

for (const [name, create] of ADAPTERS) {
  test(`${name}: a missing file does not exist and reads as empty`, async (t) => {
    const store = create(path.join(await temporaryFolder(t), "nested", "config.json"));
    assert.equal(await store.exists(), false);
    assert.deepEqual(await store.read(), {});
  });

  test(`${name}: writes create the folders, sort the keys, and leave no temporary file`, async (t) => {
    const folder = path.join(await temporaryFolder(t), "kiriya");
    const store = create(path.join(folder, "config.json"));
    await store.write({ zeta: "z", plugins: ["a", "./b"] });
    assert.equal(await store.exists(), true);
    assert.deepEqual(await store.read(), { plugins: ["a", "./b"], zeta: "z" });
    const text = await readFile(path.join(folder, "config.json"), "utf8");
    assert.ok(text.indexOf('"plugins"') < text.indexOf('"zeta"'));
    assert.ok(text.endsWith("}\n"));
    assert.deepEqual(await readdir(folder), ["config.json"]);
  });

  test(`${name}: a file that is not one JSON object of text and lists of text names the problem`, async (t) => {
    const root = await temporaryFolder(t);
    const cases: ReadonlyArray<readonly [string, string]> = [
      ["{ nope", "core.config.invalid-json"],
      ["[1, 2]", "core.config.not-an-object"],
      ['{ "plugins": 3 }', "core.config.invalid-field"],
      ['{ "plugins": ["a", 1] }', "core.config.invalid-field"],
    ];
    for (const [index, [text, key]] of cases.entries()) {
      const file = path.join(root, `config-${index}.json`);
      await writeFile(file, text);
      await assert.rejects(create(file).read(), failsWith(key));
    }
  });
}
