# kiriya — Blueprint

The design document for kiriya: what it is, which tools it holds, how the code is
structured, the standards every contribution follows, and the order of work.

**State on 2026-09-13:** design. A prototype of the `files`, `archive`, `git`,
`docker` and `config` modules exists in TypeScript with 108 passing tests, run on
Windows only. Phase 1 (section 9) rebuilds it on the architecture below. The
repository stays private during development and becomes public together with the
first npm release.

---

## 1. What kiriya is

**One command-line toolbox for everyday developer work that behaves the same on
Windows, Linux and macOS.**

| | |
|---|---|
| For | Any developer, on any stack, on any of the three operating systems |
| Replaces | Remembering `del` vs `rm`, `netstat -ano` vs `lsof -i`, `clip` vs `pbcopy`, `findstr` vs `grep`, and writing one-off scripts for each |
| Also serves | AI agents, through MCP, under the same safety rules a person gets |
| Is not | A shell, a package manager, a cloud CLI, a GUI, or a security testing kit |

**Closest existing tools** ([RESEARCH.md](./RESEARCH.md) section 6): Bun Shell and
Deno's task shell give the same commands on every OS, but only inside scripts for
their own runtimes; PowerShell 7 runs everywhere but is a language of its own;
Nushell has many of these built-ins but means switching shells; DevToys and IT-Tools are
converters with a GUI; uutils and busybox-w32 port Unix commands without previews,
trash or JSON; DesktopCommanderMCP gives agents terminal and file tools. kiriya is
one dependency-free CLI for the shell a developer already uses, with the same
safety model for people and agents.

## 2. Constraints

| Constraint | What it forces |
|---|---|
| **Free to build, use and run** | MIT licence, free CI, public registries. No service kiriya depends on at runtime. |
| **Zero runtime dependencies** | Argument parsing, input schemas, archives and the MCP protocol are written in-house. The supply chain of a tool that deletes files is Node.js itself. Development dependencies are allowed. |
| **Identical behaviour on three operating systems** | No shell. Every OS difference sits behind a port with one adapter per OS. Every test runs on all three in CI. |
| **Safe by default** | Preview before bulk changes, trash instead of delete, typed confirmation for anything permanent, protected paths. |
| **Offline** | No network access except in commands whose purpose is the network. No telemetry. |
| **A small maintainer team** | Rules are enforced by tests and CI, not by reviewers remembering them. |

## 3. The riskiest assumption

> Process, port, clipboard and trash operations can be made to behave identically
> on Windows, Linux and macOS through thin OS adapters without runtime
> dependencies, and stay reliable in CI on all three.

The prototype proves this for the file system on Windows. Phase 0 answers it for
the operations that need OS programs, on all three systems.

Research already shows where it is weakest ([RESEARCH.md](./RESEARCH.md) section 7):
an AppLocker or WDAC policy blocks the Windows trash path; PowerShell costs about a
second per call; a plain move into the macOS trash loses Put Back; and CI cannot
reproduce macOS permission failures or offer a Linux clipboard. Small signed native
helpers would remove most of these, at the cost of shipping binaries (section 10).

**Phase 0 answer, 2026-09-13: yes, for every case CI can reach.** Port lookup,
process lookup, clipboard and trash passed on Windows Server 2025, Ubuntu 24.04 and
macOS 26, each on Node 22 and 24, with Myanmar text in every file name and clipboard
sample. Windows is the slow platform: its PowerShell-based operations took about
0.6 s warm and up to 5 s on the first call, against under 100 ms on Linux and macOS.
Still unverified: trash on a Mac without Full Disk Access, Finder's Put Back, and a
real AppLocker or WDAC policy. Full results: `spike/README.md` on the `spike/phase-0` branch.

---

## 4. Product rules

1. **Same command, same result, on every OS.** A difference is a bug, or it is
   documented in the command's help together with its reason.
2. **Safe by default.** Read-only unless told otherwise. Bulk changes preview
   first. Delete goes to the trash. Anything permanent needs the user to type what
   will be destroyed, and `--yes` never replaces that.
3. **Every command has human output and `--json`.** Data goes to stdout, messages
   and prompts to stderr.
4. **One command, three surfaces.** The same use case runs from the CLI, from MCP
   and from a plugin, with the same safety level.
5. **No shell, no hidden network, no telemetry.**
6. **English first, translatable later.** Every user-facing message is a key in one
   English locale file from the first release, so adding a language later needs no
   code change. Other locales, Myanmar first, come after the first release;
   terminals do not yet shape complex scripts such as Myanmar correctly
   ([RESEARCH.md](./RESEARCH.md) section 2).
7. **Explicit over inferred.** Plugins load only when configured, never by scanning
   `node_modules`. A capability a machine lacks is reported, never guessed.

---

## 5. Tool catalog

Status values: **prototype** (working code exists, to be rebuilt in phase 1),
**v1** (before the first public release), **v2** (after it).

### 5.1 Prototype modules

| Module | Commands | Change in phase 1 |
|---|---|---|
| `files` | `new` `list` `tree` `info` `read` `find` `grep` `hash` `dupes` `compare` `copy` `move` `rename` `replace` `delete` `clean` `sync` `size` | Async ports, `--json`, message keys. Behaviour unchanged. |
| `archive` | `zip` `unzip` | Moved out of `files`, so one module owns every archive format |
| `git` | `fetch` `pull` `switch` `status` across every repository under a folder | `status` is the prototype's `repos`, without its checks of one person's folder conventions. A failed fetch or pull now fails the run. |
| `docker` | `up` `down` `logs` `ps` `rebuild` for the compose project in the current folder or `--file` | Adds `clean`, a previewed prune. The prototype's folder of environments, `docker.root` with `envs`, is left out: it described one machine's layout. |
| `config` | `list` `keys` `get` `set` `unset` `path` | Per-OS location, section 7.9. Only kiriya's own settings, starting with `plugins`; the prototype's keys belonged to one person's tools. |

