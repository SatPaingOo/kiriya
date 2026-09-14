# kiriya clip

Copy text to the clipboard and paste it back with one command on every OS, instead of
`Set-Clipboard` on Windows, `pbcopy` on macOS, or `xclip` and `wl-copy` on Linux, and with
Unicode such as Myanmar text intact.

## Common tasks

### Copy the output of a command

```bash
git log -1 | kiriya clip copy
kiriya sys report | kiriya clip copy
```

### Copy a string or a file's text

```bash
kiriya clip copy "hello"
kiriya clip copy --file notes.md
```

### Paste into a file or another command

```bash
kiriya clip paste > notes.txt
kiriya clip paste | kiriya convert json
```

## Good to know

- `copy` warns when the text looks like a secret, such as a private key or a token, because
  clipboard history and other programs can read the clipboard.
- kiriya uses the clipboard program of each OS:

  | OS | Program |
  |---|---|
  | Windows | `Set-Clipboard` and `Get-Clipboard` in PowerShell; never `clip.exe`, which garbles UTF-8 |
  | macOS | `pbcopy` and `pbpaste`, with a UTF-8 locale |
  | Linux | `wl-copy` and `wl-paste` on Wayland, or `xclip` or `xsel` on X11 |

- On Linux, a machine without a desktop session has no clipboard, and kiriya says so.
  `kiriya doctor` shows which program it found.
- On Windows, starting PowerShell makes each call take up to a second, and the clipboard
  cannot be reached when PowerShell runs in Constrained Language Mode.
- Over MCP, `copy` and `paste` both need `mcp.allowWrite`: the clipboard can hold passwords
  that other programs put there.

<!-- kiriya:reference -->
<!-- Written by `npm run docs` from the command specs. Change the specs, not this part. -->

## Reference

### `kiriya clip copy`

Copy text from an argument, what is piped in, or a file to the clipboard.

```text
kiriya clip copy [text] [options]
```

| Argument | Description |
|---|---|
| `text` | The text to copy; - or nothing reads what is piped in. |

| Option | Description |
|---|---|
| `--file <path>` | Copy a text file's content instead. |

- **Safety:** `write`, can change things, in ways that can be undone
- **MCP:** offered to AI agents when `mcp.allowWrite` is `true`

```bash
kiriya clip copy "hello"
git log -1 | kiriya clip copy
kiriya clip copy --file notes.md
```

### `kiriya clip paste`

Print the text on the clipboard.

```text
kiriya clip paste
```

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents when `mcp.allowWrite` is `true`

```bash
kiriya clip paste
kiriya clip paste > notes.txt
kiriya clip paste --json
```
<!-- /kiriya:reference -->
