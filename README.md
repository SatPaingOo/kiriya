# kiriya

**One command-line toolbox for everyday developer work that behaves the same on Windows, Linux and macOS.**

**Status:** phase 3 in progress · every v1 module built · release files in place · MCP server started, read tools and write tools when allowed · not on npm yet · private repository · last reviewed 2026-09-14

> kiriya (ကိရိယာ, Burmese for "tool") has every module planned for its first release
> built and tested in CI on Windows, Linux and macOS, with Node.js 22, 24 and the current
> release. Every command answers `--json`. It is not published to npm yet, so the steps
> below build it from source.

## Install

kiriya needs [Node.js](https://nodejs.org/) 22.13 or later. Until the first npm
release, build it from a clone:

```bash
git clone https://github.com/SatPaingOo/kiriya.git
cd kiriya
npm ci
npm run build
npm link
```

`npm link` puts `kiriya` on your PATH, and `npm unlink --global kiriya` takes it off
again. Then see what your machine gives kiriya:

```bash
kiriya doctor
```

After the first release, `npm install --global kiriya` replaces these steps. To turn
on tab completion, see [docs/completion.md](./docs/completion.md).

## What it does

| Module | For example | Does |
|---|---|---|
| `files` | `kiriya files delete dist` | Everyday file work: list, find, grep, copy, move, rename, delete to the trash, sync, size |
| `archive` | `kiriya archive untar node.tar.gz` | zip and tar.gz, refusing entries that would escape their folder |
| `git` | `kiriya git status ~/code` | Status, fetch, pull and switch across every repository under a folder |
| `docker` | `kiriya docker up` | The compose project in the current folder |
| `port` | `kiriya port who 3000` | Which process holds a port, ending it, finding a free one |
| `proc` | `kiriya proc find vite` | List, find, end and show the tree of processes |
| `env` | `kiriya env check` | Variables with secrets hidden, PATH problems, `.env` against `.env.example` |
| `sys` | `kiriya sys report` | Machine facts and tool versions for a bug report |
| `net` | `kiriya net check db:5432` | Local addresses, TCP reachability, DNS |
| `convert` | `kiriya convert jwt < token.txt` | base64, hex, url, json, jwt, time and case, all offline |
| `gen` | `kiriya gen uuid --v7` | UUIDs, ULIDs, passwords and tokens |
| `clip` | `git log -1 \| kiriya clip copy` | The clipboard, with Unicode intact |
| `open` | `kiriya open .` | A file, folder or web address in its default application |
| `config` | `kiriya config list` | kiriya's own settings and plugins |
| `doctor` | `kiriya doctor` | What this machine offers kiriya |
| `completion` | `kiriya completion bash` | Tab completion for bash, zsh, fish and PowerShell |

`kiriya help <module>` lists a module's commands, and `kiriya help <module> <command>`
explains one. `kiriya mcp` serves kiriya's commands to AI agents over MCP, only
the ones that change nothing unless you allow more; see [docs/mcp.md](./docs/mcp.md).

## The problem

Every operating system does the same everyday developer tasks with different
commands: deleting to the trash, finding what holds a port, killing a process,
copying to the clipboard, searching files, checking PATH. Developers who switch
machines, teams that mix operating systems, and AI agents that run commands for
them all pay for that difference, usually with one-off scripts.

## The binding constraint

No runtime dependencies, free to build and run, and identical behaviour on
Windows, Linux and macOS, proven in CI rather than assumed.

## The riskiest assumption

Process, port, clipboard and trash operations can be made to behave identically
on all three operating systems through thin OS adapters, without runtime
dependencies, and stay reliable in CI.

**Answer, 2026-09-13:** yes, for every case CI can reach, on Windows, Ubuntu and
macOS with Node 22 and 24. Windows is the slow platform, at about 0.6 s per
operation. Details in [BLUEPRINT.md](./BLUEPRINT.md) section 3.

## Documents

| File | Holds |
|---|---|
| [BLUEPRINT.md](./BLUEPRINT.md) | What kiriya is, the tool catalog, architecture, code standards, decisions, plan |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | How the code is organised today, and how to add a command, module or adapter |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Setup, scripts, the checks every change passes, branches, commits and CI |
| [AGENTS.md](./AGENTS.md) | The same rules, gathered for AI coding agents |
| [docs/plugins.md](./docs/plugins.md) | How to write, install and check a plugin |
| [docs/completion.md](./docs/completion.md) | How to turn on tab completion in bash, zsh, fish and PowerShell |
| [docs/mcp.md](./docs/mcp.md) | How to serve kiriya to AI agents over MCP, and what it offers them |
| [docs/releasing.md](./docs/releasing.md) | How a release is prepared, published from CI and checked |
| [RESEARCH.md](./RESEARCH.md) | Prior art, CLI and MCP guidelines, distribution options, sources |
| [CHANGELOG.md](./CHANGELOG.md) | What each release adds and changes |
| [SECURITY.md](./SECURITY.md) | How to report a vulnerability privately |
| [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) | How contributors treat each other |
| [LICENSE](./LICENSE) | MIT |
