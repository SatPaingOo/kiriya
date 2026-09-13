import assert from "node:assert/strict";
import { test } from "node:test";
import { configFilePath } from "../../../src/core/infrastructure/node/config-location.js";
import { FakeEnvironment } from "../../support/fakes.js";

test("Windows keeps the configuration under APPDATA, or the roaming profile without it", () => {
  const withAppData = new FakeEnvironment("windows", "C:\\Users\\dev", { APPDATA: "D:\\Roaming" });
  assert.equal(configFilePath(withAppData, "C:\\work"), "D:\\Roaming\\kiriya\\config.json");
  assert.equal(
    configFilePath(new FakeEnvironment("windows", "C:\\Users\\dev"), "C:\\work"),
    "C:\\Users\\dev\\AppData\\Roaming\\kiriya\\config.json",
  );
});

test("Linux follows XDG_CONFIG_HOME, ignoring a relative value as the specification says", () => {
  const home = "/home/dev";
  assert.equal(
    configFilePath(new FakeEnvironment("linux", home, { XDG_CONFIG_HOME: "/xdg" }), "/work"),
    "/xdg/kiriya/config.json",
  );
  assert.equal(
    configFilePath(new FakeEnvironment("linux", home, { XDG_CONFIG_HOME: "xdg" }), "/work"),
    "/home/dev/.config/kiriya/config.json",
  );
  assert.equal(configFilePath(new FakeEnvironment("linux", home), "/work"), "/home/dev/.config/kiriya/config.json");
});

test("macOS uses Application Support", () => {
  assert.equal(
    configFilePath(new FakeEnvironment("macos", "/Users/dev"), "/work"),
    "/Users/dev/Library/Application Support/kiriya/config.json",
  );
});

test("KIRIYA_CONFIG wins, resolved against the working folder", () => {
  const linux = new FakeEnvironment("linux", "/home/dev", { KIRIYA_CONFIG: "conf/kiriya.json" });
  assert.equal(configFilePath(linux, "/work"), "/work/conf/kiriya.json");
  const windows = new FakeEnvironment("windows", "C:\\Users\\dev", { KIRIYA_CONFIG: "E:\\kiriya.json" });
  assert.equal(configFilePath(windows, "C:\\work"), "E:\\kiriya.json");
});
