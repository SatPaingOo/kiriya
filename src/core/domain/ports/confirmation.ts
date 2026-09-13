import type { Message } from "../message.js";

export interface Confirmation {
  /** A yes-or-no question for work that can be undone. `assumeYes` comes only from --yes. */
  approve(question: Message, assumeYes: boolean): Promise<boolean>;
  /**
   * Work that cannot be undone: the user types `expected`, or a script passes it as
   * `provided` through --confirm. --yes never counts. Resolves false when it cannot ask.
   */
  typed(warning: Message, expected: string, provided: string | undefined): Promise<boolean>;
}
