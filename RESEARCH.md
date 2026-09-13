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
| GUI toolboxes | DevToys, IT-Tools, CyberChef: converters, encoders, formatters [1][G] | No | 31,990★ · 40,569★ · 35,821★ |
| Ports and processes | kill-port: kill whatever holds a port. fkill-cli: kill by PID, name or `:port` on all three OSes [2] | Yes | 570★ and 1.42M/wk · 7,005★ |
| Shell portability | rimraf: Windows `EPERM` and non-atomic unlink [3]. cross-env: `NODE_ENV=production` fails in Windows shells; archived 2025-11-19 [4]. shx: Unix commands in npm scripts [5]. trash-cli: the trash differs per OS [6] | Yes | 116.0M/wk · 18.2M/wk · 1.03M/wk · 22.0k/wk |
| Cleanup | npkill: find and delete heavy `node_modules` folders | No | 9,444★ |
| Environment | envinfo: environment report for bug reports. mise: tool versions, env vars, tasks. direnv. dotenv-linter: lint `.env` files | Partly | 13.0M/wk · 33,843★ · 15,439★ · 2,104★ |
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
| Machine output | Human output by default, chosen by detecting a terminal; `--json` for structured output and `--plain` for line-based text [10]. Streams use JSON Lines: UTF-8, one value per line [12]. Tables have no borders [11]. |
| Colour | Off when output is not a terminal, when `NO_COLOR` is set and non-empty, when `TERM=dumb`, or with `--no-color` [10][13]. Node's `util.styleText` honours `NO_COLOR`, `FORCE_COLOR` and the terminal check [14]. |
| Prompts | Only when stdin is a terminal. `--no-input` fails with instructions instead of prompting. Ctrl+C always works [10]. |
| Destructive actions | Mild: may confirm. Moderate: prompt and offer a dry run. Severe: type the resource name, or pass `--confirm="name"` in scripts [10]. |
| Responsiveness and config | Respond within 100 ms and show progress. Precedence: flags, environment, project config, user config, system config. No telemetry without consent [10]. |
| Exit codes | 0 success, anything else failure [10]. Shells reserve 1–2, 126, 127, 128+n (130 is Ctrl+C) and 255; custom codes belong in 64–113 [15]. `sysexits.h` is deprecated [16]. |
| Directories | XDG Base Directory 0.8: `XDG_CONFIG_HOME` (`~/.config`), `XDG_DATA_HOME` (`~/.local/share`), `XDG_STATE_HOME` (`~/.local/state`), `XDG_CACHE_HOME` (`~/.cache`); relative values must be ignored [17]. The env-paths library maps these to `~/Library/Preferences`, `~/Library/Application Support`, `~/Library/Caches` and `~/Library/Logs` on macOS, and to `%APPDATA%\<app>\Config` and `%LOCALAPPDATA%\<app>\Data`, `\Cache` and `\Log` on Windows [18]. |

## 3. MCP

| Topic | Finding |
|---|---|
| Version | Current specification **2026-07-28**, published that day [19]. The `initialize` handshake and sessions are removed; each request carries its version and capabilities in `_meta`; servers must implement `server/discover`; server-to-client requests use a multi round-trip pattern; Roots, Sampling and Logging are deprecated, so directories are passed as tool parameters or server config and logs go to stderr [20][21]. |
| Tool definition | `name` (1–128 characters from `A-Za-z0-9_-.`), `title`, `description`, `inputSchema` (JSON Schema 2020-12 by default, never null; a tool without arguments uses `{"type":"object","additionalProperties":false}`), optional `outputSchema`, `annotations`. With an `outputSchema`, `structuredContent` must conform, and the same JSON should be repeated as text. Execution failures return `isError: true`; an unknown tool is a JSON-RPC error. Tools should be listed in a stable order [22]. |
| Annotations | Defaults are `readOnlyHint=false`, `destructiveHint=true`, `idempotentHint=false`, `openWorldHint=true`. `destructiveHint` and `idempotentHint` only apply when the tool is not read-only. All are hints: clients must not rely on them from untrusted servers, and hosts must get user consent before tool calls [22][23][24]. |
| Elicitation | The server answers with `resultType:"input_required"` and an `elicitation/create` request; the client retries with `inputResponses`. Form mode allows only flat string, number, boolean or enum fields. Users accept, decline or cancel, and servers must handle all three. Form mode must never ask for passwords, API keys or tokens [22][25]. |
| stdio | Newline-separated JSON-RPC with no newlines inside a message; stdout carries only MCP messages, stderr carries logs; clients cancel with `notifications/cancelled`; the server should exit when stdin closes [26]. |
| Security | Servers must validate inputs, enforce access control, rate-limit and sanitise outputs [22]. Local servers should use stdio [27]. Clients should sandbox local servers and limit file-system access [27]. Authorisation URLs must not be opened through `cmd.exe`, `sh` or PowerShell [27]. |
| SDK or by hand | The specification is defined by `schema.ts` [24], and the SDK page does not require an SDK [28]. The stdio format is plain JSON-RPC [26], so a hand-written server is feasible; that is an inference, not a statement in the specification. Clients that still send `initialize` fail against a server that speaks only the new protocol, unless the server supports both eras [21]. |
| SDK dependencies | `@modelcontextprotocol/sdk` 1.30.0 depends on 17 packages, including express, hono, jose, ajv and zod [29]. `@modelcontextprotocol/server` 2.0.0 depends on `@modelcontextprotocol/core` and zod, Node 20 or later [30][31]; it speaks the 2025 protocol by default, and `serveStdio()` serves both eras [32]. |

