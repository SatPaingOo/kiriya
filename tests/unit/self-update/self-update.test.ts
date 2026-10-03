import assert from "node:assert/strict";
import { test } from "node:test";
import { BUILT_IN_MODULES } from "../../../src/config/modules.js";
import { CommandRegistry } from "../../../src/core/application/command-registry.js";
import type { CorePorts, RuntimeInfo } from "../../../src/core/domain/module.js";
import type { FetchOutcome, Network } from "../../../src/core/domain/ports/network.js";
import { toolDefinition } from "../../../src/core/presentation/mcp/tool-definitions.js";
import { Translator } from "../../../src/core/presentation/i18n/translator.js";
import { en } from "../../../src/i18n/locales/en.js";
import { installSource } from "../../../src/modules/self-update/domain/install-source.js";
import { compareVersions, parseVersion, readLatestVersion } from "../../../src/modules/self-update/domain/versions.js";
import { UpdateSelf } from "../../../src/modules/self-update/application/update-self.use-case.js";
import { commandContext, expectDone, FakeProcessRunner } from "../../support/fakes.js";

const translator = new Translator(en);

/** Answers one scripted outcome, and records what it was asked for. */
class FakeNetwork implements Network {
  readonly asked: string[] = [];

  constructor(private readonly outcome: FetchOutcome) {}

  fetchText(url: string): Promise<FetchOutcome> {
    this.asked.push(url);
    return Promise.resolve(this.outcome);
  }

  addresses(): never {
    throw new Error("not used");
  }
  connect(): never {
    throw new Error("not used");
  }
  request(): never {
    throw new Error("not used");
  }
  lookup(): never {
    throw new Error("not used");
  }
  resolve(): never {
    throw new Error("not used");
  }
}

const body = (version: string): FetchOutcome => ({
  ok: true,
  status: 200,
  body: JSON.stringify({ name: "kiriya", version }),
  ms: 5,
});

const runtime = (version: string, installDirectory: string): RuntimeInfo => ({
  kiriyaVersion: version,
  nodeVersion: "v24.1.0",
  installDirectory,
});

const NPM_PATH = "/usr/lib/node_modules/kiriya/";
const SOURCE_PATH = "/home/me/code/kiriya/";

test("a version is read, and a prerelease sorts below the release it leads to", () => {
  assert.deepEqual(parseVersion("1.2.3"), { major: 1, minor: 2, patch: 3, prerelease: null });
  assert.deepEqual(parseVersion("0.1.0-rc.1"), { major: 0, minor: 1, patch: 0, prerelease: "rc.1" });
  assert.equal(parseVersion("1.2"), null);
  assert.equal(parseVersion("latest"), null);

  const older = parseVersion("0.1.2");
  const newer = parseVersion("0.2.0");
  const pre = parseVersion("0.2.0-rc.1");
  assert.ok(older && newer && pre);
  assert.ok(compareVersions(newer, older) > 0);
  assert.ok(compareVersions(older, newer) < 0);
  assert.equal(compareVersions(older, older), 0);
  // The point of this: a prerelease must never look like an upgrade past the release.
  assert.ok(compareVersions(pre, newer) < 0);
});

test("the latest version is read from the registry's body, and nothing else is believed", () => {
  assert.equal(readLatestVersion(JSON.stringify({ version: "0.2.0" })), "0.2.0");
  assert.equal(readLatestVersion("not json at all"), null);
  assert.equal(readLatestVersion(JSON.stringify({ version: 2 })), null);
  assert.equal(readLatestVersion(JSON.stringify({})), null);
  assert.equal(readLatestVersion(JSON.stringify({ version: "whatever" })), null);
  // A proxy answering with a page instead of the endpoint must not read as a version.
  assert.equal(readLatestVersion("<html><body>Sign in</body></html>"), null);
});

test("only a folder npm put kiriya in counts as an npm install", () => {
  assert.equal(installSource(NPM_PATH), "npm");
  assert.equal(installSource("C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\kiriya\\"), "npm");
  assert.equal(installSource(SOURCE_PATH), "elsewhere");
  // npm link resolves to the checkout, and a future tap or single file would too.
  assert.equal(installSource("/opt/homebrew/Cellar/kiriya/0.2.0/"), "elsewhere");
  assert.equal(installSource("/home/me/node_modules/other/"), "elsewhere");
});

