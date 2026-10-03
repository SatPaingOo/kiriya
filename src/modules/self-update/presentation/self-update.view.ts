import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import type { SelfUpdateOutput } from "../application/update-self.use-case.js";

/** A version that could not be read arrives as a failure, so this prints nothing for it. */
export const selfUpdateView: TextView<SelfUpdateOutput> = (output, format) => {
  if (output.latest === null) return [];
  if (output.applied) {
    return [format.green(format.text(message("self-update.applied", { version: output.latest })))];
  }
  if (!output.newer) {
    return [format.text(message("self-update.current", { version: output.installed }))];
  }
  const found = format.text(message("self-update.available", { installed: output.installed, latest: output.latest }));
  // Say what to type next, because finding out is the whole point of running this.
  const next =
    output.source === "npm"
      ? message("self-update.how-apply")
      : message("self-update.how-elsewhere", { latest: output.latest });
  return [format.green(found), format.dim(format.text(next))];
};
