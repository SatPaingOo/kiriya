# kiriya net

Answer everyday network questions the same way on every OS, instead of `ipconfig` and
`Test-NetConnection` on Windows or `ip addr`, `nc` and `dig` on Linux and macOS.

## Common tasks

### See this machine's addresses

```bash
kiriya net ip
kiriya net ip --all
```

`ip` lists the address of each network interface. `--all` adds loopback addresses such as
`127.0.0.1`.

### Check that a service answers

```bash
kiriya net check localhost:5432
kiriya net check db.internal:5432 --timeout 10
kiriya net check https://example.com
kiriya net check [::1]:8080
```

`check` opens a TCP connection and reports how long the answer took and which address
answered. A web address's scheme gives the port, such as 443 for `https`. It shows that
something listens, not that the service behind it works.

When nothing answers, `check` says why, and exits with 1: the connection was refused, it
timed out, 5 seconds by default, the name is not in DNS, or the network cannot reach the
host.

### Look up a name

```bash
kiriya net dns example.com
kiriya net dns example.com --type mx
```

By default `dns` resolves the name as programs on this machine do: the hosts file first,
then DNS. `--type` asks DNS directly for records of one type: `a`, `aaaa`, `cname`, `mx`,
`txt` or `ns`.

## Good to know

- `check` and `dns` use the network; `ip` only reads this machine. Nothing changes.
- Over MCP, every `net` command is offered to AI agents by default, so an agent can reach
  any host this machine can, through `check` and `dns`.

## Related

- [port](port.md) shows which process listens on a port on this machine.
- [wait](wait.md) tries again until a port or a web address answers.

<!-- kiriya:reference -->
<!-- Written by `npm run docs` from the command specs. Change the specs, not this part. -->

## Reference

### `kiriya net check`

Check whether a TCP port answers, such as db.internal:5432 or https://example.com.

```text
kiriya net check <target> [options]
```

| Argument | Description |
|---|---|
| `target` | host:port, [IPv6]:port, or a URL whose scheme gives the port. |

| Option | Description |
|---|---|
| `--timeout <seconds>` | Seconds to wait, from 1 to 120; 5 by default. |

- **Safety:** `read`, changes nothing
- **Network:** uses the network
- **MCP:** offered to AI agents by default

```bash
kiriya net check localhost:5432
kiriya net check https://example.com
kiriya net check [::1]:8080
```

### `kiriya net dns`

Look up a name's addresses as programs here see them, or its DNS records of one type.

```text
kiriya net dns <name> [options]
```

| Argument | Description |
|---|---|
| `name` | The host name to look up. |

| Option | Description |
|---|---|
| `--type <system\|a\|aaaa\|cname\|mx\|txt\|ns>` | system (the default: the hosts file, then DNS), a, aaaa, cname, mx, txt or ns. |

- **Safety:** `read`, changes nothing
- **Network:** uses the network
- **MCP:** offered to AI agents by default

```bash
kiriya net dns example.com
kiriya net dns example.com --type mx
kiriya net dns localhost --json
```

### `kiriya net ip`

List this machine's network addresses.

```text
kiriya net ip [options]
```

| Option | Description |
|---|---|
| `--all` | Include loopback addresses. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya net ip
kiriya net ip --all --json
```
<!-- /kiriya:reference -->
