import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import type { HashOutput } from "../application/hash-files.use-case.js";

/** `<hash>  <path>`, as sha256sum prints it; a failed check is reported on stderr. */
export const hashView: TextView<HashOutput> = (output, format) => {
  if (output.check !== null) {
    if (!output.check.matches) return [];
    const matches = message("files.hash.matches", {
      algorithm: output.algorithm,
      path: format.path(output.check.path),
    });
    return [format.green(format.text(matches))];
  }
  return output.files.map((file) => `${file.hash}  ${format.path(file.path)}`);
};
