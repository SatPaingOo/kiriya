import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import type { CopyOutput } from "../application/copy-text.use-case.js";
import type { PasteOutput } from "../application/paste-text.use-case.js";

export const copyView: TextView<CopyOutput> = (output, format) => [
  format.dim(format.text(message("clip.copy.done", { count: output.characters }))),
];

/** The text itself, one final line ending aside, which the terminal adds back. */
export const pasteView: TextView<PasteOutput> = (output) =>
  output.text === "" ? [] : output.text.replace(/\r?\n$/, "").split(/\r?\n/);
