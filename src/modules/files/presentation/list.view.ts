import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import type { ListOutput } from "../application/list-entries.use-case.js";

export const listView: TextView<ListOutput> = (output, format) => {
  const lines = [format.bold(format.path(output.path)), ""];
  for (const entry of output.entries) {
    const size = entry.kind === "file" ? format.bytes(entry.size) : "";
    const name = entry.kind === "directory" ? format.bold(`${entry.name}/`) : entry.name;
    const target = entry.target === null ? "" : format.dim(` -> ${entry.target}`);
    lines.push(`  ${entry.kind.padEnd(9)} ${size.padStart(9)}  ${format.time(entry.modifiedMs)}  ${name}${target}`);
  }
  const folders = output.entries.filter((entry) => entry.kind === "directory").length;
  const bytes = output.entries.reduce((sum, entry) => sum + entry.size, 0);
  lines.push(
    "",
    format.text(
      message("files.list.total", { folders, files: output.entries.length - folders, size: format.bytes(bytes) }),
    ),
  );
  if (output.hidden > 0) lines.push(format.dim(format.text(message("files.list.hidden", { count: output.hidden }))));
  return lines;
};
