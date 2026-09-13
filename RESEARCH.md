# kiriya — Research

Prior art, guidelines and constraints that shaped [BLUEPRINT.md](./BLUEPRINT.md).

> Desk research collected on 2026-09-13 from the sources listed at the end.
> GitHub stars are from the GitHub search API that day; npm figures are weekly
> downloads for 2026-09-05 to 2026-09-11. Both are snapshots, not rankings.
> Anything that could not be verified is listed in section 7. Re-check the MCP and
> distribution facts before the phase that depends on them: both areas change
> within months.

---

## 1. Tools developers already reach for

| Category | Tools, and the pain they solve | Differs by OS? | Popularity |
|---|---|---|---|
| GUI toolboxes | DevToys, IT-Tools, CyberChef: converters, encoders, formatters [1][G]. CyberChef has a Node.js API but no CLI; IT-Tools has neither [120][121] | No | 31,990★ · 40,569★ · 35,821★ |
| Ports and processes | kill-port: kill whatever holds a port. fkill-cli: kill by PID, name or `:port` on all three OSes [2] | Yes | 570★ and 1.42M/wk · 7,005★ |
| Shell portability | rimraf: Windows `EPERM` and non-atomic unlink [3]. cross-env: `NODE_ENV=production` fails in Windows shells; archived 2025-11-19 [4]. shx: Unix commands in npm scripts [5]. trash-cli: the trash differs per OS [6] | Yes | 116.0M/wk · 18.2M/wk · 1.03M/wk · 22.0k/wk |
| Cleanup | npkill: find and delete heavy `node_modules` folders | No | 9,444★ |
| Environment | envinfo: environment report for bug reports. mise: tool versions, env vars, tasks; runs natively on Windows, though asdf plugins are Unix-only [118]. direnv: a Windows build exists, but `.envrc` runs through bash and a PowerShell issue has been open since 2024 [119]. dotenv-linter: lint `.env` files | Partly | 13.0M/wk · 33,843★ · 15,439★ · 2,104★ |
| Tasks | just: uses `sh` on Windows unless another shell is configured [7]. go-task. zx. concurrently | Yes, the shell | 35,767★ · 16,133★ · 45,740★ · 15.1M/wk |
| Watch, serve, wait | watchexec: run on change, reads `.gitignore`, all three OSes [8]. http-server. serve. json-server: mock REST API. wait-on: wait for files, ports, sockets or HTTP | Partly | 7,180★ · 5.27M/wk · 2.95M/wk · 75,705★ · 7.53M/wk |
| Data | jq. yq: YAML, JSON, XML, CSV, TOML, HCL. fx: JSON viewer. jc: command output to JSON | No | 35,590★ · 15,953★ · 20,624★ · 8,676★ |
| Metrics | tokei and cloc: count code. hyperfine: benchmark commands | No | 14,908★ · 23,521★ · 28,851★ |
| Git workflow | lefthook and husky: git hooks. commitizen and commitlint: Conventional Commits. git-cliff: changelogs | Partly | 3.29M/wk · 25.5M/wk · 1.19M/wk · 7.22M/wk · 12,230★ |
| Defensive security | gitleaks, trufflehog, secretlint: secret scanning. osv-scanner: vulnerable dependencies. license-checker: npm licences. mkcert: its `-install` writes system and Firefox trust stores and may need admin on Windows [9] | mkcert only | 29,282★ · 27,850★ · 926k/wk · 11,019★ · 715k/wk · 59,582★ |
| Other | httpie: HTTP client. tldr: cheat sheets. qrcode-terminal. cronstrue: explain cron expressions | No | 38,503★ · 63,689★ · 4.91M/wk · 2.61M/wk |

**Already covered by the blueprint:** fkill (`port`, `proc`), envinfo (`sys`), watchexec (`watch`), just and concurrently (`task`), trash-cli and rimraf (`files delete`), npkill (`files clean`).

**Ranked candidates not yet planned** (the ranking is a judgement, the figures are evidence):

| # | Candidate | Why |
|---|---|---|
| 1 | secrets scan | Defensive, stack-independent, a natural read-only MCP tool (gitleaks 29,282★) |
| 2 | wait for a port, URL or file | The glue between `compose up`, `serve` and CI (wait-on 7.53M/wk) |
| 3 | lines of code | Any stack; cheap context for agents (cloc 23,521★) |
| 4 | git hooks | Fits the multi-repository `git` module (husky 25.5M/wk) |
| 5 | HTTP requests with `--json` | httpie 38,503★ |
| 6 | command benchmarks | hyperfine 28,851★ |
| 7 | YAML, TOML and CSV in `json` queries | yq 15,953★; dependency-free parsers are the cost |
| 8 | commit lint and changelog | commitlint 7.22M/wk |
| 9 | mock REST server from a JSON file | json-server 75,705★ |
| 10 | vulnerability lookup through OSV | osv-scanner 11,019★ |
| 11 | dependency licence inventory beyond npm | license-checker 715k/wk |
| 12 | certificate inspection | Installing into trust stores stays out of scope [9] |
| 13 | QR code, for example of a `serve` URL | qrcode-terminal 4.91M/wk |
| 14 | cron explanation and next run times | cronstrue 2.61M/wk |
| 15 | cached tldr pages | tldr 63,689★ |