### 5.2 v1 — new modules before the first public release

| Module | Commands | The OS difference it removes |
|---|---|---|
| `port` | `who <port>`, `kill <port>`, `free [--from <n>]` | `netstat -ano` + `taskkill` vs `lsof -i` / `ss` + `kill` |
| `proc` | `list [--name]`, `find`, `kill`, `tree` | `tasklist` / `Get-Process` vs `ps` |
| `env` | `show [--reveal]`, `path` (duplicate and missing folders), `check` (`.env` against `.env.example`) | `$env:X` vs `$X`; `;` vs `:` in PATH |
| `sys` | `info`, `tools` (installed versions of node, python, dotnet, java, go, git, docker), `report` (both, for bug reports) | A different command for every fact on every OS |
| `net` | `ip`, `check <host:port>`, `dns <name>` | `ipconfig` vs `ip addr` / `ifconfig` |
| `convert` | `base64`, `url`, `json` (format, minify, validate), `jwt` (decode only; never verifies or sends), `time` (epoch and ISO), `case`, `hex` | Nothing built in on Windows; web converters receive your tokens |
| `gen` | `uuid`, `ulid`, `password`, `token` | `[guid]::NewGuid()` vs `uuidgen` |
| `archive` | adds `tar` and `untar` for `.tar.gz` | Linux artifacts arrive as tar.gz, Windows ones as zip |
| `clip` | `copy`, `paste` | `clip` / `Set-Clipboard` vs `pbcopy` vs `xclip` / `wl-copy` |
| `open` | `open <file|folder|url>` | `start` vs `open` vs `xdg-open` |
| `doctor` | Which capabilities this machine has: trash, clipboard backend, git, docker, loaded plugins | Makes an unsupported environment visible before a command fails |
| `completion` | Completion scripts for bash, zsh, fish and PowerShell | Each shell has its own format |

### 5.3 v2 — after the first public release

| Module or command | What |
|---|---|
| `mcp` | MCP server over stdio, section 6.8 |
| `serve` | Serve a folder over HTTP, bound to localhost only |
| `watch` | Run a command when files change, debounced |
| `json` | Query and select from JSON: a documented subset of jq |
| `files diff` | Line diff of two text files |
| `files tail` | Follow a growing file |
| `task` | List and run scripts from `package.json`, `Makefile`, `justfile`, `*.csproj` and `pyproject.toml` through one command |
| `self-update` | Check the registry for a newer version and update |

### 5.4 Candidates from research

Ranked in [RESEARCH.md](./RESEARCH.md) section 1 by usefulness and adoption of the
tools that do each job today. Each still needs an issue with a design before work starts.

| Rank | Command | What | Safety | Network | When |
|---|---|---|---|---|---|
| 1 | `secrets scan` | Find committed secrets in a repository's files and history | read | no | v2 |
| 2 | `wait` | Wait until a port listens, a URL answers or a file appears, with a timeout | read | for URLs only | v2 |
| 3 | `loc` | Lines of code by language | read | no | v2 |
| 4 | `git hooks` | List, install and remove git hooks across repositories | write | no | v2 |
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

### 5.5 What belongs in a plugin, not in kiriya

kiriya holds only what every developer needs. A tool that serves one stack, one
product or one organisation is a plugin (section 6.7), for example:

| Kind | Example |
|---|---|
| One database engine | backup and restore helpers for SQL Server, PostgreSQL or MySQL |
| One framework or ORM | scaffolding for an ORM, a code generator for a framework's controllers |
| One organisation | internal project templates, naming checks, deployment steps |

### 5.6 Non-goals

| Out of scope | Reason |
|---|---|
| Anything needing administrator rights or changing system settings: hosts file, firewall, services, registry, drivers | Security; users should make those changes knowingly and directly |
| Wrapping package managers such as `winget`, `apt`, `brew` or `choco` | Too many variants to keep reliable |
| Cloud provider CLIs | They exist and change constantly |
| Offensive security tools | Not part of an everyday developer toolbox, and dual-use |
| Installing certificates into system or browser trust stores | Needs administrator rights on some systems [RESEARCH.md](./RESEARCH.md) section 1; `cert inspect` only reads |
| Replacing `git` or `docker` command for command | Both already work on every OS; kiriya adds only multi-repository, multi-project and safety value |
| A GUI or TUI | The CLI and MCP are the product |
| Telemetry of any kind | Product rule 5 |

---

## 6. Architecture

### 6.1 Layers and the dependency rule

```text
presentation  →  application  →  domain  ←  infrastructure
(cli, mcp,       (use cases)      (rules,     (node:fs, OS programs;
 renderers)                        ports)       one adapter per port)
```

| Layer | Holds | May import |
|---|---|---|
| `domain` | Entities, value objects, pure functions, port interfaces, typed errors | `domain` and catalog types only: no `node:` modules, no I/O |
| `application` | Use cases: one class per command | `domain`, `config` data, and `node:path` for path arithmetic; no I/O |
| `infrastructure` | Adapters that implement exactly one port each | `domain`, `config` data, Node.js, operating-system programs |
| `presentation` | CLI parsing, help, text views, JSON output, exit codes, the MCP server | `application`, `domain`, Node.js terminal APIs |

