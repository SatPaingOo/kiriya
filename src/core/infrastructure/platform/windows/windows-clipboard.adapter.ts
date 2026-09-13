import { CapabilityUnavailableError, OperationFailedError } from "../../../domain/errors.js";
import type { Clipboard } from "../../../domain/ports/clipboard.js";
import { firstLine, runPowerShellTyped } from "../../node/typed-programs.js";

const PREAMBLE = String.raw`
$ErrorActionPreference = 'Stop'
$mode = $ExecutionContext.SessionState.LanguageMode
if ($mode -ne 'FullLanguage') { "mode|$mode"; exit 0 }
`;

const WRITE_SCRIPT = `${PREAMBLE}
$bytes = [Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())
Set-Clipboard -Value ([Text.Encoding]::UTF8.GetString($bytes))
"done|"
`;

const READ_SCRIPT = `${PREAMBLE}
$text = Get-Clipboard -Raw
if ($null -eq $text) { $text = '' }
"text|" + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($text))
`;

/**
 * Set-Clipboard and Get-Clipboard through Windows PowerShell, because clip.exe garbles
 * UTF-8. Text travels as base64 on stdin and stdout, so no code page touches it. Like
 * the trash, the cmdlets need full language mode. Verified in the phase 0 spike.
 */
export class WindowsClipboardAdapter implements Clipboard {
  backend(): Promise<string> {
    return Promise.resolve("PowerShell Set-Clipboard");
  }

  async write(text: string, signal: AbortSignal): Promise<void> {
    await this.run(WRITE_SCRIPT, "done|", signal, Buffer.from(text, "utf8").toString("base64"));
  }

  async read(signal: AbortSignal): Promise<string> {
    const encoded = await this.run(READ_SCRIPT, "text|", signal);
    return Buffer.from(encoded, "base64").toString("utf8");
  }

  /** What the script printed after `prefix`. */
  private async run(script: string, prefix: string, signal: AbortSignal, input = ""): Promise<string> {
    const result = await runPowerShellTyped(script, { input, signal, timeoutMs: 60_000 });
    const lines = result.stdout.split(/\r?\n/).map((line) => line.trim());
    const mode = lines.find((line) => line.startsWith("mode|"));
    if (mode !== undefined) {
      throw new CapabilityUnavailableError("core.clipboard.windows.language-mode", { mode: mode.slice(5) });
    }
    const answer = lines.find((line) => line.startsWith(prefix));
    if (result.code !== 0 || answer === undefined) {
      const detail = firstLine(result.stderr);
      throw new OperationFailedError("core.clipboard.failed", { program: "PowerShell", code: result.code, detail });
    }
    return answer.slice(prefix.length);
  }
}
