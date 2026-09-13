import type { Message } from "../message.js";

/** Paths no command may delete, move or overwrite. */
export interface ProtectedPaths {
  /** Why `path` is protected when working in `cwd`, or null when it is not. */
  reasonFor(path: string, cwd: string): Message | null;
}
