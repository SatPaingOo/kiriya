import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import type { ReplaceOutput } from "../application/replace-text.use-case.js";

export const replaceView: TextView<ReplaceOutput> = (output, format) => {
  const lines: string[] = [];
  for (const file of output.files) {
    const count = format.dim(format.text(message("files.replace.matches", { count: file.count })));
    lines.push(`${format.bold(format.path(file.path))}  ${count}`);
    if (file.lineCountChanges) lines.push(format.dim(`  ${format.text(message("files.replace.lines-change"))}`));
    for (const sample of file.samples) {
      lines.push(`  ${String(sample.line).padStart(5)}  ${format.red("-")} ${sample.before}`);
      lines.push(`  ${"".padStart(5)}  ${format.green("+")} ${sample.after}`);
    }
  }
  const skipped =
    output.skipped > 0 ? format.dim(` · ${format.text(message("files.grep.skipped", { count: output.skipped }))}`) : "";
  const total = message("files.replace.total", {
    total: output.replacements,
    files: output.files.length,
    checked: output.checked,
  });
  lines.push("", `${format.text(total)}${skipped}`);
  if (output.written > 0) {
    lines.push(format.green(format.text(message("files.replace.written", { count: output.written }))));
  }
  return lines;
};
