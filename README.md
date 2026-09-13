# kiriya

**One command-line toolbox for everyday developer work that behaves the same on Windows, Linux and macOS.**

**Status:** design · private repository · no code yet · last reviewed 2026-09-13

> kiriya (ကိရိယာ, Burmese for "tool") is at the design stage. A working prototype
> of its first modules exists, tested on Windows only, and is the starting point
> for the first phase. Nothing here is ready to install yet.

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

## Documents

| File | Holds |
|---|---|
| [BLUEPRINT.md](./BLUEPRINT.md) | What kiriya is, the tool catalog, architecture, code standards, decisions, plan |
| [RESEARCH.md](./RESEARCH.md) | Prior art, CLI and MCP guidelines, distribution options, sources |
