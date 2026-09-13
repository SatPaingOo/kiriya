/** Hands a file, a folder or a web address to the application the OS chooses for it. */
export interface Opener {
  /** Returns once the OS has taken the target, without waiting for the application to close. */
  open(target: string, signal: AbortSignal): Promise<void>;
}
