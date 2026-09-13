/** The system clipboard, as text. */
export interface Clipboard {
  /** What serves the clipboard here, such as pbcopy; CapabilityUnavailableError when this session has none. */
  backend(): Promise<string>;
  write(text: string, signal: AbortSignal): Promise<void>;
  /** An empty string when the clipboard holds no text. */
  read(signal: AbortSignal): Promise<string>;
}
