import type { EndedProcess } from "../application/process-ending.js";
import { message } from "../domain/message.js";
import type { ViewFormat } from "../domain/view.js";

/** One line per process that ended; the others arrive as failures and warnings. */
export function endedLines(processes: readonly EndedProcess[], format: ViewFormat): string[] {
  return processes
    .filter((entry) => entry.outcome === "ended")
    .map((entry) => format.green(format.text(message("core.end.ended", { name: entry.name ?? "?", pid: entry.pid }))));
}

/** Rows as aligned columns two spaces apart; the last column is not padded, so long text can run on. */
export function columns(rows: ReadonlyArray<readonly string[]>): string[] {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, index) => {
      widths[index] = Math.max(widths[index] ?? 0, cell.length);
    });
  }
  return rows.map((row) =>
    `  ${row.map((cell, index) => (index === row.length - 1 ? cell : cell.padEnd(widths[index] ?? 0))).join("  ")}`.trimEnd(),
  );
}
