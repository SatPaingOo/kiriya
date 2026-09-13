import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import type { ScriptOutput } from "../application/print-script.use-case.js";
import type { SuggestOutput } from "../application/suggest-words.use-case.js";

/** The script exactly, so it can be piped into a file or evaluated. */
export const scriptView: TextView<ScriptOutput> = (output) => output.script.replace(/\n$/, "").split("\n");

/** One suggestion per line: the value, a tab, and its description, which may be empty. */
export const suggestView: TextView<SuggestOutput> = (output, format) =>
  output.suggestions.map(
    (suggestion) =>
      `${suggestion.value}\t${suggestion.description === null ? "" : format.text(message(suggestion.description))}`,
  );
