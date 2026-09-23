# Releasing

kiriya is published to npm by CI only, never from a laptop.
`.github/workflows/release.yml` runs when a GitHub release is published. It builds and
tests the release, checks it, and publishes it through npm trusted publishing. Because
the repository and the package are public, npm adds provenance. After npm, it publishes
[server.json](../../server.json), the server's metadata, to the
[MCP Registry](https://modelcontextprotocol.io/registry/about), which points MCP clients
at that npm package. It also builds the MCP bundle, `kiriya-<version>.mcpb`, and attaches it
to the GitHub release for one-click install in Claude's desktop app.

## Once, before the first release

1. Make the repository public. npm adds provenance only for a public repository and
   a public package.
2. In the repository's settings, turn on private vulnerability reporting, which
   [SECURITY.md](../../SECURITY.md) points reporters to.
3. On npmjs.com, turn on two-factor authentication for the publishing account.
4. Publish the first version with a token, because trusted publishing cannot start one.

   npmjs.com adds a trusted publisher in a package's settings, and a package that has
   never been published has no settings, so the first version cannot use OIDC. npm
   answers the attempt with `404 Not Found - PUT .../kiriya`, which means "not allowed"
   rather than "no such name". Publishing from a laptop would break the rule above, so
   the first version goes through CI with a token instead:

   - On npmjs.com create a granular access token that may read and write packages, with
     the shortest expiry offered.
   - Add it to the `npm` environment of this repository as the secret `NPM_TOKEN`, so
     only the publishing job can read it.
   - The publish step passes it as `NODE_AUTH_TOKEN`. Provenance still works: it is
     signed with the workflow's own OIDC identity, not with the token.

5. Add a trusted publisher for the `kiriya` package as soon as it exists: owner
   `SatPaingOo`, repository `kiriya`, workflow `release.yml`, environment `npm`. Then
   delete the `NPM_TOKEN` secret, revoke the token, and remove the `NODE_AUTH_TOKEN`
   block from the publish step. Every release after the first one publishes with no
   token anywhere.
6. Once publishing works, set the package's publishing access to require two-factor
   authentication and disallow tokens.
7. The MCP Registry needs no setup: the workflow signs in with GitHub OIDC, which lets it
   publish names under `io.github.SatPaingOo/`. The registry is in preview and may reset
   its data; after a reset, re-run the release's `mcp-registry` job.

## Each release

1. On a branch, prepare the release in one pull request:
   - Set `version` in `package.json`. For the first release, also remove
     `"private": true`, which until then stops any publish.
   - Set the same version in [server.json](../../server.json), in both places it appears.
   - In [CHANGELOG.md](../../CHANGELOG.md), turn `## [Unreleased]` into
     `## [<version>] - <YYYY-MM-DD>`, and start a new empty `## [Unreleased]` above it.
2. Merge it once CI passes on every operating system.
3. On GitHub, create a release from `main` with the tag `v<version>`, such as `v0.1.0`,
   and publish it.
4. The release workflow stops, and publishes nothing, when:
   - the tag is not `v` followed by the version in `package.json`;
   - `package.json` is still private;
   - the changelog has no section for the version;
   - `server.json` does not match `package.json`: its name, version, npm package or
     description;
   - the package would ship tests, tools, source maps or sources, or leave out the
     program, the licence, the readme or the changelog.

## After publishing

On a clean machine with each operating system:

```bash
npm install --global kiriya
kiriya doctor
```

Then confirm the signatures and provenance in any project:

```bash
npm install kiriya
npm audit signatures
```

And that the MCP Registry lists the new version:

```bash
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.SatPaingOo/kiriya"
```

Finally, on each operating system, open the release's `.mcpb` file in Claude's desktop app,
pick a folder, and ask the agent to list it.

The first release is done when all of this passes on Windows, Linux and macOS.
