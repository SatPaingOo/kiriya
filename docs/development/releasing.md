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
4. Add a trusted publisher for the `kiriya` package: owner `SatPaingOo`, repository
   `kiriya`, workflow `release.yml`, environment `npm`. Every release publishes with no
   token anywhere; npm takes the job's OIDC identity as the credential.
5. Once publishing works, set the package's publishing access to require two-factor
   authentication and disallow tokens.
6. The MCP Registry needs no setup: the workflow signs in with GitHub OIDC, which lets it
   publish names under `io.github.SatPaingOo/`. The registry is in preview and may reset
   its data; after a reset, re-run the release's `mcp-registry` job.

Step 4 has an order problem the first time, worth knowing if you ever start another
package. npm keeps the trusted publisher in a package's settings, and a package nobody
has published has no settings, so the first version cannot authenticate with OIDC: npm
answers `404 Not Found` on the `PUT`, which means "not allowed" rather than "no such
name". kiriya's 0.1.0 went out through CI with a granular access token instead, passed
to the publish step as `NODE_AUTH_TOKEN` from a secret of the `npm` environment, and the
token was revoked as soon as the package existed. Such a token needs its **Bypass
two-factor authentication** option, which cannot be added afterwards, or the publish
stops with `EOTP`. Provenance is signed with the workflow's own OIDC identity, so it
works either way.

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

Run the **verify the published package** workflow, giving it the version:

```bash
gh workflow run verify.yml -f version=0.1.1
```

It installs kiriya from npm on a clean Windows, Linux and macOS runner — none of them
building from this repository — and checks what people actually receive: that the command
runs and is the version asked for, that `doctor` reports the machine, that the signature
and the provenance attestation verify, that a read-only command answers `--json`, that
deleting without a terminal refuses and changes nothing, that deleting to the trash works
on that operating system, and that the MCP Registry lists the version.

The registry can take a few minutes to serve a version that was just published, so the
install step retries for three minutes before giving up.

Two things the workflow cannot do, and a person still has to:

- Open the release's `.mcpb` file in Claude's desktop app, pick a folder, and ask the agent
  to list it.
- Try the clipboard and `open`, which need a desktop session that a runner does not have.

A release is done when the workflow is green on all three operating systems and the `.mcpb`
bundle has been opened once.