`node:path` is allowed in `application` because it is pure string arithmetic whose
rules differ by OS, and reimplementing it would be the kind of drift kiriya exists to
remove. More rules:

- **A module never imports another module.** What two modules share moves into `core`.
- **`src/main.ts` is the composition root**, the only file that constructs adapters,
  wires them into use cases, and imports the message catalog as a value.
- **No runtime dependencies:** every import is a relative file or a `node:` built-in.

All rules are enforced by a test, section 7.12.

### 6.2 Folder structure

Layers sit inside each module rather than once for the whole repository, because
each tool changes for its own reasons and a plugin must have the same shape as a
built-in module.

```text
kiriya/
├── README.md  BLUEPRINT.md  RESEARCH.md
├── ARCHITECTURE.md  CONTRIBUTING.md  AGENTS.md      # phase 1
├── LICENSE  CHANGELOG.md  SECURITY.md  CODE_OF_CONDUCT.md   # phase 3
├── package.json  package-lock.json  tsconfig.json  .nvmrc
├── eslint.config.js  .prettierrc  .editorconfig  .gitignore
├── .github/workflows/                 # ci.yml (matrix), release.yml
├── src/
│   ├── main.ts                        # composition root
│   ├── config/                        # data, not code: module list, clean rules, protected paths, limits
│   ├── i18n/
│   │   └── locales/                   # en.ts: the catalog, and the MessageKey type derived from it
│   ├── core/                          # the kernel every module uses
│   │   ├── domain/
│   │   │   ├── command.ts             # CommandSpec, Command, CommandResult, SafetyLevel
│   │   │   ├── module.ts              # KiriyaModule, the contract for built-ins and plugins
│   │   │   ├── errors.ts              # every typed error, in one file
│   │   │   ├── values/                # AbsolutePath, ByteSize, Duration, GlobPattern
│   │   │   └── ports/                 # FileSystem, ProcessRunner, Trash, Clipboard, Confirmation, Clock, Logger
│   │   ├── application/               # CommandRegistry, SafetyPolicy, PluginLoader
│   │   ├── infrastructure/
│   │   │   ├── node/                  # node-file-system.adapter.ts, node-process-runner.adapter.ts
│   │   │   ├── platform/
│   │   │   │   ├── windows/           # windows-trash.adapter.ts, windows-clipboard.adapter.ts, ...
│   │   │   │   ├── linux/
│   │   │   │   └── macos/
│   │   │   └── config/                # json-config.store.ts, input-schema parser
│   │   └── presentation/
│   │       ├── cli/                   # argv parsing, help, JSON output, exit codes, terminal confirmation
│   │       ├── i18n/                  # translator: messages to text
│   │       └── mcp/                   # stdio server, tool mapping, elicitation
│   └── modules/
│       ├── files/
│       │   ├── files.module.ts        # registers this module's commands
│       │   ├── domain/                # pure: glob, case styles, text encoding, transfer plans
│       │   ├── application/           # delete-paths.use-case.ts: the use case and its CommandSpec
│       │   ├── infrastructure/        # adapters only this module needs
│       │   └── presentation/          # delete.view.ts: the text view
│       ├── archive/  git/  docker/  config/
│       └── port/  proc/  env/  sys/  net/  convert/  gen/  clip/  open/  doctor/  completion/
├── tests/
│   ├── unit/                          # mirrors src/; domain and application with in-memory fakes
│   ├── contract/                      # one suite per port, run against every adapter
│   ├── integration/                   # real file system in temporary folders, real git
│   ├── e2e/                           # the built CLI and MCP server as black boxes, golden output
│   └── support/                       # fakes, temporary folders, fixtures
├── tools/                             # development scripts: import-boundary check, docs generation
└── docs/
    └── commands/                      # reference pages generated from command specs
```

### 6.3 Core contracts

These shapes are the design. Names may change during phase 1; responsibilities may not.

```ts
// core/domain/command.ts
export type SafetyLevel = "read" | "write" | "destroy";

export interface CommandSpec<Input> {
  readonly id: string;                 // "files.delete"
  readonly summary: MessageKey;        // "files.delete.summary"
  readonly input: InputSchema<Input>;  // parses argv and MCP arguments; emits JSON Schema
  readonly safety: SafetyLevel;
  readonly idempotent: boolean;
  readonly usesNetwork: boolean;       // true only for commands whose purpose is the network
  readonly runsUserCommands: boolean;  // task, watch, bench: never exposed over MCP
}

export interface Command<Input, Output> {
  readonly spec: CommandSpec<Input>;
  execute(input: Input, context: CommandContext): Promise<CommandResult<Output>>;
}

export interface CommandContext {
  readonly cwd: AbsolutePath;
  readonly confirmation: Confirmation; // a terminal prompt, an MCP elicitation, or refusal
  readonly progress: Progress;         // stderr, MCP progress notifications, or silent
  readonly signal: AbortSignal;        // Ctrl+C and MCP cancellation
}

export type CommandResult<Output> =
  | { readonly kind: "done"; readonly data: Output; readonly warnings: readonly Warning[] }
  | { readonly kind: "preview"; readonly plan: Output; readonly applyFlag: string };
```

A use case is a class that receives its ports through its constructor and never
prints:

```ts
// modules/files/application/delete-paths.use-case.ts
export class DeletePaths implements Command<DeleteInput, DeleteOutput> {
  readonly spec = deleteSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly trash: Trash,
    private readonly pathGuard: PathGuard,
  ) {}

  async execute(input: DeleteInput, context: CommandContext): Promise<CommandResult<DeleteOutput>> {
    // expand the globs, refuse protected paths, measure, confirm, then trash or remove
  }
}
```

