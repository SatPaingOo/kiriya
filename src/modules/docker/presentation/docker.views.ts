import { message } from "../../../core/domain/message.js";
import type { TextView, ViewFormat } from "../../../core/domain/view.js";
import type { MessageKey } from "../../../i18n/locales/en.js";
import type { CleanOutput } from "../application/clean-engine.use-case.js";
import type { PsOutput } from "../application/list-containers.use-case.js";
import type { StartOutput } from "../application/run-compose.use-case.js";
import type { DownOutput } from "../application/stop-project.use-case.js";
import type { LogsOutput } from "../application/show-logs.use-case.js";
import type { PortMapping } from "../domain/compose-file.js";

/** Rows of cells as columns padded to their widest cell. */
function columns(rows: ReadonlyArray<readonly string[]>): string[] {
  const widths: number[] = [];
  for (const row of rows) row.forEach((cell, index) => (widths[index] = Math.max(widths[index] ?? 0, cell.length)));
  return rows.map(
    (row) =>
      `  ${row
        .map((cell, index) => cell.padEnd(widths[index] ?? 0))
        .join("  ")
        .trimEnd()}`,
  );
}

function portLines(ports: readonly PortMapping[], format: ViewFormat): string[] {
  return ports.map((port) => `  ${format.text(message("docker.port", { ...port }))}`);
}

export const psView: TextView<PsOutput> = (output, format) => {
  if (output.mode === "projects") {
    if (output.projects.length === 0) return [format.dim(format.text(message("docker.ps.no-projects")))];
    return columns(output.projects.map((project) => [project.name, project.status, project.configFiles]));
  }
  const header = `${format.bold(output.project)}  ${format.dim(format.path(output.file))}`;
  if (output.containers.length === 0) return [header, format.dim(format.text(message("docker.ps.no-containers")))];
  return [
    header,
    ...columns(output.containers.map((item) => [item.name, item.service, item.state, item.status, item.ports])),
  ];
};

function startView(done: MessageKey): TextView<StartOutput> {
  return (output, format) =>
    output.succeeded
      ? [format.green(format.text(message(done, { project: output.project }))), ...portLines(output.ports, format)]
      : [];
}

export const upView = startView("docker.up.done");
export const rebuildView = startView("docker.rebuild.done");

export const downView: TextView<DownOutput> = (output, format) => {
  if (!output.succeeded) return [];
  const key = output.volumes ? "docker.down.done-volumes" : "docker.down.done";
  return [format.green(format.text(message(key, { project: output.project })))];
};

/** The logs themselves already went to the terminal as docker printed them. */
export const logsView: TextView<LogsOutput> = () => [];

export const cleanView: TextView<CleanOutput> = (output, format) => {
  const label = (key: MessageKey): string => format.text(message(key));
  const lines = columns([
    [
      label("docker.clean.column.type"),
      label("docker.clean.column.total"),
      label("docker.clean.column.active"),
      label("docker.clean.column.size"),
      label("docker.clean.column.reclaimable"),
    ],
    ...output.usage.map((row) => [row.type, row.total, row.active, row.size, row.reclaimable]),
  ]);
  lines[0] = format.bold(lines[0] ?? "");
  for (const result of output.results.filter((item) => item.succeeded)) {
    const space = result.reclaimed ?? "0B";
    lines.push(format.green(format.text(message("docker.clean.reclaimed", { target: result.target, space }))));
  }
  return lines;
};
