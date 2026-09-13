import type { Confirmation } from "../../domain/ports/confirmation.js";

/** Nobody can be asked over MCP yet, so every question is declined and the command stops with nothing changed. */
export class DecliningConfirmation implements Confirmation {
  approve(): Promise<boolean> {
    return Promise.resolve(false);
  }

  typed(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
