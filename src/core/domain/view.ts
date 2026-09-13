import type { Message } from "./message.js";

/** What a text view may use. Presentation implements it: translation, colour, units. */
export interface ViewFormat {
  text(message: Message): string;
  bold(text: string): string;
  dim(text: string): string;
  red(text: string): string;
  green(text: string): string;
  yellow(text: string): string;
  bytes(count: number): string;
  time(epochMs: number): string;
  /** Relative to the working folder when inside it, otherwise absolute. */
  path(absolutePath: string): string;
}

/** Turns one command's output into lines of human-readable text. */
export type TextView<Output> = (output: Output, format: ViewFormat) => readonly string[];
