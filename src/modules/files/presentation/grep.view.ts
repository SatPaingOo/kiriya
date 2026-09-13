import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import type { GrepOutput } from "../application/search-text.use-case.js";

export const grepView: TextView<GrepOutput> = (output, format) => {
  const lines: string[] = [];
  if (output.mode === "lines") {
    for (const match of output.lines) {
      lines.push(`${format.bold(format.path(match.path))}:${match.line}: ${match.text}`);
    }
    if (output.matches > output.lines.length) {
      const more = output.matches - output.lines.length;
      lines.push(format.dim(format.text(message("files.grep.more", { count: more }))));
    }
  } else {
    for (const file of output.files) {
      lines.push(output.mode === "files" ? format.path(file.path) : `${format.path(file.path)}: ${file.count}`);
    }
  }
  const skipped =
    output.skipped > 0 ? format.dim(` · ${format.text(message("files.grep.skipped", { count: output.skipped }))}`) : "";
  const total = message("files.grep.total", {
    matches: output.matches,
    matched: output.files.length,
    checked: output.checked,
  });
  lines.push("", `${format.text(total)}${skipped}`);
  return lines;
};
