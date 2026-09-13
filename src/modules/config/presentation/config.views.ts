import { message } from "../../../core/domain/message.js";
import type { ConfigValue } from "../../../core/domain/ports/config-store.js";
import type { TextView } from "../../../core/domain/view.js";
import type { GetOutput } from "../application/get-setting.use-case.js";
import type { KeysOutput } from "../application/list-config-keys.use-case.js";
import type { ListOutput } from "../application/list-settings.use-case.js";
import type { SetOutput } from "../application/set-setting.use-case.js";
import type { PathOutput } from "../application/show-config-path.use-case.js";
import type { UnsetOutput } from "../application/unset-setting.use-case.js";

const shown = (value: ConfigValue): string => (typeof value === "string" ? value : value.join(", "));

/** Only the path, so `$(kiriya config path)` works in a script. */
export const pathView: TextView<PathOutput> = (output) => [output.path];

export const keysView: TextView<KeysOutput> = (output, format) =>
  output.keys.flatMap((entry) => [
    `${format.bold(entry.key)}  ${format.dim(entry.type)}  ${format.text(entry.description)}`,
    ...(entry.choices === null
      ? []
      : [format.dim(`  ${format.text(message("config.keys.choices", { choices: entry.choices.join(", ") }))}`)]),
    format.dim(
      `  ${format.text(message("config.keys.example", { command: `kiriya config set ${entry.key} ${entry.example}` }))}`,
    ),
  ]);

export const listView: TextView<ListOutput> = (output, format) => {
  const width = Math.max(0, ...output.settings.map((setting) => setting.key.length));
  return [
    format.dim(output.path),
    ...output.settings.map((setting) => {
      const value =
        setting.value === null ? format.dim(format.text(message("config.list.not-set"))) : shown(setting.value);
      const unknown = setting.known ? "" : `  ${format.dim(format.text(message("config.list.unknown")))}`;
      return `  ${setting.key.padEnd(width)}  ${value}${unknown}`;
    }),
  ];
};

/** One value per line, so a list setting can be read line by line. */
export const getView: TextView<GetOutput> = (output) =>
  typeof output.value === "string" ? [output.value] : [...output.value];

export const setView: TextView<SetOutput> = (output, format) => [
  format.green(format.text(message("config.set.done", { key: output.key, value: shown(output.value) }))),
];

export const unsetView: TextView<UnsetOutput> = (output, format) => [
  output.removed
    ? format.green(format.text(message("config.unset.done", { key: output.key })))
    : format.dim(format.text(message("config.unset.not-set", { key: output.key }))),
];
