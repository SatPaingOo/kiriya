# kiriya sys

Describe this machine and the developer tools on it the same way on every OS, instead of
`systeminfo`, `uname -a`, `sw_vers` and a version command for every tool.

## Common tasks

### Describe this machine

```bash
kiriya sys info
```

`info` shows the operating system and its version, the kernel, the processor, memory,
uptime, the host name, the locale and time zone, and the Node.js runtime kiriya runs on.

### See which developer tools are installed

```bash
kiriya sys tools
```

`tools` looks for node, python, dotnet, java, go, git and docker on PATH and shows the
version of each one it finds, and which ones it does not.

### Attach machine details to a bug report

```bash
kiriya sys report
kiriya sys report | kiriya clip copy
```

`report` prints both as Markdown, ready to paste into an issue, and leaves out the host name.

## Good to know

- Nothing changes, and nothing leaves the machine.
- The operating system's name comes from `/etc/os-release` on Linux and `sw_vers` on macOS.
- Over MCP, every `sys` command is offered to AI agents by default.

## Related

- [doctor](doctor.md) checks what kiriya itself can use on this machine.
- [env](env.md) shows environment variables and PATH problems.

<!-- kiriya:reference -->
<!-- Written by `npm run docs` from the command specs. Change the specs, not this part. -->

## Reference

### `kiriya sys info`

Show the operating system, processor, memory, uptime, locale and runtime.

```text
kiriya sys info
```

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya sys info
kiriya sys info --json
```

### `kiriya sys report`

Print machine facts and tool versions as Markdown for a bug report, without the host name.

```text
kiriya sys report
```

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya sys report
kiriya sys report --json
```

### `kiriya sys tools`

Find node, python, dotnet, java, go, git and docker, and their versions.

```text
kiriya sys tools
```

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya sys tools
kiriya sys tools --json
```
<!-- /kiriya:reference -->
