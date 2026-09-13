import { CapabilityUnavailableError, OperationFailedError } from "../../../domain/errors.js";
import type { Clipboard } from "../../../domain/ports/clipboard.js";
import type { Environment } from "../../../domain/ports/environment.js";
import type { ProcessRunner } from "../../../domain/ports/process-runner.js";
import { firstLine, runTyped } from "../../node/typed-programs.js";

interface ClipboardProgram {
  readonly name: string;
  readonly copy: readonly [string, readonly string[]];
  readonly paste: readonly [string, readonly string[]];
}

/** What xclip, xsel and wl-paste say about a clipboard with no text on it. */
const EMPTY = /not available|nothing is copied|no selection/i;

/**
 * wl-clipboard in a Wayland session, then xclip or xsel under X11. A session with no
 * display has no clipboard at all, which is reported rather than faked.
 */
export class LinuxClipboardAdapter implements Clipboard {
  constructor(
    private readonly environment: Environment,
    private readonly processRunner: ProcessRunner,
  ) {}

  async backend(): Promise<string> {
    return (await this.program()).name;
  }

  async write(text: string, signal: AbortSignal): Promise<void> {
    const program = await this.program();
    const [command, args] = program.copy;
    // These programs stay in the background to serve the clipboard, holding their output open, so only their exit counts.
    const result = await runTyped(command, args, { input: text, signal, ignoreOutput: true, timeoutMs: 30_000 });
    if (result.code !== 0) {
      throw new OperationFailedError("core.clipboard.failed", { program: program.name, code: result.code, detail: "" });
    }
  }

  async read(signal: AbortSignal): Promise<string> {
    const program = await this.program();
    const [command, args] = program.paste;
    const result = await runTyped(command, args, { signal, timeoutMs: 30_000 });
    if (result.code === 0) return result.stdout;
    if (EMPTY.test(result.stderr)) return "";
    const detail = firstLine(result.stderr);
    throw new OperationFailedError("core.clipboard.failed", { program: program.name, code: result.code, detail });
  }

  private async program(): Promise<ClipboardProgram> {
    const wayland = (this.environment.variable("WAYLAND_DISPLAY") ?? "") !== "";
    const x11 = (this.environment.variable("DISPLAY") ?? "") !== "";
    if (wayland) {
      const [copy, paste] = await Promise.all([
        this.processRunner.find("wl-copy"),
        this.processRunner.find("wl-paste"),
      ]);
      if (copy !== null && paste !== null) {
        return { name: "wl-clipboard", copy: [copy, []], paste: [paste, ["--no-newline"]] };
      }
    }
    if (x11) {
      const xclip = await this.processRunner.find("xclip");
      if (xclip !== null) {
        return {
          name: "xclip",
          copy: [xclip, ["-selection", "clipboard", "-in"]],
          paste: [xclip, ["-selection", "clipboard", "-out"]],
        };
      }
      const xsel = await this.processRunner.find("xsel");
      if (xsel !== null) {
        return { name: "xsel", copy: [xsel, ["--clipboard", "--input"]], paste: [xsel, ["--clipboard", "--output"]] };
      }
    }
    if (wayland || x11) throw new CapabilityUnavailableError("core.clipboard.no-program");
    throw new CapabilityUnavailableError("core.clipboard.no-display");
  }
}
