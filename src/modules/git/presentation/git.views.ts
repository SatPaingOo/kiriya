import path from "node:path";
import { message } from "../../../core/domain/message.js";
import type { TextView, ViewFormat } from "../../../core/domain/view.js";
import type { MessageKey } from "../../../i18n/locales/en.js";
import type { FetchOutput } from "../application/fetch-repositories.use-case.js";
import type { PullOutput } from "../application/pull-repositories.use-case.js";
import type { StatusOutput } from "../application/show-status.use-case.js";
import type { SwitchAction, SwitchOutput } from "../application/switch-branch.use-case.js";
import { syncState, type RepositoryStatus } from "../domain/repository-status.js";

function syncText(status: RepositoryStatus, format: ViewFormat): string {
  const state = syncState(status);
  if (state.kind === "no-upstream") return format.text(message("git.sync.no-upstream"));
  if (state.kind === "in-sync") return format.text(message("git.sync.in-sync"));
  const parts: string[] = [];
  if (state.ahead > 0) parts.push(format.text(message("git.sync.ahead", { count: state.ahead })));
  if (state.behind > 0) parts.push(format.text(message("git.sync.behind", { count: state.behind })));
  return parts.join(", ");
}

const widthOf = (names: readonly string[]): number => Math.max(0, ...names.map((name) => name.length));

export const statusView: TextView<StatusOutput> = (output, format) => {
  const kind = output.isRepository
    ? message("git.status.repository")
    : message("git.status.workspace", { count: output.repositories.length });
  const lines = [
    `${format.bold(path.basename(output.folder))}  ${format.dim(format.text(kind))}`,
    format.dim(output.folder),
  ];
  if (output.repositories.length > 0) lines.push("");
  const nameWidth = widthOf(output.repositories.map((status) => status.name));
  const branchWidth = widthOf(output.repositories.map((status) => status.branch));
  for (const status of output.repositories) {
    const parts = [
      format.text(message("git.status.commits", { count: status.commits })),
      format.text(
        status.dirty > 0 ? message("git.status.uncommitted", { count: status.dirty }) : message("git.status.clean"),
      ),
      syncText(status, format),
      status.hasRemote
        ? format.text(message("git.status.has-remote"))
        : format.red(format.text(message("git.status.no-remote-short"))),
    ];
    lines.push(`  ${status.name.padEnd(nameWidth)}  ${status.branch.padEnd(branchWidth)}  ${parts.join(" · ")}`);
  }
  if (output.allGood) lines.push("", format.green(format.text(message("git.status.all-good"))));
  return lines;
};

export const fetchView: TextView<FetchOutput> = (output, format) => {
  const width = widthOf(output.items.map((item) => item.status.name));
  return output.items.map((item) => {
    const name = item.status.name.padEnd(width);
    if (item.outcome === "fetched") return `  ${format.green(name)}  ${syncText(item.status, format)}`;
    if (item.outcome === "no-remote")
      return `  ${format.dim(name)}  ${format.dim(format.text(message("git.skip.no-remote")))}`;
    return `  ${format.red(name)}  ${format.red(format.text(message("git.fetch.failed-short")))}`;
  });
};

export const pullView: TextView<PullOutput> = (output, format) => {
  const width = widthOf(output.items.map((item) => item.status.name));
  return output.items.map((item) => {
    const name = item.status.name.padEnd(width);
    switch (item.outcome) {
      case "pulled":
        return `  ${format.green(name)}  ${format.text(message("git.pull.new-commits", { count: item.newCommits }))}`;
      case "up-to-date":
        return `  ${format.green(name)}  ${format.dim(format.text(message("git.pull.up-to-date")))}`;
      case "no-remote":
        return `  ${format.dim(name)}  ${format.dim(format.text(message("git.skip.no-remote")))}`;
      case "no-upstream":
        return `  ${format.dim(name)}  ${format.dim(format.text(message("git.skip.no-upstream")))}`;
      case "dirty":
        return `  ${format.yellow(name)}  ${format.text(message("git.skip.dirty", { count: item.status.dirty }))}`;
      case "failed":
        return `  ${format.red(name)}  ${format.red(format.text(message("git.pull.failed-short")))}`;
    }
  });
};

const ACTION_KEYS: Readonly<Record<SwitchAction, MessageKey>> = {
  already: "git.switch.action.already",
  local: "git.switch.action.local",
  track: "git.switch.action.track",
  create: "git.switch.action.create",
  missing: "git.switch.action.missing",
};

export const switchView: TextView<SwitchOutput> = (output, format) => {
  const width = widthOf(output.steps.map((step) => step.name));
  const lines = [`${format.bold(output.branch)}  ${format.dim(output.folder)}`, ""];
  for (const step of output.steps) {
    const action = format.text(message(ACTION_KEYS[step.action]));
    const shown = step.outcome === "switched" ? format.green(output.branch) : action;
    lines.push(`  ${step.name.padEnd(width)}  ${step.from} -> ${shown}`);
  }
  const switched = output.steps.filter((step) => step.outcome === "switched").length;
  if (switched > 0) {
    lines.push("", format.green(format.text(message("git.switch.done", { count: switched, branch: output.branch }))));
  } else if (output.steps.length > 0 && output.steps.every((step) => step.action === "already")) {
    lines.push("", format.green(format.text(message("git.switch.all-on", { branch: output.branch }))));
  }
  return lines;
};
