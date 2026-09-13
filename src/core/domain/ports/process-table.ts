export interface ProcessInfo {
  readonly pid: number;
  /** null when the listing did not include parent ids. */
  readonly ppid: number | null;
  /** The program's file name, such as node or node.exe. */
  readonly name: string;
  /** null when the listing did not include command lines, or the OS hides this one. */
  readonly command: string | null;
  /** Resident memory; null when unknown. */
  readonly memoryBytes: number | null;
}

export interface ProcessListing {
  readonly processes: readonly ProcessInfo[];
  /** Parent ids and command lines were read. */
  readonly detailed: boolean;
}

export type EndOutcome = "ended" | "still-running" | "not-found" | "denied" | "failed";

export interface EndResult {
  readonly pid: number;
  readonly outcome: EndOutcome;
  /** The operating system's error code, such as EPERM. */
  readonly code: string | null;
}

/** The processes on this machine. */
export interface ProcessTable {
  /** kiriya's own process id. */
  readonly selfPid: number;
  /**
   * Every process. `detailed` asks for parent ids and command lines where they cost more:
   * on Windows they need PowerShell, which takes a second or more.
   */
  list(detailed: boolean, signal: AbortSignal): Promise<ProcessListing>;
  /**
   * Asks processes to exit, or with `force` ends them at once, then waits a few seconds
   * to see them go. On Windows both end a process at once.
   */
  end(pids: readonly number[], force: boolean): Promise<readonly EndResult[]>;
  /** kiriya itself, the program that started it, and the OS's first processes: never ended. */
  protectedPids(): ReadonlySet<number>;
}
