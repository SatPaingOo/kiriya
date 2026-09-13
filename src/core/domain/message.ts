import type { MessageKey } from "../../i18n/locales/en.js";

/** A parameter is plain text, a number, or another message to translate in place. */
export type MessageParam = string | number | Message;
export type MessageParams = Readonly<Record<string, MessageParam>>;

/** A user-facing message: a key into the locale catalog plus its parameters. Never pre-translated text. */
export interface Message {
  readonly key: MessageKey;
  readonly params: MessageParams;
}

export function message(key: MessageKey, params: MessageParams = {}): Message {
  return { key, params };
}

export function isMessage(value: unknown): value is Message {
  return typeof value === "object" && value !== null && "key" in value && "params" in value;
}
