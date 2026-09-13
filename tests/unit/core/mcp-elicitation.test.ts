import assert from "node:assert/strict";
import { test } from "node:test";
import { RefusedError } from "../../../src/core/domain/errors.js";
import { message } from "../../../src/core/domain/message.js";
import type { SafetyLevel } from "../../../src/core/domain/command.js";
import type { Confirmation } from "../../../src/core/domain/ports/confirmation.js";
import { Translator } from "../../../src/core/presentation/i18n/translator.js";
import {
  answerOf,
  InputRequired,
  RoundTripElicitation,
  supportsFormElicitation,
  type ElicitAnswer,
  type Elicitation,
  type FormQuestion,
} from "../../../src/core/presentation/mcp/elicitation.js";
import { McpConfirmation } from "../../../src/core/presentation/mcp/mcp-confirmation.js";
import { callDigest, REQUEST_STATE_TTL_MS, RequestStates } from "../../../src/core/presentation/mcp/request-state.js";

/** Shows each key as its own text, so the tests do not depend on wording. */
const keys = new Translator({});
const QUESTION = message("files.rename.ask", { count: 1 });

test("a request state reads back what was issued until it expires, and never once altered or signed elsewhere", () => {
  let now = 1000;
  const states = new RequestStates(new Uint8Array(32).fill(1), () => now);
  const state = states.issue({ tool: "files.delete", key: "confirm-1" });
  assert.deepEqual(states.read(state), {
    tool: "files.delete",
    key: "confirm-1",
    expires: 1000 + REQUEST_STATE_TTL_MS,
  });

  const [, signature] = state.split(".");
  const forged = Buffer.from(JSON.stringify({ tool: "files.delete", key: "confirm-1", expires: 9e15 })).toString(
    "base64url",
  );
  assert.equal(states.read(`${forged}.${signature}`), null);
  assert.equal(states.read(`${state}x`), null);
  assert.equal(states.read(`${state}.more`), null);
  assert.equal(new RequestStates(new Uint8Array(32).fill(2), () => now).read(state), null);
  assert.equal(states.read("no-signature"), null);
  assert.equal(states.read(42), null);

  now += REQUEST_STATE_TTL_MS + 1;
  assert.equal(states.read(state), null);
});

test("a call's digest ignores the order of argument keys, and nothing else", () => {
  assert.equal(
    callDigest("files.delete", { a: 1, b: [1, { c: 2, d: 3 }] }),
    callDigest("files.delete", { b: [1, { d: 3, c: 2 }], a: 1 }),
  );
  assert.notEqual(callDigest("files.delete", { a: 1 }), callDigest("files.delete", { a: 2 }));
  assert.notEqual(callDigest("files.delete", {}), callDigest("files.copy", {}));
  assert.equal(callDigest("files.delete", undefined), callDigest("files.delete", {}));
});

test("form mode is an empty elicitation capability or one naming form, and an answer that makes no sense is a cancel", () => {
  assert.equal(supportsFormElicitation({ elicitation: {} }), true);
  assert.equal(supportsFormElicitation({ elicitation: { form: {}, url: {} } }), true);
  assert.equal(supportsFormElicitation({ elicitation: { url: {} } }), false);
  assert.equal(supportsFormElicitation({}), false);
  assert.deepEqual(answerOf({ action: "accept", content: { value: "3", count: 3 } }), {
    action: "accept",
    content: { value: "3" },
  });
  assert.deepEqual(answerOf({ action: "decline" }), { action: "decline", content: {} });
  assert.deepEqual(answerOf({ action: "maybe" }), { action: "cancel", content: {} });
  assert.deepEqual(answerOf(undefined), { action: "cancel", content: {} });
});

test("a round trip numbers its questions and stops at the first one without an answer", async () => {
  const stopped: string[] = [];
  const elicitation = new RoundTripElicitation({ "confirm-1": { action: "accept", content: {} } }, (key) => {
    stopped.push(key);
    return new InputRequired({}, "state");
  });
  const question: FormQuestion = { message: "Go ahead?", requestedSchema: { type: "object", properties: {} } };
  assert.equal((await elicitation.ask(question)).action, "accept");
  await assert.rejects(elicitation.ask(question), InputRequired);
  assert.deepEqual(stopped, ["confirm-2"]);
});

test("over MCP a setting answers a write tool's question, the user answers a destroy tool's, and --confirm never counts", async () => {
  const asked: FormQuestion[] = [];
  const answering = (answer: ElicitAnswer): Elicitation => ({
    ask: (question) => {
      asked.push(question);
      return Promise.resolve(answer);
    },
  });
  const confirmation = (safety: SafetyLevel, elicitation: Elicitation | null): Confirmation =>
    new McpConfirmation(safety, elicitation, keys);
  const refused = (error: unknown): boolean =>
    error instanceof RefusedError && error.detail.key === "core.mcp.cannot-confirm";

  assert.equal(await confirmation("read", null).approve(QUESTION, true), false);
  assert.equal(await confirmation("write", null).approve(QUESTION, false), true);
  await assert.rejects(confirmation("write", null).typed(QUESTION, "1", "1"), refused);

  const typedValue = (value: string): Elicitation => answering({ action: "accept", content: { value } });
  assert.equal(await confirmation("destroy", typedValue("2")).typed(QUESTION, "3", "3"), false);
  assert.equal(await confirmation("destroy", typedValue(" 3 ")).typed(QUESTION, "3", undefined), true);
  assert.equal(
    await confirmation("destroy", answering({ action: "decline", content: {} })).approve(QUESTION, true),
    false,
  );
  assert.equal(
    await confirmation("destroy", answering({ action: "accept", content: {} })).approve(QUESTION, false),
    true,
  );

  assert.equal(asked.length, 4);
  assert.deepEqual(asked[0]?.requestedSchema["required"], ["value"]);
  assert.match(asked[0]?.message ?? "", /core\.mcp\.confirm\.type/);
  assert.deepEqual(asked[2]?.requestedSchema, { type: "object", properties: {} });
});
