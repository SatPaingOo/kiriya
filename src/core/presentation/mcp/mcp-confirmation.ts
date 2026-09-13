import { RefusedError } from "../../domain/errors.js";
import type { Confirmation } from "../../domain/ports/confirmation.js";

/**
 * Questions over MCP. Work that can be undone goes ahead when the user's `mcp.allowWrite`
 * setting allows it, as `--yes` would on the command line. Work that cannot be undone is
 * refused, since nobody can type its confirmation.
 */
export class McpConfirmation implements Confirmation {
  constructor(private readonly allowWrite: boolean) {}

  approve(): Promise<boolean> {
    return Promise.resolve(this.allowWrite);
  }

  typed(): Promise<boolean> {
    return Promise.reject(new RefusedError("core.mcp.cannot-confirm"));
  }
}