## 4. Distribution

| Channel | Finding |
|---|---|
| npm trusted publishing | Works from GitHub Actions, GitLab.com and CircleCI cloud, not self-hosted runners; needs npm 11.5.1+, Node 22.14.0+ and `id-token: write`; adds provenance automatically for public repositories; a package can require 2FA and refuse tokens [33]. |
| npm provenance | Signed through Sigstore, verified with `npm audit signatures`; it proves where a package was built, not that the code is safe [34]. Classic tokens were revoked on 2025-12-09 [35]; from January 2027 tokens that bypass 2FA can only stage a publish [36]. |
| Single Executable Applications | Stability 1.1, active development, in Node 22, 24 and 26 [37][38][39]. Node 26 is Current; 24 and 22 are LTS [40]. In 22 and 24 the entry is one CommonJS script, `require()` loads only built-ins, signatures must be removed and re-applied on macOS and Windows, and cross-platform builds must disable code cache and snapshots [37][38]. Node 25.5+ adds `--build-sea`; Node 26 accepts an ESM entry; SEA is tested on macOS arm64 only [39]. pnpm 11 ships as a SEA [41]; an Intel-macOS crash in pnpm 11.0.3 has since been closed [42]. |
| winget | YAML manifests submitted by pull request [43]; ZIP and portable installers supported [44]; `wingetcreate` can update and submit from CI with a classic GitHub token [45]. |
| Scoop | JSON manifest with `version`, `url`, `hash`, `bin`, `checkver`, `autoupdate` [46]. The main bucket requires 500 stars and 150 forks, so a new tool starts in its own bucket [47]. |
| Homebrew | A formula can `depends_on "node"` and run `npm install *std_npm_args` [48]. homebrew/core needs 90 forks, 90 watchers or 225 stars for a self-submitted tool, and a repository older than 30 days; otherwise use a tap [49]. |
| Comparable tools | zx ships on npm, Homebrew, JSR and Docker [50]. Gemini CLI on npx, npm, Homebrew, MacPorts and conda [51]. esbuild as per-platform npm packages pulled in as optional dependencies [52]. |

## 5. Architecture patterns

| Pattern | Finding |
|---|---|
| Ports and adapters | An application "driven by users, programs, automated test or batch scripts" [53]: the CLI and the MCP server are two drivers of the same use cases; OS behaviour sits behind small ports. |
| Pure DI | Dependency injection "without a DI Container" [54]: wire by hand in one composition root; tests pass fakes. |
| Argument parsing | `util.parseArgs` is built into Node and stable since Node 20 [14]; a command registry replaces a `switch`. |
| External plugins | git runs any `git-<name>` executable on PATH and lists them in `git help -a` [55]. kubectl maps `kubectl-foo-bar` to `kubectl foo bar`, longest match wins, built-ins cannot be overridden, and `plugin list` warns about shadowing [56]. On Windows, `.cmd` and `.bat` plugins need `cmd.exe /c`, because `spawn` with the `shell` option is deprecated for this [57]. |
| oclif | Plugins declared in `package.json` supply commands and hooks [58]; user-installed plugins override built-ins [59]; oclif itself is a runtime dependency. |

## 6. Similar all-in-one projects

| Project | What it is | How kiriya differs |
|---|---|---|
| Nushell (40,496★) | A whole shell with built-ins such as `sys`, `ps`, `kill`, `http get`, `encode base64`, `hash`, `random uuid`, `watch` [61] | kiriya works inside the shell a developer already uses |
| DevToys CLI | A command-line companion to DevToys; extensions are .NET [60] | kiriya covers workflow tasks (files, ports, processes, git across repositories), not only converters |
| dtool (379★, Rust) | Encoding, hashing, JWT, UUID and QR tools [62] | Same difference |
| @devtools-cli/devtools-cli | Base64, JSON and UUID helpers; depends on chalk and commander; 5 downloads a week [63][N] | kiriya has no runtime dependencies |
| uutils/coreutils (24,073★), busybox-w32 (886★) | Portable Unix commands [G] | kiriya adds previews, trash, typed confirmation and `--json` |
| DesktopCommanderMCP (9,562★) | Terminal and file tools for AI agents over MCP [G] | kiriya gives people and agents one tool with the same safety levels |

## 7. Not verified

- The 12 Factor CLI Apps article returned HTTP 403; its points come from a second-hand summary [11].
- The Bash manual returned HTTP 429; exit-code conventions come from TLDP [15].
- Whether `util.styleText` is still marked experimental.
- Whether direnv and mise work on Windows.
- Whether IT-Tools or CyberChef have a CLI.
- Single-executable binary sizes.
- Whether license-checker is still maintained.
- The package name of the official MCP TypeScript SDK's v2 client.

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

---

Last reviewed: 2026-09-13
