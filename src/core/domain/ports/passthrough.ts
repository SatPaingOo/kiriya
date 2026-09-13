export type OutputStream = "stdout" | "stderr";

/**
 * The live output of a program a command runs, passed on as it arrives. The CLI writes
 * it to the matching stream, or all of it to stderr with --json, so stdout stays one
 * JSON document.
 */
export interface Passthrough {
  write(text: string, stream: OutputStream): void;
}
