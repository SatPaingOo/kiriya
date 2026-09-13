import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import type { MessageKey } from "../../../i18n/locales/en.js";
import type { CaseOutput } from "../application/convert-case.use-case.js";
import type { CodecOutput } from "../application/convert-codecs.use-case.js";
import type { JsonOutput } from "../application/convert-json.use-case.js";
import type { TimeOutput } from "../application/convert-time.use-case.js";
import type { JwtOutput } from "../application/decode-jwt.use-case.js";

/** Only the result, so it can be piped or captured. */
export const outputView: TextView<CodecOutput | CaseOutput> = (output) => output.output.split("\n");

/** Invalid JSON prints nothing here: the failure names the line and column. */
export const jsonView: TextView<JsonOutput> = (output, format) => {
  if (!output.valid) return [];
  if (output.output === null) return [format.green(format.text(message("convert.json.valid")))];
  return output.output.split("\n");
};

export const jwtView: TextView<JwtOutput> = (output, format) => {
  const lines = [
    format.bold(format.text(message("convert.jwt.header"))),
    ...JSON.stringify(output.header, null, 2).split("\n"),
    "",
    format.bold(format.text(message("convert.jwt.payload"))),
    ...JSON.stringify(output.payload, null, 2).split("\n"),
  ];
  const times: ReadonlyArray<readonly [MessageKey, string | null]> = [
    ["convert.jwt.issued", output.issuedAt],
    ["convert.jwt.not-before", output.notBefore],
    [output.expired === true ? "convert.jwt.expired" : "convert.jwt.expires", output.expiresAt],
  ];
  const present = times.filter((entry): entry is readonly [MessageKey, string] => entry[1] !== null);
  if (present.length > 0) lines.push("");
  for (const [key, time] of present) {
    const text = format.text(message(key, { time: format.time(Date.parse(time)) }));
    lines.push(key === "convert.jwt.expired" ? format.red(text) : text);
  }
  return lines;
};

export const timeView: TextView<TimeOutput> = (output, format) => {
  const rows: ReadonlyArray<readonly [string, string]> = [
    [format.text(message("convert.time.label.iso")), output.iso],
    [format.text(message("convert.time.label.local")), format.time(output.epochMs)],
    [format.text(message("convert.time.label.seconds")), String(output.epochSeconds)],
    [format.text(message("convert.time.label.ms")), String(output.epochMs)],
  ];
  const width = Math.max(...rows.map(([label]) => label.length));
  return rows.map(([label, value]) => `  ${label.padEnd(width)}  ${value}`);
};
