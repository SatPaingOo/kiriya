import { message } from "../../../core/domain/message.js";
import type { EntryKind } from "../../../core/domain/ports/file-system.js";
import type { TextView } from "../../../core/domain/view.js";
import type { MessageKey } from "../../../i18n/locales/en.js";
import type { InfoOutput } from "../application/show-info.use-case.js";

const KIND_KEYS: Readonly<Record<EntryKind, MessageKey>> = {
  file: "core.kind.file",
  directory: "core.kind.directory",
  symlink: "core.kind.symlink",
  other: "core.kind.other",
};

export const infoView: TextView<InfoOutput> = (output, format) => {
  const label = (key: MessageKey): string => format.text(message(key));
  const lines: string[] = [];
  for (const item of output.items) {
    const rows: Array<readonly [string, string]> = [[label("files.info.label.type"), label(KIND_KEYS[item.kind])]];
    if (item.target !== null) rows.push([label("files.info.label.target"), item.target]);
    const size =
      item.contents === null
        ? message("files.info.size-file", { size: format.bytes(item.bytes), bytes: item.bytes })
        : message("files.info.size-folder", {
            size: format.bytes(item.bytes),
            files: item.contents.files,
            folders: item.contents.directories,
          });
    const access =
      item.permissions === null
        ? label(item.writable ? "files.info.read-write" : "files.info.read-only")
        : `${item.permissions.symbolic} (${item.permissions.octal})`;
    rows.push(
      [label("files.info.label.size"), format.text(size)],
      [label("files.info.label.created"), format.time(item.createdMs)],
      [label("files.info.label.modified"), format.time(item.modifiedMs)],
      [label("files.info.label.accessed"), format.time(item.accessedMs)],
      [label("files.info.label.access"), access],
      [label("files.info.label.hidden"), label(item.hidden ? "files.info.hidden-yes" : "files.info.hidden-no")],
    );
    if (item.hash !== null) rows.push([item.hash.algorithm, item.hash.value]);

    const width = Math.max(...rows.map(([name]) => name.length));
    lines.push(format.bold(format.path(item.path)));
    for (const [name, value] of rows) lines.push(`  ${name.padEnd(width)}  ${value}`);
    lines.push("");
  }
  return lines;
};
