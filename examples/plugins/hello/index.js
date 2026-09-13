/**
 * An example kiriya plugin with one command: `kiriya hello greet [name]`.
 *
 * A plugin runs inside kiriya with your permissions, like any program you install.
 * Read a plugin before you list it in your configuration. docs/plugins.md describes
 * the contract this file follows.
 */

const greet = {
  spec: {
    id: "hello.greet",
    summary: "hello.greet.summary",
    examples: ["kiriya hello greet", "kiriya hello greet Mya --shout", "kiriya hello greet Mya --json"],
    safety: "read",
    idempotent: true,
    usesNetwork: false,
    runsUserCommands: false,
    input: {
      positionals: [{ name: "name", description: "hello.greet.arg.name", required: false, variadic: false }],
      options: { shout: { type: "boolean", description: "hello.greet.option.shout" } },
      parse: (raw) => ({ name: raw.positionals[0] ?? "world", shout: raw.options.shout === true }),
    },
  },

  // A command computes a result and never prints; kiriya renders it as text or JSON.
  execute: (input) =>
    Promise.resolve({ kind: "done", data: { name: input.name, shout: input.shout }, warnings: [], failures: [] }),
};

/** Text for people. Messages are keys into this plugin's own catalog below. */
const greetView = (output, format) => {
  const text = format.text({ key: "hello.greet.text", params: { name: output.name } });
  return [output.shout ? text.toUpperCase() : text];
};

export default {
  id: "hello",
  summary: "hello.summary",
  messages: {
    "hello.summary": "An example plugin that says hello",
    "hello.greet.summary": "Say hello",
    "hello.greet.arg.name": "Who to greet; world by default",
    "hello.greet.option.shout": "Say it in capitals",
    "hello.greet.text": "Hello, {name}!",
  },
  register(registrar) {
    registrar.add(greet, greetView);
  },
};
