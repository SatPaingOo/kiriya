import { message } from "../../../core/domain/message.js";
import { formatTarget } from "../../../core/domain/targets.js";
import type { TextView } from "../../../core/domain/view.js";
import type { WaitFileOutput } from "../application/wait-file.use-case.js";
import type { WaitPortOutput } from "../application/wait-port.use-case.js";
import type { WaitUrlOutput } from "../application/wait-url.use-case.js";

/** Seconds with one decimal, such as 3.5. */
const seconds = (ms: number): string => (ms / 1000).toFixed(1);

// A wait that ran out of time arrives as a failure, so each view prints a line only when it is ready.

export const portView: TextView<WaitPortOutput> = (output, format) => {
  if (!output.ready) return [];
  const target = formatTarget(output);
  const line = output.gone
    ? message("wait.port.closed", { target, seconds: seconds(output.waitedMs) })
    : message("wait.port.listening", {
        target,
        address: output.address ?? output.host,
        seconds: seconds(output.waitedMs),
      });
  return [format.green(format.text(line))];
};

export const urlView: TextView<WaitUrlOutput> = (output, format) => {
  if (!output.ready || output.status === null) return [];
  const line = message("wait.url.ready", { url: output.url, status: output.status, seconds: seconds(output.waitedMs) });
  return [format.green(format.text(line))];
};

export const fileView: TextView<WaitFileOutput> = (output, format) => {
  if (!output.ready) return [];
  const params = { path: format.path(output.path), seconds: seconds(output.waitedMs) };
  return [format.green(format.text(message(output.gone ? "wait.file.gone" : "wait.file.exists", params)))];
};
