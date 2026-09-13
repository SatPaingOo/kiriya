# Architecture

How kiriya's code is organised today. [BLUEPRINT.md](./BLUEPRINT.md) explains why, and
what comes next; this file describes what exists and how to extend it.

## One command, end to end

```text
argv ─► CliApplication ─► CommandRegistry ─► InputSchema.parse ─► Command.execute ─► CommandResult
                                                                        │                  │
                                                          ports: FileSystem, Trash,   text view or JSON,
                                                          ProcessRunner, Config, ...  then the exit code
```

1. `src/main.ts` builds the adapters for the current operating system and registers
   every module listed in `src/config/modules.ts`. It then reads the configuration file
   and loads the plugins it lists, which register the same way.
2. `CliApplication` takes out the global flags (`--json`, `--no-color`, `--no-input`,
   `--debug`, `--help`, `--version`), finds the module and the verb, and parses the rest
   with `node:util` `parseArgs` against the command's `InputSchema`.
3. `InputSchema.parse` turns raw strings into the command's typed input, or throws
   `UsageError`.
4. `Command.execute` does the work through ports and returns a `CommandResult`: `done`
   with data, warnings and failures, or `preview` for a dry run. It never prints.
5. Presentation prints the result: the command's text view on stdout with warnings and
   failures on stderr, or a single JSON document on stdout with `--json`.
6. Errors are typed. `CliApplication` maps them to exit codes in one place.

## Layers

| Layer | Holds | May import |
|---|---|---|
| `domain` | Types, pure rules, port interfaces, typed errors | `domain`, catalog types |
| `application` | Use cases, one per command, and services built on ports | `domain`, `application`, `config` data, `node:path` |
| `infrastructure` | Adapters, one per port | `domain`, `infrastructure`, `config` data, any `node:` module |
| `presentation` | argv, help, text views, JSON, prompts, exit codes | `domain`, `application`, `presentation`, `node:` modules |

The layers exist once in `src/core` and again inside each module. Three more rules:

- A module never imports another module, and core never imports a module. What two
  modules share, such as walking a folder or expanding a glob, lives in core.
- Only `src/main.ts` constructs adapters and imports the message catalog as a value.
- There are no runtime dependencies: every import is a relative file or a `node:` built-in.

`tools/check-boundaries.ts` enforces all of these rules, and `npm test` runs it.

## Where things are

```text
src/
├── main.ts                       composition root: adapters, built-in modules, then plugins
├── config/                       data: modules, config keys, protected paths, dependency folders, clean rules
├── i18n/locales/en.ts            the message catalog; MessageKey is derived from it
├── core/
│   ├── domain/                   command, module, errors, message, input-schema, view, glob, names,
│   │                             text-case, encodings, secrets, global-options, ports/, values/
│   ├── application/              command-registry, plugin-loader, config-values, path-guard, walk, paths, safety, process-ending, text-input
│   ├── infrastructure/
│   │   ├── node/                 file system and content, hasher, compression, process runner,
│   │   │                         config file and location, plugin source, environment, clock,
│   │   │                         random source, standard input, system info, network
│   │   └── platform/             windows/, linux/, macos/: trash, process and port tables, clipboard, opener
│   └── presentation/
│       ├── cli/                  cli-application, argv, help, style, terminal-confirmation, json-output
│       ├── i18n/                 translator
│       ├── list-preview.ts       "… and N more" for long lists in views
│       └── ended-processes.ts    one line per ended process, and aligned columns
└── modules/
    ├── files/                    new list tree info read find grep hash dupes compare copy move rename replace delete clean sync size
    ├── archive/                  zip unzip tar untar
    ├── git/                      status fetch pull switch, across every repository under a folder
    ├── docker/                   ps up down logs rebuild clean, for the compose project in the current folder
    ├── config/                   path keys list get set unset
    ├── doctor/                   one command: kiriya doctor
    ├── gen/                      uuid ulid password token
    ├── convert/                  base64 hex url json jwt time case, from an argument, stdin or a file
    ├── env/                      show path check: variables with secrets hidden, PATH problems, .env against .env.example
    ├── sys/                      info tools report
    ├── net/                      ip check dns
    ├── port/                     who kill free
    ├── proc/                     list find kill tree
    ├── clip/                     copy paste
    ├── open/                     one command: kiriya open <file|folder|url>
    └── completion/               kiriya completion <shell>, and suggest, which the scripts ask
examples/plugins/hello/           a complete plugin in one file
docs/plugins.md                   the plugin contract
tests/
├── unit/                         pure logic and use cases with fakes: core/, files/, archive/, git/, docker/, config/, doctor/, gen/, convert/, env/, sys/, net/, port/, proc/, clip/, open/, completion/
├── integration/                  use cases with real adapters: a real file system, real git repositories
├── contract/                     one suite per port, run against its adapters
├── e2e/                          the built CLI as a black box
└── support/                      fakes, temporary folders, and a runner for the built CLI
tools/                            boundaries.ts and check-boundaries.ts
```

