# kiriya

**One command-line toolbox for everyday developer work that behaves the same on Windows, Linux and macOS.**

**Status:** phase 1 in progress · core, `files` and `archive` built and tested · private repository · last reviewed 2026-09-13

> kiriya (ကိရိယာ, Burmese for "tool") is in its first build phase. The core, the
> `files` module (18 commands) and the `archive` module (zip, unzip) work, with
> `--json` on every command, and their tests pass on Windows; CI on Linux and macOS
> comes next. Nothing here is ready to install yet.

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
| [RESEARCH.md](./RESEARCH.md) | Prior art, CLI and MCP guidelines, distribution options, sources |
