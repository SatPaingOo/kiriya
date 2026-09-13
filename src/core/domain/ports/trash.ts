import type { MessageKey } from "../../../i18n/locales/en.js";
import type { Message } from "../message.js";

export type TrashOutcome =
  | { readonly path: string; readonly ok: true }
  | { readonly path: string; readonly ok: false; readonly reason: Message };

/** The operating system's trash. Throws CapabilityUnavailableError when this machine cannot reach it at all. */
export interface Trash {
  /** How the trash is called on this OS, for messages. */
  readonly location: MessageKey;
  send(paths: readonly string[]): Promise<readonly TrashOutcome[]>;
}
