import { message } from "../../../core/domain/message.js";
import type { TextView, ViewFormat } from "../../../core/domain/view.js";
import type { MessageKey } from "../../../i18n/locales/en.js";
import type { ReportOutput } from "../application/create-report.use-case.js";
import type { ToolsOutput } from "../application/find-tools.use-case.js";
import type { MachineFacts } from "../application/machine-facts.js";
import type { InfoOutput } from "../application/show-info.use-case.js";

type Row = readonly [MessageKey, string];

function osRow(machine: MachineFacts, format: ViewFormat): Row {
  const params = { name: machine.osName, kernel: machine.kernel, arch: machine.arch };
  return ["sys.label.os", format.text(message("sys.info.os", params))];
}

function cpuRow(machine: MachineFacts, format: ViewFormat): Row {
  return ["sys.label.cpu", format.text(message("sys.info.cpu", { model: machine.cpuModel, count: machine.cpuCount }))];
}

function memoryRow(machine: MachineFacts, format: ViewFormat): Row {
  const params = { total: format.bytes(machine.memoryTotalBytes), free: format.bytes(machine.memoryFreeBytes) };
  return ["sys.label.memory", format.text(message("sys.info.memory", params))];
}

function localeRow(machine: MachineFacts, format: ViewFormat): Row {
  const params = { locale: machine.locale, timeZone: machine.timeZone };
  return ["sys.label.locale", format.text(message("sys.info.locale", params))];
}

function uptime(seconds: number, format: ViewFormat): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return format.text(message("sys.info.uptime", { days, hours, minutes }));
}

export const infoView: TextView<InfoOutput> = (output, format) => {
  const rows: Row[] = [
    osRow(output, format),
    cpuRow(output, format),
    memoryRow(output, format),
    ["sys.label.uptime", uptime(output.uptimeSeconds, format)],
    ["sys.label.host", output.hostname],
    localeRow(output, format),
    ["sys.label.node", output.node],
    ["sys.label.kiriya", output.kiriya],
  ];
  const labels = rows.map(([key]) => format.text(message(key)));
  const width = Math.max(...labels.map((label) => label.length));
  return rows.map(([, value], index) => `  ${format.bold((labels[index] ?? "").padEnd(width))}  ${value}`);
};

export const toolsView: TextView<ToolsOutput> = (output, format) => {
  const nameWidth = Math.max(...output.tools.map((tool) => tool.name.length));
  const versionWidth = Math.max(0, ...output.tools.map((tool) => tool.version?.length ?? 0));
  return output.tools.map((tool) =>
    tool.version === null
      ? `  ${tool.name.padEnd(nameWidth)}  ${format.dim(format.text(message("sys.tools.not-found")))}`
      : `  ${tool.name.padEnd(nameWidth)}  ${tool.version.padEnd(versionWidth)}  ${format.dim(tool.path ?? "")}`,
  );
};

/** Markdown without colour, to paste into an issue as it is. */
export const reportView: TextView<ReportOutput> = (output, format) => {
  const { machine, tools } = output;
  const found = tools.flatMap((tool) => (tool.version === null ? [] : [`${tool.name} ${tool.version}`]));
  const missing = tools.filter((tool) => tool.version === null).map((tool) => tool.name);
  const toolText = [
    found.join(", "),
    missing.length > 0 ? format.text(message("sys.report.not-found", { names: missing.join(", ") })) : "",
  ]
    .filter((part) => part !== "")
    .join("; ");
  const rows: Row[] = [
    ["sys.label.kiriya", machine.kiriya],
    ["sys.label.node", machine.node],
    osRow(machine, format),
    cpuRow(machine, format),
    memoryRow(machine, format),
    localeRow(machine, format),
    ["sys.label.tools", toolText],
  ];
  return rows.map(([key, value]) => `- **${format.text(message(key))}:** ${value}`);
};