A module registers its own commands; nothing central switches over tool names:

```ts
// modules/files/files.module.ts
export const filesModule: KiriyaModule = {
  id: "files",
  summary: "files.summary",
  register(registry, ports) {
    registry.add(new DeletePaths(ports.fileSystem, ports.trash, ports.pathGuard), deleteTextRenderer);
    // one line per command
  },
};
```

### 6.4 One command, end to end

`kiriya files delete "logs/*.log"` from a terminal:

1. `main.ts` detects the OS, builds the adapters, and asks every module in
   `config/modules.ts`, then every configured plugin, to register its commands.
2. `presentation/cli` finds `files.delete`, parses argv through its `InputSchema`,
   and builds a `CommandContext` whose `Confirmation` prompts on the terminal.
3. `SafetyPolicy` reads the spec. Trashing counts as `write` because it can be
   undone; `--permanent` raises the work to `destroy`, which needs a typed
   confirmation.
4. `DeletePaths.execute` expands the glob through `FileSystem`, refuses protected
   paths through `PathGuard`, asks `Confirmation`, then calls `Trash`.
5. The CLI passes the result to the command's text view, or prints it as JSON
   with `--json`, and maps the result or typed error to an exit code.

From MCP only step 2 differs: arguments arrive as JSON, and `Confirmation` becomes
an elicitation request to the user.

### 6.5 OS adapters

Three operating systems mean three real implementations from the start, so these
ports are not premature abstractions.

Revised after the adapter research in [RESEARCH.md](./RESEARCH.md) sections 7 and 9.

| Port | Windows | Linux | macOS |
|---|---|---|---|
| `Trash` | PowerShell checks its language mode first. In full language mode, `SHFileOperation` with `FOF_ALLOWUNDO` through Add-Type, fixed drives only, with `fAnyOperationsAborted` checked. Under Constrained Language Mode: `CapabilityUnavailableError`, suggesting `--permanent`. | The freedesktop.org trash specification implemented with `node:fs`: the home trash, or `$topdir/.Trash-$uid` on other mounts. `gio` is not needed. | `/usr/bin/trash` on macOS 15 and later; otherwise a move into `~/.Trash`, warning that Finder's Put Back will not work |
| `Clipboard` | `Set-Clipboard` and `Get-Clipboard` through PowerShell; never `clip.exe`, which garbles UTF-8 | `wl-copy`, then `xclip`, then `xsel`; on a machine without a display, `CapabilityUnavailableError` | `pbcopy` and `pbpaste` with a UTF-8 locale set: under `LC_ALL=C` `pbcopy` garbles Myanmar text |
| `ProcessTable` | `tasklist /fo csv` for names; `Get-CimInstance` only when a command line or parent id is needed | `/proc` read with `node:fs`, naming each process from `/proc/<pid>/exe`, because programs rename their main thread (Node 24 shows `MainThread`) | `ps -axww` |
| `PortTable` | `netstat -ano` | `/proc/net/tcp` and `/proc/net/tcp6` read with `node:fs`, owners from `/proc/<pid>/fd` | `lsof -nP -iTCP -sTCP:LISTEN` |
| `Opener` | `explorer.exe` | `xdg-open` | `open` |
| `StandardPaths` | Windows known folders | XDG base directories | `~/Library` folders |

Consequences the design accepts:

- **Latency.** In CI, Windows trash and clipboard took about 0.6 s warm and up to
  5 s on the first call, and `tasklist` about 0.35 s; on a developer machine,
  starting PowerShell alone took 0.9–1.2 s. Every Linux and macOS operation stayed
  under 100 ms. A command calls PowerShell at most once per run and shows progress
  when it does.
- **Other users' processes.** Without elevation, Linux and macOS do not reveal who
  owns another user's port. kiriya reports "owned by another user" and never elevates.
- **CI blind spots.** GitHub's macOS image pre-grants Full Disk Access, and Linux
  runners have no clipboard without a virtual display. The macOS trash and every
  clipboard path get a manual test on a real machine before each release.

Every adapter passes the same contract suite for its port. An adapter that cannot
work on a machine raises `CapabilityUnavailableError` naming what is missing, for
example: "no clipboard program found; install wl-clipboard or xclip".

### 6.6 Extension points

| Add… | Edit |
|---|---|
| a command to a module | a new `*.use-case.ts` with its spec and a `*.view.ts`, plus one line in the module's `*.module.ts` |
| a module | a new `src/modules/<name>/` folder, plus one entry in `src/config/modules.ts` |
| support for an OS program | a new adapter in `core/infrastructure/platform/<os>/`, plus the adapter table in `src/config/platforms.ts` |
| an output format | a new formatter in `core/presentation/cli/`, beside `json-output.ts` |
| a locale | a new `src/i18n/locales/<code>.ts` typed as `Catalog`, so the compiler rejects a missing key |
| a clean rule or a protected path | `src/config/clean-rules.ts` or `src/config/protected-paths.ts` |
| a tool for one stack or organisation | a plugin, section 6.7 |

### 6.7 Plugins

A plugin is an npm package or a local folder whose default export is a `KiriyaModule`,
the same contract as a built-in module, together with the English text of its own
message keys, which start with its id. [docs/plugins.md](./docs/plugins.md) is the full
contract. A plugin loads only when the user's config lists it; a path is relative to the
config file:

