import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import type { DupesOutput } from "../application/find-duplicates.use-case.js";

export const dupesView: TextView<DupesOutput> = (output, format) => {
  const lines: string[] = [];
  for (const group of output.groups) {
    const extra = message("files.dupes.extra", { size: format.bytes(group.size * (group.paths.length - 1)) });
    lines.push(
      `${format.bold(`${format.bytes(group.size)} × ${group.paths.length}`)}  ${format.dim(format.text(extra))}`,
    );
    for (const item of group.paths) lines.push(`  ${format.path(item)}`);
    lines.push("");
  }
  lines.push(
    format.text(
      output.groups.length === 0
        ? message("files.dupes.none", { checked: output.checked })
        : message("files.dupes.total", {
            groups: output.groups.length,
            size: format.bytes(output.extraBytes),
            checked: output.checked,
          }),
    ),
  );
  return lines;
};
