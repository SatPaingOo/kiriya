import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import { previewLines } from "../../../core/presentation/list-preview.js";
import type { MessageKey } from "../../../i18n/locales/en.js";
import type { SyncOutput } from "../application/sync-folders.use-case.js";

const PREVIEW = 15;

export const syncView: TextView<SyncOutput> = (output, format) => {
  const label = (key: MessageKey): string => format.bold(format.text(message(key)));
  const plan = message("files.sync.plan", {
    copy: output.copy.length,
    update: output.update.length,
    remove: output.remove.length,
    size: format.bytes(output.bytes),
  });
  const lines = [
    `${label("files.sync.label.source")}  ${output.source}`,
    `${label("files.sync.label.target")}  ${output.target}`,
    "",
    format.text(plan),
  ];
  const sections: ReadonlyArray<readonly [MessageKey, readonly string[]]> = [
    ["files.sync.section.copy", output.copy],
    ["files.sync.section.update", output.update],
    ["files.sync.section.delete", output.remove],
  ];
  for (const [key, items] of sections) {
    if (items.length === 0) continue;
    lines.push("", label(key), ...previewLines(items, PREVIEW, (item) => `  ${item}`, format));
  }
  if (output.copy.length + output.update.length + output.remove.length === 0) {
    lines.push("", format.green(format.text(message("files.sync.in-sync"))));
  }
  if (output.applied) {
    const counts = { copy: output.copy.length, update: output.update.length, remove: output.remove.length };
    lines.push("", format.green(format.text(message("files.sync.done", counts))));
  }
  return lines;
};
