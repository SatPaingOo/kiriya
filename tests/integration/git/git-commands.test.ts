import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { RefusedError, UsageError } from "../../../src/core/domain/errors.js";
import { NodeFileSystemAdapter } from "../../../src/core/infrastructure/node/node-file-system.adapter.js";
import { NodeProcessRunnerAdapter } from "../../../src/core/infrastructure/node/node-process-runner.adapter.js";
import { FetchRepositories } from "../../../src/modules/git/application/fetch-repositories.use-case.js";
import { PullRepositories } from "../../../src/modules/git/application/pull-repositories.use-case.js";
import { folderInput } from "../../../src/modules/git/application/repositories.js";
import { ShowStatus } from "../../../src/modules/git/application/show-status.use-case.js";
import { SwitchBranch } from "../../../src/modules/git/application/switch-branch.use-case.js";
import { commandContext, expectDone, layout, ScriptedConfirmation, temporaryFolder } from "../../support/fakes.js";

const SKIP = spawnSync("git", ["--version"]).status === 0 ? false : "git is not installed";
const fileSystem = new NodeFileSystemAdapter();
const runner = new NodeProcessRunnerAdapter();

function git(cwd: string, ...args: string[]): string {
  const identity = ["-c", "user.name=kiriya-test", "-c", "user.email=kiriya-test@example.com"];
  const run = spawnSync("git", [...identity, ...args], { cwd, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.trim();
}

/**
 * workspace/api pushes to a bare origin; workspace/web is a clone of it one commit
 * behind; workspace/mobile has no remote and sits on another branch.
 */
async function workspace(t: TestContext): Promise<string> {
  const root = await temporaryFolder(t);
  const origin = path.join(root, "origin.git");
  const work = path.join(root, "workspace");
  git(root, "init", "-q", "--bare", "-b", "main", origin);
  await layout(work, { "api/a.txt": "a", "mobile/m.txt": "m" });
  git(path.join(work, "api"), "init", "-q", "-b", "main");
  git(path.join(work, "api"), "add", "-A");
  git(path.join(work, "api"), "commit", "-q", "-m", "first");
  git(path.join(work, "api"), "remote", "add", "origin", origin);
  git(path.join(work, "api"), "push", "-q", "-u", "origin", "main");
  git(work, "clone", "-q", origin, "web");
  git(path.join(work, "mobile"), "init", "-q", "-b", "develop");
  git(path.join(work, "mobile"), "add", "-A");
  git(path.join(work, "mobile"), "commit", "-q", "-m", "first");
  await writeFile(path.join(work, "api", "b.txt"), "b");
  git(path.join(work, "api"), "add", "-A");
  git(path.join(work, "api"), "commit", "-q", "-m", "second");
  git(path.join(work, "api"), "push", "-q");
  return work;
}

test("status reports each repository, a missing remote and a branch out of line", { skip: SKIP }, async (t) => {
  const work = await workspace(t);
  const result = expectDone(
    await new ShowStatus(fileSystem, runner).execute({ folder: ".", depth: 3 }, commandContext(work)),
  );
  assert.deepEqual(
    result.data.repositories.map((status) => [status.name, status.branch, status.hasRemote]),
    [
      ["api", "main", true],
      ["mobile", "develop", false],
      ["web", "main", true],
    ],
  );
  assert.equal(result.data.isRepository, false);
  assert.deepEqual(
    result.failures.map((failure) => failure.key),
    ["git.status.no-remote"],
  );
  assert.deepEqual(
    result.warnings.map((warning) => warning.key),
    ["git.status.other-branch"],
  );

  const single = expectDone(
    await new ShowStatus(fileSystem, runner).execute({ folder: "api", depth: 3 }, commandContext(work)),
  );
  assert.equal(single.data.isRepository, true);
  assert.equal(single.data.allGood, true);
});

test("fetch brings remote commits in; pull fast-forwards clean repositories only", { skip: SKIP }, async (t) => {
  const work = await workspace(t);
  const fetched = expectDone(
    await new FetchRepositories(fileSystem, runner).execute({ folder: ".", depth: 3 }, commandContext(work)),
  );
  assert.deepEqual(
    fetched.data.items.map((item) => [item.status.name, item.outcome, item.status.behind]),
    [
      ["api", "fetched", 0],
      ["mobile", "no-remote", null],
      ["web", "fetched", 1],
    ],
  );

  await writeFile(path.join(work, "api", "dirty.txt"), "uncommitted");
  const pulled = expectDone(
    await new PullRepositories(fileSystem, runner).execute({ folder: ".", depth: 3 }, commandContext(work)),
  );
  assert.deepEqual(
    pulled.data.items.map((item) => [item.status.name, item.outcome, item.newCommits]),
    [
      ["api", "dirty", 0],
      ["mobile", "no-remote", 0],
      ["web", "pulled", 1],
    ],
  );
  assert.deepEqual(
    pulled.warnings.map((warning) => warning.key),
    ["git.pull.dirty"],
  );
});

test("switch changes nothing until every repository can move, then moves them all", { skip: SKIP }, async (t) => {
  const work = await workspace(t);
  const command = new SwitchBranch(fileSystem, runner);
  const input = { branch: "develop", folder: ".", depth: 3, create: false, yes: true };

  const missing = expectDone(await command.execute(input, commandContext(work)));
  assert.deepEqual(
    missing.failures.map((failure) => failure.key),
    ["git.switch.missing", "git.switch.missing"],
  );
  assert.equal(git(path.join(work, "api"), "branch", "--show-current"), "main");

  await assert.rejects(
    command.execute({ ...input, create: true, yes: false }, commandContext(work, new ScriptedConfirmation(false))),
    RefusedError,
  );
  const switched = expectDone(await command.execute({ ...input, create: true }, commandContext(work)));
  assert.deepEqual(
    switched.data.steps.map((step) => [step.name, step.action, step.outcome]),
    [
      ["api", "create", "switched"],
      ["mobile", "already", "unchanged"],
      ["web", "create", "switched"],
    ],
  );
  assert.equal(git(path.join(work, "web"), "branch", "--show-current"), "develop");

  await assert.rejects(
    command.execute({ ...input, branch: "bad..name" }, commandContext(work)),
    (error: unknown) => error instanceof UsageError && error.detail.key === "git.switch.bad-branch",
  );
});

test("depth must be a whole number from 1 to 10", () => {
  for (const depth of ["0", "11", "two"]) {
    assert.throws(
      () => folderInput.parse({ positionals: [], options: { depth } }),
      (error: unknown) => error instanceof UsageError && error.detail.key === "git.option.depth-invalid",
    );
  }
  assert.equal(folderInput.parse({ positionals: [], options: {} }).depth, 3);
});
