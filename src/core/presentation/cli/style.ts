import { styleText } from "node:util";

export interface Style {
  bold(text: string): string;
  dim(text: string): string;
  red(text: string): string;
  green(text: string): string;
  yellow(text: string): string;
}

const plain = (text: string): string => text;

/**
 * Colour through util.styleText, which already turns it off for a stream that is
 * not a terminal, for NO_COLOR and NODE_DISABLE_COLORS, and on for FORCE_COLOR.
 * `enabled` adds kiriya's own switches: --no-color, KIRIYA_NO_COLOR and TERM=dumb.
 */
export function createStyle(enabled: boolean, stream: NodeJS.WriteStream): Style {
  if (!enabled) return { bold: plain, dim: plain, red: plain, green: plain, yellow: plain };
  const paint =
    (format: "bold" | "dim" | "red" | "green" | "yellow") =>
    (text: string): string =>
      styleText(format, text, { stream });
  return { bold: paint("bold"), dim: paint("dim"), red: paint("red"), green: paint("green"), yellow: paint("yellow") };
}
