import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import type { CleanOutput } from "../application/clean-builds.use-case.js";

export const cleanView: TextView<CleanOutput> = (output, format) => {
  const lines = output.candidates.map(
    (candidate) =>
      `  ${format.bytes(candidate.bytes).padStart(9)}  ${format.path(candidate.path)}  ${format.dim(format.text(candidate.reason))}`,
  );
  const tracked =
    output.tracked > 0
      ? format.dim(` · ${format.text(message("files.clean.tracked", { count: output.tracked }))}`)
      : "";
  const total = message("files.clean.total", { count: output.candidates.length, size: format.bytes(output.bytes) });
  lines.push("", `${format.text(total)}${tracked}`);
  if (output.removed > 0) {
    const removed = message("files.clean.done", { count: output.removed, size: format.bytes(output.bytes) });
    lines.push(format.green(format.text(removed)));
  }
  return lines;
};