## 2. CLI design guidelines

| Topic | Guideline |
|---|---|
| Help | `-h`, `--help` and `help`; lead with examples; suggest a fix for a typo [10]. `--version`, `-V` and `version` [11]. |
| Flags | Prefer flags to positional arguments; standard names `-f/--force`, `-n/--dry-run`, `-q`, `--json`, `--no-input`, `-o`; never read secrets from flags; `-` means stdin or stdout [10]. |
| Streams | Output on stdout; messages and errors on stderr [10][11]. |
| Machine output | Human output by default, chosen by detecting a terminal; `--json` for structured output and `--plain` for plain tabular text suited to `grep` and `awk` [10]. Streams use JSON Lines: UTF-8, one value per line [12]. Tables have no borders [11]. |
| Colour | Off when output is not a terminal, when `NO_COLOR` is set and non-empty, when an app-specific variable such as `MYAPP_NO_COLOR` is set, when `TERM=dumb`, or with `--no-color`; stdout and stderr are checked separately [10][13]. Node's `util.styleText`, stable since 22.13.0, honours `NO_COLOR`, `NODE_DISABLE_COLORS`, `FORCE_COLOR` and the terminal check [14][82]. |
| Prompts | Only when stdin is a terminal. `--no-input` fails with instructions instead of prompting. Ctrl+C always works [10]. |
| Destructive actions | Mild: may confirm. Moderate: prompt and offer a dry run. Severe: type the resource name, or pass `--confirm="name"` in scripts [10]. |
| Responsiveness and config | Respond within 100 ms and show progress. Precedence: flags, environment, project config, user config, system config. No telemetry without consent [10]. |
| Exit codes | 0 success, anything else failure [10]. Shells reserve 1–2, 126, 127, 128+n (130 is Ctrl+C) and 255; custom codes belong in 64–113 [15]. `sysexits.h` is deprecated [16]. |
| Complex scripts in terminals | Cell width is mostly right: in the ucs-detect tests Windows Terminal scores 100% for Burmese, Terminal.app and xterm.js 96.3%, GNOME Terminal and iTerm2 95.5%; the classic Windows console was not tested [126]. Glyph shaping, meaning stacked consonants and reordered marks, is correct in no mainstream terminal [127]. Windows Terminal closed an Indic grapheme bug that also covers Myanmar marks as not planned [128]; VS Code's terminal breaks a Myanmar font that works in its editor [129]; Zed merged a combining-mark fix naming Myanmar in April 2026 [130]. The Debian installer offers Burmese only in its graphical mode [131]. |
| Directories | XDG Base Directory 0.8: `XDG_CONFIG_HOME` (`~/.config`), `XDG_DATA_HOME` (`~/.local/share`), `XDG_STATE_HOME` (`~/.local/state`), `XDG_CACHE_HOME` (`~/.cache`); paths must be absolute, and a relative value should be treated as invalid and ignored [17]. The env-paths library, which adds a `-nodejs` suffix to the name by default, maps these to `~/Library/Preferences`, `~/Library/Application Support`, `~/Library/Caches` and `~/Library/Logs` on macOS, and to `%APPDATA%\<app>\Config` and `%LOCALAPPDATA%\<app>\Data`, `\Cache` and `\Log` on Windows [18]. |

## 3. MCP

