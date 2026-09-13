import assert from "node:assert/strict";
import { test } from "node:test";
import { CapabilityUnavailableError } from "../../src/core/domain/errors.js";
import type { Clipboard } from "../../src/core/domain/ports/clipboard.js";
import { NodeEnvironmentAdapter } from "../../src/core/infrastructure/node/node-environment.adapter.js";
import { NodeProcessRunnerAdapter } from "../../src/core/infrastructure/node/node-process-runner.adapter.js";
import { LinuxClipboardAdapter } from "../../src/core/infrastructure/platform/linux/linux-clipboard.adapter.js";
import { MacosClipboardAdapter } from "../../src/core/infrastructure/platform/macos/macos-clipboard.adapter.js";
import { WindowsClipboardAdapter } from "../../src/core/infrastructure/platform/windows/windows-clipboard.adapter.js";

/**
 * Overwrites the clipboard of the machine it runs on, so it only runs when asked:
 * KIRIYA_TEST_REAL_CLIPBOARD=1. CI sets it; a developer's own clipboard stays untouched.
 * It is the only test that touches the real clipboard, since test files run at the same time.
 */
const SKIP =
  process.env["KIRIYA_TEST_REAL_CLIPBOARD"] === "1" ? false : "set KIRIYA_TEST_REAL_CLIPBOARD=1 to use the clipboard";

const environment = new NodeEnvironmentAdapter();
const hasDisplay =
  environment.os !== "linux" ||
  [environment.variable("WAYLAND_DISPLAY"), environment.variable("DISPLAY")].some((value) => (value ?? "") !== "");

function osClipboard(): Clipboard {
  switch (environment.os) {
    case "windows":
      return new WindowsClipboardAdapter();
    case "macos":
      return new MacosClipboardAdapter();
    case "linux":
      return new LinuxClipboardAdapter(environment, new NodeProcessRunnerAdapter());
  }
}

test(
  "the clipboard round-trips Myanmar text and lines, or says why this session has none",
  { skip: SKIP },
  async () => {
    const signal = new AbortController().signal;
    const clipboard = osClipboard();
    const text = `kiriya ကိရိယာ ✓ ${Date.now()}\nsecond line`;
    if (!hasDisplay) {
      await assert.rejects(clipboard.write(text, signal), CapabilityUnavailableError);
      return;
    }
    assert.ok((await clipboard.backend()).length > 0);
    await clipboard.write(text, signal);
    const read = await clipboard.read(signal);
    assert.equal(read.replace(/\r\n/g, "\n").replace(/\n$/, ""), text);
  },
);
