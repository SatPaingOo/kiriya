# Architecture

How kiriya's code is organised today. [BLUEPRINT.md](./BLUEPRINT.md) explains why, and
what comes next; this file describes what exists and how to extend it.

## One command, end to end

```text
argv ─► CliApplication ─► CommandRegistry ─► InputSchema.parse ─► Command.execute ─► CommandResult
                                                                        │                  │
                                                          ports: FileSystem, Trash,   text view or JSON,
                                                          Confirmation, Clock, ...    then the exit code
```

1. `src/main.ts` builds the adapters for the current operating system, registers every
   module listed in `src/config/modules.ts`, and hands argv to `CliApplication`.
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
├── main.ts                       composition root
├── config/                       data: modules, protected paths, dependency folders, clean rules, rebuildable folders
├── i18n/locales/en.ts            the message catalog; MessageKey is derived from it
├── core/
│   ├── domain/                   command, module, errors, message, input-schema, view, glob, names, ports/, values/
│   ├── application/              command-registry, path-guard, walk, paths (expand, outermost, measure), safety
│   ├── infrastructure/
│   │   ├── node/                 file system, file content, hasher, compression, process runner, environment, clock
│   │   └── platform/             windows/, linux/, macos/: one trash adapter each
│   └── presentation/
│       ├── cli/                  cli-application, argv, help, style, terminal-confirmation, json-output
│       ├── i18n/                 translator
│       └── list-preview.ts       "… and N more" for long lists in views
└── modules/
    ├── files/                    new list tree info read find grep hash dupes compare copy move rename replace delete clean sync size
    │   ├── files.module.ts       registers each command with its view
    │   ├── domain/               sizes and times, text encodings, case styles, extension lists, sync plans
    │   ├── application/          <verb>-<noun>.use-case.ts with its CommandSpec; transfers, move-entry, text-files
    │   └── presentation/         <verb>.view.ts
    └── archive/                  zip unzip
        ├── archive.module.ts
        ├── domain/               crc32, zip-format: headers and the central directory as pure functions over bytes
        ├── application/          create-zip, extract-zip, zip-reader
        └── presentation/         zip.view.ts, unzip.view.ts
tests/
├── unit/                         pure logic, no file system: core/, files/, archive/, i18n/, tools/
├── integration/                  use cases on a real file system in temporary folders
├── contract/                     one suite per port, run against its adapters
├── e2e/                          the built CLI as a black box
└── support/                      fakes, temporary folders, and a runner for the built CLI
tools/                            boundaries.ts and check-boundaries.ts
```

## Contracts

### Commands

A command is a class implementing `Command<Input, Output>` with a `CommandSpec<Input>`:

| Field | Meaning |
|---|---|
| `id` | `<module>.<verb>`, such as `files.delete` |
| `summary` | Catalog key for help |
| `input` | `InputSchema`: positionals, options, and `parse(raw)` into the typed input |
| `examples` | Shown in help |
| `safety` | `read`, `write` or `destroy`: the most the command can do with any flags |
| `idempotent`, `usesNetwork`, `runsUserCommands` | Facts the future MCP server exposes and filters on |

The spec lives in the same file as the use case. The text view, a
`TextView<Output>` function, lives in `presentation/<verb>.view.ts` and formats through
`ViewFormat`: translation, colour, sizes, times, and paths relative to the working folder.

### Messages

Every user-facing string is a key in `src/i18n/locales/en.ts`, with `{name}` placeholders.
Code passes `Message` values, `{ key, params }`, and a parameter can itself be a message.
Text output translates them. JSON output keeps the key and parameters and adds the text,
so scripts can match on keys and never on wording. A test fails on any catalog key the
source does not use, and TypeScript fails on any key the catalog does not have.

### Errors and exit codes

| Error | Kind | Exit code |
|---|---|---|
| Success | | 0 |
| A `done` result with failures, including a difference found by `files compare` or `files hash --check` | | 1 |
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

Commands that change many things preview first: `rename`, `replace`, `clean` and `sync`
change nothing without `--apply`, and `copy`, `move` and `delete` accept `--dry-run`.

### Ports

| Port | What it does | Adapters |
|---|---|---|
| `FileSystem` | Paths, folders and metadata: stat, list, create, copy, move, remove | `NodeFileSystemAdapter` |
| `FileContent` | Bytes inside files: read, write, positioned reads, exclusive creation | `NodeFileContentAdapter` |
| `Hasher` | File digests read in chunks | `NodeHasherAdapter` |
| `Compression` | Raw deflate, as ZIP stores it | `NodeCompressionAdapter` |
| `ProcessRunner` | Find a program on PATH and run it without a shell | `NodeProcessRunnerAdapter` |
| `Trash` | The operating system's trash | `WindowsTrashAdapter` (Recycle Bin through PowerShell), `FreedesktopTrashAdapter`, `MacosTrashAdapter` |
| `Confirmation` | Questions to the person running the command | `TerminalConfirmation` in presentation |
| `Environment`, `Clock` | The OS, the home folder, variables; the time | `NodeEnvironmentAdapter`, `SystemClockAdapter` |
| `ProtectedPaths` | Paths no command may delete, move or overwrite | `PathGuard` in core application |

`src/main.ts` is the only place that chooses an adapter by operating system.

## Extending kiriya

### A command

1. Add its keys to `src/i18n/locales/en.ts`: summary, argument and option descriptions,
   and output lines.
2. Write `src/modules/<module>/application/<verb>-<noun>.use-case.ts`: input and output
   types, the `CommandSpec`, and a class whose constructor takes only the ports it needs.
3. Write `src/modules/<module>/presentation/<verb>.view.ts`.
4. Register both in `<module>.module.ts`.
5. Test it. Cover the judgement calls, and give every refusal a negative test.

### A module

Create `src/modules/<name>/` with `<name>.module.ts` and the layer folders it needs, then
add one line to `src/config/modules.ts`.

### A port or an adapter

Declare the interface in `src/core/domain/ports/`, implement it in
`src/core/infrastructure/node/` or `platform/<os>/`, add it to `CorePorts`, construct it in
`src/main.ts`, and run the port's suite in `tests/contract/` against the new adapter.

## Behaving the same on every OS

- Resolve paths with `node:path` against `context.cwd`, never `process.cwd()`.
- kiriya expands globs itself, so a quoted pattern means the same in PowerShell, cmd and bash.
- Sort by code point, not `localeCompare`.
- New names must be valid on Windows, Linux and macOS alike: `invalidNameReason` checks them.
- Start programs with an argument array through `ProcessRunner`, never a shell string.
- Times are whole milliseconds since the epoch. Text keeps the encoding it was read in.
