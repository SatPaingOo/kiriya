# kiriya

**One command-line toolbox for everyday developer work that behaves the same on Windows,
Linux and macOS.**

kiriya (ကိရိယာ, Burmese for "tool") saves remembering `del` and `rm`, `netstat -ano` and
`lsof -i`, `clip` and `pbcopy`, or writing a one-off script for each. It is one Node.js
program with no runtime dependencies. Every command answers `--json`, changes to many files
show a plan first, deletions go to the trash, and nothing that cannot be undone happens
until you type a confirmation. AI agents can use the same commands over MCP, under the same
rules.

## Install

kiriya needs [Node.js](https://nodejs.org/) 22.13 or later.

```bash
npm install --global kiriya
```

Then check what this machine gives it:

```bash
kiriya doctor
```

Every release is published from CI with [provenance](https://docs.npmjs.com/generating-provenance-statements),
so `npm audit signatures` can show which workflow built the copy you installed. Every module
below is tested on Windows, Linux and macOS with Node.js 22, 24 and the current release.

[Getting started](docs/getting-started.md) takes it from there, and
[CONTRIBUTING.md](CONTRIBUTING.md) covers building from source.

## Quick start

```bash
kiriya doctor                                   # what this machine offers kiriya
kiriya --help                                   # every module
kiriya help port                                # one module, with examples
kiriya port who 3000                            # which process holds port 3000
kiriya files find --name "*.log" --older 30d    # the same search in every shell
kiriya files delete dist --dry-run              # the plan, before anything changes
kiriya git status ~/code --json                 # every repository under a folder, as JSON
```

## Modules

<!-- kiriya:modules -->
<!-- Written by `npm run docs` from the command specs. Change the specs, not this part. -->

| Module | What it does |
|---|---|
| [`archive`](docs/modules/archive.md) | ZIP and tar.gz archives, made and opened the same way on every OS with no zip, tar or 7-Zip installed. |
| [`clip`](docs/modules/clip.md) | Copy text to the clipboard and paste it back, with Unicode intact on every OS. |
| [`completion`](docs/modules/completion.md) | Tab completion for kiriya's modules, commands, options and values in bash, zsh, fish and PowerShell. |
| [`config`](docs/modules/config.md) | kiriya's own settings, such as the plugins to load, in one file per user. |
| [`convert`](docs/modules/convert.md) | Convert text between base64, hex, URL encoding, JSON, JWT, times and cases, entirely on this machine. |
| [`docker`](docs/modules/docker.md) | docker compose for the project in the current folder, and a previewed clean-up of the engine. |
| [`doctor`](docs/modules/doctor.md) | Check what this machine gives kiriya: runtime, configuration, trash, clipboard, git, docker and plugins. |
| [`env`](docs/modules/env.md) | Environment variables, PATH and .env files, read the same way on every OS. |
| [`files`](docs/modules/files.md) | Files and folders: create, find, read, search, compare, copy, move, rename and delete, the same on every OS. |
| [`gen`](docs/modules/gen.md) | Random identifiers, passwords and tokens from the operating system's secure random source. |
| [`git`](docs/modules/git.md) | Git across every repository under a folder: status, fetch, pull and switch. |
| [`net`](docs/modules/net.md) | Local addresses, TCP reachability and DNS lookups, the same on every OS. |
| [`open`](docs/modules/open.md) | Open a file or folder in its default application, or a web address in the browser. |
| [`port`](docs/modules/port.md) | See which process listens on a TCP port, end it, or find a free port, the same on every OS. |
| [`proc`](docs/modules/proc.md) | List, find and end processes, and show them as a tree, the same on every OS. |
| [`sys`](docs/modules/sys.md) | This machine and the developer tools on it, described the same way on every OS. |
| [`wait`](docs/modules/wait.md) | Wait until a port listens, a web address answers or a file appears, the same way on every OS. |
<!-- /kiriya:modules -->

## AI agents

`kiriya mcp` serves these commands to AI agents over the Model Context Protocol. It offers
only commands that change nothing until you allow more, and asks you before any work that
cannot be undone. [MCP server](docs/guides/mcp.md) shows how to add it to a client.

## Documentation

| For | Read |
|---|---|
| Using kiriya | [Getting started](docs/getting-started.md) · [Usage](docs/usage.md) · [Modules](docs/modules/README.md) |
| Guides | [MCP server](docs/guides/mcp.md) · [Tab completion](docs/guides/completion.md) · [Plugins](docs/guides/plugins.md) |
| Contributing | [CONTRIBUTING.md](CONTRIBUTING.md) · [Architecture](docs/development/architecture.md) · [Design](docs/development/design.md) |
| Everything | [Documentation index](docs/README.md) |

## Project

[Changelog](CHANGELOG.md) · [Security policy](SECURITY.md) · [Code of conduct](CODE_OF_CONDUCT.md) ·
[MIT licence](LICENSE)
