import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import type { OpenOutput } from "../application/open-target.use-case.js";

export const openView: TextView<OpenOutput> = (output, format) => {
  const target = output.kind === "url" ? output.target : format.path(output.target);
  return [format.dim(format.text(message("open.done", { target })))];
};
