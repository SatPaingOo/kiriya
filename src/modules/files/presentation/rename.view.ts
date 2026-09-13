import path from "node:path";
import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import type { RenameOutput } from "../application/rename-paths.use-case.js";

export const renameView: TextView<RenameOutput> = (output, format) => {
  if (output.mode === "one") {
    return output.renames.map((rename) =>
      format.green(
        format.text(
          message("files.rename.renamed-one", { from: format.path(rename.from), name: path.basename(rename.to) }),
        ),
      ),
    );
  }
  const lines = output.renames.map(
    (rename) => `  ${format.path(rename.from)} -> ${format.bold(path.basename(rename.to))}`,
  );
  lines.push("", format.text(message("files.rename.count", { count: output.renames.length })));
  if (output.renames.length === 0 && output.problems.length === 0) {
    lines.push(format.green(format.text(message("files.rename.all-fit"))));
  }
  if (output.renamed > 0)
    lines.push(format.green(format.text(message("files.rename.renamed", { count: output.renamed }))));
  return lines;
};
