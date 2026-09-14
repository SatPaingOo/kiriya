# Design

Why kiriya is built the way it is: what it is for, the rules every command follows, what is
in and out of scope, the code standards, the key decisions and the roadmap.
[Architecture](architecture.md) describes the code as it is today, and
[Research](research.md) holds the evidence behind these choices.

## What kiriya is

**One command-line toolbox for everyday developer work that behaves the same on Windows,
Linux and macOS.**

| | |
|---|---|
| For | Any developer, on any stack, on any of the three operating systems |
| Replaces | Remembering `del` and `rm`, `netstat -ano` and `lsof -i`, `clip` and `pbcopy`, `findstr` and `grep`, and writing one-off scripts for each |
| Also serves | AI agents, through MCP, under the same safety rules a person gets |
| Is not | A shell, a package manager, a cloud CLI, a GUI, or a security testing kit |

The closest tools ([research](research.md#6-similar-all-in-one-projects)): Bun Shell and
Deno's task shell give the same commands on every OS, but only inside scripts for their own
runtimes; PowerShell 7 runs everywhere but is a language of its own; Nushell has many of these
built-ins but means switching shells; DevToys and IT-Tools are converters with a GUI; uutils
and busybox-w32 port Unix commands without previews, trash or JSON; DesktopCommanderMCP gives
agents terminal and file tools. kiriya is one dependency-free CLI for the shell a developer
already uses, with the same safety model for people and agents.

## Constraints

| Constraint | What it forces |
|---|---|
| **Free to build, use and run** | MIT licence, free CI, public registries. No service kiriya depends on at runtime. |
| **Zero runtime dependencies** | Argument parsing, input schemas, archives and the MCP protocol are written in-house. The supply chain of a tool that deletes files is Node.js itself. Development dependencies are allowed. |
| **Identical behaviour on three operating systems** | No shell. Every OS difference sits behind a port with one adapter per OS. Every test runs on all three in CI. |
| **Safe by default** | Preview before bulk changes, trash instead of delete, typed confirmation for anything permanent, protected paths. |
| **Offline** | No network access except in commands whose purpose is the network. No telemetry. |
| **A small maintainer team** | Rules are enforced by tests and CI, not by reviewers remembering them. |

## The riskiest assumption

> Process, port, clipboard and trash operations can be made to behave identically on Windows,
> Linux and macOS through thin OS adapters without runtime dependencies, and stay reliable in
> CI on all three.

**Answer, 2026-09-13: yes, for every case CI can reach.** Port lookup, process lookup,
clipboard and trash passed on Windows Server 2025, Ubuntu 24.04 and macOS 26, each on Node 22
and 24, with Myanmar text in every file name and clipboard sample. Windows is the slow
platform: its PowerShell-based operations took about 0.6 s warm and up to 5 s on the first
call, against under 100 ms on Linux and macOS. The results are in `spike/README.md` on the
`spike/phase-0` branch.

Still unverified, because CI cannot reach them ([research](research.md#7-os-adapters)): trash
on a Mac without Full Disk Access, Finder's Put Back, and a real AppLocker or WDAC policy,
which blocks the Windows trash path.

## Product rules

1. **Same command, same result, on every OS.** A difference is a bug, or it is documented in
   the command's help together with its reason.
2. **Safe by default.** Read-only unless told otherwise. Bulk changes preview first. Delete
   goes to the trash. Anything permanent needs the user to type what will be destroyed, and
   `--yes` never replaces that.
3. **Every command has human output and `--json`.** Data goes to stdout, messages and prompts
   to stderr.
4. **One command, three surfaces.** The same use case runs from the CLI, from MCP and from a
   plugin, with the same safety level.
5. **No shell, no hidden network, no telemetry.**
6. **English first, translatable later.** Every user-facing message is a key in one English
   locale file, so adding a language needs no code change. Other locales, Myanmar first, come
   after the first release; terminals do not yet shape complex scripts such as Myanmar
   correctly ([research](research.md#2-cli-design-guidelines)).
7. **Explicit over inferred.** Plugins load only when configured, never by scanning
   `node_modules`. A capability a machine lacks is reported, never guessed.

## Scope

### Built

The modules in the [module list](../modules/README.md), the MCP server and plugins.

### Next

Each item needs an issue with a design before work starts.

| Module or command | What |
|---|---|
| `serve` | Serve a folder over HTTP, bound to localhost only |
| `watch` | Run a command when files change, debounced |
| `json` | Query and select from JSON: a documented subset of jq |
| `files diff` | Line diff of two text files |
| `files tail` | Follow a growing file |
| `task` | List and run scripts from `package.json`, `Makefile`, `justfile`, `*.csproj` and `pyproject.toml` through one command |
| `self-update` | Check the registry for a newer version and update |

### Candidates from research

Ranked in [research](research.md#1-tools-developers-already-reach-for) by usefulness and by
the adoption of the tools that do each job today.

| Rank | Command | What | Safety | Network | When |
|---|---|---|---|---|---|
| 1 | `secrets scan` | Find committed secrets in a repository's files and history | read | no | next |
| 2 | `wait` | Wait until a port listens, a URL answers or a file appears, with a timeout | read | for URLs only | built |
| 3 | `loc` | Lines of code by language | read | no | next |
| 4 | `git hooks` | List, install and remove git hooks across repositories | write | no | next |
| 5 | `http` | Send an HTTP request and print the response, with `--json` | read | yes | later |
| 6 | `bench` | Time repeated runs of a command, with statistics | runs a user command | no | later |
| 7 | `json` over YAML, TOML and CSV | The same queries over more formats | read | no | later: dependency-free parsers are the cost |
| 8 | `git commit-lint`, `git changelog` | Check Conventional Commits and draft a changelog | read, write | no | later |
| 9 | `serve --mock` | A REST API from a JSON file, on localhost | read | no | later |
| 10 | `audit` | Look dependencies up in the OSV vulnerability database | read | yes | later |
| 11 | `licenses` | Dependency licence inventory across ecosystems | read | no | later |
| 12 | `cert inspect` | Subject, issuer and expiry of a certificate file or host | read | for hosts | later; installing into trust stores stays out of scope |
| 13 | `qr` | Print a QR code, for example of a `serve` URL | read | no | later |
| 14 | `convert cron` | Explain a cron expression and list its next run times | read | no | later |
| 15 | `cheat` | Cached tldr pages | read | yes | not planned: it needs a download cache of third-party content |

A command that runs a program the user names (`task`, `watch`, `bench`) is marked
`runsUserCommands` in its spec and is never exposed over MCP.

### What belongs in a plugin

kiriya holds only what every developer needs. A tool that serves one stack, one product or
one organisation is a [plugin](../guides/plugins.md):

| Kind | Example |
|---|---|
| One database engine | Backup and restore helpers for SQL Server, PostgreSQL or MySQL |
| One framework or ORM | Scaffolding for an ORM, a code generator for a framework's controllers |
| One organisation | Internal project templates, naming checks, deployment steps |

### Non-goals

| Out of scope | Reason |
|---|---|
| Anything needing administrator rights or changing system settings: hosts file, firewall, services, registry, drivers | Security; users should make those changes knowingly and directly |
| Wrapping package managers such as `winget`, `apt`, `brew` or `choco` | Too many variants to keep reliable |
| Cloud provider CLIs | They exist and change constantly |
| Offensive security tools | Not part of an everyday developer toolbox, and dual-use |
| Installing certificates into system or browser trust stores | Needs administrator rights on some systems; `cert inspect` would only read |
| Replacing `git` or `docker` command for command | Both already work on every OS; kiriya adds only multi-repository, multi-project and safety value |
| A GUI or TUI | The CLI and MCP are the product |
| Telemetry of any kind | Product rule 5 |

## Architecture decisions

[Architecture](architecture.md) shows the layers, folders, contracts and ports. These are the
reasons behind them.

### Layers inside each module

The four layers, `domain`, `application`, `infrastructure` and `presentation`, sit inside
each module rather than once for the whole repository, because each tool changes for its own
reasons and a plugin must have the same shape as a built-in module. A module never imports
another module, and only `src/main.ts` constructs adapters. `node:path` is allowed in
`application` because it is pure string arithmetic whose rules differ by OS, and
reimplementing it would be the kind of drift kiriya exists to remove.

### OS adapters

Three operating systems mean three real implementations from the start, so these ports are
not premature abstractions. Chosen after the adapter research in
[research](research.md#7-os-adapters):

| Port | Windows | Linux | macOS |
|---|---|---|---|
| `Trash` | PowerShell checks its language mode first, then `SHFileOperation` with `FOF_ALLOWUNDO`, fixed drives only. Under Constrained Language Mode, a missing capability that suggests `--permanent` | The freedesktop.org trash specification with `node:fs`: the home trash, or `$topdir/.Trash-$uid` on other mounts | `/usr/bin/trash` on macOS 15 and later; otherwise a move into `~/.Trash`, warning that Put Back will not work |
| `Clipboard` | `Set-Clipboard` and `Get-Clipboard` through PowerShell; never `clip.exe`, which garbles UTF-8 | `wl-copy`, then `xclip`, then `xsel`; without a display, a missing capability | `pbcopy` and `pbpaste` with a UTF-8 locale, since under `LC_ALL=C` `pbcopy` garbles Myanmar text |
| `ProcessTable` | `tasklist /fo csv`; `Get-CimInstance` only when command lines or parents are needed | `/proc` read with `node:fs`, naming each process from `/proc/<pid>/exe`, because programs rename their main thread | `ps -axww` |
| `PortTable` | `netstat -ano` | `/proc/net/tcp` and `/proc/net/tcp6`, owners from `/proc/<pid>/fd` | `netstat` and `lsof` |
| `Opener` | `explorer.exe` | `xdg-open` | `open` |

Consequences the design accepts:

- **Latency.** In CI, Windows trash and clipboard took about 0.6 s warm and up to 5 s on the
  first call, and `tasklist` about 0.35 s. Every Linux and macOS operation stayed under
  100 ms. A command calls PowerShell at most once per run.
- **Other users' processes.** Without elevation, Linux and macOS do not reveal who owns
  another user's port. kiriya reports it and never elevates.
- **CI blind spots.** GitHub's macOS image pre-grants Full Disk Access, and Linux runners have
  no clipboard without a virtual display. The macOS trash and every clipboard path get a
  manual test on a real machine before each release.

Every adapter passes the same contract suite for its port. An adapter that cannot work on a
machine raises `CapabilityUnavailableError` naming what is missing.

### Plugins

| Rule | Why |
|---|---|
| A plugin cannot replace or shadow a built-in command id | Users must be able to trust what `kiriya files delete` does |
| Plugin commands carry a safety level and pass through the same safety checks | One safety model for every command |
| `kiriya doctor` lists loaded plugins with their source and version | Explicit over inferred |
| A plugin that fails to load is reported and skipped; built-in commands keep working | One bad plugin must not break the toolbox |
| Plugins run in-process with the user's permissions, and the docs say so plainly | Honest about the trust model |

### MCP

The protocol facts come from [research](research.md#3-mcp), re-checked against the 2026-07-28
specification and its schema on 2026-09-14. [MCP server](../guides/mcp.md) describes what a
client sees.

| Topic | Decision |
|---|---|
| Protocol | The 2026-07-28 version, with `server/discover`. The earlier `initialize` handshake is answered too, for 2025-11-25 back to 2024-11-05, so clients that have not moved yet still work |
| Transport | stdio only: newline-delimited JSON-RPC on stdout, logs on stderr, exit when stdin closes. stdin carries the protocol, so no command reads it |
| Tools | One tool per command, named by its id. The input schema comes from the command's input schema, and the output is the document `--json` prints. All four annotations are always set, because the defaults assume the worst |
| Exposure | `read` tools by default, `write` tools with `mcp.allowWrite`, and `destroy` tools with `mcp.allowDestroy` for clients with form elicitation. Commands that run programs the user names, and commands only for a terminal, are never tools. Reads that can show secrets or send data away need `mcp.allowWrite` |
| Confirmation | Every question a `destroy` tool asks goes to the user through elicitation; in the 2026-07-28 version as an input-required result with a signed `requestState` that lasts 15 minutes, and before it as a request of the server's own. The yes-or-no questions of `write` tools are answered by `mcp.allowWrite` |
| Scope | Roots come from arguments or `--root`, by default the folder the server starts in. Every path must lie under a root as written and with symlinks followed. Tools that change something never reach the configuration file or a `.git` folder. Client roots are not used, since the protocol deprecates them |
| Errors and limits | A failed command, a refused path and a bad argument are tool results with `isError: true`, so the model can correct its call. Lists keep 200 items and a result stays under about 40,000 characters, with `truncated` naming each cut |
| Trust | Annotations are untrusted hints, and the specification only recommends a human in the loop, so kiriya's refusals never depend on the client behaving well |
| Publishing | `mcpName` and `server.json` for the MCP Registry, published through GitHub OIDC after npm with a pinned, checksum-verified `mcp-publisher`, and an MCPB bundle packed with kiriya's own `archive zip` on every release |

### Split triggers

| Trigger | Split |
|---|---|
| Plugin authors need the contracts without the tools | Publish `@kiriya/sdk` from `core/domain` |
| The MCP server needs its own release cadence | Move to a workspace with `packages/mcp` |
| One module grows past about 5,000 lines | Consider moving it into its own package |

Until one of these happens, kiriya is a single npm package.

## Code standards

These rules are complete in themselves, and a contribution that breaks one is not merged.
[CONTRIBUTING.md](../../CONTRIBUTING.md) covers the workflow around them.

### Baseline

| Rule | Detail |
|---|---|
| Runtime | Node.js 22.13 or later, pinned in `.nvmrc` and `engines`. 22 is supported until 2027-04-30 and 24 until 2028-04-30; the minimum moves to 24 before 22 reaches end of life ([research](research.md#4-distribution)). 22.13 is where `util.styleText` became stable. Release jobs use Node 22.14.0 or later with npm 11.5.1 or later, which trusted publishing needs |
| Language | TypeScript with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `noImplicitOverride` |
| Modules | ESM only (`"type": "module"`); built-ins through the `node:` prefix |
| Package manager | npm, with `package-lock.json` committed |
| Runtime dependencies | None. A proposal to add one needs an issue stating the size, the maintenance record and why in-house code is worse |
| Lint and format | ESLint flat config and Prettier, as development dependencies; CI fails on either |
| Scripts | `build`, `dev`, `docs`, `test`, `lint`, `format`, `typecheck` with these exact names |

### Type discipline

- **No `any`.** Use `unknown` and narrow explicitly, with a comment when the type cannot be
  known.
- **No `@ts-ignore`.** `@ts-expect-error` with a one-line reason is allowed only for wrong
  third-party types.
- **`interface` for ports and object shapes, `type` for unions** and computed types.
- **Ports have no `I` prefix.** They are named for their role: `Trash`, `FileSystem`.
- **`readonly` by default** for fields and arrays that are not deliberately mutable.
- **Discriminated unions** instead of objects with many optional fields.
- **Derive, never duplicate:** `type SafetyLevel = (typeof SAFETY_LEVELS)[number]`.
- **Validate at the boundary once**, through the input schema or the config checks, then pass
  typed values inward. The core never validates again.

### SOLID, as checks

| Principle | The check a reviewer runs |
|---|---|
| **Single responsibility** | A use case computes, a view formats, an adapter talks to the OS. A file doing two of these is split. Its one reason to change fits in one sentence |
| **Open/closed** | A new command, module, OS program, format or locale is added with the edits [Architecture](architecture.md#extending-kiriya) lists. A `switch` over command ids or OS names outside `main.ts` and `config/` is rejected |
| **Liskov substitution** | Every adapter of a port passes that port's contract suite on every OS. No adapter leaks a PowerShell message, an errno or a program's exit code to a use case |
| **Interface segregation** | Ports stay small: `Trash`, `Clipboard`, `ProcessTable` and `PortTable` are separate, never one `Platform` interface. A use case receives only the ports it calls |
| **Dependency inversion** | `domain` declares ports, `infrastructure` implements them, `main.ts` wires them. `new` on an adapter anywhere else is rejected. No service locator |

### Classes and functions

| Kind | Form | Examples |
|---|---|---|
| Use case | Class; collaborators through the constructor | `DeletePaths`, `FindFiles` |
| Adapter | Class implementing exactly one port | `WindowsTrashAdapter`, `NodeFileSystemAdapter` |
| Value object | Class that validates in its constructor, so an invalid value cannot exist | |
| Computation | Plain exported function, pure | `globToRegExp`, `crc32` |
| View | Plain function from result to lines | `deleteView` |
| Module | Plain object satisfying `KiriyaModule` | `filesModule` |

A pure function is never wrapped in a class to look consistent. No static-only utility
classes.

### Naming

| Thing | Convention | Example |
|---|---|---|
| File | `kebab-case.ts`, with a role suffix where it has a role | `delete-paths.use-case.ts`, `windows-trash.adapter.ts`, `delete.view.ts`, `files.module.ts` |
| Folder | `kebab-case` | `core/infrastructure/platform/` |
| Class, interface, type | `PascalCase` | `DeletePaths`, `Trash`, `SafetyLevel` |
| Function, variable | `camelCase` | `globToRegExp` |
| Constant set | `UPPER_SNAKE_CASE` | `SAFETY_LEVELS` |
| Command id | `<module>.<verb>` | `files.delete`, `port.who` |
| CLI syntax | `kiriya <module> <verb> [arguments] [--flags]` | `kiriya port kill 3000` |
| Flag | `--kebab-case`; a short flag only for very common options | `--dry-run`, `-i` for `--ignore-case` |
| Message key | `<module>.<command>.<message>` | `files.delete.ask-trash` |
| Test | `tests/<layer>/<area>/<subject>.test.ts`, where the area is `core`, `tools` or a module | `tests/integration/files/delete-paths.test.ts` |

### Errors and exit codes

All typed errors live in `core/domain/errors.ts`. An adapter wraps every Node.js or OS failure
in one of them before it crosses inward, and presentation maps errors once.

| Result | CLI exit code | MCP |
|---|---|---|
| Done, with or without warnings | 0 | Result |
| Some operations failed | 1 | Result with `isError: true` |
| `UsageError`: bad flag or value | 2 | Result with `isError: true`, since the specification treats input that fails validation as a tool error |
| `RefusedError`: protected path, or confirmation declined or impossible | 1 | Result with `isError: true` and the reason |
| `CapabilityUnavailableError` | 1 | Result with `isError: true` naming what is missing |
| Interrupted | 130 | No answer: the client cancelled the request |

No stack trace reaches a user unless `--debug` is set. A new exit code, if one is ever needed,
uses the range 64–113: shells reserve 126, 127, 128 plus a signal number, and 255, and
`sysexits.h` is deprecated ([research](research.md#2-cli-design-guidelines)).

### Async work and external programs

- All I/O is asynchronous. Synchronous `fs` is allowed only while `main.ts` starts up.
- No floating promise: each is awaited, returned, or discarded with a comment saying why.
- Every external program runs without a shell, with an argument array, a timeout and the
  command's `AbortSignal`.
- Large files are read as streams or in chunks, never loaded whole without a size limit.

### Command-line interface

Based on the guidelines in [research](research.md#2-cli-design-guidelines).

| Area | Rule |
|---|---|
| Help | `-h`, `--help` and `kiriya help <module> [command]`. Command help ends with examples. Module help explains what the module is for, shows examples and points to its guide. An unknown name suggests the closest one |
| Version | `-V` and `--version` |
| Flags over positions | Positional arguments only for the obvious subject (`kiriya port kill 3000`); everything else is a named flag. Standard names: `--dry-run`, `--apply`, `--force`, `--json`, `--no-input`. Secrets are never accepted as flag values |
| Streams | Data on stdout; messages, progress and prompts on stderr. `-` means stdin where text is expected |
| Formats | Text on a terminal and `--json` on every command. Tables have no borders. Planned: `--plain` for tabular text suited to `grep` and `awk`, and JSON Lines for commands that stream, such as `watch` and `files tail` |
| Colour | Through Node's `util.styleText`, which turns colour off for a stream that is not a terminal, for `NO_COLOR` and `NODE_DISABLE_COLORS`, and on for `FORCE_COLOR`. kiriya adds `KIRIYA_NO_COLOR`, `TERM=dumb` and `--no-color`, and decides for stdout and stderr separately |
| Prompts | Only when stdin is a terminal. `--no-input` never prompts and fails naming the flag that was needed. Ctrl+C always stops the command |
| Responsiveness | Work that may take longer than a second shows progress on stderr first. Planned: measure the start-up time of `kiriya --version` in CI, and let it grow by no more than 20% between releases |
| Precedence | Flags, then environment variables, then the user config file, then defaults |
| Stability | Each command's JSON shape is a public contract. Removing or renaming a field is a breaking change |

### Messages and configuration

- Every user-facing message is a key in `src/i18n/locales/en.ts`, which the `MessageKey` type
  is derived from. Another locale is typed as `Catalog`, so the compiler fails when it lacks a
  key, and a test fails on a key no source file uses. JSON output keeps keys and parameters,
  so scripts never depend on wording.
- Only English ships at first. A later locale will be chosen with `--lang` or `KIRIYA_LANG`,
  never from the OS locale automatically, because terminals do not yet shape complex scripts
  such as Myanmar correctly.
- Configuration is one JSON file per user. It never holds a secret, and it is validated on
  load with an error naming the file and field.
- The file follows the XDG Base Directory specification on Linux and the platform folders
  elsewhere, as [Usage](../usage.md#configuration) lists. A relative XDG value is ignored, as
  the specification recommends. On macOS kiriya uses Application Support rather than
  Preferences, which holds system-managed property lists.

### Logging

kiriya writes no log today. When it does, a log goes only to stderr and only with `--debug`,
and holds command ids and argument names, never argument values, file contents, environment
values, tokens or passwords.

### Safety invariants

Each invariant has a test that runs on every OS.

1. A command writes, moves or deletes only if its spec says `write` or `destroy`.
2. `destroy` work needs a typed confirmation: typed at the prompt, or passed as
   `--confirm=<exact value>` in a script. `--yes` never satisfies it, no terminal and no
   `--confirm` means refusal, and over MCP it needs an elicitation the user accepts.
3. `delete` goes to the trash unless `--permanent`.
4. Drive roots, the home folder, the working folder and its parents, and operating-system
   folders are refused.
5. Nothing existing is replaced without `--overwrite` and a typed confirmation.
6. Globs do not enter hidden or dependency folders without `--all`.
7. No secret value is printed: `env show` masks secret-looking values unless `--reveal`.
8. No network access from a command whose spec says `usesNetwork: false`.
9. An archive entry that would land outside its target folder stops the extraction.
10. No adapter starts a program through `cmd.exe`, `sh` or a PowerShell command built from
    user input; arguments are always passed as an array.
11. Over MCP, a path outside the server's roots is refused, and a tool that changes something
    never reaches the configuration file or a `.git` folder.

### Testing

| Layer | Scope | Rules |
|---|---|---|
| Unit | `domain`, `application` and tools | No file system, network, clock or randomness; ports are in-memory fakes. The majority of tests |
| Contract | Each port | One suite per port, run against every adapter on its own OS |
| Integration | `infrastructure` | Real file system inside temporary folders, real git, processes the test started itself |
| End to end | The built CLI and MCP server | Exit codes, stdout and stderr separation, text and JSON output, and a client built with the official MCP SDK |
| Boundaries | The source tree | A dependency-free script in `tools/` fails on an import the [layer rules](architecture.md#layers) do not allow, on a catalog value import outside `main.ts`, and on any package import |

- Test the judgement calls: invalid input, empty results, conflicts, refusals, missing
  capabilities, timeouts. A test of only the easy case is not enough.
- Every safety invariant has a negative test proving the refusal.
- Deterministic: inject the clock and the random source; no dependence on test order.
- A flaky test is fixed or deleted the day it is found.
- **CI matrix:** Windows, Linux and macOS, each on Node 22, Node 24 and the current release.
  While the repository is private, free CI is 2,000 minutes a month and macOS minutes cost
  about ten times Linux ones, so CI runs Linux and Windows on Node 22, and the full matrix
  runs when started by hand: before merging a change to adapters, paths or processes, and
  before a release. A public repository runs the full matrix on every push and pull request.

### Comments and documentation

- Comment why, not what. A workaround or an OS quirk names its reason.
- No commented-out code, and no TODO without an issue number.
- Behaviour and its documentation change in the same pull request.
- `CHANGELOG.md` follows Keep a Changelog and gets an entry for every user-visible change.
- Command references are generated from the command specs, never written by hand. Each module
  guide is written by hand around its generated reference, and CI checks both, with every
  relative link in the docs.

### Git and releases

- Conventional Commits: `feat(files): add tail`, `fix(port): handle IPv6 listeners`.
- Branches: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`; `main` is always releasable.
- Every pull request passes lint, format, typecheck, the docs check and the CI matrix.
- Semantic versioning. Command ids, flags, exit codes and JSON shapes are the public API;
  changing one is a major version after 1.0.
- Releases are built and published by CI only, never from a laptop.

### Definition of done

A change is done when all of these hold:

1. It meets the acceptance criteria of its issue or roadmap item.
2. Tests cover the new behaviour, including the negative cases, and pass on all three
   operating systems.
3. Lint, format, typecheck, the boundary check and the docs check are clean.
4. A new command has a safety level, `--json` output, a message key for every string, and its
   task described in its module's guide.
5. Documentation and `CHANGELOG.md` are updated in the same pull request.
6. The author has read the whole diff once as if a stranger wrote it.

## Key decisions

| Decision | Chosen | Rejected, and why |
|---|---|---|
| Repository | `github.com/SatPaingOo/kiriya`, private during development; made public just before the first npm release, because npm adds provenance only for public repositories | Designing in private keeps unfinished command contracts from being depended on. An organisation account can follow when contributors join |
| npm package | Not published until the maintainer judges the first release ready | A published name and version are a promise; publishing half-built commands would break it on the first real change |
| Name | `kiriya` | `sayar` does not say "tool"; `bento` is buried under BentoPDF and BentoML in search; `commonkit` is long and generic. The npm name was free and no GitHub repository used it on 2026-09-13 |
| Language | TypeScript on Node.js | Go and Rust give a single binary and faster start-up, but the prototype was TypeScript and Node.js is already on most developer machines. Single-file binaries remain possible, under Distribution below |
| Package shape | One npm package with boundaries enforced by tests | A workspace of packages from day one is premature; [split triggers](#split-triggers) name when to change |
| Layout | Layers inside each module | One global set of layers spreads every tool across four folders and gives plugins a different shape from built-ins |
| Dependencies | None at runtime | commander, zod, oclif and execa would each save code and each widen the supply chain of a tool that deletes files |
| I/O | Asynchronous ports | Synchronous I/O, as in the prototype, blocks a long-running MCP server |
| MCP implementation | A hand-written stdio server with no runtime dependency, tested end to end against a client built with the official TypeScript SDK as a development dependency | The official SDK v2 needs its core package and zod at runtime, and v1 depends on 17 packages including express and hono ([research](research.md#3-mcp)). The cost accepted: kiriya follows specification changes itself |
| Confirmation in scripts | `--confirm=<exact value>` | Follows clig.dev for severe actions. `--yes` stays insufficient because it does not show the caller knows what will be destroyed |
| Configuration scope | A user config file only | A project config file checked into a repository could make kiriya load code from a cloned repository. If one is ever added, it can never list plugins |
| Plugins | In-process modules listed in config | Executables named `kiriya-*` on PATH, as git does, are simple but cannot share the safety policy, JSON output or MCP exposure |
| Docs | Hand-written guides around references generated from the command specs, checked in CI | A hand-written reference drifts from flags and defaults; a fully generated page cannot explain the tasks a module is for |
| Distribution | npm with trusted publishing and provenance first. Later, a kiriya Scoop bucket and a Homebrew tap that installs from npm with `depends_on "node"`, so neither needs a signed binary. Single-file binaries and winget only when Single Executable Applications accept an ESM entry in an LTS Node release (26, LTS from 2026-10-28) and signing costs nothing: SignPath Foundation for Windows if kiriya qualifies; no macOS binary while notarization needs the paid Apple Developer Program | In Node 22 and 24 a single executable takes one CommonJS script and the feature is still in active development. Azure Artifact Signing accepts individual developers from the US and Canada only, and Apple charges US$99 a year, which breaks the free-to-build constraint. homebrew/core and the Scoop main bucket require popularity a new tool does not have yet ([research](research.md#4-distribution)) |

## Roadmap

| Stage | Work | State |
|---|---|---|
| Spike | Port lookup, process lookup, clipboard and trash, run in CI on Windows, Linux and macOS | CI part done 2026-09-13. Manual checks remain: trash on a Mac without Full Disk Access with Finder's Put Back, and Windows under Constrained Language Mode or AppLocker |
| Core and files | The kernel, `files` and `archive` on async ports, contract and boundary tests, CI matrix | Done 2026-09-13 |
| Prototype modules | `git`, `docker`, `config`, and the plugin loader with an example plugin | Done 2026-09-13 |
| v1 modules | `port`, `proc`, `env`, `sys`, `net`, `convert`, `gen`, `clip`, `open`, `doctor`, `completion`; licence, changelog, security policy, code of conduct, release workflow | Done 2026-09-14 |
| MCP server | `read`, `write` and `destroy` tools over both protocol versions, registry metadata and an MCPB bundle, tested with the official SDK | Done 2026-09-14 |
| Docs | Getting started, usage, and a guide per module with a generated reference; module help in the CLI | Done 2026-09-14 |
| v2 modules | Started before the first release, each after a design issue: `wait` ([#19](https://github.com/SatPaingOo/kiriya/issues/19)) | `wait` done 2026-09-14 |
| First release | The repository made public; npm through trusted publishing with provenance; the MCP Registry and the MCPB bundle ([Releasing](releasing.md)) | Waits for the maintainer. Done when a clean machine on each OS installs kiriya from the README alone, `kiriya doctor` passes, and `npm audit signatures` verifies the package |
| Growth | The [next](#next) list and the research candidates; a Scoop bucket and a Homebrew tap; winget and single-file binaries when the distribution decision's condition holds | Users other than the maintainers report issues and depend on releases |

## Open questions

| Question | Default if not answered |
|---|---|
| May kiriya ship small signed native helpers for trash, clipboard and processes? | **Decided 2026-09-13: no.** Every operation worked without helpers in the spike; a helper would only buy Windows speed and trash under application-control policies |
| A short alias command, such as `kiri`? | No alias until users ask for one |

Last reviewed: 2026-09-14
