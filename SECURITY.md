# Security policy

## Supported versions

Until 1.0, security fixes go into the latest release only.

## Reporting a vulnerability

Please report a vulnerability privately, never in a public issue. On the repository's
GitHub page, open the **Security** tab and choose **Report a vulnerability**. Only the
maintainer sees the report, and the fix and its advisory are prepared there before
anything is made public.

Include:

- the kiriya version, from `kiriya --version`;
- the output of `kiriya sys report`, which leaves out the host name;
- the steps that show the problem.

## What matters most

kiriya deletes, moves and overwrites files, ends processes and extracts archives. These
are the problems to report first:

- A command changes something although its safety level says it only reads.
- A command that cannot be undone runs without its typed confirmation, or accepts
  `--yes` in its place.
- A command changes a protected path, such as a drive root, the home folder or the
  working folder.
- An archive entry lands outside its target folder.
- `env show` prints a secret-looking value without `--reveal`, or the configuration file
  takes a secret.
- A program starts through a shell, or a script is built from user input.
- A command whose spec says it uses no network uses the network.

Plugins run with the same rights as kiriya itself. Report a problem in a plugin to that
plugin's authors.
