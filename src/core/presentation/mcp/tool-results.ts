import type { CommandResult } from "../../domain/command.js";
import type { KiriyaError } from "../../domain/errors.js";
import { errorJson, resultJson } from "../cli/json-output.js";
import type { Translator } from "../i18n/translator.js";
import { isObject, type JsonObject } from "./protocol.js";

export type ToolResult = {
  readonly content: ReadonlyArray<{ readonly type: "text"; readonly text: string }>;
  readonly structuredContent: JsonObject;
  readonly isError: boolean;
};

export type OutputLimits = {
  /** Items kept from the start of each list. */
  readonly items: number;
  /** Characters of the whole JSON document, and of any one text in it. */
  readonly characters: number;
};

/** Roughly ten thousand tokens: enough for a model to act on, small enough for its context. */
export const OUTPUT_LIMITS: OutputLimits = { items: 200, characters: 40_000 };

type Cut = { readonly at: string; readonly omitted: number; readonly unit: "items" | "characters" };

function trim(value: unknown, at: string, items: number, characters: number, cuts: Cut[]): unknown {
  if (typeof value === "string") {
    if (value.length <= characters) return value;
    cuts.push({ at, omitted: value.length - characters, unit: "characters" });
    return value.slice(0, characters);
  }
  if (Array.isArray(value)) {
    if (value.length > items) cuts.push({ at, omitted: value.length - items, unit: "items" });
    return value.slice(0, items).map((item, index) => trim(item, `${at}[${index}]`, items, characters, cuts));
  }
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        trim(item, at === "" ? key : `${at}.${key}`, items, characters, cuts),
      ]),
    );
  }
  return value;
}

/** Long lists keep their first items and long texts their start, tighter each round, until the document fits. */
export function limitDocument(document: JsonObject, limits: OutputLimits): JsonObject {
  let items = limits.items;
  let characters = limits.characters;
  for (;;) {
    const cuts: Cut[] = [];
    const trimmed = trim(document, "", items, characters, cuts) as JsonObject;
    const limited = cuts.length === 0 ? trimmed : { ...trimmed, truncated: cuts };
    if (JSON.stringify(limited).length <= limits.characters || (items === 10 && characters === 1000)) return limited;
    items = Math.max(10, Math.floor(items / 2));
    characters = Math.max(1000, Math.floor(characters / 2));
  }
}

function toolResult(document: JsonObject, isError: boolean, limits: OutputLimits): ToolResult {
  const structuredContent = limitDocument(document, limits);
  return { content: [{ type: "text", text: JSON.stringify(structuredContent) }], structuredContent, isError };
}

/**
 * The document `--json` prints, as structured content and repeated as text. Output a
 * program printed on the way, such as docker's, is added; failures make it an error.
 */
export function commandToolResult(
  commandId: string,
  result: CommandResult<unknown>,
  output: string,
  translator: Translator,
  limits: OutputLimits = OUTPUT_LIMITS,
): ToolResult {
  const document = JSON.parse(resultJson(commandId, result, translator)) as JsonObject;
  const failed = result.kind === "done" && result.failures.length > 0;
  return toolResult(output === "" ? document : { ...document, output }, failed, limits);
}

/** A typed error as the document `--json` prints, so the model reads what to change. */
export function errorToolResult(
  error: KiriyaError,
  translator: Translator,
  limits: OutputLimits = OUTPUT_LIMITS,
): ToolResult {
  return toolResult(JSON.parse(errorJson(error, translator)) as JsonObject, true, limits);
}
