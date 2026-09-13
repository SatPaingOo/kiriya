import assert from "node:assert/strict";
import { test } from "node:test";
import { CapabilityUnavailableError, OperationFailedError } from "../../../src/core/domain/errors.js";
import { message } from "../../../src/core/domain/message.js";
import type { Clipboard } from "../../../src/core/domain/ports/clipboard.js";
import type { ConfigStore } from "../../../src/core/domain/ports/config-store.js";
import type { PluginInventory, PluginProblem } from "../../../src/core/domain/ports/plugin-inventory.js";
import type { Trash } from "../../../src/core/domain/ports/trash.js";
import { RunChecks } from "../../../src/modules/doctor/application/run-checks.use-case.js";
import { isAtLeast } from "../../../src/modules/doctor/domain/versions.js";
import {
  commandContext,
  expectDone,
  FakeEnvironment,
  FakeProcessRunner,
  MemoryConfigStore,
} from "../../support/fakes.js";

const trash: Trash = { location: "core.trash.location.freedesktop", send: () => Promise.resolve([]) };
const clipboard: Clipboard = {
  backend: () => Promise.resolve("xclip"),
  write: () => Promise.resolve(),
  read: () => Promise.resolve(""),
};
const environment = new FakeEnvironment("linux", "/home/dev");
const inventory = (problems: readonly PluginProblem[] = []): PluginInventory => ({
  loaded: () => [],
  problems: () => problems,
});
const toolsRunning = new FakeProcessRunner({ git: "/usr/bin/git", docker: "/usr/bin/docker" }, (args) =>
  args[0] === "--version" ? { stdout: "git version 2.50.0\n" } : { stdout: "29.0.0\n" },
);

async function statuses(checks: RunChecks): Promise<{ statuses: Record<string, string>; failures: string[] }> {
  const result = expectDone(await checks.execute({}, commandContext("/")));
  return {
    statuses: Object.fromEntries(result.data.checks.map((check) => [check.name, check.status])),
    failures: result.failures.map((failure) => failure.key),
  };
}

test("a healthy machine passes every check", async () => {
  const runtime = { kiriyaVersion: "1.2.3", nodeVersion: "v24.1.0" };
  const outcome = await statuses(
    new RunChecks(toolsRunning, environment, new MemoryConfigStore(), trash, clipboard, inventory(), runtime),
  );
  assert.deepEqual(outcome.statuses, {
    kiriya: "ok",
    node: "ok",
    os: "ok",
    config: "ok",
    trash: "ok",
    clipboard: "ok",
    git: "ok",
    docker: "ok",
    plugins: "ok",
  });
  assert.deepEqual(outcome.failures, []);
});

test("missing tools, a stopped engine and an old Node.js are warnings, not failures", async () => {
  const runtime = { kiriyaVersion: "1.2.3", nodeVersion: "v22.12.0" };
  const bare = await statuses(
    new RunChecks(
      new FakeProcessRunner({}),
      environment,
      new MemoryConfigStore(),
      trash,
      clipboard,
      inventory(),
      runtime,
    ),
  );
  assert.deepEqual([bare.statuses["node"], bare.statuses["git"], bare.statuses["docker"]], ["warn", "warn", "warn"]);
  assert.deepEqual(bare.failures, []);

  const stopped = new FakeProcessRunner({ docker: "/usr/bin/docker" }, () => ({ code: 1, stderr: "cannot connect" }));
  const result = expectDone(
    await new RunChecks(stopped, environment, new MemoryConfigStore(), trash, clipboard, inventory(), runtime).execute(
      {},
      commandContext("/"),
    ),
  );
  assert.equal(result.data.checks.find((check) => check.name === "docker")?.detail.key, "doctor.check.docker-stopped");
});

test("a configuration file kiriya cannot read, and a plugin that did not load, fail", async () => {
  const broken: ConfigStore = {
    path: "/cfg.json",
    exists: () => Promise.resolve(true),
    read: () => Promise.reject(new OperationFailedError("core.config.invalid-json", { path: "/cfg.json" })),
    write: () => Promise.resolve(),
  };
  const problems = [{ entry: "./gone", reason: message("core.plugin.not-found", { entry: "./gone" }) }];
  const runtime = { kiriyaVersion: "1.2.3", nodeVersion: "v24.1.0" };
  const outcome = await statuses(
    new RunChecks(toolsRunning, environment, broken, trash, clipboard, inventory(problems), runtime),
  );
  assert.deepEqual([outcome.statuses["config"], outcome.statuses["plugins"]], ["fail", "fail"]);
  assert.deepEqual(outcome.failures, ["core.config.invalid-json", "doctor.plugin-failed"]);
});

test("versions compare part by part", () => {
  assert.equal(isAtLeast("v22.13.0", "22.13.0"), true);
  assert.equal(isAtLeast("v22.12.9", "22.13.0"), false);
  assert.equal(isAtLeast("v24.0.0", "22.13"), true);
  assert.equal(isAtLeast("22.13", "22.13.0"), true);
});

test("a session without a clipboard is a warning that names why", async () => {
  const none: Clipboard = {
    backend: () => Promise.reject(new CapabilityUnavailableError("core.clipboard.no-display")),
    write: () => Promise.resolve(),
    read: () => Promise.resolve(""),
  };
  const runtime = { kiriyaVersion: "1.2.3", nodeVersion: "v24.1.0" };
  const checks = new RunChecks(toolsRunning, environment, new MemoryConfigStore(), trash, none, inventory(), runtime);
  const result = expectDone(await checks.execute({}, commandContext("/")));
  const check = result.data.checks.find((entry) => entry.name === "clipboard");
  assert.deepEqual([check?.status, check?.detail.key], ["warn", "core.clipboard.no-display"]);
  assert.deepEqual(result.failures, []);
});
