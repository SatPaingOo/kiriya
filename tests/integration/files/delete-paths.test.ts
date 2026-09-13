import assert from "node:assert/strict";
import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { PathGuard } from "../../../src/core/application/path-guard.js";
import { RefusedError } from "../../../src/core/domain/errors.js";
import { isMessage } from "../../../src/core/domain/message.js";
import { NodeEnvironmentAdapter } from "../../../src/core/infrastructure/node/node-environment.adapter.js";
import { NodeFileSystemAdapter } from "../../../src/core/infrastructure/node/node-file-system.adapter.js";
import { DeletePaths, type DeleteInput } from "../../../src/modules/files/application/delete-paths.use-case.js";
import {
  commandContext,
  expectDone,
  FakeTrash,
  layout,
  relativeTo,
  ScriptedConfirmation,
  temporaryFolder,
} from "../../support/fakes.js";

const fileSystem = new NodeFileSystemAdapter();
const guard = new PathGuard(new NodeEnvironmentAdapter());

function input(paths: readonly string[], overrides: Partial<DeleteInput> = {}): DeleteInput {
  return { paths, permanent: false, dryRun: false, yes: false, confirm: undefined, all: false, ...overrides };
}

const refused = (key: string) => (error: unknown) => error instanceof RefusedError && error.detail.key === key;

test("sends the outermost matches to the trash after a yes", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, { "a.log": "1", "b.log": "22", "keep.txt": "", "logs/x.log": "333" });
  const trash = new FakeTrash(fileSystem);
  const confirmation = new ScriptedConfirmation(true);
  const result = expectDone(
    await new DeletePaths(fileSystem, trash, guard).execute(
      input(["*.log", "logs", "logs/x.log"]),
      commandContext(root, confirmation),
    ),
  );
  assert.deepEqual(relativeTo(root, trash.received), ["a.log", "b.log", "logs"]);
  assert.deepEqual(
    result.data.items.map((item) => item.outcome),
    ["trashed", "trashed", "trashed"],
  );
  assert.equal(result.data.bytes, 6);
  assert.deepEqual(result.failures, []);
  assert.equal(confirmation.asked[0]?.key, "files.delete.ask-trash");
  assert.deepEqual(await readdir(root), ["keep.txt"]);
});

test("a dry run changes nothing", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, { "a.log": "1" });
  const trash = new FakeTrash(fileSystem);
  const result = await new DeletePaths(fileSystem, trash, guard).execute(
    input(["a.log"], { dryRun: true }),
    commandContext(root),
  );
  assert.equal(result.kind, "preview");
  assert.deepEqual(trash.received, []);
  await access(path.join(root, "a.log"));
});

test("a declined question changes nothing", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, { "a.log": "1" });
  const trash = new FakeTrash(fileSystem);
  await assert.rejects(
    new DeletePaths(fileSystem, trash, guard).execute(
      input(["a.log"]),
      commandContext(root, new ScriptedConfirmation(false)),
    ),
    refused("core.confirm.declined"),
  );
  assert.deepEqual(trash.received, []);
  await access(path.join(root, "a.log"));
});

test("--permanent needs the typed item count; --yes never counts", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, { "a.log": "1", "b.log": "2" });
  const trash = new FakeTrash(fileSystem);
  const remove = new DeletePaths(fileSystem, trash, guard);
  const context = commandContext(root, new ScriptedConfirmation(false));

  await assert.rejects(
    remove.execute(input(["a.log", "b.log"], { permanent: true }), context),
    refused("core.confirm.declined"),
  );
  await assert.rejects(
    remove.execute(input(["a.log", "b.log"], { permanent: true, yes: true }), context),
    refused("core.confirm.declined"),
  );
  await assert.rejects(
    remove.execute(input(["a.log", "b.log"], { permanent: true, confirm: "3" }), context),
    refused("core.confirm.mismatch"),
  );
  assert.deepEqual((await readdir(root)).sort(), ["a.log", "b.log"]);

  const result = expectDone(
    await remove.execute(input(["a.log", "b.log"], { permanent: true, confirm: "2" }), context),
  );
  assert.deepEqual(
    result.data.items.map((item) => item.outcome),
    ["deleted", "deleted"],
  );
  assert.deepEqual(trash.received, []);
  assert.deepEqual(await readdir(root), []);
});

test("refuses the working folder before asking anything", async (t) => {
  const root = await temporaryFolder(t);
  const confirmation = new ScriptedConfirmation(true);
  await assert.rejects(
    new DeletePaths(fileSystem, new FakeTrash(fileSystem), guard).execute(
      input(["."]),
      commandContext(root, confirmation),
    ),
    (error: unknown) => {
      const reason = error instanceof RefusedError ? error.detail.params["reason"] : undefined;
      return refused("core.guard.refused")(error) && isMessage(reason) && reason.key === "core.guard.working-folder";
    },
  );
  assert.deepEqual(confirmation.asked, []);
});

test("warns about a git repository", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, { "repo/.git/HEAD": "ref" });
  const result = await new DeletePaths(fileSystem, new FakeTrash(fileSystem), guard).execute(
    input(["repo"], { dryRun: true }),
    commandContext(root),
  );
  assert.deepEqual(
    result.warnings.map((warning) => warning.key),
    ["files.delete.repository"],
  );
});

test("a path the trash refuses is a failure; the rest still go", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, { "a.log": "1", "b.log": "2" });
  const trash = new FakeTrash(fileSystem, new Set([path.join(root, "a.log")]));
  const result = expectDone(
    await new DeletePaths(fileSystem, trash, guard).execute(input(["*.log"]), commandContext(root)),
  );
  assert.deepEqual(
    result.data.items.map((item) => item.outcome),
    ["failed", "trashed"],
  );
  assert.deepEqual(
    result.failures.map((failure) => failure.key),
    ["files.delete.failed"],
  );
  assert.deepEqual(await readdir(root), ["a.log"]);
});
