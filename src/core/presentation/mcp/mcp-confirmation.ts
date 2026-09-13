import type { SafetyLevel } from "../../domain/command.js";
import { RefusedError } from "../../domain/errors.js";
import { message, type Message } from "../../domain/message.js";
import type { Confirmation } from "../../domain/ports/confirmation.js";
import type { Translator } from "../i18n/translator.js";
import type { Elicitation } from "./elicitation.js";

/**
 * Questions over MCP, by the tool's safety level:
 *
 * - `write`: yes-or-no questions are answered yes by the user's `mcp.allowWrite` setting,
 *   as `--yes` would answer them on the command line.
 * - `destroy`: yes-or-no questions are asked through elicitation, so no call of such a
 *   tool changes anything the user did not accept.
 * - Typed confirmations, in any tool, are asked through elicitation, which exists only
 *   with `mcp.allowDestroy` and a client that supports it; without it they are refused.
 *
 * A value passed as `--confirm` never counts, since an agent could pass it.
 */
export class McpConfirmation implements Confirmation {
  constructor(
    private readonly safety: SafetyLevel,
    private readonly elicitation: Elicitation | null,
    private readonly translator: Translator,
  ) {}

  async approve(question: Message): Promise<boolean> {
    if (this.safety === "read") return false;
    if (this.safety === "write") return true;
    const answer = await this.asker().ask({
      message: this.translator.text(question),
      requestedSchema: { type: "object", properties: {} },
    });
    return answer.action === "accept";
  }

  async typed(warning: Message, expected: string): Promise<boolean> {
    const instruction = this.translator.text(message("core.mcp.confirm.type", { expected }));
    const answer = await this.asker().ask({
      message: `${this.translator.text(warning)} ${instruction}`,
      requestedSchema: {
        type: "object",
        properties: {
          value: {
            type: "string",
            title: this.translator.text(message("core.mcp.confirm.field")),
            description: instruction,
          },
        },
        required: ["value"],
      },
    });
    return answer.action === "accept" && answer.content["value"]?.trim() === expected;
  }

  private asker(): Elicitation {
    if (this.elicitation === null) throw new RefusedError("core.mcp.cannot-confirm");
    return this.elicitation;
  }
}
