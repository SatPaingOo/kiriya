# kiriya proc

List, find and end processes, and see them as a tree, with the same commands on every OS
instead of `tasklist`, `Get-Process` or `taskkill` on Windows and `ps` or `kill` elsewhere.

## Common tasks

### Find a process

```bash
kiriya proc find vite
kiriya proc find server.js
```

`find` matches the text, in any case, against each process's name and command line, so
`server.js` finds the `node` process that runs it.

To list processes with their memory, optionally by name:

```bash
kiriya proc list --name node
```

`--full` adds parent ids and command lines. A command line can hold a secret, such as a
password passed as an argument, and reading command lines is slower on Windows.

### See what started what

```bash
kiriya proc tree
kiriya proc tree 4100
```

`tree` shows every process under its parent, or only the tree under one process id.

### End a process

```bash
kiriya proc kill 4100
kiriya proc kill node
```

A number is a process id. Anything else is a program name, and every process with that
name ends; `.exe` is optional on Windows. kiriya lists the processes and asks you to type
the id or name exactly as you gave it, because ending a process cannot be undone. The
processes are asked to exit; `--force` ends them at once instead.

In a script, pass the same id or name as the confirmation:

```bash
kiriya proc kill node --confirm=node
```

## Good to know

- kiriya never ends itself, the program that started it, such as your shell, or the
  operating system's first processes. They are left out and reported.
- On Linux, kiriya names a process after its program file rather than its thread name, so a
  Node.js process is `node` on every OS.
- The process list comes from `tasklist` on Windows, with `Get-CimInstance` when command
  lines or parents are needed, from `/proc` on Linux, and from `ps` on macOS.
- Over MCP, `list`, `find` and `tree` are offered to AI agents by default. `list --full` needs
  `mcp.allowWrite`, since command lines can hold secrets, and `kill` needs
  `mcp.allowDestroy` and asks you through the client first.

## Related

- [port](port.md) finds and ends the process that holds a TCP port.

<!-- kiriya:reference -->
<!-- Written by `npm run docs` from the command specs. Change the specs, not this part. -->

## Reference

### `kiriya proc find`

Find processes whose name or command line contains some text.

```text
kiriya proc find <text>
```

| Argument | Description |
|---|---|
| `text` | The text to look for, in any case. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya proc find vite
kiriya proc find server.js --json
```

### `kiriya proc kill`

End a process by id, or every process with a name, after a typed confirmation.

```text
kiriya proc kill <target> [options]
```

| Argument | Description |
|---|---|
| `target` | A process id, or a program name such as node; .exe is optional. |

| Option | Description |
|---|---|
| `--force` | End them at once instead of asking them to exit. |
| `--confirm <id-or-name>` | For scripts: the id or name exactly as given, as the prompt would ask. Only at a terminal. |

- **Safety:** `destroy`, can do work that cannot be undone, and asks for a typed confirmation first
- **MCP:** offered to AI agents with elicitation when `mcp.allowDestroy` is `true`

```bash
kiriya proc kill 4100
kiriya proc kill node
kiriya proc kill node --force --confirm=node
```

### `kiriya proc list`

List processes with their memory, sorted by name.

```text
kiriya proc list [options]
```

| Option | Description |
|---|---|
| `--name <text>` | Only processes whose name contains this text, in any case. |
| `--full` | Add parent ids and command lines; slower on Windows. Can show secrets. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya proc list
kiriya proc list --name node
kiriya proc list --full --json
```

### `kiriya proc tree`

Show processes as a tree of parents and children, or the tree under one process.

```text
kiriya proc tree [pid]
```

| Argument | Description |
|---|---|
| `pid` | The process whose tree to show; every process when left out. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya proc tree
kiriya proc tree 4100
kiriya proc tree 4100 --json
```
<!-- /kiriya:reference -->
