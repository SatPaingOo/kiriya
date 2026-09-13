export interface ProcessResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface ProcessOptions {
  readonly cwd?: string;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

/** Programs on this machine, always started without a shell and with an argument array. */
export interface ProcessRunner {
  /** The full path of an executable found on PATH, or null. */
  find(program: string): Promise<string | null>;
  /** CapabilityUnavailableError when the program cannot start at all. */
  run(program: string, args: readonly string[], options?: ProcessOptions): Promise<ProcessResult>;
}
