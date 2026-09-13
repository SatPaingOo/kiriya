import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import type { CreateOutput } from "../application/create-paths.use-case.js";

/** Created paths go to stdout; the ones left alone are reported as failures on stderr. */
export const newView: TextView<CreateOutput> = (output, format) =>
  output.items
    .filter((item) => item.created)
    .map((item) =>
      format.green(
        format.text(
          message(item.kind === "directory" ? "files.new.created-folder" : "files.new.created-file", {
            path: format.path(item.path),
          }),
        ),
      ),
    );