Each module has `<module>.module.ts`, which registers its commands with their views,
and the layer folders it needs. Use cases are `application/<verb>-<noun>.use-case.ts`
with their `CommandSpec`. Views are `presentation/<verb>.view.ts`, or, for a module
whose views are small, one `presentation/<module>.views.ts`.

## Contracts

### Commands

A command is a class implementing `Command<Input, Output>` with a `CommandSpec<Input>`:

| Field | Meaning |
|---|---|
| `id` | `<module>.<verb>`, such as `files.delete`; or `<module>` alone for a module that is one command, such as `doctor` |
| `summary` | Catalog key for help |
| `input` | `InputSchema`: positionals, options, and `parse(raw)` into the typed input |
| `examples` | Shown in help |
| `safety` | `read`, `write` or `destroy`: the most the command can do with any flags |
| `idempotent`, `usesNetwork`, `runsUserCommands` | Facts the future MCP server exposes and filters on |

`execute(input, context)` receives a `CommandContext`:

| Field | Meaning |
|---|---|
| `cwd` | The working folder; resolve every path against it |
| `confirmation` | Asks the person running the command, or refuses when nobody can be asked |
| `passthrough` | Where the live output of a program the command runs goes, such as a docker build: the matching stream in a terminal, and stderr with `--json` so stdout stays one document |
| `signal` | Aborts on Ctrl+C; a program started with it is stopped |

The text view, a `TextView<Output>` function, formats through `ViewFormat`:
translation, colour, sizes, times, and paths relative to the working folder.

### Messages

Every user-facing string is a key in `src/i18n/locales/en.ts`, with `{name}` placeholders.
Code passes `Message` values, `{ key, params }`, and a parameter can itself be a message.
Text output translates them. JSON output keeps the key and parameters and adds the text,
so scripts can match on keys and never on wording. A test fails on any catalog key the
source does not use, and TypeScript fails on any key the catalog does not have. Plugins
bring the text of their own keys, which the translator adds to kiriya's catalog.

### Errors and exit codes

| Error | Kind | Exit code |
|---|---|---|
| Success | | 0 |
| A `done` result with failures, such as a difference `files compare` found or a repository `git pull` could not update | | 1 |
| `NotFoundError`, `ConflictError`, `RefusedError`, `CapabilityUnavailableError`, `OperationFailedError` | `not-found`, `conflict`, `refused`, `capability-unavailable`, `failed` | 1 |
| `UsageError` | `usage` | 2 |
| `InterruptedError`, or Ctrl+C during a command | `interrupted` | 130 |
| Anything else: a bug | `unexpected` | 1; `--debug` shows the stack |

Adapters wrap Node.js and operating-system errors in these types before they reach a
use case, so no errno code leaves `infrastructure`.

### JSON output

```json
{
  "ok": true,
  "command": "files.find",
  "kind": "done",
  "data": {},
  "warnings": [],
  "failures": []
}
```

A preview adds `"applyFlag"`. An error prints
`{ "ok": false, "error": { "kind": "not-found", "message": { "key": "...", "params": {}, "text": "..." } } }`.
Prompts and warnings go to stderr, so stdout stays one parseable document.

### Safety

| Level | Rule |
|---|---|
| `read` | Changes nothing |
| `write` | Never replaces something that exists without an explicit flag |
| `destroy` | Needs a typed confirmation: typed at the prompt, or `--confirm=<value>` in a script. `--yes` never counts. With no terminal and no `--confirm`, the command is refused |

`src/core/application/safety.ts` holds the three checks every command uses:
`refuseProtected` sends targets through the `ProtectedPaths` port, which refuses drive
roots, the home folder, the working folder and its parents, and operating-system
folders; `requireApproval` asks a yes-or-no question; `requireTypedConfirmation` asks for
the typed value, and stops before any prompt when a script's `--confirm` does not match.

Commands that change many things preview first: `rename`, `replace`, `clean`,
`files sync` and `docker clean` change nothing without `--apply`, and `copy`, `move` and
`delete` accept `--dry-run`.

### Ports

