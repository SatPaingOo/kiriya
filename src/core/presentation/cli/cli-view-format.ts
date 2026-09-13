import path from "node:path";
import type { Message } from "../../domain/message.js";
import { formatBytes } from "../../domain/values/bytes.js";
import type { ViewFormat } from "../../domain/view.js";
import type { Translator } from "../i18n/translator.js";
import type { Style } from "./style.js";

export class CliViewFormat implements ViewFormat {
  constructor(
    private readonly translator: Translator,
    private readonly style: Style,
    private readonly cwd: string,
  ) {}

  text(value: Message): string {
    return this.translator.text(value);
  }

  bold(text: string): string {
    return this.style.bold(text);
  }

  dim(text: string): string {
    return this.style.dim(text);
  }

  red(text: string): string {
    return this.style.red(text);
  }

  green(text: string): string {
    return this.style.green(text);
  }

  yellow(text: string): string {
    return this.style.yellow(text);
  }

  bytes(count: number): string {
    return formatBytes(count);
  }

  /** Local time as YYYY-MM-DD HH:MM. */
  time(epochMs: number): string {
    const date = new Date(epochMs);
    const pad = (value: number): string => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  path(absolutePath: string): string {
    const relative = path.relative(this.cwd, absolutePath);
    if (relative === "") return ".";
    return relative.startsWith("..") || path.isAbsolute(relative) ? absolutePath : relative;
  }
}
