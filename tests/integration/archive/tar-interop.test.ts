import assert from "node:assert/strict";
import { chmod, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { NodeCompressionAdapter } from "../../../src/core/infrastructure/node/node-compression.adapter.js";
import { NodeFileContentAdapter } from "../../../src/core/infrastructure/node/node-file-content.adapter.js";
import { NodeFileSystemAdapter } from "../../../src/core/infrastructure/node/node-file-system.adapter.js";
import { NodeProcessRunnerAdapter } from "../../../src/core/infrastructure/node/node-process-runner.adapter.js";
import { CreateTar, tarSpec } from "../../../src/modules/archive/application/create-tar.use-case.js";
import { ExtractTar, untarSpec } from "../../../src/modules/archive/application/extract-tar.use-case.js";
import { commandContext, expectDone, layout, temporaryFolder } from "../../support/fakes.js";

const fileSystem = new NodeFileSystemAdapter();
const content = new NodeFileContentAdapter();
const compression = new NodeCompressionAdapter();
const runner = new NodeProcessRunnerAdapter();

/** Windows' own bsdtar, not a tar from Git for Windows, which reads C: as a remote host. */
async function systemTar(): Promise<string | null> {
  if (process.platform === "win32")
    return path.win32.join(process.env["SystemRoot"] ?? "C:\\Windows", "System32", "tar.exe");
  return runner.find("tar");
}

function pack(root: string, source: string, to: string) {
  return new CreateTar(fileSystem, content, compression).execute(
    tarSpec.input.parse({ positionals: [source], options: { to } }),
    commandContext(root),
  );
}

function unpack(root: string, archive: string, to: string) {
  return new ExtractTar(fileSystem, content, compression).execute(
    untarSpec.input.parse({ positionals: [archive], options: { to } }),
    commandContext(root),
  );
}

test("the system's tar extracts what kiriya packs, and kiriya extracts what the system's tar packs", async (t) => {
  const tar = await systemTar();
  if (tar === null) {
    t.skip("this machine has no tar program");
    return;
  }
  const root = await temporaryFolder(t);
  const longName = `${"deep/".repeat(22)}long-name.txt`;
  await layout(root, { "src/readme.txt": "hello\n", [`src/${longName}`]: "long\n", "src/empty/": "" });

  expectDone(await pack(root, "src", "kiriya.tar.gz"));
  await mkdir(path.join(root, "by-system"));
  const extracted = await runner.run(tar, ["-xzf", "kiriya.tar.gz", "-C", "by-system"], { cwd: root });
  assert.equal(extracted.code, 0, extracted.stderr);
  assert.equal(await readFile(path.join(root, "by-system", "src", "readme.txt"), "utf8"), "hello\n");
  assert.equal(await readFile(path.join(root, "by-system", "src", ...longName.split("/")), "utf8"), "long\n");

  const packed = await runner.run(tar, ["-czf", "system.tar.gz", "src"], { cwd: root });
  assert.equal(packed.code, 0, packed.stderr);
  const result = expectDone(await unpack(root, "system.tar.gz", "by-kiriya"));
  assert.deepEqual(result.failures, []);
  assert.equal(await readFile(path.join(root, "by-kiriya", "src", "readme.txt"), "utf8"), "hello\n");
  assert.equal(await readFile(path.join(root, "by-kiriya", "src", ...longName.split("/")), "utf8"), "long\n");
  assert.ok((await stat(path.join(root, "by-kiriya", "src", "empty"))).isDirectory());
});

test(
  "an executable file stays executable through tar and untar",
  { skip: process.platform === "win32" ? "Windows has no executable bit" : false },
  async (t) => {
    const root = await temporaryFolder(t);
    await layout(root, { "tools/run.sh": "#!/bin/sh\necho hi\n", "tools/notes.txt": "plain" });
    await chmod(path.join(root, "tools", "run.sh"), 0o755);
    await chmod(path.join(root, "tools", "notes.txt"), 0o644);
    expectDone(await pack(root, "tools", "tools.tar"));
    expectDone(await unpack(root, "tools.tar", "out"));
    assert.equal((await stat(path.join(root, "out", "tools", "run.sh"))).mode & 0o111, 0o111);
    assert.equal((await stat(path.join(root, "out", "tools", "notes.txt"))).mode & 0o111, 0);
  },
);
