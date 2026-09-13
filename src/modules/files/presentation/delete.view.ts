import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import type { DeleteOutput } from "../application/delete-paths.use-case.js";

export const deleteView: TextView<DeleteOutput> = (output, format) => {
  const lines: string[] = [];
  for (const item of output.items) {
    const shown = format.path(item.path) + (item.kind === "directory" ? "/" : "");
    if (item.outcome === "planned") lines.push(`  ${shown}  ${format.dim(format.bytes(item.bytes))}`);
    if (item.outcome === "trashed")
      lines.push(format.green(format.text(message("files.delete.trashed", { path: shown }))));
    if (item.outcome === "deleted")
      lines.push(format.green(format.text(message("files.delete.deleted", { path: shown }))));
  }
  lines.push(
    "",
    format.text(message("files.delete.total", { count: output.items.length, size: format.bytes(output.bytes) })),
  );
  return lines;
};
