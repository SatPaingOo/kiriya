import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import type { TarOutput } from "../application/create-tar.use-case.js";

export const tarView: TextView<TarOutput> = (output, format) => {
  const ratio = output.bytesIn === 0 ? 100 : Math.round((output.bytesOut / output.bytesIn) * 100);
  const summary = message("archive.tar.done", {
    path: format.path(output.archive),
    entries: output.entries,
    bytesIn: format.bytes(output.bytesIn),
    bytesOut: format.bytes(output.bytesOut),
    ratio,
  });
  const lines = [format.green(format.text(summary))];
  if (output.skippedLinks > 0) {
    lines.push(format.dim(format.text(message("archive.tar.skipped-links", { count: output.skippedLinks }))));
  }
  return lines;
};
