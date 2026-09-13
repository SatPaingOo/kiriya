import { message } from "../../../core/domain/message.js";
import type { TextView, ViewFormat } from "../../../core/domain/view.js";
import type { MessageKey } from "../../../i18n/locales/en.js";
import type { CheckStatus, DoctorOutput } from "../application/run-checks.use-case.js";

const STATUS_KEYS: Readonly<Record<CheckStatus, MessageKey>> = {
  ok: "doctor.status.ok",
  warn: "doctor.status.warn",
  fail: "doctor.status.fail",
};

function paint(status: CheckStatus, text: string, format: ViewFormat): string {
  if (status === "ok") return format.green(text);
  return status === "warn" ? format.yellow(text) : format.red(text);
}

export const doctorView: TextView<DoctorOutput> = (output, format) => {
  const statusWidth = Math.max(...output.checks.map((check) => format.text(message(STATUS_KEYS[check.status])).length));
  const nameWidth = Math.max(...output.checks.map((check) => check.name.length));
  const lines = output.checks.map((check) => {
    const status = format.text(message(STATUS_KEYS[check.status])).padEnd(statusWidth);
    return `  ${paint(check.status, status, format)}  ${check.name.padEnd(nameWidth)}  ${format.text(check.detail)}`;
  });
  if (output.plugins.length > 0) {
    lines.push("", format.bold(format.text(message("doctor.plugins"))));
    const idWidth = Math.max(...output.plugins.map((plugin) => plugin.id.length));
    for (const plugin of output.plugins) {
      const label = [plugin.name ?? plugin.entry, plugin.version].filter((part) => part !== null).join(" ");
      const detail = message("doctor.plugin", { commands: plugin.commands, location: format.path(plugin.location) });
      lines.push(`  ${plugin.id.padEnd(idWidth)}  ${label}  ${format.dim(format.text(detail))}`);
    }
  }
  return lines;
};
