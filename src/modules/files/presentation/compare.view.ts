import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import { previewLines } from "../../../core/presentation/list-preview.js";
import type { MessageKey } from "../../../i18n/locales/en.js";
import type { CompareOutput } from "../application/compare-paths.use-case.js";

const FOLDER_PREVIEW = 50;

export const compareView: TextView<CompareOutput> = (output, format) => {
  const lines = [`${format.red("a")}  ${output.a}`, `${format.green("b")}  ${output.b}`, ""];

  if (output.kind === "files") {
    const text = output.text;
    if (output.identical) {
      lines.push(format.green(format.text(message("files.compare.identical", { size: format.bytes(output.sizeA) }))));
    } else if (text === null) {
      const sizes = { sizeA: format.bytes(output.sizeA), sizeB: format.bytes(output.sizeB) };
      lines.push(format.text(message("files.compare.files-differ", sizes)));
    } else if (text.sameText) {
      const encodings = { encodingA: text.encodingA, encodingB: text.encodingB };
      lines.push(format.text(message("files.compare.same-text", encodings)));
    } else {
      const end = format.dim(format.text(message("files.compare.end-of-file")));
      const counts = { line: text.line, linesA: text.linesA, linesB: text.linesB };
      lines.push(
        format.text(message("files.compare.first-difference", counts)),
        `  ${format.red("a")}  ${text.lineA ?? end}`,
        `  ${format.green("b")}  ${text.lineB ?? end}`,
      );
    }
    return lines;
  }

  const sections: ReadonlyArray<readonly [MessageKey, readonly string[]]> = [
    ["files.compare.only-in-a", output.onlyInA],
    ["files.compare.only-in-b", output.onlyInB],
    [
      "files.compare.changed",
      output.different.map((item) =>
        item.reason === "kind" ? format.text(message("files.compare.kind-differs", { path: item.path })) : item.path,
      ),
    ],
  ];
  for (const [key, items] of sections) {
    if (items.length === 0) continue;
    lines.push(format.bold(format.text(message(key, { count: items.length }))));
    lines.push(...previewLines(items, FOLDER_PREVIEW, (item) => `  ${item}`, format), "");
  }
  const differences = output.onlyInA.length + output.onlyInB.length + output.different.length;
  lines.push(
    differences === 0
      ? format.green(format.text(message("files.compare.identical-folders", { count: output.entries })))
      : format.text(
          message("files.compare.folder-total", {
            onlyA: output.onlyInA.length,
            onlyB: output.onlyInB.length,
            different: output.different.length,
          }),
        ),
  );
  return lines;
};
