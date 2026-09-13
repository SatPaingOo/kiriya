# Writing a kiriya plugin

A plugin adds a module to kiriya: `kiriya <plugin> <command>`, with help, `--json`,
confirmations and exit codes that work exactly as they do for built-in modules.
[`examples/plugins/hello`](../examples/plugins/hello/index.js) is a complete plugin in
one file; read it alongside this page.

## Trust

A plugin is ordinary JavaScript that kiriya imports into its own process. It runs with
your permissions and can do anything you can. kiriya does not sandbox it. Read a plugin
before you list it in your configuration, as you would any program you install.

## Using a plugin

1. Install it: `npm install --global kiriya-plugin-example` puts it next to a global
   kiriya, or keep a plugin in a folder of your own.
2. List it: `kiriya config set plugins kiriya-plugin-example ./team/kiriya-plugin`.
   A package name is looked up in `node_modules` folders above kiriya and above the
   configuration file; a path is relative to the configuration file's folder.
3. Check it: `kiriya doctor` lists every loaded plugin with its version and location,
   and every plugin that failed to load with the reason.

A plugin that cannot be found, imported or checked is skipped, and the rest of kiriya
keeps working. `kiriya doctor` then exits with 1 until the problem is fixed.

## The contract

The plugin's entry file is an ES module. For a folder, the entry is the `"."` export in
its `package.json`, then `"main"`, then `index.js`. Its default export is an object:

| Field | What it must be |
|---|---|
| `id` | Lower-case letters, digits and hyphens, starting with a letter. It is the module name on the command line, so it must not be taken by a built-in module, another plugin, or `core`, `help` or `version`. |
| `summary` | A message key for one line of help about the module |
| `messages` | The English text of every message key the plugin uses. Each key starts with `<id>.`. Text may hold `{name}` placeholders. |
| `register(registrar, ports)` | Calls `registrar.add(command, view)` once per command |

A module whose single command has the id `<id>` itself runs as `kiriya <id>`; otherwise
command ids are `<id>.<verb>` and run as `kiriya <id> <verb>`. When `register` throws, or
adds a command with an id that does not belong to the plugin, none of its commands are
registered.

### A command

```js
const greet = {
  spec: {
    id: "hello.greet",
    summary: "hello.greet.summary",
    examples: ["kiriya hello greet Mya"],
    safety: "read", // read, write or destroy: the most the command can do with any flags
    idempotent: true,
    usesNetwork: false,
    runsUserCommands: false,
    input: {
      positionals: [{ name: "name", description: "hello.greet.arg.name", required: false, variadic: false }],
      options: { shout: { type: "boolean", description: "hello.greet.option.shout" } },
      parse: (raw) => ({ name: raw.positionals[0] ?? "world", shout: raw.options.shout === true }),
    },
  },
  execute: async (input, context) => ({ kind: "done", data: { name: input.name }, warnings: [], failures: [] }),
};
```

- `input.parse` receives the checked arguments as `{ positionals, options }` and returns
  the command's input. Throwing there is reported as a usage error.
- `execute(input, context)` does the work and returns a result. It never prints.
  - `{ kind: "done", data, warnings, failures }`: warnings and failures are messages,
    `{ key, params }`. Any failure makes kiriya exit with 1.
  - `{ kind: "preview", data, applyFlag, warnings }`: nothing changed, and `applyFlag`,
    such as `"--apply"`, is the flag that would make the change.
- `context.cwd` is the working folder, and `context.signal` aborts on Ctrl+C.
- `context.confirmation.approve(question, assumeYes)` asks a yes-or-no question for
  work that can be undone. For work that cannot, `context.confirmation.typed(warning,
  expected, provided)` asks for a typed value, and `--yes` must never stand in for it.
- `context.passthrough.write(text, stream)` passes on the live output of a program the
  command runs.

`data` is the command's JSON output, so treat its shape as a public contract.

### A view

```js
const greetView = (output, format) => [format.text({ key: "hello.greet.text", params: { name: output.name } })];
```

A view turns `data` into lines of text. `format` translates messages and offers `bold`,
`dim`, `red`, `green`, `yellow`, `bytes(count)`, `time(epochMs)` and `path(absolutePath)`.

### Ports

`register` receives the same ports built-in modules use: `fileSystem`, `fileContent`,
`hasher`, `compression`, `processRunner`, `trash`, `environment`, `clock`,
`protectedPaths`, `config`, `plugins` and `runtime`. [ARCHITECTURE.md](../ARCHITECTURE.md#ports)
describes each one. Using them rather than Node.js directly is what keeps a plugin's
behaviour the same on Windows, Linux and macOS: errors arrive as the same typed errors,
programs start without a shell, and protected paths are refused the same way.

## Not yet

- Types for plugin authors. They come as a separate `@kiriya/sdk` package once plugin
  authors need them (BLUEPRINT.md section 6.9).
- Settings that belong to a plugin, and messages in languages other than English.