| Topic | Finding |
|---|---|
| Version | Current specification **2026-07-28**, published that day [19]. The `initialize` handshake and sessions are removed; each request carries its version and capabilities in `_meta`; servers must implement `server/discover`; server-to-client requests use a multi round-trip pattern; Roots, Sampling and Logging are deprecated, so directories are passed as tool parameters or server config and logs go to stderr [20][21]. |
| Tool definition | `name` (SHOULD be 1–128 characters from `A-Za-z0-9_-.`), `title`, `description`, `inputSchema` (JSON Schema 2020-12 by default, never null; a tool without arguments uses `{"type":"object","additionalProperties":false}`), optional `outputSchema`, `annotations`. With an `outputSchema`, `structuredContent` must conform, and the same JSON should be repeated as text. Execution failures return `isError: true`; an unknown tool is a JSON-RPC error. Tools should be listed in a stable order [22]. |
| Annotations | Defaults are `readOnlyHint=false`, `destructiveHint=true`, `idempotentHint=false`, `openWorldHint=true`. `destructiveHint` and `idempotentHint` only apply when the tool is not read-only. All are hints: clients MUST treat them as untrusted unless the server is trusted [22][23]. Asking users before tool calls is a non-binding principle; the binding text is a SHOULD to keep a human in the loop who can deny a call [22][24]. |
| Elicitation | The server returns an `InputRequiredResult` whose `inputRequests` map holds an `elicitation/create` request; the client retries the call with a new JSON-RPC id, `inputResponses` and any `requestState` [22][25]. Form mode allows flat string, number, integer, boolean and single- or multi-select enum fields. Users accept, decline or cancel, and servers MUST handle decline and cancel. Form mode MUST NOT ask for passwords, API keys, access tokens or payment details; those use URL mode [25]. |
| stdio | Newline-separated JSON-RPC with no newlines inside a message; stdout carries only MCP messages, stderr carries logs; clients cancel with `notifications/cancelled`; the server should exit when stdin closes [26]. |
| Security | Servers must validate inputs, enforce access control, rate-limit and sanitise outputs [22]. Local servers should use stdio [27]. Clients should sandbox local servers and limit file-system access [27]. Authorisation URLs must not be opened through `cmd.exe`, `sh` or PowerShell [27]. |
| SDK or by hand | The specification is defined by `schema.ts` [24], and the SDK page does not require an SDK [28]. The stdio format is plain JSON-RPC [26], so a hand-written server is feasible; that is an inference, not a statement in the specification. Clients that still send `initialize` fail against a server that speaks only the new protocol, unless the server supports both eras [21]. |
| SDK dependencies | Checked with `npm view` on 2026-09-13. `@modelcontextprotocol/sdk` 1.30.0 depends on 17 packages, including express, hono, jose, ajv and zod [29]. `@modelcontextprotocol/server` 2.0.0 depends on `@modelcontextprotocol/core` and zod, and core on zod, both Node 20 or later [30][31]. `@modelcontextprotocol/client` 2.0.0 depends on core, zod, jose, cross-spawn, eventsource, eventsource-parser and pkce-challenge. `serveStdio()` serves both protocol versions, choosing per connection from the first message [32]. |
| Client support, September 2026 | There is no official feature matrix any more. Elicitation: Claude Code yes [64]; Cursor yes [65]; VS Code yes since 1.102 (seen only in a search excerpt of its release notes); ChatGPT probably [66]; Claude's desktop app no as of spring 2026, newer status unconfirmed [67]; Zed no [68]; Windsurf does not list it. The 2026-07-28 version: Claude Code partly, and with stdio servers only when `MCP_PROTOCOL_NEGOTIATION=auto` [64]; Claude's apps rolling out [69]; the others unknown. A stdio server therefore has to speak both versions and work without elicitation. |
| Registry and bundles | The official MCP Registry is in preview and stores metadata only. Publishing needs the npm package first, `mcpName` in `package.json` equal to the server name, a `server.json` from `mcp-publisher init`, a GitHub or DNS ownership check, then `mcp-publisher publish` [70][71][72]. MCP Bundles (`.mcpb`, formerly DXT) are zip files with a `manifest.json`, built with `@anthropic-ai/mcpb` and used for one-click install in Claude's desktop app [73]. |

## 4. Distribution

