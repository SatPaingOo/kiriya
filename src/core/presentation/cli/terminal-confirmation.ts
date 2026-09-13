import { createInterface } from "node:readline/promises";
import { InterruptedError } from "../../domain/errors.js";
import { message, type Message } from "../../domain/message.js";
import type { Confirmation } from "../../domain/ports/confirmation.js";
import type { Translator } from "../i18n/translator.js";
import type { Style } from "./style.js";

export interface TerminalConfirmationOptions {
  readonly input: NodeJS.ReadableStream;
  /** Prompts go to stderr, so stdout stays data only. */
  readonly output: NodeJS.WritableStream;
  /** stdin is a terminal and --no-input was not given. */
  readonly interactive: boolean;
  readonly translator: Translator;
  readonly style: Style;
}

export class TerminalConfirmation implements Confirmation {
  constructor(private readonly options: TerminalConfirmationOptions) {}

  async approve(question: Message, assumeYes: boolean): Promise<boolean> {
    if (assumeYes) return true;
    if (!this.options.interactive) {
      this.write(this.text(message("core.confirm.no-terminal-yes")));
      return false;
    }
    const answer = await this.ask(`${this.text(question)} ${this.text(message("core.confirm.yes-no"))} `);
    return answer.trim().toLowerCase() === "y";
  }

  async typed(warning: Message, expected: string, provided: string | undefined): Promise<boolean> {
    if (provided !== undefined) return provided === expected;
    if (!this.options.interactive) {
      this.write(this.text(message("core.confirm.no-terminal-typed", { flag: `--confirm=${expected}` })));
      return false;
    }
    this.write(`${this.options.style.red(this.text(message("core.confirm.cannot-undo")))} ${this.text(warning)}`);
    const answer = await this.ask(
      `${this.text(message("core.confirm.type", { expected: this.options.style.bold(expected) }))} `,
    );
    return answer.trim() === expected;
  }

  private text(value: Message): string {
    return this.options.translator.text(value);
  }

  private write(line: string): void {
    this.options.output.write(`${line}\n`);
  }

  /** Ctrl+C at the prompt interrupts the command; input that ends without an answer declines. */
  private async ask(prompt: string): Promise<string> {
    const readline = createInterface({ input: this.options.input, output: this.options.output });
    const controller = new AbortController();
    let interrupted = false;
    readline.once("SIGINT", () => {
      interrupted = true;
      controller.abort();
    });
    readline.once("close", () => controller.abort());
    try {
      return await readline.question(prompt, { signal: controller.signal });
    } catch (error) {
      if (interrupted) {
        this.options.output.write("\n");
        throw new InterruptedError("core.error.interrupted");
      }
      if (controller.signal.aborted) return "";
      throw error;
    } finally {
      readline.close();
    }
  }
}
