import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import type { FindOutput } from "../application/find-files.use-case.js";

export const findView: TextView<FindOutput> = (output, format) => {
  const lines = output.matches.map((match) => {
    const size = match.kind === "directory" ? "" : format.bytes(match.size);
    const shown = format.path(match.path) + (match.kind === "directory" ? "/" : "");
    return `  ${format.time(match.modifiedMs)}  ${size.padStart(9)}  ${shown}`;
  });
  if (output.total > output.matches.length) {
    lines.push(format.dim(format.text(message("files.find.more", { count: output.total - output.matches.length }))));
  }
  lines.push(
    "",
    output.total === 0
      ? format.text(message("files.find.none"))
      : format.text(message("files.find.total", { count: output.total, size: format.bytes(output.totalBytes) })),
  );
  return lines;
};