| Channel | Finding |
|---|---|
| Node.js release lines | 26 is Current since 2026-05-05 and becomes LTS on 2026-10-28; 24 is Active LTS until its end of life on 2028-04-30; 22 is Maintenance LTS until 2027-04-30; 20 reached end of life on 2026-04-30 [40][75]. |
| npm trusted publishing | Works from GitHub-hosted runners, GitLab.com shared runners and CircleCI cloud, not self-hosted runners; needs npm 11.5.1+, Node 22.14.0+ and `id-token: write`; a package can require 2FA and refuse tokens [33]. It works from a private repository, but automatic provenance comes only from GitHub Actions and GitLab, and only for a public repository and a public package [33][34]. |
| npm provenance | Signed through Sigstore, verified with `npm audit signatures`; it proves where a package was built, not that the code is safe [34]. Classic tokens were revoked on 2025-12-09 [35]. The target for January 2027: tokens that bypass 2FA can only stage a publish, which a maintainer approves with 2FA [36]. |
| CI minutes | Standard GitHub-hosted runners are free in public repositories. A private repository on the Free plan gets 2,000 minutes a month [83]. Per-minute prices are Linux $0.006, Windows $0.010 and macOS $0.062 [84]. Older GitHub documentation says Windows and macOS consume included minutes at 2 and 10 times the Linux rate; the current pricing page no longer mentions multipliers, so whether they still apply is unverified [84]. |
| Code signing | macOS: notarization of Developer ID software needs the Apple Developer Program at US$99 a year, and a bare command-line binary can be notarized but its ticket cannot be stapled [76][77]. Windows: Azure Artifact Signing costs about $9.99 a month and accepts individual developers from the US and Canada only; OV and EV certificates cost about $150–400 a year, and no option skips SmartScreen reputation building; Smart App Control on Windows 11 blocks unsigned executables without reputation [78][79][80]. SignPath Foundation signs qualifying open-source projects for free, with SignPath Foundation shown as publisher [81]. An npm-installed JavaScript CLI runs through the user's existing `node` binary and is not what Gatekeeper and SmartScreen target; that it is never flagged is an inference, not a documented fact. |
| Single Executable Applications | Stability 1.1, active development, in Node 22, 24 and 26 [37][38][39]. Node 26 is Current; 24 and 22 are LTS [40]. In 22 and 24 the entry is one CommonJS script, `require()` loads only built-ins, re-signing is required on macOS and optional on Windows, and cross-platform builds must disable code cache and snapshots [37][38]. Node 25.5+ adds `--build-sea`; Node 26 accepts an ESM entry with `"mainFormat": "module"`, but not together with `useSnapshot`; SEA is tested on macOS arm64 only [39]. Only pnpm's standalone `@pnpm/exe` ships as a SEA, and `pnpm pack-app` needs Node 25.5+ and a CommonJS entry [41]; an Intel-macOS crash caused by a Node bug has since been closed [42]. |
| winget | YAML manifests submitted by pull request [43]; ZIP and portable installers supported [44]; `wingetcreate` can update and submit from CI, but accepts only a classic GitHub token with `public_repo` scope [45]. |
| Scoop | JSON manifest with `version`, `url`, `hash`, `bin`, `checkver`, `autoupdate` [46]. The main bucket requires 500 stars and 150 forks, so a new tool starts in its own bucket [47]. |
| Homebrew | A formula can `depends_on "node"` and run `npm install *std_npm_args` [48]. homebrew/core's audit code requires 30 forks, 30 watchers or 75 stars, tripled to 90, 90 or 225 for a self-submitted tool, and a repository at least 30 days old; otherwise use a tap [49][74]. |
| Comparable tools | zx ships on npm, Homebrew, JSR and Docker [50]. Gemini CLI on npx, npm, Homebrew and MacPorts; its conda instructions install Node and then run npm [51]. esbuild as per-platform npm packages pulled in as optional dependencies [52]. |

## 5. Architecture patterns

| Pattern | Finding |
|---|---|
| Ports and adapters | An application "driven by users, programs, automated test or batch scripts" [53]: the CLI and the MCP server are two drivers of the same use cases; OS behaviour sits behind small ports. |
| Pure DI | Dependency injection "without a DI Container" [54]: wire by hand in one composition root; tests pass fakes. |
| Argument parsing | `util.parseArgs` is built into Node and stable since Node 20 [14]; a command registry replaces a `switch`. |
| External plugins | git runs any `git-<name>` executable on PATH and lists them in `git help -a` [55]. kubectl maps `kubectl-foo-bar` to `kubectl foo bar`, longest match wins, built-ins cannot be overridden, and `plugin list` warns about shadowing [56]. On Windows, `.cmd` and `.bat` files cannot run without a shell; the documented options are `cmd.exe /c`, `exec()` or the `shell` option, and passing arguments together with `shell: true` is deprecated as DEP0190 [57][117]. |
| oclif | Plugins declared in `package.json` supply commands and hooks [58][59]; when a core plugin and a user-installed or linked plugin define the same command, the core plugin wins [116]; oclif itself is a runtime dependency. |

## 6. Similar all-in-one projects

| Project | What it is | How kiriya differs |
|---|---|---|
| Bun Shell (bun 95,953★) | Bun's `$` template: a bash-like shell with built-in `cd`, `ls`, `rm`, `cat`, `mkdir`, `mv` and more, documented as working on Windows, Linux and macOS and replacing rimraf and cross-env [123] | The closest match to kiriya's core problem, but only inside Bun scripts, and without previews, trash or typed confirmation |
| Deno task shell (deno 108,416★) | A cross-platform subset of sh for `deno task`: `cp`, `mv`, `rm`, `mkdir`, `cat`, pipes, redirects and globs [124] | Same problem for task scripts only; kiriya is a standalone command |
| PowerShell 7 (55,366★) | One shell on all three OSes; on Linux and macOS the Unix-style aliases are removed and Windows-only cmdlets are missing [125] | Its own language; kiriya works from any shell, PowerShell included |
| x-cmd (4,649★) | A POSIX shell and awk toolkit of 488+ modules, pitched at AI agents; on Windows it needs Git Bash, WSL, Cygwin or MinGW [122] | kiriya runs on native Windows with Node.js only |
| Nushell (40,496★) | A whole shell with built-ins such as `sys`, `ps`, `kill`, `http get`, `encode base64`, `hash`, `random uuid`, `watch` [61] | kiriya works inside the shell a developer already uses |
| devbox (12,354★), pkgx (9,916★), topgrade (4,515★) | Nix-based dev environments (Windows through WSL2), a portable package runner (native Windows experimental), and an all-package-manager updater [134][135][136] | Adjacent problems: installing and updating tools, not using them |
| DevToys CLI | A command-line companion to DevToys; extensions are .NET [60] | kiriya covers workflow tasks (files, ports, processes, git across repositories), not only converters |
| dtool (379★, Rust) | Encoding, hashing, JWT, UUID and QR tools [62] | Same difference |
| @devtools-cli/devtools-cli | Base64, JSON and UUID helpers; depends on chalk and commander; 5 downloads a week [63][N] | kiriya has no runtime dependencies |
| uutils/coreutils (24,073★), busybox-w32 (886★) | Portable Unix commands [G] | kiriya adds previews, trash, typed confirmation and `--json` |
| DesktopCommanderMCP (9,562★) | Terminal and file tools for AI agents over MCP [G] | kiriya gives people and agents one tool with the same safety levels |

