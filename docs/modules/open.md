# kiriya open

Open a file or folder in the application the operating system chooses, or a web address in
the browser, with one command instead of `start` on Windows, `open` on macOS and `xdg-open`
on Linux.

## Common tasks

### Open a folder in the file manager

```bash
kiriya open .
```

### Open a file in its default application

```bash
kiriya open report.pdf
```

### Open a web address or a new email

```bash
kiriya open https://example.com/docs
kiriya open mailto:team@example.com
```

## Good to know

- `open` takes a file, a folder, or an `http`, `https` or `mailto` address. Any other scheme,
  such as `file:` or `javascript:`, is refused.
- A file that would run as a program when opened, such as an executable or a script, is
  refused. Open the folder that holds it instead.
- kiriya hands the target to `explorer.exe` on Windows, `open` on macOS and `xdg-open` on
  Linux, and never starts a program through a shell.
- Over MCP, `open` needs `mcp.allowWrite`, because a web address can carry any text to a
  website.

<!-- kiriya:reference -->
<!-- Written by `npm run docs` from the command specs. Change the specs, not this part. -->

## Reference

### `kiriya open`

Open a file or folder in its default application, or a web address in the browser.

```text
kiriya open <target>
```

| Argument | Description |
|---|---|
| `target` | A file, a folder, or an http, https or mailto address. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents when `mcp.allowWrite` is `true`

```bash
kiriya open .
kiriya open report.pdf
kiriya open https://example.com/docs
```
<!-- /kiriya:reference -->
