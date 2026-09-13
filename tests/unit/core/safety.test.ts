import assert from "node:assert/strict";
import { test } from "node:test";
import { refuseProtected, requireApproval, requireTypedConfirmation } from "../../../src/core/application/safety.js";
import { RefusedError } from "../../../src/core/domain/errors.js";
import { message } from "../../../src/core/domain/message.js";
import type { ProtectedPaths } from "../../../src/core/domain/ports/protected-paths.js";
import { commandContext, ScriptedConfirmation } from "../../support/fakes.js";

const refused = (key: string) => (error: unknown) => error instanceof RefusedError && error.detail.key === key;
const guard: ProtectedPaths = {
  reasonFor: (target) => (target === "/protected" ? message("core.guard.home", { path: target }) : null),
};
const warning = message("files.clean.warn", { count: 2, size: "1 KB" });
const question = message("files.rename.ask", { count: 2 });

test("one protected path refuses the whole command", () => {
  assert.throws(() => refuseProtected(guard, ["/fine", "/protected"], "/"), refused("core.guard.refused"));
  assert.doesNotThrow(() => refuseProtected(guard, ["/fine"], "/"));
});

test("a wrong --confirm stops before any prompt; a right one or a typed answer goes on", async () => {
  const confirmation = new ScriptedConfirmation(true);
  await assert.rejects(
    requireTypedConfirmation(commandContext("/", confirmation), warning, "2", "3"),
    refused("core.confirm.mismatch"),
  );
  assert.deepEqual(confirmation.asked, []);
  await requireTypedConfirmation(commandContext("/", confirmation), warning, "2", "2");
  await requireTypedConfirmation(commandContext("/", confirmation), warning, "2", undefined);
  await assert.rejects(
    requireTypedConfirmation(commandContext("/", new ScriptedConfirmation(false)), warning, "2", undefined),
    refused("core.confirm.declined"),
  );
});

test("approval goes on with a yes or --yes and stops otherwise", async () => {
  await requireApproval(commandContext("/", new ScriptedConfirmation(true)), question, false);
  await requireApproval(commandContext("/", new ScriptedConfirmation(false)), question, true);
  await assert.rejects(
    requireApproval(commandContext("/", new ScriptedConfirmation(false)), question, false),
    refused("core.confirm.declined"),
  );
});