## 7. OS adapters

What the planned process, port, clipboard and trash adapters run into on each
operating system. Latency measured on this project's own machine is in section 9.

| Operation | OS | Finding |
|---|---|---|
| Start-up cost | Windows | Windows PowerShell 5.1 with `-NoProfile` took 234–333 ms in 2018 measurements and pwsh 6.x 408–540 ms [85][86]; no rigorous figures exist for pwsh 7.4–7.6. Start-up can also stall on DNS lookups or without internet [85]. A 100 ms target is not reachable for any command that starts PowerShell. |
| Trash | Windows | Under an AppLocker or WDAC policy PowerShell runs in Constrained Language Mode, where Add-Type cannot load arbitrary C# or Win32 APIs and only three COM objects are allowed; cmdlets in Windows modules keep working [97]. An Add-Type trash path therefore fails under such a policy, and so does `Shell.Application` [97]. `SHFileOperation` was replaced by `IFileOperation` in Windows Vista and can return 0 when cancelled, so `fAnyOperationsAborted` must be checked [95]. sindresorhus/trash ships a small C helper that calls `IFileOperation` [93][94]; an unsigned bundled executable can be blocked by Smart App Control [96]. How common these policies are on developer machines: no data found. |
| Trash | macOS | Listing `~/.Trash` fails without Full Disk Access, even under sudo [98]. Protected folders restrict reading, not writing, so moving a file into `~/.Trash` should work without it; that is an inference [99]. A plain move loses Finder's Put Back. macOS 15 added `/usr/bin/trash`; sindresorhus/macos-trash says its Put Back is broken and uses `FileManager.trashItem` instead [100][102]. sindresorhus/trash falls back to a plain move on permission errors [101]. |
| Trash | Linux | The freedesktop.org specification requires a home trash; files on other filesystems go to `$topdir/.Trash/$uid` (sticky bit, not a symlink) or `$topdir/.Trash-$uid`, or may be copied to the home trash [103]. `gio trash` refuses system mounts by default [104]. trash-cli on WSL creates `.Trash-1000` folders on `/mnt/c` and `/mnt/d` [105]. sindresorhus/trash picks a trash per mount point, copies across devices, and on WSL sends Windows paths to the Recycle Bin through PowerShell [106]. |
| Clipboard | Windows | `clip.exe` reads stdin in the console code page, so UTF-8 text such as Myanmar comes out garbled [91]. clipboardy uses `Set-Clipboard` first and falls back to a bundled binary [92]. |
| Clipboard | Linux | Headless machines have no clipboard; clipboardy's own CI skips Ubuntu [92]. xclip fails without an X display. |
| Processes | Windows | `tasklist` took 165 ms and the native `fastlist` 14 ms in fastlist's measurement [87]; ps-list ships fastlist [88]. WMIC is being removed from Windows 11 [89]. Node.js has no process-listing API, and on Windows SIGINT, SIGTERM and SIGKILL all end a process immediately [115]. |
| Processes | Linux, macOS | Linux: `/proc` can be read with `node:fs`, but `hidepid` hides other users' processes. macOS: `ps`; ps-list notes that one of its methods truncates names to 15 characters [88]. |
| Ports | Windows | `netstat -ano` shows owning PIDs without elevation; only `-b` needs it [90]. kill-port uses `netstat -nao` and `taskkill` [113]. |
| Ports | Linux | `/proc/net/tcp` and `tcp6` are per network namespace and carry a `uid` column [110]; mapping a socket to a PID through `/proc/<pid>/fd` needs ptrace access, so another user's socket has no visible owner [111]. |
| Ports | macOS | `lsof` shows only the user's own processes unless run as root [112]. pid-port uses `netstat -anv`, then `lsof` [114]; one blog says macOS netstat shows no PIDs, which is unverified. |
| CI runners | All | `ubuntu-latest` is Ubuntu 24.04, `windows-latest` Windows Server 2025, `macos-latest` macOS 26 on arm64; Linux and macOS have passwordless sudo and Windows runs as administrator [107]. The Ubuntu image lists `xvfb`, `iproute2` and `net-tools` but not `xclip`, `xsel`, `wl-clipboard`, `lsof` or `gio` [108]. The macOS image pre-grants Full Disk Access to bash and Terminal, so CI cannot reproduce the permission failures users meet [109]. Clipboard and Recycle Bin behaviour on the Windows runner is undocumented, and sindresorhus/trash has its Windows CI disabled [106]. |

