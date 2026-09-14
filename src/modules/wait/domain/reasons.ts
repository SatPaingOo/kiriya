import { message, type Message } from "../../../core/domain/message.js";
import type { HttpFailure } from "../../../core/domain/ports/network.js";
import type { MessageKey } from "../../../i18n/locales/en.js";

const REASONS: Readonly<Record<HttpFailure, MessageKey>> = {
  refused: "wait.reason.refused",
  timeout: "wait.reason.timeout",
  "not-found": "wait.reason.not-found",
  unreachable: "wait.reason.unreachable",
  tls: "wait.reason.tls",
  failed: "wait.reason.failed",
};

/** Why the last attempt was not ready, worded to end a sentence. */
export function failureReason(failure: HttpFailure, host: string, code: string | null): Message {
  return message(REASONS[failure], { host, code: code ?? failure });
}
