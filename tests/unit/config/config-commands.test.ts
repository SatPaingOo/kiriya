import assert from "node:assert/strict";
import { test } from "node:test";
import { NotFoundError, OperationFailedError, RefusedError, UsageError } from "../../../src/core/domain/errors.js";
import { GetSetting } from "../../../src/modules/config/application/get-setting.use-case.js";
import { ListSettings } from "../../../src/modules/config/application/list-settings.use-case.js";
import { SetSetting } from "../../../src/modules/config/application/set-setting.use-case.js";
import { ShowConfigPath } from "../../../src/modules/config/application/show-config-path.use-case.js";
import { UnsetSetting } from "../../../src/modules/config/application/unset-setting.use-case.js";
import { looksSecret } from "../../../src/core/domain/secrets.js";
import { expectDone, MemoryConfigStore } from "../../support/fakes.js";

const FILE = "/home/dev/.config/kiriya/config.json";
const failsWith = (type: new (...args: never[]) => Error, key: string) => (error: unknown) =>
  error instanceof type && "detail" in error && (error as { detail: { key: string } }).detail.key === key;

test("path reports where the file is and whether it exists", async () => {
  assert.deepEqual(expectDone(await new ShowConfigPath(new MemoryConfigStore(FILE)).execute()).data, {
    path: FILE,
    exists: false,
  });
  assert.equal(expectDone(await new ShowConfigPath(new MemoryConfigStore(FILE, {})).execute()).data.exists, true);
});

test("set stores every value of a list setting and reports what it replaced", async () => {
  const config = new MemoryConfigStore(FILE, { plugins: ["old"], other: "kept" });
  const result = expectDone(await new SetSetting(config).execute({ key: "plugins", values: ["a", "./b"] }));
  assert.deepEqual(result.data, { key: "plugins", value: ["a", "./b"], previous: ["old"] });
  assert.deepEqual(config.current, { plugins: ["a", "./b"], other: "kept" });
});

test("set refuses a setting kiriya does not know, and anything that looks like a secret", async () => {
  const config = new MemoryConfigStore(FILE);
  await assert.rejects(
    new SetSetting(config).execute({ key: "colour", values: ["red"] }),
    failsWith(UsageError, "config.set.unknown-key"),
  );
  await assert.rejects(
    new SetSetting(config).execute({ key: "plugins", values: ["ok", "Password=hunter2"] }),
    failsWith(RefusedError, "config.set.secret"),
  );
  assert.equal(config.current, null);
});

test("get prints a setting, and says when it is not set", async () => {
  const config = new MemoryConfigStore(FILE, { plugins: ["a"] });
  assert.deepEqual(expectDone(await new GetSetting(config).execute({ key: "plugins" })).data.value, ["a"]);
  await assert.rejects(
    new GetSetting(config).execute({ key: "missing" }),
    failsWith(NotFoundError, "config.get.not-set"),
  );
});

test("unset removes a setting, and changes nothing when it was not set", async () => {
  const config = new MemoryConfigStore(FILE, { plugins: ["a"], other: "x" });
  assert.equal(expectDone(await new UnsetSetting(config).execute({ key: "plugins" })).data.removed, true);
  assert.deepEqual(config.current, { other: "x" });
  assert.equal(expectDone(await new UnsetSetting(config).execute({ key: "plugins" })).data.removed, false);
});

test("list shows every known setting, set or not, and marks settings kiriya does not read", async () => {
  const result = expectDone(await new ListSettings(new MemoryConfigStore(FILE, { old: "x" })).execute());
  assert.deepEqual(result.data.settings, [
    { key: "old", value: "x", known: false },
    { key: "plugins", value: null, known: true },
  ]);
  await assert.rejects(
    new ListSettings(new MemoryConfigStore(FILE, { plugins: "one" })).execute(),
    failsWith(OperationFailedError, "core.config.wrong-type"),
  );
});

test("secrets are recognised in the common spellings, and plain values are not", () => {
  for (const secret of ["Password=x", "pwd: x", "api_key=x", "TOKEN = x", "-----BEGIN RSA PRIVATE KEY-----"]) {
    assert.equal(looksSecret(secret), true, secret);
  }
  for (const plain of ["kiriya-plugin-example", "./team/plugin", "password-manager-plugin"]) {
    assert.equal(looksSecret(plain), false, plain);
  }
});
