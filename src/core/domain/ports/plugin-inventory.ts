import type { Message } from "../message.js";

export interface LoadedPlugin {
  /** As written in the configuration. */
  readonly entry: string;
  readonly id: string;
  readonly name: string | null;
  readonly version: string | null;
  /** The file kiriya imported. */
  readonly location: string;
  readonly commands: number;
}

export interface PluginProblem {
  readonly entry: string;
  readonly reason: Message;
}

/** The plugins this run loaded, and the ones it could not. */
export interface PluginInventory {
  loaded(): readonly LoadedPlugin[];
  problems(): readonly PluginProblem[];
}