test("a newer version is reported and nothing is installed without --apply", async () => {
  const network = new FakeNetwork(body("0.2.0"));
  const npm = new FakeProcessRunner({ npm: "/usr/bin/npm" });
  const command = new UpdateSelf(network, npm, runtime("0.1.2", NPM_PATH));

  const result = expectDone(await command.execute({ apply: false }, commandContext("/")));
  assert.deepEqual(result.data, {
    installed: "0.1.2",
    latest: "0.2.0",
    newer: true,
    source: "npm",
    applied: false,
  });
  assert.deepEqual(npm.runs, [], "nothing may be installed without --apply");
  assert.deepEqual(result.failures ?? [], []);
});

test("--apply installs exactly the version the registry named", async () => {
  const network = new FakeNetwork(body("0.2.0"));
  const npm = new FakeProcessRunner({ npm: "/usr/bin/npm" });
  const command = new UpdateSelf(network, npm, runtime("0.1.2", NPM_PATH));

  const result = expectDone(await command.execute({ apply: true }, commandContext("/")));
  assert.equal(result.data.applied, true);
  assert.equal(npm.runs.length, 1);
  assert.deepEqual(npm.runs[0]?.args, ["install", "--global", "kiriya@0.2.0"]);
});

test("--apply refuses to run npm over an install npm did not make", async () => {
  const network = new FakeNetwork(body("0.2.0"));
  const npm = new FakeProcessRunner({ npm: "/usr/bin/npm" });
  const command = new UpdateSelf(network, npm, runtime("0.1.2", SOURCE_PATH));

  const result = expectDone(await command.execute({ apply: true }, commandContext("/")));
  assert.equal(result.data.applied, false);
  assert.equal(result.data.source, "elsewhere");
  assert.deepEqual(npm.runs, [], "npm must not touch what it did not install");
  assert.equal(result.failures?.[0]?.key, "self-update.not-npm");
});

test("being current is not a failure, and --apply then does nothing", async () => {
  for (const apply of [false, true]) {
    const network = new FakeNetwork(body("0.1.2"));
    const npm = new FakeProcessRunner({ npm: "/usr/bin/npm" });
    const command = new UpdateSelf(network, npm, runtime("0.1.2", NPM_PATH));
    const result = expectDone(await command.execute({ apply }, commandContext("/")));
    assert.equal(result.data.newer, false);
    assert.equal(result.data.applied, false);
    assert.deepEqual(result.failures ?? [], []);
    assert.deepEqual(npm.runs, []);
  }
});

test("a registry that cannot be reached, or answers something else, fails without guessing", async () => {
  const unreachable = new UpdateSelf(
    new FakeNetwork({ ok: false, failure: "timeout", status: null, code: null, ms: 10 }),
    new FakeProcessRunner({}),
    runtime("0.1.2", NPM_PATH),
  );
  const timedOut = expectDone(await unreachable.execute({ apply: true }, commandContext("/")));
  assert.equal(timedOut.data.latest, null);
  assert.equal(timedOut.failures?.[0]?.key, "self-update.unreachable");

  const wrongStatus = new UpdateSelf(
    new FakeNetwork({ ok: true, status: 404, body: "", ms: 10 }),
    new FakeProcessRunner({}),
    runtime("0.1.2", NPM_PATH),
  );
  const missing = expectDone(await wrongStatus.execute({ apply: true }, commandContext("/")));
  assert.equal(missing.data.latest, null);
  assert.equal(missing.failures?.[0]?.key, "self-update.unreadable");
});

test("npm failing to install is reported with its exit code, not swallowed", async () => {
  const npm = new FakeProcessRunner({ npm: "/usr/bin/npm" }, () => ({ code: 1, stderr: "EACCES" }));
  const command = new UpdateSelf(new FakeNetwork(body("0.2.0")), npm, runtime("0.1.2", NPM_PATH));
  const result = expectDone(await command.execute({ apply: true }, commandContext("/")));
  assert.equal(result.data.applied, false);
  assert.equal(result.failures?.[0]?.key, "self-update.failed");
});

test("self-update is never an MCP tool, however much the user allows", () => {
  const registry = new CommandRegistry();
  for (const module of BUILT_IN_MODULES) registry.register(module, {} as CorePorts);
  const found = registry.list().flatMap((module) => [...module.commands.values()]);
  const selfUpdate = found.find((entry) => entry.command.spec.id === "self-update");
  assert.ok(selfUpdate, "self-update should be a built-in command");
  assert.equal(selfUpdate.command.spec.terminalOnly, true);
  // The definition still builds, so the exclusion is a decision rather than an accident.
  assert.equal(toolDefinition(selfUpdate.command.spec, translator, true).name, "self-update");
});
