import assert from "node:assert/strict";
import { test } from "node:test";
import { InterruptedError, UsageError } from "../../../src/core/domain/errors.js";
import type { RawInput } from "../../../src/core/domain/input-schema.js";
import { message } from "../../../src/core/domain/message.js";
import type {
  ConnectOutcome,
  HttpOutcome,
  LookupOutcome,
  Network,
  NetworkAddress,
} from "../../../src/core/domain/ports/network.js";
import { waitFileSpec } from "../../../src/modules/wait/application/wait-file.use-case.js";
import { WaitForPort, waitPortSpec } from "../../../src/modules/wait/application/wait-port.use-case.js";
import { WaitForUrl, waitUrlSpec } from "../../../src/modules/wait/application/wait-url.use-case.js";
import { parseHttpAddress, parsePortTarget, statusIsReady } from "../../../src/modules/wait/domain/wait-input.js";
import { commandContext, expectDone, SteppingClock } from "../../support/fakes.js";

const raw = (positionals: readonly string[], options: RawInput["options"] = {}): RawInput => ({ positionals, options });

const OPEN: ConnectOutcome = { ok: true, address: "127.0.0.1", ms: 1 };
const REFUSED: ConnectOutcome = { ok: false, failure: "refused", code: "ECONNREFUSED", ms: 1 };
const answered = (status: number): HttpOutcome => ({ ok: true, status, ms: 1 });

/** Answers each attempt with the next scripted outcome, repeating the last, and records the time each was allowed. */
class ScriptedNetwork implements Network {
  readonly allowed: number[] = [];

  constructor(
    private readonly connects: readonly ConnectOutcome[],
    private readonly requests: readonly HttpOutcome[] = [],
  ) {}

  addresses(): readonly NetworkAddress[] {
    return [];
  }

  connect(_host: string, _port: number, timeoutMs: number): Promise<ConnectOutcome> {
    return this.answer(this.connects, timeoutMs);
  }

  request(_url: string, timeoutMs: number): Promise<HttpOutcome> {
    return this.answer(this.requests, timeoutMs);
  }

  lookup(): Promise<LookupOutcome> {
    return Promise.reject(new Error("not used"));
  }

  resolve(): Promise<LookupOutcome> {
    return Promise.reject(new Error("not used"));
  }

  private answer<T>(outcomes: readonly T[], timeoutMs: number): Promise<T> {
    this.allowed.push(timeoutMs);
    const outcome = outcomes[Math.min(this.allowed.length, outcomes.length) - 1];
    return outcome === undefined ? Promise.reject(new Error("nothing scripted")) : Promise.resolve(outcome);
  }
}

test("a port target is a port on this machine, host:port, [IPv6]:port or a URL, and --timeout stays within an hour", () => {
  assert.deepEqual(parsePortTarget("5432"), { host: "localhost", port: 5432 });
  assert.deepEqual(parsePortTarget("db.internal:5432"), { host: "db.internal", port: 5432 });
  assert.deepEqual(parsePortTarget("[::1]:8080"), { host: "::1", port: 8080 });
  assert.deepEqual(parsePortTarget("https://example.com"), { host: "example.com", port: 443 });
  for (const bad of ["0", "65536", "000080", "db", ""]) assert.equal(parsePortTarget(bad), null, bad);

  assert.deepEqual(waitPortSpec.input.parse(raw(["3000"])), {
    target: { host: "localhost", port: 3000 },
    gone: false,
    timeoutSeconds: 60,
  });
  assert.equal(waitPortSpec.input.parse(raw(["3000"], { gone: true, timeout: "3600" })).timeoutSeconds, 3600);
  assert.throws(() => waitPortSpec.input.parse(raw(["3000"], { timeout: "3601" })), UsageError);
  assert.throws(() => waitPortSpec.input.parse(raw(["3000"], { timeout: "0" })), UsageError);
  assert.throws(() => waitPortSpec.input.parse(raw(["nope"])), UsageError);
});

