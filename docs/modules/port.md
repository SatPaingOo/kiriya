# kiriya port

Find what holds a TCP port, end it, or pick a free one, with the same commands on every OS,
instead of `netstat -ano` and `taskkill` on Windows or `lsof -i`, `ss` and `kill` on Linux
and macOS.

## Common tasks

### See what is using a port

```bash
kiriya port who 3000
```

`who` lists each process listening on the port, with its id and program. Leave the port out
to see every listening port on the machine:

```bash
kiriya port who
```

### Free a port a stuck process holds

```bash
kiriya port kill 3000
```

kiriya lists the processes it will end and asks you to type the port number, because ending
a process cannot be undone. The processes are asked to exit; `--force` ends them at once
instead. In a script, pass the port as the confirmation:

```bash
kiriya port kill 3000 --confirm=3000
```

### Pick a port for a development server

```bash
kiriya port free
kiriya port free --from 8080
```

`free` tries ports from 3000, or from `--from`, and prints the first one that nothing listens
on and that can be opened. The output is only the number, so a script can use it directly:

```bash
PORT=$(kiriya port free) npm run dev
```

```powershell
$env:PORT = kiriya port free; npm run dev
```

## Good to know

- Only listening TCP sockets count, over IPv4 and IPv6.
- Without administrator rights, Linux and macOS do not reveal which process of another user
  holds a port. kiriya shows it as another user's process, cannot end it, and never asks for
  elevation.
- kiriya never ends itself, the program that started it, or the operating system's first
  processes, even when one of them listens on the port.
- The port table comes from `netstat -ano` on Windows, `/proc/net/tcp` and `/proc/net/tcp6`
  on Linux, and `netstat` and `lsof` on macOS. Windows is the slowest, at under a second.
- Over MCP, `who` and `free` are offered to AI agents by default. `kill` needs
  `mcp.allowDestroy`, and asks you through the client before it ends anything.

## Related

- [proc](proc.md) finds and ends processes by name or id.
- [net](net.md) checks whether a port on another host answers.
- [wait](wait.md) waits until a port listens, or until it is free with `--gone`.

<!-- kiriya:reference -->
<!-- Written by `npm run docs` from the command specs. Change the specs, not this part. -->

## Reference

### `kiriya port free`

Print the first TCP port, from 3000 or --from, that nothing listens on and that can be opened.

```text
kiriya port free [options]
```

| Option | Description |
|---|---|
| `--from <port>` | The first port to try; 3000 by default. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya port free
kiriya port free --from 8080
PORT=$(kiriya port free)
```

### `kiriya port kill`

End the processes listening on a TCP port, after a typed confirmation.

```text
kiriya port kill <port> [options]
```

| Argument | Description |
|---|---|
| `port` | The port whose listeners to end. |

| Option | Description |
|---|---|
| `--force` | End them at once instead of asking them to exit. |
| `--confirm <port>` | For scripts: the port number, as the prompt would ask. Only at a terminal. |

- **Safety:** `destroy`, can do work that cannot be undone, and asks for a typed confirmation first
- **MCP:** offered to AI agents with elicitation when `mcp.allowDestroy` is `true`

```bash
kiriya port kill 3000
kiriya port kill 3000 --force --confirm=3000
```

### `kiriya port who`

Show the processes listening on a TCP port, or on every port.

```text
kiriya port who [port]
```

| Argument | Description |
|---|---|
| `port` | The port; every listening port when left out. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya port who 3000
kiriya port who
kiriya port who 5432 --json
```
<!-- /kiriya:reference -->
