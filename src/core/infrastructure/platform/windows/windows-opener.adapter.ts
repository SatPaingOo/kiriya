import path from "node:path";
import type { Opener } from "../../../domain/ports/opener.js";
import { launchDetached } from "../../node/typed-programs.js";

/** explorer.exe opens a file in its application, a folder in a window, and a web address in the browser. */
export class WindowsOpenerAdapter implements Opener {
  open(target: string): Promise<void> {
    // explorer.exe exits with 1 even when it opened the target, so only whether it started counts.
    const explorer = path.win32.join(process.env["SystemRoot"] ?? "C:\\Windows", "explorer.exe");
    return launchDetached(explorer, [target]);
  }
}