test("a url is http or https, and a status is ready when it is any 2xx or one --status names", () => {
  assert.equal(parseHttpAddress("http://localhost:3000/health"), "http://localhost:3000/health");
  assert.equal(parseHttpAddress("https://example.com"), "https://example.com/");
  for (const bad of ["ftp://example.com", "localhost:3000", "mailto:a@example.com", ""]) {
    assert.equal(parseHttpAddress(bad), null, bad);
  }
  assert.deepEqual(waitUrlSpec.input.parse(raw(["http://x.test/"], { status: ["200", "401"] })).statuses, [200, 401]);
  assert.throws(() => waitUrlSpec.input.parse(raw(["http://x.test/"], { status: ["20"] })), UsageError);
  assert.throws(() => waitUrlSpec.input.parse(raw(["http://x.test/"], { status: ["600"] })), UsageError);
  assert.throws(() => waitUrlSpec.input.parse(raw(["ftp://x.test/"])), UsageError);
  assert.deepEqual(
    [statusIsReady(204, []), statusIsReady(301, []), statusIsReady(503, []), statusIsReady(401, [401])],
    [true, false, false, true],
  );
});

test("wait commands only read, and url counts as sensitive because an address can carry text away", () => {
  for (const spec of [waitPortSpec, waitUrlSpec, waitFileSpec]) {
    assert.deepEqual([spec.safety, spec.idempotent, spec.runsUserCommands], ["read", true, false], spec.id);
  }
  assert.deepEqual([waitPortSpec.usesNetwork, waitUrlSpec.usesNetwork, waitFileSpec.usesNetwork], [true, true, false]);
  assert.deepEqual(
    [waitPortSpec.sensitive, waitUrlSpec.sensitive, waitFileSpec.sensitive],
    [undefined, true, undefined],
  );
  assert.equal(waitFileSpec.input.positionals[0]?.path, true);
});

test("a port that starts listening on the third attempt is ready after two half-second sleeps", async () => {
  const network = new ScriptedNetwork([REFUSED, REFUSED, OPEN]);
  const clock = new SteppingClock(1_000);
  const input = waitPortSpec.input.parse(raw(["5432"]));
  const result = expectDone(await new WaitForPort(network, clock).execute(input, commandContext("/")));
  assert.deepEqual(result.data, {
    host: "localhost",
    port: 5432,
    gone: false,
    ready: true,
    attempts: 3,
    waitedMs: 1_000,
    address: "127.0.0.1",
    failure: null,
    code: null,
  });
  assert.deepEqual(result.failures, []);
  assert.deepEqual(clock.sleeps, [500, 500]);
  assert.deepEqual(network.allowed, [2_000, 2_000, 2_000]);
});

test("a port that never listens times out with the last reason, and the last attempt still gets a quarter second", async () => {
  const network = new ScriptedNetwork([REFUSED]);
  const input = waitPortSpec.input.parse(raw(["db:5432"], { timeout: "1" }));
  const result = expectDone(await new WaitForPort(network, new SteppingClock(0)).execute(input, commandContext("/")));
  assert.deepEqual(
    [result.data.ready, result.data.attempts, result.data.waitedMs, result.data.failure],
    [false, 3, 1_000, "refused"],
  );
  assert.deepEqual(network.allowed, [1_000, 500, 250]);
  const reason = message("wait.reason.refused", { host: "db", code: "ECONNREFUSED" });
  assert.deepEqual(result.failures, [message("wait.port.timed-out", { target: "db:5432", seconds: 1, reason })]);
});