## 8. Not verified

- The 12 Factor CLI Apps article returned HTTP 403; its twelve factors were read from a mirror [132].
- The Bash manual returned HTTP 429; exit-code conventions come from TLDP [15].
- Single-executable binary sizes.
- How Myanmar text renders in the classic Windows console host.
- The exact Node.js version in which DEP0190 became a runtime warning.

- Whether Smart App Control alone forces PowerShell into Constrained Language Mode.
- Whether moving a file into `~/.Trash` works without Full Disk Access on current macOS.
- Clipboard and Recycle Bin behaviour on GitHub's Windows and macOS runners, and a clipboard under `xvfb` on Linux.
- How `gio trash` behaves on WSL `/mnt/c` and on container bind mounts.
- Start-up time of pwsh 7.4 and later, beyond this project's own measurement.
- How the `open` command should behave on each OS: not researched yet.

## 9. Measurements

Taken on 2026-09-13 on one Windows 11 machine (build 26200) from PowerShell 7.6.5
with `Measure-Command`, best and median of five runs. One machine only: read them as
orders of magnitude, not benchmarks.

| Operation | Best | Median |
|---|---|---|
| `node -e 0` on Node 22.12 | 80 ms | 112 ms |
| `node -e 0` on Node 24.14 | 67 ms | 70 ms |
| The prototype CLI printing one module's commands, all 80 modules loaded, Node 22 | 215 ms | 237 ms |
| `netstat -ano` | 30 ms | 33 ms |
| `tasklist /fo csv` | 711 ms | 753 ms |
| `powershell.exe -NoProfile -Command 1`, start-up only | 895 ms | 911 ms |
| `pwsh -NoProfile -Command "Get-Process"`, spawned | 470 ms | 481 ms |
| `powershell.exe -NoProfile -Command Get-Clipboard`, spawned | 1,119 ms | 1,197 ms |
| `Get-NetTCPConnection -State Listen` inside an already running PowerShell | 426 ms | 478 ms |
| `Get-CimInstance Win32_Process` inside an already running PowerShell | 225 ms | 242 ms |
| `Get-Process` inside an already running PowerShell | 15 ms | 19 ms |

Also observed on the same machine:

- `wmic.exe` is not present on this Windows 11 build.
- Node 22.12 ships ICU 76.1 and formats the `my` locale without any library:
  `၂၀၂၆ စက်တင်ဘာ ၁၃` for a date and `၁,၂၃၄,၅၆၇.၅` for a number. `Intl.PluralRules`
  reports only the category `other` for `my`.
- `@modelcontextprotocol/client` 2.0.0 exists; dependency lists in section 3 come from `npm view`.
- `kiriya` was still unregistered on npm.
- `license-checker`'s npm metadata was last modified on 2022-06-19; its latest version, 25.0.1, and its last commit date from 2019-01-10 [133].
- GitHub reports `kentcdodds/cross-env` as archived.

## 10. Phase 0 spike

Run in GitHub Actions on 2026-09-13 on Windows Server 2025, Ubuntu 24.04 and macOS 26
(arm64), each with Node 22.23.2 and 24.20.0; all six jobs passed. Full tables:
`spike/README.md` on the `spike/phase-0` branch.

| Finding | Evidence |
|---|---|
| Windows trash through `SHFileOperation` works on the runner and the file appears in the Recycle Bin | Recycle Bin listing checked in both jobs |
| With PowerShell forced into Constrained Language Mode, the trash adapter reports `CapabilityUnavailableError` | `__PSLockdownPolicy=4` probe in both Windows jobs |
| `clip.exe` garbles UTF-8; `Set-Clipboard` and `Get-Clipboard` round-trip Myanmar text | Both Windows jobs |
| `pbcopy` garbles UTF-8 under `LC_ALL=C` | Both macOS jobs |
| `/usr/bin/trash` works on macOS 26 and leaves the file in `~/.Trash` | Both macOS jobs, with the image's pre-granted Full Disk Access |
| The freedesktop.org layout, implemented with `node:fs`, handles a second mount; `gio trash` refuses it | tmpfs mount in both Ubuntu jobs |
| On Linux, Node 24 renames its main thread, so `/proc/<pid>/stat` reports `MainThread` | The first Ubuntu Node 24 job failed on this; fixed by reading `/proc/<pid>/exe` |
| Warm latency: Windows 0.35–0.66 s for processes, clipboard and trash, about 45 ms for ports; Linux and macOS under 100 ms for everything | Bench step in every job |
| Cold first calls on Windows took up to 5.0 s | Test diagnostics in the Windows jobs |

