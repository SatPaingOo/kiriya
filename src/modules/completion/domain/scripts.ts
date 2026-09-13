export const SHELLS = ["bash", "zsh", "fish", "powershell"] as const;
export type Shell = (typeof SHELLS)[number];

/*
 * Each script only gathers the words on the line and asks `kiriya completion suggest`
 * what can come next, so every shell completes the same way and plugins installed
 * later complete too. Words travel as --word=<word> and --current=<word>: Windows
 * PowerShell 5.1 drops empty arguments to programs, and a word such as --json must
 * never be read as an option of suggest itself. An empty answer hands completion
 * back to the shell, which then offers file names.
 */

const BASH = [
  "# kiriya completion for bash.",
  '# Load it from ~/.bashrc:  eval "$(kiriya completion bash)"',
  "_kiriya_complete() {",
  "  local IFS=$'\\n'",
  '  local args=("--current=${COMP_WORDS[COMP_CWORD]}")',
  "  local word",
  '  for word in "${COMP_WORDS[@]:1:COMP_CWORD-1}"; do',
  '    args+=("--word=$word")',
  "  done",
  "  local lines",
  '  lines=$(kiriya completion suggest "${args[@]}" 2>/dev/null) || return 0',
  '  if [ -z "$lines" ]; then',
  "    compopt -o default 2>/dev/null",
  "    COMPREPLY=()",
  "    return 0",
  "  fi",
  "  COMPREPLY=($(printf '%s\\n' \"$lines\" | cut -f1))",
  "}",
  "complete -F _kiriya_complete kiriya",
];

const ZSH = [
  "#compdef kiriya",
  "# kiriya completion for zsh.",
  '# Load it from ~/.zshrc, after compinit:  eval "$(kiriya completion zsh)"',
  "_kiriya() {",
  "  local -a args lines candidates",
  "  local word line tab=$'\\t'",
  '  args=("--current=${words[CURRENT]}")',
  '  for word in "${(@)words[2,CURRENT-1]}"; do',
  '    args+=("--word=$word")',
  "  done",
  '  lines=("${(@f)$(kiriya completion suggest "${args[@]}" 2>/dev/null)}")',
  '  if [[ -z "${lines[1]}" ]]; then',
  "    _files",
  "    return",
  "  fi",
  '  for line in "${lines[@]}"; do',
  '    candidates+=("${${line%%${tab}*}//:/\\\\:}:${line#*${tab}}")',
  "  done",
  "  _describe 'kiriya' candidates",
  "}",
  "compdef _kiriya kiriya",
];

const FISH = [
  "# kiriya completion for fish.",
  "# Save it once:  kiriya completion fish > ~/.config/fish/completions/kiriya.fish",
  "function __kiriya_complete",
  "    set -l words (commandline -opc)",
  "    set -l lines (kiriya completion suggest --current=(commandline -ct) --word=$words[2..-1] 2>/dev/null)",
  "    if test (count $lines) -eq 0",
  "        __fish_complete_path (commandline -ct)",
  "        return",
  "    end",
  "    printf '%s\\n' $lines",
  "end",
  "complete -c kiriya -f -a '(__kiriya_complete)'",
];

const POWERSHELL = [
  "# kiriya completion for PowerShell.",
  "# Load it from your profile:  kiriya completion powershell | Out-String | Invoke-Expression",
  "Register-ArgumentCompleter -Native -CommandName kiriya -ScriptBlock {",
  "    param($wordToComplete, $commandAst, $cursorPosition)",
  "    $words = @($commandAst.CommandElements | Select-Object -Skip 1 | ForEach-Object { $_.ToString() })",
  "    if ($wordToComplete -ne '' -and $words.Count -gt 0) { $words = @($words | Select-Object -SkipLast 1) }",
  '    $arguments = @("--current=$wordToComplete") + @($words | ForEach-Object { "--word=$_" })',
  "    kiriya completion suggest @arguments 2>$null | ForEach-Object {",
  '        $parts = $_ -split "`t", 2',
  "        $tip = if ($parts.Count -gt 1 -and $parts[1] -ne '') { $parts[1] } else { $parts[0] }",
  "        [System.Management.Automation.CompletionResult]::new($parts[0], $parts[0], 'ParameterValue', $tip)",
  "    }",
  "}",
];

const SCRIPTS: Readonly<Record<Shell, readonly string[]>> = {
  bash: BASH,
  zsh: ZSH,
  fish: FISH,
  powershell: POWERSHELL,
};

export function completionScript(shell: Shell): string {
  return `${SCRIPTS[shell].join("\n")}\n`;
}
