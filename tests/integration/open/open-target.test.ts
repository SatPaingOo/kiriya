import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { KiriyaError, NotFoundError, RefusedError } from "../../../src/core/domain/errors.js";
import type { Opener } from "../../../src/core/domain/ports/opener.js";
import { NodeFileSystemAdapter } from "../../../src/core/infrastructure/node/node-file-system.adapter.js";
import { OpenTarget, openSpec } from "../../../src/modules/open/application/open-target.use-case.js";
import { commandContext, expectDone, FakeEnvironment, layout, temporaryFolder } from "../../support/fakes.js";

class RecordingOpener implements Opener {
  readonly opened: string[] = [];

  open(target: string): Promise<void> {
    this.opened.push(target);
    return Promise.resolve();
  }
}

const failsWith = (type: new (...args: never[]) => KiriyaError, key: string) => (error: unknown) =>
  error instanceof type && error.detail.key === key;

test("open hands files, folders and web addresses to the OS, and refuses what would run or is missing", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, { "notes.txt": "x", "docs/": "", "setup.bat": "echo" });
  const opener = new RecordingOpener();
  const open = new OpenTarget(opener, new NodeFileSystemAdapter(), new FakeEnvironment("windows", root));
  const run = async (target: string) =>
    expectDone(await open.execute(openSpec.input.parse({ positionals: [target], options: {} }), commandContext(root)));

  assert.deepEqual((await run("notes.txt")).data, { target: path.join(root, "notes.txt"), kind: "file" });
  assert.deepEqual((await run("docs")).data, { target: path.join(root, "docs"), kind: "folder" });
  assert.deepEqual((await run("https://example.com")).data, { target: "https://example.com", kind: "url" });
  assert.deepEqual(opener.opened, [path.join(root, "notes.txt"), path.join(root, "docs"), "https://example.com"]);

  await assert.rejects(run("setup.bat"), failsWith(RefusedError, "open.runs-program"));
  await assert.rejects(run("javascript:alert(1)"), failsWith(RefusedError, "open.scheme-refused"));
  await assert.rejects(run("missing.txt"), failsWith(NotFoundError, "core.fs.not-found"));
  assert.equal(opener.opened.length, 3);
});
