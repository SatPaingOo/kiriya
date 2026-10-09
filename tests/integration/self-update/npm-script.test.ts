import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { NodeFileSystemAdapter } from "../../../src/core/infrastructure/node/node-file-system.adapter.js";
import { npmScriptCandidates } from "../../../src/modules/self-update/application/npm-script.js";
import { layout, temporaryFolder } from "../../support/fakes.js";

const fileSystem = new NodeFileSystemAdapter();
const SCRIPT = "npm/bin/npm-cli.js";

/** Every candidate that is really a file, in the order self-update tries them. */
async function present(nodeExecutable: string): Promise<string[]> {
  const found: string[] = [];
  for (const candidate of npmScriptCandidates(nodeExecutable)) {
    if ((await fileSystem.stat(candidate))?.kind === "file") found.push(candidate);
  }
  return found;
}

/**
 * The unit tests answer from a set of strings, which cannot show that these paths reach a real
 * file: the second one walks out of node's own folder with `..`, and only this operating
 * system's path rules say where that lands. Each layout is built and then looked for.
 */
test("each layout npm is installed in is found through the real filesystem", async (t) => {
  const layouts = [
    ["beside node, as the Windows installers put it", `bin/node_modules/${SCRIPT}`],
    ["under lib, as Linux and macOS put it", `lib/node_modules/${SCRIPT}`],
  ] as const;
  for (const [installer, relative] of layouts) {
    const root = await temporaryFolder(t);
    await layout(root, { [relative]: "#!/usr/bin/env node\n" });
    const found = await present(path.join(root, "bin", "node"));
    assert.deepEqual(found, [path.join(root, ...relative.split("/"))], installer);
  }
});

test("a node with no npm beside it finds nothing, rather than a path that is not there", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, { "bin/": "" });
  assert.deepEqual(await present(path.join(root, "bin", "node")), []);
});
