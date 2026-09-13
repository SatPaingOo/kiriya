import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import type { CopyOutput } from "../application/copy-paths.use-case.js";

export const copyView: TextView<CopyOutput> = (output, format) => {
  const exists = format.yellow(format.text(message("files.transfer.exists-note")));
  const lines = output.items.map((item) => {
    const note = item.conflict ? `  ${exists}` : "";
    return `  ${format.path(item.source)} -> ${format.path(item.destination)}  ${format.dim(format.bytes(item.bytes))}${note}`;
  });
  const conflicts =
    output.conflicts > 0
      ? `, ${format.text(message("files.transfer.conflicts-note", { count: output.conflicts }))}`
      : "";
  lines.push(
    "",
    `${format.text(message("files.copy.total", { count: output.items.length, size: format.bytes(output.bytes) }))}${conflicts}`,
  );
  const copied = output.items.filter((item) => item.outcome === "copied").length;
  if (copied > 0) lines.push(format.green(format.text(message("files.copy.done", { count: copied }))));
  return lines;
};
