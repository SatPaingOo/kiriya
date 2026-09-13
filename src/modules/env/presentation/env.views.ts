import { message } from "../../../core/domain/message.js";
import type { TextView, ViewFormat } from "../../../core/domain/view.js";
import type { MessageKey } from "../../../i18n/locales/en.js";
import type { CheckOutput } from "../application/check-dotenv.use-case.js";
import type { PathEntryStatus, PathOutput } from "../application/inspect-path.use-case.js";
import type { ShowOutput } from "../application/show-variables.use-case.js";

/** NAME=value, one per line, as shells print them. */
export const showView: TextView<ShowOutput> = (output, format) => {
  const lines = output.variables.map((variable) =>
    variable.value === null
      ? `${variable.name}=${format.dim(format.text(message("env.show.hidden-value")))}`
      : `${variable.name}=${variable.value}`,
  );
  if (output.hidden > 0) lines.push(format.dim(format.text(message("env.show.hidden", { count: output.hidden }))));
  return lines;
};

const STATUS_KEYS: Readonly<Record<PathEntryStatus, MessageKey>> = {
  ok: "env.path.status.ok",
  missing: "env.path.status.missing",
  "not-a-folder": "env.path.status.not-a-folder",
  duplicate: "env.path.status.duplicate",
  empty: "env.path.status.empty",
  relative: "env.path.status.relative",
};

function paintStatus(status: PathEntryStatus, text: string, format: ViewFormat): string {
  if (status === "ok") return format.green(text);
  return status === "missing" || status === "not-a-folder" ? format.red(text) : format.yellow(text);
}

export const pathView: TextView<PathOutput> = (output, format) => {
  const labels = output.entries.map((entry) => format.text(message(STATUS_KEYS[entry.status])));
  const statusWidth = Math.max(0, ...labels.map((label) => label.length));
  const indexWidth = String(output.entries.length).length;
  return output.entries.map((entry, position) => {
    const status = paintStatus(entry.status, (labels[position] ?? "").padEnd(statusWidth), format);
    const expanded = entry.folder !== entry.entry.trim() ? format.dim(` → ${entry.folder}`) : "";
    const repeat =
      entry.duplicateOf === null
        ? ""
        : format.dim(`  ${format.text(message("env.path.same-as", { index: entry.duplicateOf }))}`);
    return `  ${String(entry.index).padStart(indexWidth)}  ${status}  ${entry.entry}${expanded}${repeat}`;
  });
};

/** Problems arrive as failures and warnings; a file with every variable set gets one line. */
export const checkView: TextView<CheckOutput> = (output, format) =>
  output.fileExists && output.missing.length === 0
    ? [
        format.green(
          format.text(message("env.check.ok", { count: output.expected, example: output.example, file: output.file })),
        ),
      ]
    : [];
