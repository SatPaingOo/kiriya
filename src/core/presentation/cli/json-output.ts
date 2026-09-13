import type { CommandResult } from "../../domain/command.js";
import { KiriyaError } from "../../domain/errors.js";
import { isMessage } from "../../domain/message.js";
import type { Translator } from "../i18n/translator.js";

/**
 * JSON keeps every message's key and parameters, so scripts never depend on wording,
 * and adds its text. Nested messages in parameters get the same treatment on the way down.
 */
function stringify(value: unknown, translator: Translator): string {
  return JSON.stringify(
    value,
    (_key, item: unknown) =>
      isMessage(item) && !("text" in item) ? { key: item.key, params: item.params, text: translator.text(item) } : item,
    2,
  );
}

export function resultJson(commandId: string, result: CommandResult<unknown>, translator: Translator): string {
  const failures = result.kind === "done" ? result.failures : [];
  return stringify(
    {
      ok: failures.length === 0,
      command: commandId,
      kind: result.kind,
      ...(result.kind === "preview" ? { applyFlag: result.applyFlag } : {}),
      data: result.data,
      warnings: result.warnings,
      failures,
    },
    translator,
  );
}

export function errorJson(error: unknown, translator: Translator): string {
  if (error instanceof KiriyaError) {
    return stringify({ ok: false, error: { kind: error.kind, message: error.detail } }, translator);
  }
  return stringify({ ok: false, error: { kind: "unexpected", message: String(error) } }, translator);
}
