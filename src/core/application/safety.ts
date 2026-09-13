import type { CommandContext } from "../domain/command.js";
import { RefusedError } from "../domain/errors.js";
import type { Message } from "../domain/message.js";
import type { ProtectedPaths } from "../domain/ports/protected-paths.js";

/** Refuses the whole command when any path is protected, before anything is asked or changed. */
export function refuseProtected(guard: ProtectedPaths, paths: readonly string[], cwd: string): void {
  for (const target of paths) {
    const reason = guard.reasonFor(target, cwd);
    if (reason !== null) throw new RefusedError("core.guard.refused", { path: target, reason });
  }
}

/** A yes-or-no question for work that can be undone; anything but yes stops the command. */
export async function requireApproval(context: CommandContext, question: Message, assumeYes: boolean): Promise<void> {
  if (!(await context.confirmation.approve(question, assumeYes))) throw new RefusedError("core.confirm.declined");
}

/**
 * A typed confirmation for work that cannot be undone. A --confirm value that does
 * not match stops the command before any prompt, since the plan is not what the script expected.
 */
export async function requireTypedConfirmation(
  context: CommandContext,
  warning: Message,
  expected: string,
  provided: string | undefined,
): Promise<void> {
  if (provided !== undefined && provided !== expected) {
    throw new RefusedError("core.confirm.mismatch", { provided, expected });
  }
  if (!(await context.confirmation.typed(warning, expected, provided))) throw new RefusedError("core.confirm.declined");
}
