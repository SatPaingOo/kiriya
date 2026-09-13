# Releasing

kiriya is published to npm by CI only, never from a laptop.
`.github/workflows/release.yml` runs when a GitHub release is published. It builds and
tests the release, checks it, and publishes it through npm trusted publishing. Because
the repository and the package are public, npm adds provenance.

## Once, before the first release

1. Make the repository public. npm adds provenance only for a public repository and
   a public package.
2. In the repository's settings, turn on private vulnerability reporting, which
   [SECURITY.md](../SECURITY.md) points reporters to.
3. On npmjs.com, turn on two-factor authentication for the publishing account.
4. Add a trusted publisher for the `kiriya` package: owner `SatPaingOo`, repository
   `kiriya`, workflow `release.yml`, environment `npm`.

   npmjs.com adds a trusted publisher in a package's settings. If it offers no way to
   add one before the package's first version exists, decide how that first version is
   published before going further. Publishing from a laptop would break the rule above.
5. Once publishing works, set the package's publishing access to require two-factor
   authentication and disallow tokens.

## Each release

1. On a branch, prepare the release in one pull request:
   - Set `version` in `package.json`. For the first release, also remove
     `"private": true`, which until then stops any publish.
   - In [CHANGELOG.md](../CHANGELOG.md), turn `## [Unreleased]` into
     `## [<version>] - <YYYY-MM-DD>`, and start a new empty `## [Unreleased]` above it.
2. Merge it once CI passes on every operating system.
3. On GitHub, create a release from `main` with the tag `v<version>`, such as `v0.1.0`,
   and publish it.
4. The release workflow stops, and publishes nothing, when:
   - the tag is not `v` followed by the version in `package.json`;
   - `package.json` is still private;
   - the changelog has no section for the version;
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

Phase 3 of [BLUEPRINT.md](../BLUEPRINT.md) is done when all of this passes on Windows,
Linux and macOS.
