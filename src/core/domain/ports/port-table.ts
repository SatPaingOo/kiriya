export interface Listener {
  /** The local address, such as 0.0.0.0, ::, 127.0.0.1 or ::1. */
  readonly address: string;
  readonly port: number;
  /** null when the owner is hidden, as another user's process is on Linux and macOS without elevation. */
  readonly pid: number | null;
}

/** Listening TCP sockets on this machine. */
export interface PortTable {
  listeners(signal: AbortSignal): Promise<readonly Listener[]>;
  /** Whether a TCP server could listen on the port on every interface right now. */
  canListen(port: number): Promise<boolean>;
}