```json
{ "plugins": ["kiriya-plugin-postgres", "./tools/our-company-plugin"] }
```

| Rule | Why |
|---|---|
| A plugin cannot replace or shadow a built-in command id | Users must be able to trust what `kiriya files delete` does |
| Plugin commands carry a safety level and pass through `SafetyPolicy` like any other | One safety model for every command |
| `kiriya doctor` lists loaded plugins with their source and version | Explicit over inferred |
| A plugin that fails to load is reported and skipped; built-in commands keep working | One bad plugin must not break the toolbox |
| Plugins run in-process with the user's permissions; the docs say so plainly | Honest about the trust model |

### 6.8 MCP

`kiriya mcp` runs an MCP server over stdio. The protocol facts come from
[RESEARCH.md](./RESEARCH.md) section 3 and are re-checked against the specification
when phase 4 starts.

| Topic | Design |
|---|---|
| Protocol | The 2026-07-28 specification, including `server/discover`. The earlier `initialize` handshake is answered too, so clients that have not moved yet still work. |
| Transport | stdio only. Newline-delimited JSON-RPC on stdout, logs on stderr, exit when stdin closes; `notifications/cancelled` aborts the command's `AbortSignal`. |
| Tools | One tool per command. `name` is the command id (`files.delete`, a valid tool name); `inputSchema` and `outputSchema` come from the command's schemas; `structuredContent` carries the JSON output and a text block repeats it. Tools are listed in a stable order. |
| Annotations | All four are always set, because the defaults assume the worst. `read`: `readOnlyHint: true`. `write`: `readOnlyHint: false`, `destructiveHint: false`. `destroy`: `readOnlyHint: false`, `destructiveHint: true`. `idempotentHint` comes from the spec, `openWorldHint` from `usesNetwork`. |
| Exposure | `read` tools by default. `write` tools only when the user's config sets `mcp.allowWrite`. `destroy` tools only with `mcp.allowDestroy`, and each call still needs an elicitation the user accepts. Commands with `runsUserCommands` are never exposed. |
| Confirmation | Elicitation in form mode with one string field for the typed value: the count or name, never a secret. Decline and cancel both end the call with nothing changed. A client without elicitation cannot run a `destroy` tool, and such tools are left out of the list when the request's client capabilities show no elicitation. Several popular clients lacked elicitation on 2026-09-13 ([RESEARCH.md](./RESEARCH.md) section 3). |
| Scope | The server starts with one or more `--root` folders, by default the folder it starts in. Every path argument is resolved and refused when outside a root. Client roots are not used, since the protocol deprecates them. |
| Errors | A failed command returns `isError: true` with the typed error's message, so the model can correct its call. An unknown tool is a JSON-RPC error. |
| Output limits | Large results are truncated with the number of omitted items. Secret values stay masked exactly as in the CLI. |
| Trust | Annotations are untrusted hints to clients, and the specification only recommends that hosts keep a human in the loop. kiriya's own refusals never depend on the client behaving well. |
| Publishing | When the repository is public: `mcpName` in `package.json`, a `server.json` in the MCP Registry, and an MCPB bundle for one-click install in Claude's desktop app |

### 6.9 Split triggers

| Trigger | Split |
|---|---|
| Plugin authors need the contracts without the tools | Publish `@kiriya/sdk` from `core/domain` |
| The MCP server needs its own release cadence | Move to a workspace with `packages/mcp` |
| One module grows past about 5,000 lines | Consider moving it into its own package |

Until one of these happens, kiriya is a single npm package.

---

## 7. Code standards

These rules are complete in themselves. They become `CONTRIBUTING.md` and
`ARCHITECTURE.md` in phase 1, and a contribution that breaks one is not merged.

### 7.1 Baseline

| Rule | Detail |
|---|---|
| Runtime | Node.js >= 22.13, pinned in `.nvmrc` and `engines`. Node 20 reached end of life on 2026-04-30; 22 is supported until 2027-04-30 and 24 until 2028-04-30; 26 becomes LTS on 2026-10-28 ([RESEARCH.md](./RESEARCH.md) section 4). The minimum moves to 24 before 22 reaches end of life. 22.13 is where `util.styleText` became stable. Release jobs use Node 22.14.0 or later with npm 11.5.1 or later, which trusted publishing needs. |
| Language | TypeScript with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `noImplicitOverride` |
| Modules | ESM only (`"type": "module"`); built-ins through the `node:` prefix |
| Package manager | npm; `package-lock.json` committed |
| Runtime dependencies | None. A proposal to add one needs an issue stating the size, the maintenance record and why in-house code is worse. |
| Lint and format | ESLint flat config and Prettier, as development dependencies; CI fails on either |
| Scripts | `build`, `dev`, `test`, `lint`, `format`, `typecheck` with these exact names |

### 7.2 Type discipline

- **No `any`.** Use `unknown` and narrow explicitly, with a comment when the type
  cannot be known.
- **No `@ts-ignore`.** `@ts-expect-error` with a one-line reason is allowed only for
  wrong third-party types.
- **`interface` for ports and object shapes, `type` for unions** and computed types.
- **Ports have no `I` prefix.** They are named for their role: `Trash`, `FileSystem`.
- **`readonly` by default** for fields and arrays that are not deliberately mutable.
- **Discriminated unions** instead of objects with many optional fields.
- **Derive, never duplicate:** `type SafetyLevel = (typeof SAFETY_LEVELS)[number]`.
- **Validate at the boundary once** through `InputSchema` or the config schema, then
  pass typed values inward. The core never re-validates.

### 7.3 SOLID, as checks

