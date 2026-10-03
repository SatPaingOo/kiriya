import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import type { ScanOutput } from "../application/scan-secrets.use-case.js";

/** Longer samples are cut here, so a minified line cannot flood the terminal. */
const SAMPLE_LIMIT = 60;

export const scanView: TextView<ScanOutput> = (output, format) => {
  if (output.findings.length === 0) {
    const clean = message("secrets.scan.clean", { checked: output.checked });
    const lines = [format.green(format.text(clean))];
    if (output.allowed > 0)
      lines.push(format.dim(format.text(message("secrets.scan.allowed", { count: output.allowed }))));
    return lines;
  }

  const kindWidth = Math.max(...output.findings.map((finding) => finding.kind.length));
  const places = output.findings.map((finding) => `${format.path(finding.path)}:${finding.line}:${finding.column}`);
  const placeWidth = Math.max(...places.map((place) => place.length));
  const lines = output.findings.map((finding, index) => {
    const place = (places[index] ?? "").padEnd(placeWidth);
    const sample = finding.sample.length > SAMPLE_LIMIT ? `${finding.sample.slice(0, SAMPLE_LIMIT)}…` : finding.sample;
    return `  ${format.yellow(place)}  ${finding.kind.padEnd(kindWidth)}  ${sample}`;
  });

  lines.push(
    "",
    format.text(message("secrets.scan.counted", { count: output.findings.length, checked: output.checked })),
  );
  if (output.allowed > 0)
    lines.push(format.dim(format.text(message("secrets.scan.allowed", { count: output.allowed }))));
  if (output.truncated) lines.push(format.dim(format.text(message("secrets.scan.truncated"))));
  // Say how to excuse one, because a fixture flagged with no way out is why scanners get turned off.
  lines.push(format.dim(format.text(message("secrets.scan.how-allow"))));
  return lines;
};
