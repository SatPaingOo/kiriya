# kiriya completion

Tab completion for kiriya's modules, commands, options and option values in bash, zsh, fish
and PowerShell.

To turn it on, add one line to your shell's profile. [Tab completion](../guides/completion.md)
has the line for each shell.

## How it works

`kiriya completion <shell>` prints a short script and installs nothing, so you can read it
before you load it. When you press Tab, the script runs `kiriya completion suggest` with the
words typed so far, and kiriya answers with what can come next: a module, a command, an
option, or one of an option's values, such as `size` after `--sort`. Where nothing more
specific fits, such as a path, the shell's own file name completion takes over.

Because kiriya answers each time, a plugin completes as soon as it is listed in the
configuration, with nothing to reinstall.

## Good to know

- `completion suggest` is for the scripts, but running it by hand shows what a script
  receives:

  ```bash
  kiriya completion suggest --word=files --current=li
  ```

- Both commands change nothing. Over MCP they are offered to AI agents by default.

<!-- kiriya:reference -->
<!-- Written by `npm run docs` from the command specs. Change the specs, not this part. -->

## Reference

### `kiriya completion`

Print the completion script for a shell; its first lines say how to load it.

```text
kiriya completion <shell>
```

| Argument | Description |
|---|---|
| `shell` | bash, zsh, fish or powershell. One of `bash`, `zsh`, `fish`, `powershell`. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
eval "$(kiriya completion bash)"
kiriya completion fish > ~/.config/fish/completions/kiriya.fish
kiriya completion powershell | Out-String | Invoke-Expression
```

### `kiriya completion suggest`

Print what can come next on a command line, for the completion scripts to show.

```text
kiriya completion suggest [options]
```

| Option | Description |
|---|---|
| `--current <word>` | The word being completed, which may be empty. |
| `--word <word>` | A word before it on the command line, once for each word. Can be given more than once. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya completion suggest --word=files --current=li
kiriya completion suggest --current= --json
```
<!-- /kiriya:reference -->
