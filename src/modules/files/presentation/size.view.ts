import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import type { SizeOutput } from "../application/measure-folders.use-case.js";

export const sizeView: TextView<SizeOutput> = (output, format) => {
  const rebuildable =
    output.rebuildableBytes > 0
      ? format.dim(
          `  ${format.text(message("files.size.rebuildable-total", { size: format.bytes(output.rebuildableBytes) }))}`,
        )
      : "";
  const lines = [`${format.bold(format.path(output.folder))}  ${format.bytes(output.bytes)}${rebuildable}`, ""];
  const shown = output.rows.slice(0, output.top);
  const loose = format.text(message("files.size.loose-files"));
  const width = Math.max(8, loose.length, ...shown.map((row) => row.name.length + 1));
  for (const row of shown) {
    const extra =
      row.rebuildableBytes > 0
        ? format.dim(
            `  ${format.text(message("files.size.rebuildable", { size: format.bytes(row.rebuildableBytes) }))}`,
          )
        : "";
    lines.push(`  ${`${row.name}/`.padEnd(width)}  ${format.bytes(row.bytes).padStart(9)}${extra}`);
  }
  if (output.rows.length > shown.length) {
    lines.push(
      format.dim(`  ${format.text(message("files.size.more", { count: output.rows.length - shown.length }))}`),
    );
  }
  if (output.looseBytes > 0) {
    lines.push(format.dim(`  ${loose.padEnd(width)}  ${format.bytes(output.looseBytes).padStart(9)}`));
  }
  return lines;
};
