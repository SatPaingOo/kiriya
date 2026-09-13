# kiriya as an MCP server

`kiriya mcp` serves kiriya's commands to AI agents over the
[Model Context Protocol](https://modelcontextprotocol.io/). The agent's client starts it,
lists its tools and calls them, and kiriya runs each call the way the command line would,
under the same safety rules.

For now only commands that change nothing are offered. Commands that write or delete
come in later steps of phase 4 in [BLUEPRINT.md](../BLUEPRINT.md), each behind a setting.

## Add it to a client

A client starts `kiriya mcp` as a program and talks to it on stdin and stdout. Most
clients are configured with JSON like this:

```json
{
  "mcpServers": {
    "kiriya": {
      "command": "kiriya",
      "args": ["mcp", "--root", "/path/to/project"]
    }
  }
}
```

With Claude Code, from the project folder:

```bash
claude mcp add kiriya -- kiriya mcp
```

On Windows, `kiriya` installed by npm is a `.cmd` file, which some clients cannot start
directly. For those, set `"command": "cmd"` and `"args": ["/c", "kiriya", "mcp"]`.

## Roots

`--root <folder>` names a folder the agent may reach, and can be repeated. Without it,
the only root is the folder the server starts in. Relative paths start at the first root.

Every argument that names a file or folder must lie inside a root, both as written and
with symlinks followed, so neither `..` nor a link leads out. A glob is checked from the
folder it starts in, and a link that leads nowhere is refused. A path outside every
root comes back as an error with the key `core.mcp.outside-roots`, and the command
does not run.

Roots limit paths, not everything a command can see. As on the command line, `env`,
`sys`, `net`, `port`, `proc` and `clip paste` read the machine, and `config` reads
kiriya's own configuration file. Use your client's permission settings to choose which
tools an agent may call without asking.

## Tools

| Part | What kiriya sends |
|---|---|
| Name | The command id: `files.list`, `git.status`, `port.who` |
| Description | The command's summary from `kiriya help` |
| Input schema | One property per argument and option, named as in `kiriya help`. `files.grep` takes `{"pattern": "TODO", "paths": ["src"]}` |
| Output | The JSON document `--json` prints, as structured content and again as text |
| Annotations | All four: `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint` for commands that use the network |

A few options exist only for a person at a terminal and are not offered: `env show --reveal`,
so secret values stay hidden, and `docker logs --follow`, which never ends.

A command that fails, a refused path and a bad argument come back as a result with
`isError: true` and the typed error, so the model can correct its call. Lists keep their
first 200 items, and a result stays under about 40,000 characters; `truncated` in the
result names each cut and how much was left out.

## Protocol

| Topic | Behaviour |
|---|---|
| Versions | 2026-07-28, including `server/discover`. Clients that open with `initialize` are served too, for 2025-11-25, 2025-06-18, 2025-03-26 and 2024-11-05 |
| Transport | stdio: one JSON-RPC message per line on stdout, diagnostics on stderr. The server exits when stdin closes |
| Cancellation | `notifications/cancelled` stops the running command, and that request gets no answer |
| Standard input | It carries the protocol, so a command that would read piped text asks for the value as an argument instead |

To see it answer, send one request by hand:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"server/discover","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientCapabilities":{}}}}' | kiriya mcp
```
