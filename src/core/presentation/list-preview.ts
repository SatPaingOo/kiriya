import { message } from "../domain/message.js";
import type { ViewFormat } from "../domain/view.js";

/** The first `limit` items as lines, then one line saying how many more there are. */
export function previewLines<T>(
  items: readonly T[],
  limit: number,
  render: (item: T) => string,
  format: ViewFormat,
): string[] {
  const lines = items.slice(0, limit).map(render);
  if (items.length > limit) {
    lines.push(format.dim(format.text(message("core.list.more", { count: items.length - limit }))));
  }
  return lines;
}