| Port | What it does | Adapters |
|---|---|---|
| `FileSystem` | Paths, folders and metadata: stat, list, create, copy, move, remove, times and permission bits | `NodeFileSystemAdapter` |
| `FileContent` | Bytes inside files: read, write, positioned reads, exclusive creation | `NodeFileContentAdapter` |
| `Hasher` | File digests read in chunks | `NodeHasherAdapter` |
| `Compression` | Raw deflate, as ZIP stores it, and gzip streams, as .tar.gz stores them | `NodeCompressionAdapter` |
| `ProcessRunner` | Find a program on PATH and run it without a shell, capturing or streaming its output | `NodeProcessRunnerAdapter` |
| `Trash` | The operating system's trash | `WindowsTrashAdapter` (Recycle Bin through PowerShell), `FreedesktopTrashAdapter`, `MacosTrashAdapter` |
| `ConfigStore` | The user's configuration file | `JsonConfigStore` |
| `PluginSource` | Find a plugin named in the configuration and import it | `NodePluginSource` |
| `PluginInventory` | The plugins this run loaded, and the ones it could not | `PluginLoader` in core application |
| `Confirmation` | Questions to the person running the command | `TerminalConfirmation` in presentation |
| `Environment`, `Clock` | The OS, the home folder, variables; the time | `NodeEnvironmentAdapter`, `SystemClockAdapter` |
| `RandomSource` | Cryptographically secure random bytes; tests inject predictable ones | `NodeRandomSource` |
| `StandardInput` | What is piped in, read to the end with a size limit, and whether a person is typing instead | `NodeStandardInput` |
| `SystemInfo` | The OS name and kernel, processor, memory, uptime, host name, locale and time zone | `NodeSystemInfoAdapter`: os-release on Linux, `sw_vers` on macOS |
| `Network` | This machine's addresses, a TCP connection out, the system resolver and DNS queries | `NodeNetworkAdapter` |
| `ProcessTable` | Every process, with parent ids and command lines when asked; ending processes; the ids never to end | `WindowsProcessTableAdapter` (`tasklist`, or `Get-CimInstance` for details), `LinuxProcessTableAdapter` (`/proc`), `MacosProcessTableAdapter` (`ps`) |
| `PortTable` | Listening TCP sockets and their owners, and whether a port can be opened | `WindowsPortTableAdapter` (`netstat -ano`), `LinuxPortTableAdapter` (`/proc/net/tcp`), `MacosPortTableAdapter` (`netstat` and `lsof`) |
| `Clipboard` | Text to and from the system clipboard, and what serves it here | `WindowsClipboardAdapter` (`Set-Clipboard` through PowerShell), `LinuxClipboardAdapter` (`wl-clipboard`, `xclip` or `xsel`), `MacosClipboardAdapter` (`pbcopy` with a UTF-8 locale) |
| `Opener` | A file, folder or web address handed to the application the OS chooses | `WindowsOpenerAdapter` (`explorer.exe`), `LinuxOpenerAdapter` (`xdg-open`), `MacosOpenerAdapter` (`open`) |
| `CommandCatalog` | Every registered module and command with its spec, plugins included | `CommandRegistry` in core application |
| `ProtectedPaths` | Paths no command may delete, move or overwrite | `PathGuard` in core application |

`src/main.ts` is the only place that chooses an adapter by operating system.

## Configuration

One JSON file per user holds kiriya's own settings. It is found at:

| Windows | Linux | macOS |
|---|---|---|
| `%APPDATA%\kiriya\config.json` | `$XDG_CONFIG_HOME/kiriya/config.json`, by default `~/.config/kiriya/config.json` | `~/Library/Application Support/kiriya/config.json` |

`KIRIYA_CONFIG` names another file. Values are text or lists of text, and the settings
kiriya reads are listed in `src/config/config-keys.ts`. A file that is not valid names
the file and the field; while it is broken, no plugins load, every built-in command
still works, and `kiriya doctor` reports the problem. The file never holds a secret:
`kiriya config set` refuses values that look like one.

## Plugins

A plugin is a module that lives outside kiriya: an npm package or a local folder, listed
in the `plugins` setting. `PluginLoader` imports each one through `PluginSource`, checks
its shape, refuses an id that is already taken, and registers its commands, so they run
exactly like built-in ones. A plugin that fails any step is recorded and skipped.
[docs/plugins.md](./docs/plugins.md) is the contract for plugin authors.

## Extending kiriya

### A command

1. Add its keys to `src/i18n/locales/en.ts`: summary, argument and option descriptions,
   and output lines.
2. Write `src/modules/<module>/application/<verb>-<noun>.use-case.ts`: input and output
   types, the `CommandSpec`, and a class whose constructor takes only the ports it needs.
3. Write its view in `src/modules/<module>/presentation/`.
4. Register both in `<module>.module.ts`.
5. Test it. Cover the judgement calls, and give every refusal a negative test.

### A module

Create `src/modules/<name>/` with `<name>.module.ts` and the layer folders it needs, then
add one line to `src/config/modules.ts`.

### A port or an adapter

Declare the interface in `src/core/domain/ports/`, implement it in
`src/core/infrastructure/node/` or `platform/<os>/`, add it to `CorePorts`, construct it in
`src/main.ts`, and run the port's suite in `tests/contract/` against the new adapter.

### A setting

Add an entry to `src/config/config-keys.ts` with its type and a catalog key describing it.

## Behaving the same on every OS

- Resolve paths with `node:path` against `context.cwd`, never `process.cwd()`.
- kiriya expands globs itself, so a quoted pattern means the same in PowerShell, cmd and bash.
- Sort by code point, not `localeCompare`.
- New names must be valid on Windows, Linux and macOS alike: `invalidNameReason` checks them.
- Start programs with an argument array through `ProcessRunner`, never a shell string.
- Times are whole milliseconds since the epoch. Text keeps the encoding it was read in.
