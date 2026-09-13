import assert from "node:assert/strict";
import { access, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { TAR_END, tarHeader, tarPadding } from "../../src/modules/archive/domain/tar-format.js";
import { runKiriya } from "../support/cli.js";
import { layout, temporaryFolder } from "../support/fakes.js";

const exists = (target: string): Promise<boolean> =>
  access(target).then(
    () => true,
    () => false,
  );

function entry(name: string, text: string): Uint8Array[] {
  const data = Buffer.from(text);
  const header = tarHeader({ name, isDirectory: false, size: data.length, mode: 0o644, modifiedMs: Date.now() });
  return [header, data, new Uint8Array(tarPadding(data.length))];
}

test("a folder round-trips through tar and untar, and nothing is overwritten unasked", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, {
    "proj/src/index.ts": "export const x = 1;\n".repeat(50),
    "proj/node_modules/dep/index.js": "x",
    "proj/.hidden": "h",
    "proj/empty/": "",
  });
  await writeFile(path.join(root, "proj", "ဓာတ်ပုံ.png"), Buffer.alloc(3000, 7));
  const archive = (args: readonly string[]) => runKiriya(root, ["archive", ...args]);

  const packed = archive(["tar", "proj", "--to", "proj.tar.gz"]);
  assert.equal(packed.code, 0, packed.stderr);
  assert.equal(archive(["tar", "proj", "--to", "proj.tar.gz"]).code, 1, "never overwrites an archive");
  assert.equal(archive(["tar", "proj", "--to", "proj.7z"]).code, 2, "only .tar.gz, .tgz and .tar");

  assert.match(archive(["untar", "proj.tar.gz", "--list"]).stdout, /proj[/]ဓာတ်ပုံ[.]png/);
  const extracted = archive(["untar", "proj.tar.gz", "--to", "out"]);
  assert.equal(extracted.code, 0, extracted.stderr);
  assert.equal(runKiriya(root, ["files", "compare", "proj", "out/proj", "--all"]).code, 0);
  assert.ok(await exists(path.join(root, "out", "proj", "empty")));
  assert.equal(archive(["untar", "proj.tar.gz", "--to", "out"]).code, 1, "existing files are not replaced");
  assert.equal(archive(["untar", "proj.tar.gz", "--to", "out", "--overwrite", "--confirm=4"]).code, 0);
});

test("a tar that writes outside its folder is refused whole, and a file that is no tar is an error", async (t) => {
  const root = await temporaryFolder(t);
  await writeFile(
    path.join(root, "evil.tar"),
    Buffer.concat([...entry("fine.txt", "fine"), ...entry("../escaped.txt", "evil"), TAR_END]),
  );
  const refused = runKiriya(root, ["archive", "untar", "evil.tar", "--to", "safe"]);
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /Unsafe entry name: [.][.][/]escaped[.]txt/);
  assert.equal(await exists(path.join(root, "escaped.txt")), false);
  assert.equal(await exists(path.join(root, "safe", "fine.txt")), false);

  await layout(root, { "fake.tar.gz": "not a tar at all" });
  const damaged = runKiriya(root, ["archive", "untar", "fake.tar.gz", "--json"]);
  assert.equal(damaged.code, 1);
  const json = JSON.parse(damaged.stdout) as { error: { message: { key: string } } };
  assert.equal(json.error.message.key, "archive.untar.damaged");
});
