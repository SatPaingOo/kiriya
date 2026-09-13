import type { OutputStream } from "./passthrough.js";

export interface ProcessResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface ProcessOptions {
  readonly cwd?: string;
  /** Added to the inherited environment, such as GIT_TERMINAL_PROMPT=0. */
  readonly env?: Readonly<Record<string, string>>;
  /** 60 seconds by default; 0 means no limit, for a program that runs until it is stopped. */
  readonly timeoutMs?: number;
  /** Aborting it stops the program, and run then throws InterruptedError. */
  readonly signal?: AbortSignal;
  /** Receives output as it arrives; the result's stdout and stderr are then empty. */
  readonly onOutput?: (text: string, stream: OutputStream) => void;
}

/** Programs on this machine, always started without a shell and with an argument array. */
export interface ProcessRunner {
  /** The full path of an executable found on PATH, or null. */
  find(program: string): Promise<string | null>;
  /** CapabilityUnavailableError when the program cannot start at all. */
  run(program: string, args: readonly string[], options?: ProcessOptions): Promise<ProcessResult>;
}
