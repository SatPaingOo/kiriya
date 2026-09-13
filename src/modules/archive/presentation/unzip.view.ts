import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import type { UnzipOutput } from "../application/extract-zip.use-case.js";

export const unzipView: TextView<UnzipOutput> = (output, format) => {
  if (output.mode === "list") {
    const lines = output.entries.map((entry) => {
      const size = entry.isDirectory ? "" : format.bytes(entry.size);
      return `  ${format.time(entry.modifiedMs)}  ${size.padStart(9)}  ${entry.name}`;
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
  return [format.green(format.text(summary))];
};
