import { CapabilityUnavailableError } from "../../../domain/errors.js";
import type { Environment } from "../../../domain/ports/environment.js";
import type { Opener } from "../../../domain/ports/opener.js";
import type { ProcessRunner } from "../../../domain/ports/process-runner.js";
import { launchDetached } from "../../node/typed-programs.js";

/** xdg-open, started without waiting, because some desktops keep it running until the application closes. */
export class LinuxOpenerAdapter implements Opener {
  constructor(
    private readonly environment: Environment,
    private readonly processRunner: ProcessRunner,
  ) {}

  async open(target: string): Promise<void> {
    const hasDisplay = [this.environment.variable("WAYLAND_DISPLAY"), this.environment.variable("DISPLAY")].some(
      (value) => (value ?? "") !== "",
    );
    if (!hasDisplay) throw new CapabilityUnavailableError("core.open.no-display", { target });
    const xdgOpen = await this.processRunner.find("xdg-open");
    if (xdgOpen === null) throw new CapabilityUnavailableError("core.open.no-xdg-open");
    await launchDetached(xdgOpen, [target]);
  }
}