## Sources

- [G] https://api.github.com/search/repositories
- [N] https://api.npmjs.org/downloads/point/last-week/
- [1] https://github.com/DevToys-app/DevToys
- [2] https://github.com/sindresorhus/fkill-cli
- [3] https://github.com/isaacs/rimraf
- [4] https://github.com/kentcdodds/cross-env
- [5] https://github.com/shelljs/shx
- [6] https://github.com/sindresorhus/trash
- [7] https://raw.githubusercontent.com/casey/just/master/README.md
- [8] https://github.com/watchexec/watchexec
- [9] https://github.com/FiloSottile/mkcert
- [10] https://clig.dev/
- [11] https://github.com/flameddd/blog/blob/master/2019-06-15%EF%BC%9AAt%20Heroku%2012%20Factor%20CLI%20Apps.md (summary of https://medium.com/@jdxcode/12-factor-cli-apps-dd3c227a0e46)
- [12] https://jsonlines.org/
- [13] https://no-color.org/
- [14] https://nodejs.org/api/util.html
- [15] https://tldp.org/LDP/abs/html/exitcodes.html
- [16] https://man.freebsd.org/cgi/man.cgi?query=sysexits
- [17] https://specifications.freedesktop.org/basedir/latest/
- [18] https://github.com/sindresorhus/env-paths
- [19] https://blog.modelcontextprotocol.io/posts/2026-07-28/
- [20] https://modelcontextprotocol.io/specification/2026-07-28/changelog
- [21] https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning
- [22] https://modelcontextprotocol.io/specification/latest/server/tools
- [23] https://raw.githubusercontent.com/modelcontextprotocol/specification/main/schema/2026-07-28/schema.ts
- [24] https://modelcontextprotocol.io/specification/latest
- [25] https://modelcontextprotocol.io/specification/latest/client/elicitation
- [26] https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio
- [27] https://modelcontextprotocol.io/specification/latest/basic/security_best_practices
- [28] https://modelcontextprotocol.io/docs/sdk
- [29] https://registry.npmjs.org/@modelcontextprotocol/sdk/latest
- [30] https://registry.npmjs.org/@modelcontextprotocol/server/latest
- [31] https://registry.npmjs.org/@modelcontextprotocol/core/latest
- [32] https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28
- [33] https://docs.npmjs.com/trusted-publishers
- [34] https://docs.npmjs.com/generating-provenance-statements
- [35] https://github.blog/changelog/2025-12-09-npm-classic-tokens-revoked-session-based-auth-and-cli-token-management-now-available/
- [36] https://github.blog/changelog/2026-07-31-restricting-npm-bypass-2fa-granular-access-tokens/
- [37] https://nodejs.org/docs/latest-v22.x/api/single-executable-applications.html
- [38] https://nodejs.org/docs/latest-v24.x/api/single-executable-applications.html
- [39] https://nodejs.org/api/single-executable-applications.html
- [40] https://nodejs.org/en/about/previous-releases
- [41] https://pnpm.io/11.x/cli/pack-app
- [42] https://github.com/pnpm/pnpm/issues/11423
- [43] https://learn.microsoft.com/en-us/windows/package-manager/package/
- [44] https://learn.microsoft.com/en-us/windows/package-manager/winget/
- [45] https://github.com/microsoft/winget-create
- [46] https://github.com/ScoopInstaller/Scoop/wiki/App-Manifests
- [47] https://github.com/ScoopInstaller/Scoop/wiki/Criteria-for-including-apps-in-the-main-bucket
- [48] https://docs.brew.sh/Language-Specific-Formulae
- [49] https://docs.brew.sh/Package-Acceptance-Policy
- [50] https://google.github.io/zx/setup
- [51] https://github.com/google-gemini/gemini-cli
- [52] https://registry.npmjs.org/esbuild/latest
- [53] https://alistair.cockburn.us/hexagonal-architecture/
- [54] https://blog.ploeh.dk/2014/06/10/pure-di/
- [55] https://git-scm.com/docs/git-help
- [56] https://kubernetes.io/docs/tasks/extend-kubectl/kubectl-plugins/
- [57] https://nodejs.org/api/child_process.html
- [58] https://oclif.io/docs/plugins/
- [59] https://github.com/oclif/plugin-plugins
- [60] https://devtoys.app/doc/articles/extension-development/guidelines/command-line-tool.html
- [61] https://www.nushell.sh/commands/
- [62] https://github.com/guoxbin/dtool
- [63] https://registry.npmjs.org/@devtools-cli/devtools-cli/latest
- [64] https://code.claude.com/docs/en/mcp
- [65] https://cursor.com/docs/context/mcp
- [66] https://developers.openai.com/plugins/build/mcp-server
- [67] https://github.com/anthropics/claude-ai-mcp/issues/153
- [68] https://zed.dev/docs/ai/mcp
- [69] https://claude.com/blog/bringing-mcp-2026-07-28-to-claude
- [70] https://modelcontextprotocol.io/registry/about
- [71] https://modelcontextprotocol.io/registry/quickstart
- [72] https://modelcontextprotocol.io/registry/package-types
- [73] https://github.com/modelcontextprotocol/mcpb
- [74] https://raw.githubusercontent.com/Homebrew/brew/HEAD/Library/Homebrew/utils/shared_audits.rb
- [75] https://github.com/nodejs/Release
- [76] https://developer.apple.com/programs/enroll/
- [77] https://developer.apple.com/documentation/security/customizing-the-notarization-workflow
- [78] https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
- [79] https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart
- [80] https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation
- [81] https://signpath.org/terms
- [82] https://nodejs.org/en/blog/release/v22.13.0
- [83] https://docs.github.com/en/billing/concepts/product-billing/github-actions
- [84] https://docs.github.com/en/billing/reference/actions-runner-pricing
- [85] https://github.com/PowerShell/PowerShell/issues/6443
- [86] https://github.com/PowerShell/PowerShell/pull/8341
- [87] https://github.com/MarkTiedemann/fastlist
- [88] https://github.com/sindresorhus/ps-list
- [89] https://www.bleepingcomputer.com/news/microsoft/microsoft-wmic-will-be-removed-after-windows-11-25h2-upgrade/
- [90] https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/netstat
- [91] https://github.com/microsoft/WSL/issues/11047
- [92] https://github.com/sindresorhus/clipboardy
- [93] https://raw.githubusercontent.com/sindresorhus/trash/main/lib/windows.js
- [94] https://raw.githubusercontent.com/sindresorhus/recycle-bin/main/recycle-bin.c
- [95] https://learn.microsoft.com/en-us/windows/win32/api/shellapi/nf-shellapi-shfileoperationw
- [96] https://learn.microsoft.com/en-us/windows/security/application-security/application-control/app-control-for-business/appcontrol
- [97] https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_language_modes
- [98] https://developer.apple.com/forums/thread/122716
- [99] https://eclecticlight.co/2026/04/07/privacy-protected-folders/
- [100] https://github.com/sindresorhus/macos-trash
- [101] https://raw.githubusercontent.com/sindresorhus/trash/main/lib/macos.js
- [102] https://mjtsai.com/blog/2025/08/26/the-trash-command/
- [103] https://specifications.freedesktop.org/trash/latest/
- [104] https://docs.gtk.org/gio/method.File.trash.html
- [105] https://github.com/andreafrancia/trash-cli/issues/150
- [106] https://raw.githubusercontent.com/sindresorhus/trash/main/lib/linux.js
- [107] https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- [108] https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md
- [109] https://github.com/actions/runner-images/blob/main/images/macos/scripts/build/configure-tccdb-macos.sh
- [110] https://man7.org/linux/man-pages/man5/proc_pid_net.5.html
- [111] https://man7.org/linux/man-pages/man5/proc_pid_fd.5.html
- [112] https://ss64.com/mac/lsof.html
- [113] https://raw.githubusercontent.com/tiaanduplessis/kill-port/master/index.js
- [114] https://raw.githubusercontent.com/sindresorhus/pid-port/main/index.js
- [115] https://nodejs.org/api/process.html
- [116] https://github.com/oclif/core/blob/main/src/util/determine-priority.ts
- [117] https://github.com/nodejs/node/issues/58763
- [118] https://mise.jdx.dev/faq.html
- [119] https://github.com/direnv/direnv/issues/1274
- [120] https://github.com/gchq/CyberChef/wiki/Node-API
- [121] https://github.com/gchq/CyberChef/issues/1046
- [122] https://github.com/x-cmd/x-cmd
- [123] https://bun.com/docs/runtime/shell
- [124] https://docs.deno.com/runtime/reference/cli/task/
- [125] https://learn.microsoft.com/en-us/powershell/scripting/whats-new/unix-support
- [126] https://ucs-detect.readthedocs.io/results.html
- [127] https://thottingal.in/blog/2026/03/22/complex-scripts-in-terminal/
- [128] https://github.com/microsoft/terminal/issues/20413
- [129] https://github.com/xtermjs/xterm.js/issues/4867
- [130] https://github.com/zed-industries/zed/pull/53176
- [131] https://salsa.debian.org/installer-team/localechooser/-/raw/master/languagelist
- [132] https://panlw.github.io/15394417631263.html
- [133] https://api.deps.dev/v3/systems/npm/packages/license-checker
- [134] https://github.com/topgrade-rs/topgrade
- [135] https://www.jetify.com/docs/devbox/installing-devbox
- [136] https://github.com/pkgxdev/pkgx

---

Last reviewed: 2026-09-13