| Principle | The check a reviewer runs |
|---|---|
| **Single responsibility** | A use case computes, a view formats, an adapter talks to the OS. A file doing two of these is split. Its one reason to change fits in one sentence. |
| **Open/closed** | A new command, module, OS program, format or locale is added with exactly the edits in section 6.6. A `switch` over command ids or OS names outside `main.ts` and `config/` is rejected. |
| **Liskov substitution** | Every adapter of a port passes that port's contract suite on every OS. No adapter leaks a PowerShell message, an errno or a program's exit code to a use case. |
| **Interface segregation** | Ports stay small: `Trash`, `Clipboard`, `ProcessTable` and `PortTable` are separate, never one `Platform` interface with every method. A use case receives only the ports it calls. |
| **Dependency inversion** | `domain` declares ports, `infrastructure` implements them, `main.ts` wires them. `new` on an adapter anywhere else is rejected. No service locator. |

### 7.4 Classes and functions

| Kind | Form | Examples |
|---|---|---|
| Use case | Class; collaborators through the constructor | `DeletePaths`, `FindFiles`, `KillPort` |
| Adapter | Class implementing exactly one port | `WindowsTrashAdapter`, `NodeFileSystemAdapter` |
| Value object | Class that validates in its constructor, so an invalid value cannot exist | `AbsolutePath`, `ByteSize`, `GlobPattern` |
| Computation | Plain exported function, pure | `globToRegExp`, `renameByCase`, `crc32`, `parseSize` |
| View | Plain function from result to lines | `deleteView` |
| Module | Plain object satisfying `KiriyaModule` | `filesModule` |

A pure function is never wrapped in a class to look consistent. No static-only
utility classes.

### 7.5 Naming

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
| Message key | `<module>.<command>.<message>` | `files.delete.confirm` |
| Test | `tests/<layer>/<area>/<subject>.test.ts`, where the area is `core` or a module name | `tests/integration/files/delete-paths.test.ts` |

### 7.6 Errors and exit codes

All typed errors live in `core/domain/errors.ts`. An adapter wraps every Node.js or
OS failure into one of them before it crosses inward. Presentation maps errors once.

| Result | CLI exit code | MCP |
|---|---|---|
| Done, with or without warnings | 0 | Result |
| Some operations failed | 1 | Result with `isError: true` |
| `UsageError`: bad flag or value | 2 | Invalid parameters |
| `RefusedError`: protected path, or confirmation declined or impossible | 1 | Result with `isError: true` and the reason |
| `CapabilityUnavailableError` | 1 | Result with `isError: true` naming what is missing |
| Interrupted | 130 | Cancelled |

No stack trace reaches a user unless `--debug` is set. A new exit code, if one is
ever needed, uses the range 64–113: shells reserve 126, 127, 128 plus a signal
number, and 255, and `sysexits.h` is deprecated ([RESEARCH.md](./RESEARCH.md) section 2).

### 7.7 Async work and external programs

- All I/O is asynchronous. Synchronous `fs` is allowed only while `main.ts` starts up.
- No floating promise: each is awaited, returned, or discarded with a comment saying why.
- Every external program runs without a shell, with an argument array, a timeout
  and the command's `AbortSignal`.
- Large files are read as streams or in chunks, never loaded whole without a size limit.

### 7.8 Command-line interface

Based on the guidelines in [RESEARCH.md](./RESEARCH.md) section 2.

| Area | Rule |
|---|---|
| Help | `-h`, `--help` and `kiriya help <module> [command]`. Help starts with examples. An unknown command suggests the closest one. |
| Version | `-V`, `--version` and `kiriya version` |
| Flags over positions | Positional arguments only for the obvious subject (`kiriya port kill 3000`); everything else is a named flag. Standard names: `--dry-run`, `--force`, `--quiet`, `--json`, `--no-input`. Secrets are never accepted as flag values. |
| Streams | Data on stdout; messages, progress and prompts on stderr. `-` means stdin or stdout where a file is expected. |
| Formats | Text on a terminal; `--json` on every command; `--plain` for plain tabular text suited to `grep` and `awk`; JSON Lines for commands that stream (`watch`, `files tail`). Tables have no borders. |
| Colour | Through Node's `util.styleText`, which turns colour off for a stream that is not a terminal, for `NO_COLOR` and `NODE_DISABLE_COLORS`, and on for `FORCE_COLOR`; kiriya adds `KIRIYA_NO_COLOR`, `TERM=dumb` and `--no-color`, and decides for stdout and stderr separately |
| Prompts | Only when stdin is a terminal. `--no-input` never prompts and fails naming the flag that was needed. Ctrl+C always stops the command. |
| Responsiveness | Each run loads only the invoked command's module: the prototype, loading all 80 modules, took about 230 ms against about 70–110 ms for Node alone. Work that may take longer than a second shows progress on stderr first. Start-up time of `kiriya --version` is measured in CI and may not grow by more than 20% between releases. |
| Precedence | Flags, then environment variables, then the user config file, then defaults |
| Stability | Each command's JSON shape is a public contract, covered by golden tests. Removing or renaming a field is a breaking change. |

### 7.9 i18n and configuration

- Every user-facing message is a key in `src/i18n/locales/en.ts`, which the `MessageKey`
  type is derived from. Another locale is typed as `Catalog`, so the compiler fails when
  it lacks a key, and a test fails on a key no source file uses. JSON output keeps keys
  and parameters, so scripts never depend on wording.
