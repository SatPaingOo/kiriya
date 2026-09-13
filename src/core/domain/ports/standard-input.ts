/** What is piped into kiriya. */
export interface StandardInput {
  /** A person is typing, rather than a pipe or a file feeding it. */
  readonly isTerminal: boolean;
  /** Everything until the input ends; OperationFailedError when it passes `maxBytes`. */
  read(maxBytes: number): Promise<Uint8Array>;
}
