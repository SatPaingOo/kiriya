# kiriya wait

Wait until a TCP port accepts connections, a web address answers, or a file appears, so a
script moves on only when the step before it is ready. One command on every OS, instead of
`wait-on`, an `until nc -z` loop in bash, or a `Test-NetConnection` loop in PowerShell.

Every `wait` command tries at once, then every half second, until the target is ready or
`--timeout` passes: 60 seconds by default, and at most an hour. When the target is ready,
kiriya prints one line and exits with 0. When the time runs out, it says what the last
attempt found and exits with 1. Nothing is printed while it waits, and Ctrl+C stops it at
once.

## Common tasks

### Wait for a database after starting it

```bash
kiriya docker up
kiriya wait port 5432
npm test
```

A bare number is a port on this machine. For another host, give `host:port`,
`[IPv6]:port`, or a URL whose scheme gives the port:

```bash
kiriya wait port db.internal:5432 --timeout 120
kiriya wait port [::1]:8080
```

Joined with `&&`, each step runs only when the one before it worked:

```bash
kiriya docker up && kiriya wait port 5432 && npm test
```

### Wait for a server's health check

```bash
kiriya wait url http://localhost:3000/health
kiriya wait url https://staging.example.com/ready --status 200 --status 204
```

`url` sends a GET and counts any 2xx status as ready. `--status` names the statuses that
count instead, such as `401` for an address that needs signing in. Redirects are not
followed, so a 3xx counts only when `--status` names it, and the response body is never
read. Certificates are checked as usual.

### Wait for a build output, or for a lock to go

```bash
kiriya wait file dist/app.js --timeout 300
kiriya wait file .build.lock --gone
```

`file` is ready when the file or folder exists, and with `--gone` when it no longer does.

### Wait until a port is free again

```bash
kiriya wait port 3000 --gone
```

This helps after stopping a server, before starting another one on the same port.

## Good to know

- One port attempt gives up after 2 seconds, and one URL attempt after 5, so a host that
  never answers is tried again instead of using up the whole timeout. The last attempt can
  end up to a quarter of a second after `--timeout`.
- When time runs out, the reason is one of these: the connection was refused, the host did
  not answer, its name is not in DNS, the network cannot reach it, its certificate was not
  accepted, or it answered with a status that does not count.
- `--json` returns `ready`, `attempts` and `waitedMs`, with what the last attempt found.
- Over MCP, `wait port` and `wait file` are offered to AI agents by default, and `wait url`
  needs `mcp.allowWrite`, because an address can carry any text to a website. Cancelling
  the call stops the wait.

## Related

- [docker](docker.md) starts the compose project whose services you wait for.
- [port](port.md) shows which process listens on a port on this machine.
- [net](net.md) checks a port or a name once.

<!-- kiriya:reference -->
<!-- Written by `npm run docs` from the command specs. Change the specs, not this part. -->

## Reference

### `kiriya wait file`

Wait until a file or folder exists, or until it is gone with --gone.

```text
kiriya wait file <path> [options]
```

| Argument | Description |
|---|---|
| `path` | The file or folder to wait for. |

| Option | Description |
|---|---|
| `--gone` | Wait until it no longer exists instead. |
| `--timeout <seconds>` | Seconds to wait before giving up, from 1 to 3600; 60 by default. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya wait file dist/app.js
kiriya wait file .build.lock --gone --timeout 300
```

### `kiriya wait port`

Wait until a TCP port accepts connections, or until nothing listens there with --gone.

```text
kiriya wait port <target> [options]
```

| Argument | Description |
|---|---|
| `target` | A port on this machine such as 5432, host:port, [IPv6]:port, or a URL whose scheme gives the port. |

| Option | Description |
|---|---|
| `--gone` | Wait until nothing listens there instead. |
| `--timeout <seconds>` | Seconds to wait before giving up, from 1 to 3600; 60 by default. |

- **Safety:** `read`, changes nothing
- **Network:** uses the network
- **MCP:** offered to AI agents by default

```bash
kiriya wait port 5432
kiriya wait port db.internal:5432 --timeout 120
kiriya wait port 3000 --gone
```

### `kiriya wait url`

Wait until a web address answers with a 2xx status, or with a status --status names.

```text
kiriya wait url <url> [options]
```

| Argument | Description |
|---|---|
| `url` | The http or https address to wait for. |

| Option | Description |
|---|---|
| `--status <code>` | A status that counts as ready, such as 200 or 401; any 2xx by default. Can be given more than once. |
| `--timeout <seconds>` | Seconds to wait before giving up, from 1 to 3600; 60 by default. |

- **Safety:** `read`, changes nothing
- **Network:** uses the network
- **MCP:** offered to AI agents when `mcp.allowWrite` is `true`

```bash
kiriya wait url http://localhost:3000/health
kiriya wait url https://example.com/ready --status 200 --status 204
```
<!-- /kiriya:reference -->
