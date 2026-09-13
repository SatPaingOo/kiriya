import type { TextView } from "../../../core/domain/view.js";
import type { ReadOutput } from "../application/read-text.use-case.js";

/** Only the text, so the output can be piped. */
export const readView: TextView<ReadOutput> = (output) => {
  const width = String(output.last).length;
  return output.lines.map((line, index) =>
    output.numbered ? `${String(output.first + index).padStart(width)}  ${line}` : line,
  );
};
