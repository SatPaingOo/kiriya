import assert from "node:assert/strict";
import { test } from "node:test";
import { CapabilityUnavailableError, UsageError } from "../../../src/core/domain/errors.js";
import type { RawInput } from "../../../src/core/domain/input-schema.js";
import type { Clipboard } from "../../../src/core/domain/ports/clipboard.js";
import { NodeFileContentAdapter } from "../../../src/core/infrastructure/node/node-file-content.adapter.js";
import { NodeFileSystemAdapter } from "../../../src/core/infrastructure/node/node-file-system.adapter.js";
import { LinuxClipboardAdapter } from "../../../src/core/infrastructure/platform/linux/linux-clipboard.adapter.js";
import { CopyText, copySpec } from "../../../src/modules/clip/application/copy-text.use-case.js";
import { PasteText } from "../../../src/modules/clip/application/paste-text.use-case.js";
import {
  commandContext,
  expectDone,
  FakeEnvironment,
  FakeProcessRunner,
  FakeStandardInput,
} from "../../support/fakes.js";

/** A clipboard in memory that records every text written to it. */
class MemoryClipboard implements Clipboard {
  readonly written: string[] = [];
  private text = "";

  backend(): Promise<string> {
    return Promise.resolve("memory");
  }

  write(text: string): Promise<void> {
    this.written.push(text);
    this.text = text;
    return Promise.resolve();
  }

  read(): Promise<string> {
    return Promise.resolve(this.text);
  }
}

const raw = (positionals: readonly string[]): RawInput => ({ positionals, options: {} });
const sources = (piped: string | null = null) => ({
  stdin: new FakeStandardInput(piped),
  fileSystem: new NodeFileSystemAdapter(),
  content: new NodeFileContentAdapter(),
});

test("clip copy takes text from an argument or a pipe, and clip paste reads it back", async () => {
  const clipboard = new MemoryClipboard();
  const copied = expectDone(
    await new CopyText(clipboard, sources()).execute(copySpec.input.parse(raw(["ကိရိယာ ✓"])), commandContext("/")),
  );
  assert.equal(copied.data.characters, 8);

  const piped = new CopyText(clipboard, sources("line one\nline two\n"));
  await piped.execute(copySpec.input.parse(raw([])), commandContext("/"));
  assert.deepEqual(clipboard.written, ["ကိရိယာ ✓", "line one\nline two"]);

  const pasted = expectDone(await new PasteText(clipboard).execute({}, commandContext("/")));
  assert.equal(pasted.data.text, "line one\nline two");
});

test("clip copy refuses empty text and warns about text that looks like a secret", async () => {
  const clipboard = new MemoryClipboard();
  const copy = new CopyText(clipboard, sources());
  await assert.rejects(
    copy.execute(copySpec.input.parse(raw([""])), commandContext("/")),
    (error: unknown) => error instanceof UsageError && error.detail.key === "clip.copy.empty",
  );
  assert.deepEqual(clipboard.written, []);
  const secret = expectDone(
    await copy.execute(copySpec.input.parse(raw([`ghp_${"a".repeat(36)}`])), commandContext("/")),
  );
  assert.deepEqual(
    secret.warnings.map((warning) => warning.key),
    ["clip.copy.secret"],
  );
});

test("on Linux the clipboard program follows the session: Wayland, then X11, else a reason", async () => {
  const backend = (variables: Record<string, string>, programs: Record<string, string>): Promise<string> =>
    new LinuxClipboardAdapter(
      new FakeEnvironment("linux", "/home/dev", variables),
      new FakeProcessRunner(programs),
    ).backend();
  const wayland = { "wl-copy": "/usr/bin/wl-copy", "wl-paste": "/usr/bin/wl-paste" };
  assert.equal(await backend({ WAYLAND_DISPLAY: "wayland-0" }, wayland), "wl-clipboard");
  assert.equal(await backend({ WAYLAND_DISPLAY: "wayland-0", DISPLAY: ":0" }, { xsel: "/usr/bin/xsel" }), "xsel");
  assert.equal(await backend({ DISPLAY: ":0" }, { xclip: "/usr/bin/xclip", xsel: "/usr/bin/xsel" }), "xclip");

  const reason = (key: string) => (error: unknown) =>
    error instanceof CapabilityUnavailableError && error.detail.key === key;
  await assert.rejects(backend({ DISPLAY: ":0" }, {}), reason("core.clipboard.no-program"));
  await assert.rejects(backend({ WAYLAND_DISPLAY: "wayland-0" }, {}), reason("core.clipboard.no-program"));
  await assert.rejects(backend({}, { xclip: "/usr/bin/xclip" }), reason("core.clipboard.no-display"));
});