test("--gone waits until nothing listens, and says so when something still does", async () => {
  const gone = waitPortSpec.input.parse(raw(["3000"], { gone: true }));
  const closing = expectDone(
    await new WaitForPort(new ScriptedNetwork([OPEN, REFUSED]), new SteppingClock(0)).execute(
      gone,
      commandContext("/"),
    ),
  );
  assert.deepEqual(
    [closing.data.ready, closing.data.gone, closing.data.attempts, closing.data.failure],
    [true, true, 2, "refused"],
  );

  const briefly = waitPortSpec.input.parse(raw(["3000"], { gone: true, timeout: "2" }));
  const stuck = expectDone(
    await new WaitForPort(new ScriptedNetwork([OPEN]), new SteppingClock(0)).execute(briefly, commandContext("/")),
  );
  assert.equal(stuck.data.ready, false);
  assert.deepEqual(stuck.failures, [message("wait.port.still-listening", { target: "localhost:3000", seconds: 2 })]);
});

test("a url is ready on a 2xx or a status --status names, and times out naming the last status or failure", async () => {
  const url = "http://localhost:3000/health";
  const starting = new ScriptedNetwork(
    [],
    [{ ok: false, failure: "refused", code: "ECONNREFUSED", ms: 1 }, answered(503), answered(200)],
  );
  const ready = expectDone(
    await new WaitForUrl(starting, new SteppingClock(0)).execute(
      waitUrlSpec.input.parse(raw([url])),
      commandContext("/"),
    ),
  );
  assert.deepEqual([ready.data.ready, ready.data.attempts, ready.data.status], [true, 3, 200]);
  assert.deepEqual(starting.allowed, [5_000, 5_000, 5_000]);

  const signIn = waitUrlSpec.input.parse(raw([url], { status: ["401"] }));
  const unauthorised = expectDone(
    await new WaitForUrl(new ScriptedNetwork([], [answered(401)]), new SteppingClock(0)).execute(
      signIn,
      commandContext("/"),
    ),
  );
  assert.equal(unauthorised.data.ready, true);

  const briefly = waitUrlSpec.input.parse(raw([url], { timeout: "1" }));
  const busy = expectDone(
    await new WaitForUrl(new ScriptedNetwork([], [answered(503)]), new SteppingClock(0)).execute(
      briefly,
      commandContext("/"),
    ),
  );
  const status = message("wait.reason.status", { status: 503 });
  assert.deepEqual(busy.failures, [message("wait.url.timed-out", { url, seconds: 1, reason: status })]);

  const selfSigned: HttpOutcome = { ok: false, failure: "tls", code: "DEPTH_ZERO_SELF_SIGNED_CERT", ms: 1 };
  const secure = waitUrlSpec.input.parse(raw(["https://dev.test/"], { timeout: "1" }));
  const untrusted = expectDone(
    await new WaitForUrl(new ScriptedNetwork([], [selfSigned]), new SteppingClock(0)).execute(
      secure,
      commandContext("/"),
    ),
  );
  const tls = message("wait.reason.tls", { host: "dev.test", code: "DEPTH_ZERO_SELF_SIGNED_CERT" });
  assert.deepEqual(untrusted.failures, [
    message("wait.url.timed-out", { url: "https://dev.test/", seconds: 1, reason: tls }),
  ]);
});

test("an interrupted wait stops with InterruptedError, before an attempt or after a sleep", async () => {
  const input = waitPortSpec.input.parse(raw(["5432"]));
  const stopped = new AbortController();
  stopped.abort();
  const never = new ScriptedNetwork([REFUSED]);
  await assert.rejects(
    new WaitForPort(never, new SteppingClock(0)).execute(input, { ...commandContext("/"), signal: stopped.signal }),
    InterruptedError,
  );
  assert.deepEqual(never.allowed, []);

  const later = new AbortController();
  const clock = new SteppingClock(0, () => {
    later.abort();
    return Promise.resolve();
  });
  const once = new ScriptedNetwork([REFUSED]);
  await assert.rejects(
    new WaitForPort(once, clock).execute(input, { ...commandContext("/"), signal: later.signal }),
    InterruptedError,
  );
  assert.equal(once.allowed.length, 1);
});
