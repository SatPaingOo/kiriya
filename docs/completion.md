# Tab completion

kiriya completes modules, commands, options, and option values such as
`--type mx`, in bash, zsh, fish and PowerShell. Where nothing more specific fits,
such as a path argument, the shell's own file name completion takes over.

Each script asks `kiriya completion suggest` what can come next, so plugins
installed later complete too, with nothing to reinstall.

| Shell | Turn it on |
|---|---|
| bash | Add `eval "$(kiriya completion bash)"` to `~/.bashrc` |
| zsh | Add `eval "$(kiriya completion zsh)"` to `~/.zshrc`, after `compinit` |
| fish | Run `kiriya completion fish > ~/.config/fish/completions/kiriya.fish` once |
| PowerShell | Add `kiriya completion powershell \| Out-String \| Invoke-Expression` to the file `$PROFILE` names |

Open a new shell afterwards. `kiriya completion <shell>` prints the script and
installs nothing, so it can be read before it is loaded.