- Only English ships at first. A later locale is chosen with `--lang` or
  `KIRIYA_LANG`, never from the OS locale automatically, because terminals do not
  yet shape complex scripts such as Myanmar correctly
  ([RESEARCH.md](./RESEARCH.md) section 2).
- Configuration is one JSON file per user. It never holds a secret, is validated on
  load with an error naming the file and field, and is written atomically.
- File locations, following the XDG Base Directory specification on Linux and the
  platform folders elsewhere ([RESEARCH.md](./RESEARCH.md) section 2):

  | | Windows | Linux | macOS |
  |---|---|---|---|
  | Config | `%APPDATA%\kiriya\config.json` | `$XDG_CONFIG_HOME/kiriya/config.json`, default `~/.config` | `~/Library/Application Support/kiriya/config.json` |
  | Cache | `%LOCALAPPDATA%\kiriya\Cache` | `$XDG_CACHE_HOME/kiriya`, default `~/.cache` | `~/Library/Caches/kiriya` |

  A relative XDG value is ignored, as the specification recommends. On macOS kiriya
  uses Application Support rather than Preferences, which holds system-managed
  property lists. `KIRIYA_CONFIG` overrides the config file location.

### 7.10 Logging

- Only through the `Logger` port. The adapter writes JSON lines to stderr, and only
  with `--debug` or `KIRIYA_DEBUG=1`.
- Log command ids and argument names, never argument values, file contents,
  environment values, tokens or passwords.

### 7.11 Safety invariants

Each invariant has a test that runs on every OS.

1. A command writes, moves or deletes only if its spec says `write` or `destroy`.
2. `destroy` work needs a typed confirmation: typed at the prompt, or passed as
   `--confirm=<exact value>` in a script. `--yes` never satisfies it, no terminal
   and no `--confirm` means refusal, and over MCP it needs an elicitation the user accepts.
3. `delete` goes to the trash unless `--permanent`.
4. Drive roots, the home folder, the working folder and its parents, and
   operating-system folders are refused.
5. Nothing existing is replaced without `--overwrite` and a typed confirmation.
6. Globs do not enter hidden or dependency folders without `--all`.
7. No secret value is printed: `env show` masks values of secret-looking keys
   unless `--reveal`.
8. No network access from a command whose spec says `usesNetwork: false`.
9. An archive entry that would land outside its target folder stops the extraction.
10. No adapter starts a program through `cmd.exe`, `sh` or a PowerShell command
    built from user input; arguments are always passed as an array.
11. Over MCP, a path outside the server's roots is refused.

### 7.12 Testing

| Layer | Scope | Rules |
|---|---|---|
| Unit | `domain` and `application` | No file system, network, clock or randomness; ports are in-memory fakes. The majority of tests. |
| Contract | Each port | One suite per port, run against every adapter on its own OS |
| Integration | `infrastructure` | Real file system inside temporary folders, real git, processes the test started itself |
| End to end | The built CLI and MCP server | Exit codes, stdout and stderr separation, golden text in `en`, golden JSON |
| Boundaries | The source tree | A dependency-free script in `tools/` fails on a module importing another module, on a layer importing one section 6.1 does not allow, on a `node:` import in `domain` or any but `node:path` in `application`, on a catalog value import outside `main.ts`, and on any package import |

- Test the judgement calls: invalid input, empty results, conflicts, refusals,
  missing capabilities, timeouts. A test of only the easy case is not enough.
- Every safety invariant has a negative test proving the refusal.
- Deterministic: inject the clock and the random source; no dependence on test order.
- A flaky test is fixed or deleted the day it is found.
- **CI matrix:** Windows, Linux and macOS, each on Node 22, Node 24 and the Current release.
  While the repository is private, free CI is 2,000 minutes a month and macOS
  minutes cost about ten times Linux ones ([RESEARCH.md](./RESEARCH.md) section 4),
  so while it is private CI runs Linux and Windows on Node 22, and the full matrix runs
  when started by hand: before merging a change to adapters, paths or processes, and
  before a release. A public repository runs the full matrix on every push and pull request at no cost.

### 7.13 Comments and documentation

- Comment why, not what. A workaround or an OS quirk names its reason.
- No commented-out code, and no TODO without an issue number.
- Behaviour and its documentation change in the same pull request.
- `CHANGELOG.md` follows Keep a Changelog and gets an entry for every user-visible change.
- Command reference pages are generated from command specs, never written by hand.

### 7.14 Git and releases

