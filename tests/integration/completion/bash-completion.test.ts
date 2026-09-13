import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { NodeProcessRunnerAdapter } from "../../../src/core/infrastructure/node/node-process-runner.adapter.js";

const MAIN = fileURLToPath(new URL("../../../src/main.js", import.meta.url));

test(
  "in bash, the script completes modules and option values, and leaves file names to bash",
  // On Windows, the bash first on PATH may be WSL's, which cannot run this Node.js.
  { skip: process.platform === "win32" ? "bash is tested on Linux and macOS" : false },
  async (t) => {
    const runner = new NodeProcessRunnerAdapter();
    const bash = await runner.find("bash");
    if (bash === null) {
      t.skip("this machine has no bash");
      return;
    }
    const script = [
      `kiriya() { "${process.execPath}" "${MAIN}" "$@"; }`,
      'eval "$(kiriya completion bash)"',
      'run() { COMP_WORDS=("$@"); COMP_CWORD=$(( $# - 1 )); COMPREPLY=(); _kiriya_complete; printf "%s," "${COMPREPLY[@]}"; printf "\\n"; }',
      "run kiriya fi",
      "run kiriya net dns example.com --type m",
      "run kiriya archive zip ''",
    ].join("\n");
    const environment = { KIRIYA_CONFIG: path.join(tmpdir(), "kiriya-tests", "no-config.json"), KIRIYA_NO_COLOR: "1" };
    const result = await runner.run(bash, ["-c", script], { env: environment });
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(result.stdout.trim().split("\n"), ["files,", "mx,", ","]);
  },
);
