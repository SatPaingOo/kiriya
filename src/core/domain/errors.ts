import type { MessageKey } from "../../i18n/locales/en.js";
import { message, type Message, type MessageParams } from "./message.js";

export const ERROR_KINDS = [
  "usage",
  "not-found",
  "conflict",
  "refused",
  "capability-unavailable",
  "failed",
  "interrupted",
] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];

/**
 * Every error that crosses into a use case or presentation is one of these.
 * Adapters wrap Node.js and operating-system failures before they cross inward.
 */
export abstract class KiriyaError extends Error {
  abstract readonly kind: ErrorKind;
  readonly detail: Message;

  constructor(key: MessageKey, params: MessageParams = {}, options?: ErrorOptions) {
    super(key, options);
    this.name = new.target.name;
    this.detail = message(key, params);
  }
}

/** Bad flags, values or arguments. */
export class UsageError extends KiriyaError {
  override readonly kind = "usage";
}

export class NotFoundError extends KiriyaError {
  override readonly kind = "not-found";
}

/** Something already exists where the command would create or move something. */
export class ConflictError extends KiriyaError {
  override readonly kind = "conflict";
}

/** A protected path, or a confirmation that was declined or could not be asked. */
export class RefusedError extends KiriyaError {
  override readonly kind = "refused";
}

/** This machine lacks what the command needs, such as a clipboard program. */
export class CapabilityUnavailableError extends KiriyaError {
  override readonly kind = "capability-unavailable";
}

/** An operation the OS or Node.js reported as failed. */
export class OperationFailedError extends KiriyaError {
  override readonly kind = "failed";
}

export class InterruptedError extends KiriyaError {
  override readonly kind = "interrupted";
}
