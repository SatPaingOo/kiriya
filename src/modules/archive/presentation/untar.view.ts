import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import type { UntarOutput } from "../application/extract-tar.use-case.js";

export const untarView: TextView<UntarOutput> = (output, format) => {
  if (output.mode === "list") {
    const lines = output.entries.map((entry) => {
      const size = entry.type === "file" ? format.bytes(entry.size) : "";
      // Links and special files are listed, but never extracted.
      const name = entry.type === "link" || entry.type === "other" ? format.dim(entry.name) : entry.name;
      return `  ${format.time(entry.modifiedMs)}  ${size.padStart(9)}  ${name}`;
    });
    const total = message("archive.unzip.list-total", {
      count: output.entries.length,
      size: format.bytes(output.bytes),
    });
    lines.push("", format.text(total));
    return lines;
  }
  if (!output.extracted) return [];
  const summary = message("archive.unzip.done", {
    files: output.files,
    size: format.bytes(output.bytes),
    target: format.path(output.target),
  });
  const lines = [format.green(format.text(summary))];
  if (output.skippedLinks > 0) {
    lines.push(format.dim(format.text(message("archive.untar.skipped-links", { count: output.skippedLinks }))));
  }
  return lines;
};
