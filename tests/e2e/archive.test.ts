import assert from "node:assert/strict";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { crc32 } from "../../src/modules/archive/domain/crc32.js";
import { centralHeader, endRecord, localHeader, STORED } from "../../src/modules/archive/domain/zip-format.js";
import { runKiriya } from "../support/cli.js";
import { layout, temporaryFolder } from "../support/fakes.js";

const exists = (target: string): Promise<boolean> =>
  access(target).then(
    () => true,
    () => false,
  );

/** A stored archive with any entry names at all, including ones kiriya itself would never write. */
function handmadeZip(entries: ReadonlyArray<readonly [string, string]>): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const data = new TextEncoder().encode(text);
    const header = {
      name,
      isDirectory: false,
      method: STORED,
      crc: crc32(data),
      compressedSize: data.length,
      size: data.length,
      modifiedMs: Date.now(),
    };
    central.push(centralHeader(header, offset));
    const local = localHeader(header);
    parts.push(local, data);
    offset += local.length + data.length;
  }
  const size = central.reduce((sum, bytes) => sum + bytes.length, 0);
  return Buffer.concat([...parts, ...central, endRecord({ count: entries.length, size, offset })]);
}

async function project(t: TestContext): Promise<string> {
  const root = await temporaryFolder(t);
  await layout(root, {
    "proj/src/index.ts": "export const x = 1;\n".repeat(50),
    "proj/node_modules/dep/index.js": "x",
    "proj/.hidden": "h",
  });
  await writeFile(path.join(root, "proj", "ဓာတ်ပုံ.png"), Buffer.alloc(3000, 7));
  await mkdir(path.join(root, "proj", "empty"));
  return root;
}

test("a folder round-trips through zip and unzip, and nothing is ever overwritten unasked", async (t) => {
  const root = await project(t);
  const archive = (args: readonly string[]) => runKiriya(root, ["archive", ...args]);
  const packed = archive(["zip", "proj", "--to", "proj.zip"]);
  assert.equal(packed.code, 0, packed.stderr);
  assert.equal(archive(["zip", "proj", "--to", "proj.zip"]).code, 1, "never overwrites an archive");

  assert.match(archive(["unzip", "proj.zip", "--list"]).stdout, /proj[/]ဓာတ်ပုံ[.]png/);
  const extracted = archive(["unzip", "proj.zip", "--to", "out"]);
  assert.equal(extracted.code, 0, extracted.stderr);
  assert.equal(runKiriya(root, ["files", "compare", "proj", "out/proj", "--all"]).code, 0);
  assert.ok(await exists(path.join(root, "out", "proj", "empty")));
  assert.equal(archive(["unzip", "proj.zip", "--to", "out"]).code, 1, "existing files are not replaced");
  assert.equal(archive(["unzip", "proj.zip", "--to", "out", "--overwrite", "--confirm=4"]).code, 0);
});

test("--lean leaves dependency folders out", async (t) => {
  const root = await project(t);
  assert.equal(runKiriya(root, ["archive", "zip", "proj", "--to", "lean.zip", "--lean"]).code, 0);
  const listed = runKiriya(root, ["archive", "unzip", "lean.zip", "--list"]);
  assert.doesNotMatch(listed.stdout, /node_modules/);
  assert.match(listed.stdout, /[.]hidden/);
});

test("entry names no OS can create are skipped with the reason", async (t) => {
  const root = await temporaryFolder(t);
  await writeFile(
    path.join(root, "odd.zip"),
    handmadeZip([
      ["odd/ok.txt", "ok"],
      ["odd/what?.txt", "odd"],
    ]),
  );
  const result = runKiriya(root, ["archive", "unzip", "odd.zip", "--to", "odd-out"]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /what[?][.]txt: .*names cannot contain/);
  assert.ok(await exists(path.join(root, "odd-out", "odd", "ok.txt")));
});

test("an archive that writes outside its folder is refused whole", async (t) => {
  const root = await temporaryFolder(t);
  await writeFile(
    path.join(root, "evil.zip"),
    handmadeZip([
      ["fine.txt", "fine"],
      ["../escaped.txt", "evil"],
    ]),
  );
  const result = runKiriya(root, ["archive", "unzip", "evil.zip", "--to", "safe"]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Unsafe entry name: [.][.][/]escaped[.]txt/);
  assert.equal(await exists(path.join(root, "escaped.txt")), false);
  assert.equal(await exists(path.join(root, "safe", "fine.txt")), false);
});

test("a file that is not a zip is an error, not a crash", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, { "fake.zip": "not a zip at all" });
  const result = runKiriya(root, ["archive", "unzip", "fake.zip", "--json"]);
  assert.equal(result.code, 1);
  const json = JSON.parse(result.stdout) as { error: { message: { key: string } } };
  assert.equal(json.error.message.key, "archive.read.not-a-zip");
});
