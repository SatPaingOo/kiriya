import { isObject, type JsonObject } from "./protocol.js";

/** The user's answer to a form: what they chose, and the text fields they filled in. */
export type ElicitAnswer = {
  readonly action: "accept" | "decline" | "cancel";
  readonly content: Readonly<Record<string, string>>;
};

/** A question in form mode: the text to show, and the flat schema of the fields to fill in. */
export type FormQuestion = {
  readonly message: string;
  readonly requestedSchema: JsonObject;
};

/** Asks the user through the client, in the way the request's protocol version asks. */
export interface Elicitation {
  ask(question: FormQuestion): Promise<ElicitAnswer>;
}

/** Whether client capabilities include form mode. An empty `elicitation` object means form mode, as the specification says. */
export function supportsFormElicitation(capabilities: JsonObject): boolean {
  const elicitation = capabilities["elicitation"];
  if (!isObject(elicitation)) return false;
  return Object.keys(elicitation).length === 0 || isObject(elicitation["form"]);
}

/** An answer as the client sent it. Anything that is not a valid answer counts as cancelled. */
export function answerOf(value: unknown): ElicitAnswer {
  if (!isObject(value)) return { action: "cancel", content: {} };
  const { action, content } = value;
  if (action !== "accept" && action !== "decline" && action !== "cancel") return { action: "cancel", content: {} };
  const fields: Record<string, string> = {};
  if (isObject(content)) {
    for (const [name, field] of Object.entries(content)) if (typeof field === "string") fields[name] = field;
  }
  return { action, content: fields };
}

/** Ends a round of a call whose result asks for input; the client answers by calling again. */
export class InputRequired extends Error {
  constructor(
    readonly inputRequests: JsonObject,
    readonly requestState: string,
  ) {
    super("input required");
    this.name = "InputRequired";
  }
}

/**
 * The 2026-07-28 way to ask: the question travels in the call's result, and the answer
 * comes back when the client calls again, so the command runs again from the start.
 * Questions are numbered in the order the command asks them.
 */
export class RoundTripElicitation implements Elicitation {
  private asked = 0;

  constructor(
    private readonly answers: Readonly<Record<string, ElicitAnswer>>,
    private readonly stop: (key: string, question: FormQuestion) => InputRequired,
  ) {}

  ask(question: FormQuestion): Promise<ElicitAnswer> {
    this.asked += 1;
    const key = `confirm-${this.asked}`;
    const answer = this.answers[key];
    return answer === undefined ? Promise.reject(this.stop(key, question)) : Promise.resolve(answer);
  }
}
