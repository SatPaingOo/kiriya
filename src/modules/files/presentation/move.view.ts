import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import type { MoveOutput } from "../application/move-paths.use-case.js";

export const moveView: TextView<MoveOutput> = (output, format) => {
  const exists = format.yellow(format.text(message("files.transfer.exists-note")));
  const lines = output.items.map(
    (item) => `  ${format.path(item.source)} -> ${format.path(item.destination)}${item.conflict ? `  ${exists}` : ""}`,
  );
  const conflicts =
    output.conflicts > 0
      ? `, ${format.text(message("files.transfer.conflicts-note", { count: output.conflicts }))}`
      : "";
  lines.push("", `${format.text(message("files.move.total", { count: output.items.length }))}${conflicts}`);
  const moved = output.items.filter((item) => item.outcome === "moved").length;
  if (moved > 0) lines.push(format.green(format.text(message("files.move.done", { count: moved }))));
  return lines;
};
