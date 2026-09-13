import { CapabilityUnavailableError } from "../../../domain/errors.js";
import { message } from "../../../domain/message.js";
import type { Trash, TrashOutcome } from "../../../domain/ports/trash.js";
import { runPowerShell } from "../../node/run-program.js";

const NEWLINE = String.fromCharCode(10);

/**
 * SHFileOperation with FOF_ALLOWUNDO sends to the Recycle Bin without dialogs. It
 * deletes permanently on drives without a Recycle Bin, so only fixed local drives
 * are accepted. Under Constrained Language Mode Add-Type cannot load the C#, which
 * is reported rather than worked around. Verified in the phase 0 spike.
 */
const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$mode = $ExecutionContext.SessionState.LanguageMode
"mode|$mode"
if ($mode -ne 'FullLanguage') { exit 0 }
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class KiriyaRecycleBin {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  private struct Operation {
    public IntPtr Window; public uint Function; public string From; public string To;
    public ushort Flags; public bool Aborted; public IntPtr NameMappings; public string Title;
  }
  [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
  private static extern int SHFileOperation(ref Operation operation);
  public static int Send(string path) {
    var operation = new Operation { Function = 3, From = path + new string((char)0, 2), Flags = 0x0040 | 0x0010 | 0x0400 | 0x0004 };
    int code = SHFileOperation(ref operation);
    return code != 0 ? code : (operation.Aborted ? -1 : 0);
  }
}
'@
$paths = $env:KIRIYA_TRASH_PATHS -split [char]10
for ($i = 0; $i -lt $paths.Length; $i++) {
  $p = $paths[$i]
  if ($p -eq '') { continue }
  try {
    $root = [System.IO.Path]::GetPathRoot($p)
    if ($root.StartsWith('\\')) { "network|$i"; continue }
    $drive = New-Object System.IO.DriveInfo($root)
    if ($drive.DriveType -ne 'Fixed') { "drive|$i|$($drive.DriveType)"; continue }
    $code = [KiriyaRecycleBin]::Send($p)
    if ($code -eq 0 -and -not (Test-Path -LiteralPath $p)) { "ok|$i" } else { "error|$i|SHFileOperation returned $code" }
  } catch { "error|$i|$($_.Exception.Message)" }
}
`;

export class WindowsTrashAdapter implements Trash {
  readonly location = "core.trash.location.recycle-bin";

  async send(paths: readonly string[]): Promise<readonly TrashOutcome[]> {
    const result = await runPowerShell(SCRIPT, {
      env: { KIRIYA_TRASH_PATHS: paths.join(NEWLINE) },
      timeoutMs: 10 * 60_000,
    });
    const lines = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== "");
    const mode = lines.find((line) => line.startsWith("mode|"))?.slice(5) ?? "unknown";
    if (mode !== "FullLanguage") throw new CapabilityUnavailableError("core.trash.windows.language-mode", { mode });

    const byIndex = new Map<number, TrashOutcome>();
    for (const line of lines) {
      const [status, indexText, ...rest] = line.split("|");
      if (indexText === undefined || !/^[0-9]+$/.test(indexText)) continue;
      const index = Number(indexText);
      const path = paths[index] ?? "";
      if (status === "ok") byIndex.set(index, { path, ok: true });
      else if (status === "network")
        byIndex.set(index, { path, ok: false, reason: message("core.trash.windows.network") });
      else if (status === "drive") {
        byIndex.set(index, { path, ok: false, reason: message("core.trash.windows.drive", { drive: rest.join("|") }) });
      } else byIndex.set(index, { path, ok: false, reason: message("core.trash.failed", { detail: rest.join("|") }) });
    }
    return paths.map(
      (path, index) =>
        byIndex.get(index) ?? {
          path,
          ok: false,
          reason: message("core.trash.failed", { detail: result.stderr.trim().split(/\r?\n/)[0] ?? "no result" }),
        },
    );
  }
}
