import assert from "node:assert/strict";
import { symlink } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { RootScope } from "../../../src/core/application/root-scope.js";
import { NotFoundError, RefusedError } from "../../../src/core/domain/errors.js";
import { NodeFileSystemAdapter } from "../../../src/core/infrastructure/node/node-file-system.adapter.js";
import { layout, temporaryFolder } from "../../support/fakes.js";

const fileSystem = new NodeFileSystemAdapter();

async function project(t: TestContext): Promise<{ base: string; root: string; scope: RootScope }> {
  const base = await temporaryFolder(t);
  await layout(base, {
    "project/src/app.ts": "x",
    "project/notes.md": "n",
    "other/secret.txt": "s",
    "second/readme.md": "r",
  });
  const root = path.join(base, "project");
  return { base, root, scope: await RootScope.open(fileSystem, [], root) };
}

test("the folder the server starts in is the root when none is given, and paths inside it pass", async (t) => {
  const { root, scope } = await project(t);
  assert.equal(scope.start, root);
  assert.deepEqual(scope.roots, [root]);
  await scope.refuseOutside([".", "src/app.ts", path.join(root, "notes.md"), "src/new/file.ts", "src/**/*.ts", "*"]);
});

test("a path that climbs out with .., an absolute path elsewhere and a glob that starts outside are refused", async (t) => {
  const { base, scope } = await project(t);
  for (const value of [
    "..",
    "../other/secret.txt",
    path.join(base, "other"),
    "src/../../other",
    "../other/*.txt",
    "../*",
  ]) {
    await assert.rejects(scope.refuseOutside(["src", value]), RefusedError, value);
  }
});

test("a link inside the root that leads out is refused, and so is one that leads nowhere", async (t) => {
  const { base, root, scope } = await project(t);
  // A junction needs no privilege on Windows; other systems ignore the type and make a symlink.
  await symlink(path.join(base, "other"), path.join(root, "escape"), "junction");
  await symlink(path.join(base, "gone"), path.join(root, "dangling"), "junction");
  await symlink(path.join(root, "src"), path.join(root, "inner"), "junction");
  await assert.rejects(scope.refuseOutside(["escape"]), RefusedError);
  await assert.rejects(scope.refuseOutside(["escape/secret.txt"]), RefusedError);
  await assert.rejects(scope.refuseOutside(["escape/*.txt"]), RefusedError);
  await assert.rejects(scope.refuseOutside(["dangling/new.txt"]), RefusedError);
  await scope.refuseOutside(["inner/app.ts"]);
});

test("several roots each let their own paths in, and a root reached through a link lets in paths under the link", async (t) => {
  const { base, root } = await project(t);
  await symlink(root, path.join(base, "alias"), "junction");
  const scope = await RootScope.open(fileSystem, ["alias", "second", "alias"], base);
  assert.deepEqual(scope.roots, [path.join(base, "alias"), path.join(base, "second")]);
  await scope.refuseOutside([
    "src/app.ts",
    path.join(base, "alias", "notes.md"),
    path.join(base, "second", "readme.md"),
  ]);
  // The same file written through the link's target lies under no root as written.
  await assert.rejects(scope.refuseOutside([path.join(root, "notes.md")]), RefusedError);
  await assert.rejects(scope.refuseOutside([path.join(base, "other")]), RefusedError);
});

test("work that changes something may not reach a guarded file or a folder holding it, while reading may", async (t) => {
  const { root } = await project(t);
  const config = path.join(root, "settings", "kiriya", "config.json");
  const scope = await RootScope.open(fileSystem, [], root, [config]);
  const guarded = (error: unknown): boolean => error instanceof RefusedError && error.detail.key === "core.mcp.guarded";
  for (const value of ["settings/kiriya/config.json", "settings/kiriya", "settings", ".", "settings/*/config.json"]) {
    await assert.rejects(scope.refuseOutside([value], true), guarded, value);
    await scope.refuseOutside([value]);
  }
  await scope.refuseOutside(["src/app.ts", "notes.md"], true);
});

test("a root must be a folder that exists", async (t) => {
  const { base } = await project(t);
  await assert.rejects(RootScope.open(fileSystem, ["missing"], base), NotFoundError);
  await assert.rejects(RootScope.open(fileSystem, ["project/notes.md"], base), NotFoundError);
});

test("work that changes something may not reach inside a .git folder, in any letter case, while reading may", async (t) => {
  const { root } = await project(t);
  await layout(root, { ".git/hooks/pre-commit.sample": "#!/bin/sh", "sub/.GIT/config": "" });
  const scope = await RootScope.open(fileSystem, [], root);
  const inGit = (error: unknown): boolean =>
    error instanceof RefusedError && error.detail.key === "core.mcp.git-folder";
  for (const value of [".git", ".git/hooks/post-checkout", ".git/hooks/*", "sub/.GIT/config"]) {
    await assert.rejects(scope.refuseOutside([value], true), inGit, value);
    await scope.refuseOutside([value]);
  }
  await scope.refuseOutside([".", "src/app.ts", ".github/workflows/ci.yml"], true);
});