- Conventional Commits: `feat(files): add tail`, `fix(port): handle IPv6 listeners`.
- Branches: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`; `main` is always releasable.
- Every pull request passes lint, format, typecheck and the full CI matrix.
- Semantic versioning. Command ids, flags, exit codes and JSON shapes are the
  public API; changing one is a major version after 1.0.
- Releases are built and published by CI only, never from a laptop.

### 7.15 Definition of done

A change is done when all of these hold:

1. It meets the acceptance criteria of its phase or issue.
2. Tests cover the new behaviour, including the negative cases, and pass on all three operating systems.
3. Lint, format, typecheck and the boundary check are clean.
4. The command has a safety level, `--json` output, messages in every locale, and a generated reference page.
5. Documentation and `CHANGELOG.md` are updated in the same pull request.
6. The author has read the whole diff once as if a stranger wrote it.

---

## 8. Key decisions

| Decision | Chosen | Rejected, and why |
|---|---|---|
| Repository | `github.com/SatPaingOo/kiriya`, private during development; made public just before the first npm release, because npm adds provenance only for public repositories | Designing in private keeps unfinished command contracts from being depended on. An organisation account can follow when contributors join. |
| npm package | Not published until the maintainer judges phases 0–2 and the phase 3 work ready | A published name and version are a promise; publishing half-built commands would break that promise on the first real change |
| Name | `kiriya` | `sayar` does not say "tool"; `bento` is buried under BentoPDF and BentoML in search; `commonkit` is long and generic. The npm name was free and no GitHub repository used it on 2026-09-13. |
| Language | TypeScript on Node.js | Go and Rust give a single binary and faster start-up, but the prototype is TypeScript and Node.js is already installed on most developer machines. Single-file binaries remain possible, section 9 phase 5. |
| Package shape | One npm package with boundaries enforced by tests | A workspace of packages from day one is premature; section 6.9 names the triggers. |
| Layout | Layers inside each module | One global set of layers spreads every tool across four folders and gives plugins a different shape from built-ins. |
| Dependencies | None at runtime | commander, zod, oclif and execa would each save code and each widen the supply chain of a tool that deletes files. |
| I/O | Asynchronous ports | Synchronous I/O, as in the prototype, blocks a long-running MCP server. |
| MCP implementation | A hand-written stdio server with no runtime dependency, tested end to end against a client built with the official TypeScript SDK as a development dependency | The official SDK v2 needs its core package and zod at runtime, and v1 depends on 17 packages including express and hono ([RESEARCH.md](./RESEARCH.md) section 3). The cost accepted: kiriya follows specification changes itself. |
| Confirmation in scripts | `--confirm=<exact value>` | Follows clig.dev for severe actions. `--yes` stays insufficient because it does not show the caller knows what will be destroyed. |
| Configuration scope | A user config file only | A project config file checked into a repository could make kiriya load code from a cloned repository. If one is ever added, it can never list plugins. |
| Plugins | In-process modules listed in config | Executables named `kiriya-*` on PATH, as git does, are simple but cannot share the safety policy, JSON output or MCP exposure. |
| Distribution | npm with trusted publishing and provenance first. Later, a kiriya Scoop bucket and a Homebrew tap that installs from npm with `depends_on "node"`, so neither needs a signed binary. Single-file binaries and winget only when Single Executable Applications accept an ESM entry in an LTS Node release (26, LTS from 2026-10-28) and signing costs nothing: SignPath Foundation for Windows if kiriya qualifies; no macOS binary while notarization needs the paid Apple Developer Program. | In Node 22 and 24 a single executable takes one CommonJS script and the feature is still in active development. Azure Artifact Signing accepts individual developers from the US and Canada only, and Apple charges US$99 a year, which breaks the free-to-build constraint. homebrew/core and the Scoop main bucket require popularity a new tool does not have yet ([RESEARCH.md](./RESEARCH.md) section 4). |

---

## 9. Plan

A phase is done when every acceptance criterion holds.

| Phase | Work | Done when |
|---|---|---|
| **0 — Spike** | A throwaway `spike/phase-0` branch with only port lookup, process lookup, clipboard and trash, run in CI on Windows, Linux and macOS, plus manual runs on a Mac without Full Disk Access and on Windows under Constrained Language Mode. The repository is public only while the spike's CI runs, then private again. | The same tests pass on all three; latency per operation is measured on each OS; the Put Back, UTF-8 clipboard and policy cases each have a recorded result; the native-helper question in section 10 is answered. An operation that cannot be made reliable is recorded with its reason. **CI part done 2026-09-13**, all six jobs passing; the three manual checks remain. |
| **1 — Core and files** | Repository, CI matrix, the core kernel, `files` and `archive` rebuilt on async ports with `--json` and message keys, contract and boundary tests, `ARCHITECTURE.md`, `CONTRIBUTING.md`, `AGENTS.md` | Every prototype `files` and `archive` behaviour has a passing test on all three operating systems. **Done 2026-09-13:** CI green on Windows, Linux and macOS with Node 22, 24 and the current release. |
| **2 — Remaining prototype modules** | `git`, `docker`, `config`, and the plugin loader with one example plugin | The prototype has no feature kiriya lacks, and the example plugin loads, runs and appears in `kiriya doctor`. **Done 2026-09-13:** CI green on Windows, Linux and macOS with Node 22, 24 and the current release. |
| **3 — First release** | The v1 modules in section 5.2; `LICENSE` (MIT), `CHANGELOG.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`; then, once the maintainer judges it ready, the repository made public and the package published to npm from CI through trusted publishing with provenance | A clean machine on each OS installs kiriya from the README alone, `kiriya doctor` passes, and `npm audit signatures` verifies the package. **In progress 2026-09-13:** the npm name `kiriya` and the `@kiriya` scope were still free. |
| **4 — AI** | `mcp` per section 6.8: `read` tools, then `write` tools behind `mcp.allowWrite`, then `destroy` tools behind `mcp.allowDestroy` and elicitation | A client built with the official SDK lists every tool with correct annotations, runs a `read` tool, is refused a path outside the roots, and cannot run a `destroy` tool without accepting an elicitation |
| **5 — Growth** | The v2 list and the research candidates; a kiriya Scoop bucket and Homebrew tap; winget and single-file binaries when section 8's condition holds | Users other than the maintainers report issues and depend on releases |

## 10. Open questions

| Question | Default if not answered |
|---|---|
| May kiriya ship small signed native helpers: a Windows executable for trash, clipboard and processes, and a macOS helper for trash with Put Back? | **Decided 2026-09-13: no.** Every operation worked without helpers in phase 0; a helper would only buy Windows speed and trash under application-control policies. |
| A short alias command, such as `kiri`? | No alias until users ask for one |

---

Last reviewed: 2026-09-13
