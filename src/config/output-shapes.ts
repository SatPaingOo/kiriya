// Written by `npm run shapes` from each command's output type. Do not edit by hand.
// Its source is the TypeScript type itself, so changing an output changes this file.
import type { OutputShapes } from "../core/domain/output-shape.js";

export const OUTPUT_SHAPES: OutputShapes = {
  records: {
    "archive.TarOutput": {
      kind: "record",
      fields: {
        archive: {
          kind: "string",
        },
        entries: {
          kind: "number",
        },
        bytesIn: {
          kind: "number",
        },
        bytesOut: {
          kind: "number",
        },
        skippedLinks: {
          kind: "number",
        },
        compressed: {
          kind: "boolean",
        },
      },
    },
    "archive.ZipOutput": {
      kind: "record",
      fields: {
        archive: {
          kind: "string",
        },
        entries: {
          kind: "number",
        },
        bytesIn: {
          kind: "number",
        },
        bytesOut: {
          kind: "number",
        },
        skippedLinks: {
          kind: "number",
        },
      },
    },
    "archive.ListedTarEntry": {
      kind: "record",
      fields: {
        name: {
          kind: "string",
        },
        type: {
          kind: "choice",
          of: ["file", "directory", "link", "other"],
        },
        size: {
          kind: "number",
        },
        modifiedMs: {
          kind: "number",
        },
      },
    },
    "archive.ListedEntry": {
      kind: "record",
      fields: {
        name: {
          kind: "string",
        },
        isDirectory: {
          kind: "boolean",
        },
        size: {
          kind: "number",
        },
        compressedSize: {
          kind: "number",
        },
        modifiedMs: {
          kind: "number",
        },
      },
    },
    "clip.CopyOutput": {
      kind: "record",
      fields: {
        characters: {
          kind: "number",
          description: "Unicode characters, not UTF-16 units.",
        },
      },
    },
    "clip.PasteOutput": {
      kind: "record",
      fields: {
        text: {
          kind: "string",
        },
      },
    },
    "completion.ScriptOutput": {
      kind: "record",
      fields: {
        shell: {
          kind: "choice",
          of: ["bash", "zsh", "fish", "powershell"],
        },
        script: {
          kind: "string",
        },
      },
    },
    "completion.SuggestOutput": {
      kind: "record",
      fields: {
        suggestions: {
          kind: "list",
          of: {
            kind: "ref",
            named: "completion.Suggestion",
          },
        },
      },
    },
    "completion.Suggestion": {
      kind: "record",
      fields: {
        value: {
          kind: "string",
        },
        description: {
          kind: "string",
          nullable: true,
          description: "null for a value that explains itself, such as one of an option's choices.",
        },
      },
    },
    "config.GetOutput": {
      kind: "record",
      fields: {
        key: {
          kind: "string",
        },
        value: {
          kind: "unknown",
        },
      },
    },
    "config.KeysOutput": {
      kind: "record",
      fields: {
        keys: {
          kind: "list",
          of: {
            kind: "ref",
            named: "config.KeyInfo",
          },
        },
      },
    },
    "config.KeyInfo": {
      kind: "record",
      fields: {
        key: {
          kind: "string",
        },
        type: {
          kind: "choice",
          of: ["string", "list"],
        },
        description: {
          kind: "ref",
          named: "core.Message",
        },
        example: {
          kind: "string",
        },
        choices: {
          kind: "list",
          of: {
            kind: "string",
          },
          nullable: true,
          description: "The only values a setting takes; null when any value will do.",
        },
      },
    },
    "core.Message": {
      kind: "record",
      fields: {
        key: {
          kind: "string",
        },
        params: {
          kind: "unknown",
        },
      },
    },
    "config.ListOutput": {
      kind: "record",
      fields: {
        path: {
          kind: "string",
        },
        settings: {
          kind: "list",
          of: {
            kind: "ref",
            named: "config.Setting",
          },
        },
      },
    },
    "config.Setting": {
      kind: "record",
      fields: {
        key: {
          kind: "string",
        },
        value: {
          kind: "unknown",
          nullable: true,
          description: "null when the setting is not in the file.",
        },
        known: {
          kind: "boolean",
          description: "false for a setting in the file that kiriya does not read.",
        },
      },
    },
    "config.SetOutput": {
      kind: "record",
      fields: {
        key: {
          kind: "string",
        },
        value: {
          kind: "unknown",
        },
        previous: {
          kind: "unknown",
          nullable: true,
          description: "null when the setting was not in the file.",
        },
      },
    },
    "config.PathOutput": {
      kind: "record",
      fields: {
        path: {
          kind: "string",
        },
        exists: {
          kind: "boolean",
        },
      },
    },
    "config.UnsetOutput": {
      kind: "record",
      fields: {
        key: {
          kind: "string",
        },
        removed: {
          kind: "boolean",
          description: "false when the setting was not in the file.",
        },
      },
    },
    "convert.CaseOutput": {
      kind: "record",
      fields: {
        output: {
          kind: "string",
        },
      },
    },
    "convert.CodecOutput": {
      kind: "record",
      fields: {
        output: {
          kind: "string",
        },
      },
    },
    "convert.JsonOutput": {
      kind: "record",
      fields: {
        valid: {
          kind: "boolean",
        },
        output: {
          kind: "string",
          nullable: true,
          description:
            "The formatted or minified JSON, or what --get asked for; null with --check, when the JSON is invalid, and when the path was not there.",
        },
        line: {
          kind: "number",
          nullable: true,
          description: "Where the first error is, from 1; null when it is valid.",
        },
        column: {
          kind: "number",
          nullable: true,
        },
        path: {
          kind: "string",
          nullable: true,
          description: "The path --get asked for; null when none was.",
        },
        found: {
          kind: "boolean",
          nullable: true,
          description: "Whether that path was there; null when none was asked for.",
        },
        value: {
          kind: "unknown",
          description: "What was at the path, as JSON rather than as text; null when there was nothing to take.",
        },
      },
    },
    "convert.TimeOutput": {
      kind: "record",
      fields: {
        iso: {
          kind: "string",
        },
        epochSeconds: {
          kind: "number",
        },
        epochMs: {
          kind: "number",
        },
      },
    },
    "convert.JwtOutput": {
      kind: "record",
      fields: {
        header: {
          kind: "unknown",
        },
        payload: {
          kind: "unknown",
        },
        issuedAt: {
          kind: "string",
          nullable: true,
          description: "ISO 8601 times from the iat, nbf and exp claims; null when a claim is absent.",
        },
        notBefore: {
          kind: "string",
          nullable: true,
        },
        expiresAt: {
          kind: "string",
          nullable: true,
        },
        expired: {
          kind: "boolean",
          nullable: true,
          description: "Measured against this machine's clock; null without an exp claim.",
        },
      },
    },
    "docker.CleanOutput": {
      kind: "record",
      fields: {
        usage: {
          kind: "list",
          of: {
            kind: "ref",
            named: "docker.DiskUsage",
          },
        },
        volumes: {
          kind: "boolean",
        },
        results: {
          kind: "list",
          of: {
            kind: "ref",
            named: "docker.PruneResult",
          },
        },
      },
    },
    "docker.DiskUsage": {
      kind: "record",
      fields: {
        type: {
          kind: "string",
        },
        total: {
          kind: "string",
        },
        active: {
          kind: "string",
        },
        size: {
          kind: "string",
        },
        reclaimable: {
          kind: "string",
        },
      },
    },
    "docker.PruneResult": {
      kind: "record",
      fields: {
        target: {
          kind: "string",
          description: "container, image, network, builder or volume.",
        },
        succeeded: {
          kind: "boolean",
        },
        reclaimed: {
          kind: "string",
          nullable: true,
        },
      },
    },
    "docker.Container": {
      kind: "record",
      fields: {
        name: {
          kind: "string",
        },
        service: {
          kind: "string",
        },
        state: {
          kind: "string",
        },
        status: {
          kind: "string",
        },
        ports: {
          kind: "string",
        },
      },
    },
    "docker.ComposeProjectState": {
      kind: "record",
      fields: {
        name: {
          kind: "string",
        },
        status: {
          kind: "string",
        },
        configFiles: {
          kind: "string",
        },
      },
    },
    "docker.StartOutput": {
      kind: "record",
      fields: {
        project: {
          kind: "string",
        },
        file: {
          kind: "string",
        },
        services: {
          kind: "list",
          of: {
            kind: "string",
          },
        },
        succeeded: {
          kind: "boolean",
        },
        ports: {
          kind: "list",
          of: {
            kind: "ref",
            named: "docker.PortMapping",
          },
          description: "Ports the compose file publishes, for the services started.",
        },
      },
    },
    "docker.PortMapping": {
      kind: "record",
      fields: {
        host: {
          kind: "string",
        },
        service: {
          kind: "string",
        },
        target: {
          kind: "string",
        },
      },
    },
    "docker.LogsOutput": {
      kind: "record",
      fields: {
        project: {
          kind: "string",
        },
        succeeded: {
          kind: "boolean",
        },
      },
    },
    "docker.DownOutput": {
      kind: "record",
      fields: {
        project: {
          kind: "string",
        },
        volumes: {
          kind: "boolean",
        },
        succeeded: {
          kind: "boolean",
        },
      },
    },
    "doctor.DoctorOutput": {
      kind: "record",
      fields: {
        checks: {
          kind: "list",
          of: {
            kind: "ref",
            named: "doctor.DoctorCheck",
          },
        },
        plugins: {
          kind: "list",
          of: {
            kind: "ref",
            named: "core.LoadedPlugin",
          },
        },
        pluginProblems: {
          kind: "list",
          of: {
            kind: "ref",
            named: "core.PluginProblem",
          },
        },
      },
    },
    "doctor.DoctorCheck": {
      kind: "record",
      fields: {
        name: {
          kind: "string",
        },
        status: {
          kind: "choice",
          of: ["ok", "warn", "fail"],
        },
        detail: {
          kind: "ref",
          named: "core.Message",
        },
      },
    },
    "core.LoadedPlugin": {
      kind: "record",
      fields: {
        entry: {
          kind: "string",
          description: "As written in the configuration.",
        },
        id: {
          kind: "string",
        },
        name: {
          kind: "string",
          nullable: true,
        },
        version: {
          kind: "string",
          nullable: true,
        },
        location: {
          kind: "string",
          description: "The file kiriya imported.",
        },
        commands: {
          kind: "number",
        },
      },
    },
    "core.PluginProblem": {
      kind: "record",
      fields: {
        entry: {
          kind: "string",
        },
        reason: {
          kind: "ref",
          named: "core.Message",
        },
      },
    },
    "env.CheckOutput": {
      kind: "record",
      fields: {
        file: {
          kind: "string",
        },
        example: {
          kind: "string",
        },
        fileExists: {
          kind: "boolean",
        },
        expected: {
          kind: "number",
        },
        missing: {
          kind: "list",
          of: {
            kind: "string",
          },
        },
        empty: {
          kind: "list",
          of: {
            kind: "string",
          },
        },
        extra: {
          kind: "list",
          of: {
            kind: "string",
          },
        },
        duplicates: {
          kind: "list",
          of: {
            kind: "string",
          },
        },
        malformed: {
          kind: "list",
          of: {
            kind: "ref",
            named: "env.MalformedLine",
          },
        },
      },
    },
    "env.MalformedLine": {
      kind: "record",
      fields: {
        path: {
          kind: "string",
        },
        line: {
          kind: "number",
        },
      },
    },
    "env.PathOutput": {
      kind: "record",
      fields: {
        variable: {
          kind: "string",
        },
        separator: {
          kind: "string",
        },
        entries: {
          kind: "list",
          of: {
            kind: "ref",
            named: "env.PathEntry",
          },
        },
      },
    },
    "env.PathEntry": {
      kind: "record",
      fields: {
        index: {
          kind: "number",
          description: "From 1, in the order the OS searches.",
        },
        entry: {
          kind: "string",
        },
        folder: {
          kind: "string",
          description: "The folder the entry names, after quotes and `%NAME%` on Windows.",
        },
        status: {
          kind: "choice",
          of: ["ok", "missing", "duplicate", "empty", "relative", "not-a-folder"],
        },
        duplicateOf: {
          kind: "number",
          nullable: true,
          description: "The earlier entry this one repeats.",
        },
      },
    },
    "env.ShowOutput": {
      kind: "record",
      fields: {
        variables: {
          kind: "list",
          of: {
            kind: "ref",
            named: "env.ShownVariable",
          },
        },
        hidden: {
          kind: "number",
        },
      },
    },
    "env.ShownVariable": {
      kind: "record",
      fields: {
        name: {
          kind: "string",
        },
        value: {
          kind: "string",
          nullable: true,
          description: "null when the value is hidden.",
        },
        secret: {
          kind: "boolean",
          description: "The name or the value looks like a secret.",
        },
      },
    },
    "files.CleanOutput": {
      kind: "record",
      fields: {
        folder: {
          kind: "string",
        },
        candidates: {
          kind: "list",
          of: {
            kind: "ref",
            named: "files.CleanCandidate",
          },
          description: "Largest first.",
        },
        bytes: {
          kind: "number",
        },
        tracked: {
          kind: "number",
          description: "Matching folders left alone because git tracks files in them.",
        },
        removed: {
          kind: "number",
        },
      },
    },
    "files.CleanCandidate": {
      kind: "record",
      fields: {
        path: {
          kind: "string",
        },
        reason: {
          kind: "ref",
          named: "core.Message",
          description: "What recreates the folder.",
        },
        bytes: {
          kind: "number",
        },
      },
    },
    "files.CompareFilesOutput": {
      kind: "record",
      fields: {
        kind: {
          kind: "choice",
          of: ["files"],
        },
        a: {
          kind: "string",
        },
        b: {
          kind: "string",
        },
        identical: {
          kind: "boolean",
        },
        sizeA: {
          kind: "number",
        },
        sizeB: {
          kind: "number",
        },
        text: {
          kind: "ref",
          named: "files.TextDifference",
          nullable: true,
          description: "null when identical, or when either file is not text.",
        },
      },
    },
    "files.TextDifference": {
      kind: "record",
      fields: {
        sameText: {
          kind: "boolean",
          description: "Equal once line endings are ignored: only line endings or the encoding differ.",
        },
        encodingA: {
          kind: "choice",
          of: ["utf8", "utf8-bom", "utf16le", "utf16be"],
        },
        encodingB: {
          kind: "choice",
          of: ["utf8", "utf8-bom", "utf16le", "utf16be"],
        },
        line: {
          kind: "number",
          description: "The first line that differs, from 1.",
        },
        linesA: {
          kind: "number",
        },
        linesB: {
          kind: "number",
        },
        lineA: {
          kind: "string",
          nullable: true,
          description: "null past the end of the file.",
        },
        lineB: {
          kind: "string",
          nullable: true,
        },
      },
    },
    "files.CompareFoldersOutput": {
      kind: "record",
      fields: {
        kind: {
          kind: "choice",
          of: ["folders"],
        },
        a: {
          kind: "string",
        },
        b: {
          kind: "string",
        },
        entries: {
          kind: "number",
        },
        onlyInA: {
          kind: "list",
          of: {
            kind: "string",
          },
        },
        onlyInB: {
          kind: "list",
          of: {
            kind: "string",
          },
        },
        different: {
          kind: "list",
          of: {
            kind: "ref",
            named: "files.FolderDifference",
          },
        },
      },
    },
    "files.FolderDifference": {
      kind: "record",
      fields: {
        path: {
          kind: "string",
          description: "Relative, with `/`.",
        },
        reason: {
          kind: "choice",
          of: ["content", "kind"],
          description: "`kind`: a file on one side, a folder on the other.",
        },
      },
    },
    "files.CopyOutput": {
      kind: "record",
      fields: {
        items: {
          kind: "list",
          of: {
            kind: "ref",
            named: "files.CopyItem",
          },
        },
        bytes: {
          kind: "number",
        },
        conflicts: {
          kind: "number",
        },
      },
    },
    "files.CopyItem": {
      kind: "record",
      fields: {
        source: {
          kind: "string",
        },
        destination: {
          kind: "string",
        },
        bytes: {
          kind: "number",
        },
        conflict: {
          kind: "boolean",
        },
        outcome: {
          kind: "choice",
          of: ["planned", "copied", "failed"],
        },
        reason: {
          kind: "ref",
          named: "core.Message",
          nullable: true,
        },
      },
    },
    "files.CreateOutput": {
      kind: "record",
      fields: {
        items: {
          kind: "list",
          of: {
            kind: "ref",
            named: "files.CreatedPath",
          },
        },
      },
    },
    "files.CreatedPath": {
      kind: "record",
      fields: {
        path: {
          kind: "string",
        },
        kind: {
          kind: "choice",
          of: ["file", "directory"],
        },
        created: {
          kind: "boolean",
        },
        reason: {
          kind: "ref",
          named: "core.Message",
          nullable: true,
        },
      },
    },
    "files.DeleteOutput": {
      kind: "record",
      fields: {
        mode: {
          kind: "choice",
          of: ["trash", "permanent"],
        },
        items: {
          kind: "list",
          of: {
            kind: "ref",
            named: "files.DeletionItem",
          },
        },
        bytes: {
          kind: "number",
        },
      },
    },
    "files.DeletionItem": {
      kind: "record",
      fields: {
        path: {
          kind: "string",
        },
        kind: {
          kind: "choice",
          of: ["file", "directory", "other", "symlink"],
        },
        bytes: {
          kind: "number",
        },
        files: {
          kind: "number",
        },
        isRepository: {
          kind: "boolean",
        },
        outcome: {
          kind: "choice",
          of: ["planned", "failed", "trashed", "deleted"],
        },
        reason: {
          kind: "ref",
          named: "core.Message",
          nullable: true,
        },
      },
    },
    "files.DupesOutput": {
      kind: "record",
      fields: {
        folder: {
          kind: "string",
        },
        checked: {
          kind: "number",
        },
        groups: {
          kind: "list",
          of: {
            kind: "ref",
            named: "files.DuplicateGroup",
          },
          description: "Largest waste first.",
        },
        extraBytes: {
          kind: "number",
        },
      },
    },
    "files.DuplicateGroup": {
      kind: "record",
      fields: {
        size: {
          kind: "number",
        },
        paths: {
          kind: "list",
          of: {
            kind: "string",
          },
        },
      },
    },
    "files.FindOutput": {
      kind: "record",
      fields: {
        folder: {
          kind: "string",
        },
        matches: {
          kind: "list",
          of: {
            kind: "ref",
            named: "files.FoundEntry",
          },
          description: "At most `limit` entries.",
        },
        total: {
          kind: "number",
        },
        totalBytes: {
          kind: "number",
        },
      },
    },
    "files.FoundEntry": {
      kind: "record",
      fields: {
        path: {
          kind: "string",
        },
        kind: {
          kind: "choice",
          of: ["file", "directory", "other", "symlink"],
        },
        size: {
          kind: "number",
        },
        modifiedMs: {
          kind: "number",
        },
      },
    },
    "files.HashOutput": {
      kind: "record",
      fields: {
        algorithm: {
          kind: "choice",
          of: ["sha256", "sha1", "md5", "sha512"],
        },
        files: {
          kind: "list",
          of: {
            kind: "ref",
            named: "files.HashedFile",
          },
        },
        check: {
          kind: "ref",
          named: "files.HashCheck",
          nullable: true,
        },
      },
    },
    "files.HashedFile": {
      kind: "record",
      fields: {
        path: {
          kind: "string",
        },
        hash: {
          kind: "string",
        },
      },
    },
    "files.HashCheck": {
      kind: "record",
      fields: {
        path: {
          kind: "string",
        },
        expected: {
          kind: "string",
        },
        actual: {
          kind: "string",
        },
        matches: {
          kind: "boolean",
        },
      },
    },
    "files.ListOutput": {
      kind: "record",
      fields: {
        path: {
          kind: "string",
        },
        entries: {
          kind: "list",
          of: {
            kind: "ref",
            named: "files.ListedEntry",
          },
        },
        hidden: {
          kind: "number",
        },
      },
    },
    "files.ListedEntry": {
      kind: "record",
      fields: {
        name: {
          kind: "string",
        },
        path: {
          kind: "string",
        },
        kind: {
          kind: "choice",
          of: ["file", "directory", "other", "symlink"],
        },
        size: {
          kind: "number",
          description: "Bytes for files; 0 for everything else.",
        },
        modifiedMs: {
          kind: "number",
        },
        target: {
          kind: "string",
          nullable: true,
          description: "Where a symlink points; null for everything else.",
        },
      },
    },
    "files.SizeOutput": {
      kind: "record",
      fields: {
        folder: {
          kind: "string",
        },
        bytes: {
          kind: "number",
        },
        rebuildableBytes: {
          kind: "number",
        },
        looseBytes: {
          kind: "number",
          description: "Files directly in the folder.",
        },
        top: {
          kind: "number",
          description: "How many rows the text view shows; JSON has every row.",
        },
        rows: {
          kind: "list",
          of: {
            kind: "ref",
            named: "files.SizeRow",
          },
          description: "Every subfolder, largest first.",
        },
      },
    },
    "files.SizeRow": {
      kind: "record",
      fields: {
        name: {
          kind: "string",
        },
        path: {
          kind: "string",
        },
        bytes: {
          kind: "number",
        },
        rebuildableBytes: {
          kind: "number",
          description: "Bytes inside dependency, build and cache folders.",
        },
      },
    },
    "files.MoveOutput": {
      kind: "record",
      fields: {
        items: {
          kind: "list",
          of: {
            kind: "ref",
            named: "files.MoveItem",
          },
        },
        conflicts: {
          kind: "number",
        },
      },
    },
    "files.MoveItem": {
      kind: "record",
      fields: {
        source: {
          kind: "string",
        },
        destination: {
          kind: "string",
        },
        conflict: {
          kind: "boolean",
        },
        outcome: {
          kind: "choice",
          of: ["planned", "failed", "moved"],
        },
        reason: {
          kind: "ref",
          named: "core.Message",
          nullable: true,
        },
      },
    },
    "files.ReadOutput": {
      kind: "record",
      fields: {
        path: {
          kind: "string",
        },
        encoding: {
          kind: "choice",
          of: ["utf8", "utf8-bom", "utf16le", "utf16be"],
        },
        first: {
          kind: "number",
          description: "Line numbers, from 1, of the first and the last line in `lines`.",
        },
        last: {
          kind: "number",
        },
        totalLines: {
          kind: "number",
        },
        lines: {
          kind: "list",
          of: {
            kind: "string",
          },
        },
        numbered: {
          kind: "boolean",
        },
      },
    },
    "files.RenameOutput": {
      kind: "record",
      fields: {
        mode: {
          kind: "choice",
          of: ["one", "many"],
        },
        renames: {
          kind: "list",
          of: {
            kind: "ref",
            named: "files.PlannedRename",
          },
        },
        problems: {
          kind: "list",
          of: {
            kind: "ref",
            named: "core.Message",
          },
          description: "Invalid names and clashes; any of them stops every rename.",
        },
        renamed: {
          kind: "number",
        },
      },
    },
    "files.PlannedRename": {
      kind: "record",
      fields: {
        from: {
          kind: "string",
        },
        to: {
          kind: "string",
        },
      },
    },
    "files.ReplaceOutput": {
      kind: "record",
      fields: {
        files: {
          kind: "list",
          of: {
            kind: "ref",
            named: "files.ReplacedFile",
          },
        },
        replacements: {
          kind: "number",
        },
        checked: {
          kind: "number",
        },
        skipped: {
          kind: "number",
          description: "Binary files and files over 50 MB.",
        },
        written: {
          kind: "number",
        },
      },
    },
    "files.ReplacedFile": {
      kind: "record",
      fields: {
        path: {
          kind: "string",
        },
        count: {
          kind: "number",
        },
        lineCountChanges: {
          kind: "boolean",
          description: "When the replacement adds or removes lines, no line samples are shown.",
        },
        samples: {
          kind: "list",
          of: {
            kind: "ref",
            named: "files.ReplaceSample",
          },
        },
      },
    },
    "files.ReplaceSample": {
      kind: "record",
      fields: {
        line: {
          kind: "number",
        },
        before: {
          kind: "string",
        },
        after: {
          kind: "string",
        },
      },
    },
    "files.GrepOutput": {
      kind: "record",
      fields: {
        mode: {
          kind: "choice",
          of: ["files", "lines", "count"],
        },
        lines: {
          kind: "list",
          of: {
            kind: "ref",
            named: "files.GrepLine",
          },
          description: "Matching lines, trimmed, at most `limit`; only in lines mode.",
        },
        files: {
          kind: "list",
          of: {
            kind: "ref",
            named: "files.GrepFile",
          },
          description: "Every file with at least one match.",
        },
        matches: {
          kind: "number",
        },
        checked: {
          kind: "number",
        },
        skipped: {
          kind: "number",
          description: "Binary files and files over 50 MB.",
        },
      },
    },
    "files.GrepLine": {
      kind: "record",
      fields: {
        path: {
          kind: "string",
        },
        line: {
          kind: "number",
        },
        text: {
          kind: "string",
        },
      },
    },
    "files.GrepFile": {
      kind: "record",
      fields: {
        path: {
          kind: "string",
        },
        count: {
          kind: "number",
        },
      },
    },
    "files.InfoOutput": {
      kind: "record",
      fields: {
        items: {
          kind: "list",
          of: {
            kind: "ref",
            named: "files.InfoItem",
          },
        },
      },
    },
    "files.InfoItem": {
      kind: "record",
      fields: {
        path: {
          kind: "string",
        },
        kind: {
          kind: "choice",
          of: ["file", "directory", "other", "symlink"],
        },
        target: {
          kind: "string",
          nullable: true,
        },
        bytes: {
          kind: "number",
        },
        contents: {
          kind: "record",
          fields: {
            files: {
              kind: "number",
            },
            directories: {
              kind: "number",
            },
          },
          nullable: true,
          description: "What a folder holds; null for anything else.",
        },
        createdMs: {
          kind: "number",
        },
        modifiedMs: {
          kind: "number",
        },
        accessedMs: {
          kind: "number",
        },
        writable: {
          kind: "boolean",
          description: "The owner may write.",
        },
        permissions: {
          kind: "record",
          fields: {
            symbolic: {
              kind: "string",
            },
            octal: {
              kind: "string",
            },
          },
          nullable: true,
          description: "As `rwxr-xr-x` and `755`; null on Windows, which keeps no such bits.",
        },
        hidden: {
          kind: "boolean",
        },
        hash: {
          kind: "record",
          fields: {
            algorithm: {
              kind: "choice",
              of: ["sha256", "sha1", "md5", "sha512"],
            },
            value: {
              kind: "string",
            },
          },
          nullable: true,
        },
      },
    },
    "files.TreeOutput": {
      kind: "record",
      fields: {
        root: {
          kind: "string",
        },
        depth: {
          kind: "number",
        },
        nodes: {
          kind: "list",
          of: {
            kind: "ref",
            named: "files.TreeNode",
          },
        },
        directories: {
          kind: "number",
        },
        files: {
          kind: "number",
        },
      },
    },
    "files.TreeNode": {
      kind: "record",
      fields: {
        name: {
          kind: "string",
        },
        kind: {
          kind: "choice",
          of: ["file", "directory", "other", "symlink"],
        },
        target: {
          kind: "string",
          nullable: true,
        },
        closed: {
          kind: "boolean",
          description: "A dependency or build folder that is listed but not opened without --all.",
        },
        unreadable: {
          kind: "boolean",
        },
        children: {
          kind: "list",
          of: {
            kind: "ref",
            named: "files.TreeNode",
          },
        },
      },
    },
    "files.SyncOutput": {
      kind: "record",
      fields: {
        source: {
          kind: "string",
        },
        target: {
          kind: "string",
        },
        copy: {
          kind: "list",
          of: {
            kind: "string",
          },
          description: "Relative paths with `/`.",
        },
        update: {
          kind: "list",
          of: {
            kind: "string",
          },
        },
        remove: {
          kind: "list",
          of: {
            kind: "string",
          },
        },
        bytes: {
          kind: "number",
        },
        applied: {
          kind: "boolean",
        },
      },
    },
    "gen.GeneratedOutput": {
      kind: "record",
      fields: {
        values: {
          kind: "list",
          of: {
            kind: "string",
          },
        },
      },
    },
    "git.FetchOutput": {
      kind: "record",
      fields: {
        folder: {
          kind: "string",
        },
        items: {
          kind: "list",
          of: {
            kind: "ref",
            named: "git.FetchItem",
          },
        },
      },
    },
    "git.FetchItem": {
      kind: "record",
      fields: {
        status: {
          kind: "ref",
          named: "git.RepositoryStatus",
          description: "After the fetch when it succeeded, before it otherwise.",
        },
        outcome: {
          kind: "choice",
          of: ["failed", "fetched", "no-remote"],
        },
      },
    },
    "git.RepositoryStatus": {
      kind: "record",
      fields: {
        name: {
          kind: "string",
          description: "Relative to the folder given, with `/`; the folder's own name when it is the repository.",
        },
        path: {
          kind: "string",
        },
        branch: {
          kind: "string",
          description: "The branch, a short commit id for a detached HEAD, or `?`.",
        },
        commits: {
          kind: "number",
        },
        dirty: {
          kind: "number",
          description: "Files with uncommitted changes, as `git status` counts them.",
        },
        ahead: {
          kind: "number",
          nullable: true,
          description: "null when the branch has no upstream.",
        },
        behind: {
          kind: "number",
          nullable: true,
        },
        hasRemote: {
          kind: "boolean",
        },
      },
    },
    "git.PullOutput": {
      kind: "record",
      fields: {
        folder: {
          kind: "string",
        },
        items: {
          kind: "list",
          of: {
            kind: "ref",
            named: "git.PullItem",
          },
        },
      },
    },
    "git.PullItem": {
      kind: "record",
      fields: {
        status: {
          kind: "ref",
          named: "git.RepositoryStatus",
        },
        outcome: {
          kind: "choice",
          of: ["failed", "no-remote", "pulled", "up-to-date", "no-upstream", "dirty"],
        },
        newCommits: {
          kind: "number",
        },
      },
    },
    "git.StatusOutput": {
      kind: "record",
      fields: {
        folder: {
          kind: "string",
        },
        isRepository: {
          kind: "boolean",
          description: "The folder is one repository, not a workspace holding several.",
        },
        repositories: {
          kind: "list",
          of: {
            kind: "ref",
            named: "git.RepositoryStatus",
          },
        },
        allGood: {
          kind: "boolean",
          description: "Every repository has a remote, nothing is unpushed, and all are on one branch.",
        },
      },
    },
    "git.SwitchOutput": {
      kind: "record",
      fields: {
        branch: {
          kind: "string",
        },
        folder: {
          kind: "string",
        },
        steps: {
          kind: "list",
          of: {
            kind: "ref",
            named: "git.SwitchStep",
          },
        },
      },
    },
    "git.SwitchStep": {
      kind: "record",
      fields: {
        name: {
          kind: "string",
        },
        path: {
          kind: "string",
        },
        from: {
          kind: "string",
        },
        dirty: {
          kind: "number",
        },
        action: {
          kind: "choice",
          of: ["create", "local", "missing", "already", "track"],
        },
        outcome: {
          kind: "choice",
          of: ["planned", "failed", "unchanged", "switched"],
        },
      },
    },
    "net.CheckOutput": {
      kind: "record",
      fields: {
        host: {
          kind: "string",
        },
        port: {
          kind: "number",
        },
        reachable: {
          kind: "boolean",
        },
        address: {
          kind: "string",
          nullable: true,
          description: "The address that answered; null when none did.",
        },
        ms: {
          kind: "number",
        },
        failure: {
          kind: "choice",
          of: ["failed", "refused", "timeout", "not-found", "unreachable"],
          nullable: true,
        },
        code: {
          kind: "string",
          nullable: true,
          description: "The operating system's error code, such as ECONNREFUSED.",
        },
      },
    },
    "net.AddressesOutput": {
      kind: "record",
      fields: {
        addresses: {
          kind: "list",
          of: {
            kind: "ref",
            named: "core.NetworkAddress",
          },
        },
      },
    },
    "core.NetworkAddress": {
      kind: "record",
      fields: {
        interfaceName: {
          kind: "string",
        },
        family: {
          kind: "choice",
          of: ["IPv4", "IPv6"],
        },
        address: {
          kind: "string",
        },
        cidr: {
          kind: "string",
          nullable: true,
          description: "Such as 192.168.1.20/24; null when the OS does not say.",
        },
        mac: {
          kind: "string",
        },
        internal: {
          kind: "boolean",
          description: "A loopback address, reachable only from this machine.",
        },
      },
    },
    "net.DnsOutput": {
      kind: "record",
      fields: {
        name: {
          kind: "string",
        },
        type: {
          kind: "choice",
          of: ["system", "a", "aaaa", "cname", "mx", "txt", "ns"],
        },
        records: {
          kind: "list",
          of: {
            kind: "ref",
            named: "core.DnsRecord",
          },
        },
        failure: {
          kind: "choice",
          of: ["failed", "timeout", "not-found"],
          nullable: true,
        },
      },
    },
    "core.DnsRecord": {
      kind: "record",
      fields: {
        type: {
          kind: "string",
          description: "A, AAAA, CNAME, MX, TXT or NS.",
        },
        value: {
          kind: "string",
        },
        priority: {
          kind: "number",
          nullable: true,
          description: "An MX record's preference; null for every other record.",
        },
      },
    },
    "open.OpenOutput": {
      kind: "record",
      fields: {
        target: {
          kind: "string",
          description: "The web address, or the absolute path.",
        },
        kind: {
          kind: "choice",
          of: ["file", "folder", "url"],
        },
      },
    },
    "port.KillPortOutput": {
      kind: "record",
      fields: {
        port: {
          kind: "number",
        },
        processes: {
          kind: "list",
          of: {
            kind: "ref",
            named: "core.EndedProcess",
          },
        },
      },
    },
    "core.EndedProcess": {
      kind: "record",
      fields: {
        pid: {
          kind: "number",
        },
        name: {
          kind: "string",
          nullable: true,
        },
        outcome: {
          kind: "choice",
          of: ["failed", "not-found", "ended", "still-running", "denied"],
        },
      },
    },
    "port.FreeOutput": {
      kind: "record",
      fields: {
        port: {
          kind: "number",
        },
      },
    },
    "port.WhoOutput": {
      kind: "record",
      fields: {
        port: {
          kind: "number",
          nullable: true,
        },
        listeners: {
          kind: "list",
          of: {
            kind: "ref",
            named: "port.OwnedListener",
          },
        },
      },
    },
    "port.OwnedListener": {
      kind: "record",
      fields: {
        name: {
          kind: "string",
          nullable: true,
          description: "The owner's program name; null when the owner is hidden or ended meanwhile.",
        },
        address: {
          kind: "string",
          description: "The local address, such as 0.0.0.0, ::, 127.0.0.1 or ::1.",
        },
        port: {
          kind: "number",
        },
        pid: {
          kind: "number",
          nullable: true,
          description:
            "null when the owner is hidden, as another user's process is on Linux and macOS without elevation.",
        },
      },
    },
    "proc.KillOutput": {
      kind: "record",
      fields: {
        target: {
          kind: "string",
        },
        processes: {
          kind: "list",
          of: {
            kind: "ref",
            named: "core.EndedProcess",
          },
        },
      },
    },
    "proc.ProcessesOutput": {
      kind: "record",
      fields: {
        processes: {
          kind: "list",
          of: {
            kind: "ref",
            named: "core.ProcessInfo",
          },
        },
        detailed: {
          kind: "boolean",
          description: "Parent ids and command lines are included.",
        },
      },
    },
    "core.ProcessInfo": {
      kind: "record",
      fields: {
        pid: {
          kind: "number",
        },
        ppid: {
          kind: "number",
          nullable: true,
          description: "null when the listing did not include parent ids.",
        },
        name: {
          kind: "string",
          description: "The program's file name, such as node or node.exe.",
        },
        command: {
          kind: "string",
          nullable: true,
          description: "null when the listing did not include command lines, or the OS hides this one.",
        },
        memoryBytes: {
          kind: "number",
          nullable: true,
          description: "Resident memory; null when unknown.",
        },
      },
    },
    "proc.TreeOutput": {
      kind: "record",
      fields: {
        rows: {
          kind: "list",
          of: {
            kind: "ref",
            named: "proc.TreeRow",
          },
        },
      },
    },
    "proc.TreeRow": {
      kind: "record",
      fields: {
        pid: {
          kind: "number",
        },
        ppid: {
          kind: "number",
          nullable: true,
        },
        name: {
          kind: "string",
        },
        depth: {
          kind: "number",
          description: "0 for a root.",
        },
      },
    },
    "secrets.ScanOutput": {
      kind: "record",
      fields: {
        findings: {
          kind: "list",
          of: {
            kind: "ref",
            named: "secrets.SecretFinding",
          },
        },
        checked: {
          kind: "number",
        },
        skipped: {
          kind: "number",
          description: "Binary files and files over the text limit.",
        },
        allowed: {
          kind: "number",
          description: "Secrets a `kiriya:allow-secret` marker declared deliberate.",
        },
        truncated: {
          kind: "boolean",
          description: "Whether `--limit` cut the list short.",
        },
      },
    },
    "secrets.SecretFinding": {
      kind: "record",
      fields: {
        path: {
          kind: "string",
        },
        line: {
          kind: "number",
        },
        column: {
          kind: "number",
        },
        kind: {
          kind: "choice",
          of: ["private-key", "url-credentials", "jwt", "token"],
        },
        sample: {
          kind: "string",
          description: "Enough to tell whose secret it is, never enough to use it.",
        },
      },
    },
    "self-update.SelfUpdateOutput": {
      kind: "record",
      fields: {
        installed: {
          kind: "string",
        },
        latest: {
          kind: "string",
          nullable: true,
          description: "What the registry calls latest; null when it could not be read.",
        },
        newer: {
          kind: "boolean",
        },
        source: {
          kind: "choice",
          of: ["npm", "elsewhere"],
        },
        applied: {
          kind: "boolean",
          description: "Whether an update was actually run, which only `--apply` does.",
        },
      },
    },
    "sys.ReportOutput": {
      kind: "record",
      fields: {
        machine: {
          kind: "ref",
          named: "sys.MachineFacts",
        },
        tools: {
          kind: "list",
          of: {
            kind: "ref",
            named: "sys.ToolReport",
          },
        },
      },
    },
    "sys.MachineFacts": {
      kind: "record",
      fields: {
        os: {
          kind: "choice",
          of: ["windows", "linux", "macos"],
        },
        osName: {
          kind: "string",
        },
        kernel: {
          kind: "string",
        },
        arch: {
          kind: "string",
        },
        cpuModel: {
          kind: "string",
        },
        cpuCount: {
          kind: "number",
        },
        memoryTotalBytes: {
          kind: "number",
        },
        memoryFreeBytes: {
          kind: "number",
        },
        locale: {
          kind: "string",
        },
        timeZone: {
          kind: "string",
        },
        node: {
          kind: "string",
        },
        kiriya: {
          kind: "string",
        },
      },
    },
    "sys.ToolReport": {
      kind: "record",
      fields: {
        name: {
          kind: "string",
        },
        version: {
          kind: "string",
          nullable: true,
          description: "null when the tool is not installed.",
        },
        path: {
          kind: "string",
          nullable: true,
        },
      },
    },
    "sys.ToolsOutput": {
      kind: "record",
      fields: {
        tools: {
          kind: "list",
          of: {
            kind: "ref",
            named: "sys.ToolReport",
          },
        },
      },
    },
    "sys.InfoOutput": {
      kind: "record",
      fields: {
        uptimeSeconds: {
          kind: "number",
        },
        hostname: {
          kind: "string",
        },
        os: {
          kind: "choice",
          of: ["windows", "linux", "macos"],
        },
        osName: {
          kind: "string",
        },
        kernel: {
          kind: "string",
        },
        arch: {
          kind: "string",
        },
        cpuModel: {
          kind: "string",
        },
        cpuCount: {
          kind: "number",
        },
        memoryTotalBytes: {
          kind: "number",
        },
        memoryFreeBytes: {
          kind: "number",
        },
        locale: {
          kind: "string",
        },
        timeZone: {
          kind: "string",
        },
        node: {
          kind: "string",
        },
        kiriya: {
          kind: "string",
        },
      },
    },
    "wait.WaitFileOutput": {
      kind: "record",
      fields: {
        path: {
          kind: "string",
          description: "Absolute.",
        },
        gone: {
          kind: "boolean",
          description: "Waiting until the path no longer exists, rather than until it does.",
        },
        ready: {
          kind: "boolean",
        },
        attempts: {
          kind: "number",
        },
        waitedMs: {
          kind: "number",
        },
      },
    },
    "wait.WaitPortOutput": {
      kind: "record",
      fields: {
        host: {
          kind: "string",
        },
        port: {
          kind: "number",
        },
        gone: {
          kind: "boolean",
          description: "Waiting until nothing listens, rather than until something does.",
        },
        ready: {
          kind: "boolean",
        },
        attempts: {
          kind: "number",
        },
        waitedMs: {
          kind: "number",
        },
        address: {
          kind: "string",
          nullable: true,
          description: "From the last attempt: the address that answered, or why nothing did.",
        },
        failure: {
          kind: "choice",
          of: ["failed", "refused", "timeout", "not-found", "unreachable"],
          nullable: true,
        },
        code: {
          kind: "string",
          nullable: true,
          description: "The operating system's error code, such as ECONNREFUSED.",
        },
      },
    },
    "wait.WaitUrlOutput": {
      kind: "record",
      fields: {
        url: {
          kind: "string",
        },
        ready: {
          kind: "boolean",
        },
        attempts: {
          kind: "number",
        },
        waitedMs: {
          kind: "number",
        },
        status: {
          kind: "number",
          nullable: true,
          description: "From the last attempt: the status it answered with, or why it did not answer.",
        },
        failure: {
          kind: "choice",
          of: ["failed", "refused", "timeout", "not-found", "unreachable", "tls"],
          nullable: true,
        },
        code: {
          kind: "string",
          nullable: true,
        },
      },
    },
  },
  commands: {
    "archive.tar": {
      kind: "ref",
      named: "archive.TarOutput",
    },
    "archive.zip": {
      kind: "ref",
      named: "archive.ZipOutput",
    },
    "archive.untar": {
      kind: "variants",
      of: [
        {
          kind: "record",
          fields: {
            mode: {
              kind: "choice",
              of: ["list"],
            },
            archive: {
              kind: "string",
            },
            entries: {
              kind: "list",
              of: {
                kind: "ref",
                named: "archive.ListedTarEntry",
              },
            },
            bytes: {
              kind: "number",
            },
          },
        },
        {
          kind: "record",
          fields: {
            mode: {
              kind: "choice",
              of: ["extract"],
            },
            archive: {
              kind: "string",
            },
            target: {
              kind: "string",
            },
            extracted: {
              kind: "boolean",
            },
            files: {
              kind: "number",
            },
            bytes: {
              kind: "number",
            },
            unsafe: {
              kind: "list",
              of: {
                kind: "string",
              },
              description: "Names that would land outside the target; any of them stops the extraction.",
            },
            skipped: {
              kind: "list",
              of: {
                kind: "string",
              },
              description: "Names no OS could create, such as `what?.txt`; skipped.",
            },
            conflicts: {
              kind: "list",
              of: {
                kind: "string",
              },
              description: "Existing files that --overwrite would replace.",
            },
            skippedLinks: {
              kind: "number",
              description: "Symbolic and hard links, devices and pipes, which are never created.",
            },
          },
        },
      ],
    },
    "archive.unzip": {
      kind: "variants",
      of: [
        {
          kind: "record",
          fields: {
            mode: {
              kind: "choice",
              of: ["list"],
            },
            archive: {
              kind: "string",
            },
            entries: {
              kind: "list",
              of: {
                kind: "ref",
                named: "archive.ListedEntry",
              },
            },
            bytes: {
              kind: "number",
            },
          },
        },
        {
          kind: "record",
          fields: {
            mode: {
              kind: "choice",
              of: ["extract"],
            },
            archive: {
              kind: "string",
            },
            target: {
              kind: "string",
            },
            extracted: {
              kind: "boolean",
            },
            files: {
              kind: "number",
            },
            bytes: {
              kind: "number",
            },
            unsafe: {
              kind: "list",
              of: {
                kind: "string",
              },
              description: "Names that would land outside the target; any of them stops the extraction.",
            },
            skipped: {
              kind: "list",
              of: {
                kind: "string",
              },
              description: "Names no OS could create, such as `what?.txt`; skipped.",
            },
            conflicts: {
              kind: "list",
              of: {
                kind: "string",
              },
              description: "Existing files that --overwrite would replace.",
            },
          },
        },
      ],
    },
    "clip.copy": {
      kind: "ref",
      named: "clip.CopyOutput",
    },
    "clip.paste": {
      kind: "ref",
      named: "clip.PasteOutput",
    },
    completion: {
      kind: "ref",
      named: "completion.ScriptOutput",
    },
    "completion.suggest": {
      kind: "ref",
      named: "completion.SuggestOutput",
    },
    "config.get": {
      kind: "ref",
      named: "config.GetOutput",
    },
    "config.keys": {
      kind: "ref",
      named: "config.KeysOutput",
    },
    "config.list": {
      kind: "ref",
      named: "config.ListOutput",
    },
    "config.set": {
      kind: "ref",
      named: "config.SetOutput",
    },
    "config.path": {
      kind: "ref",
      named: "config.PathOutput",
    },
    "config.unset": {
      kind: "ref",
      named: "config.UnsetOutput",
    },
    "convert.case": {
      kind: "ref",
      named: "convert.CaseOutput",
    },
    "convert.base64": {
      kind: "ref",
      named: "convert.CodecOutput",
    },
    "convert.hex": {
      kind: "ref",
      named: "convert.CodecOutput",
    },
    "convert.url": {
      kind: "ref",
      named: "convert.CodecOutput",
    },
    "convert.json": {
      kind: "ref",
      named: "convert.JsonOutput",
    },
    "convert.time": {
      kind: "ref",
      named: "convert.TimeOutput",
    },
    "convert.jwt": {
      kind: "ref",
      named: "convert.JwtOutput",
    },
    "docker.clean": {
      kind: "ref",
      named: "docker.CleanOutput",
    },
    "docker.ps": {
      kind: "variants",
      of: [
        {
          kind: "record",
          fields: {
            mode: {
              kind: "choice",
              of: ["project"],
            },
            project: {
              kind: "string",
            },
            file: {
              kind: "string",
            },
            containers: {
              kind: "list",
              of: {
                kind: "ref",
                named: "docker.Container",
              },
            },
          },
        },
        {
          kind: "record",
          fields: {
            mode: {
              kind: "choice",
              of: ["projects"],
            },
            projects: {
              kind: "list",
              of: {
                kind: "ref",
                named: "docker.ComposeProjectState",
              },
            },
          },
        },
      ],
    },
    "docker.up": {
      kind: "ref",
      named: "docker.StartOutput",
    },
    "docker.rebuild": {
      kind: "ref",
      named: "docker.StartOutput",
    },
    "docker.logs": {
      kind: "ref",
      named: "docker.LogsOutput",
    },
    "docker.down": {
      kind: "ref",
      named: "docker.DownOutput",
    },
    doctor: {
      kind: "ref",
      named: "doctor.DoctorOutput",
    },
    "env.check": {
      kind: "ref",
      named: "env.CheckOutput",
    },
    "env.path": {
      kind: "ref",
      named: "env.PathOutput",
    },
    "env.show": {
      kind: "ref",
      named: "env.ShowOutput",
    },
    "files.clean": {
      kind: "ref",
      named: "files.CleanOutput",
    },
    "files.compare": {
      kind: "variants",
      of: [
        {
          kind: "ref",
          named: "files.CompareFilesOutput",
        },
        {
          kind: "ref",
          named: "files.CompareFoldersOutput",
        },
      ],
    },
    "files.copy": {
      kind: "ref",
      named: "files.CopyOutput",
    },
    "files.new": {
      kind: "ref",
      named: "files.CreateOutput",
    },
    "files.delete": {
      kind: "ref",
      named: "files.DeleteOutput",
    },
    "files.dupes": {
      kind: "ref",
      named: "files.DupesOutput",
    },
    "files.find": {
      kind: "ref",
      named: "files.FindOutput",
    },
    "files.hash": {
      kind: "ref",
      named: "files.HashOutput",
    },
    "files.list": {
      kind: "ref",
      named: "files.ListOutput",
    },
    "files.size": {
      kind: "ref",
      named: "files.SizeOutput",
    },
    "files.move": {
      kind: "ref",
      named: "files.MoveOutput",
    },
    "files.read": {
      kind: "ref",
      named: "files.ReadOutput",
    },
    "files.rename": {
      kind: "ref",
      named: "files.RenameOutput",
    },
    "files.replace": {
      kind: "ref",
      named: "files.ReplaceOutput",
    },
    "files.grep": {
      kind: "ref",
      named: "files.GrepOutput",
    },
    "files.info": {
      kind: "ref",
      named: "files.InfoOutput",
    },
    "files.tree": {
      kind: "ref",
      named: "files.TreeOutput",
    },
    "files.sync": {
      kind: "ref",
      named: "files.SyncOutput",
    },
    "gen.password": {
      kind: "ref",
      named: "gen.GeneratedOutput",
    },
    "gen.token": {
      kind: "ref",
      named: "gen.GeneratedOutput",
    },
    "gen.ulid": {
      kind: "ref",
      named: "gen.GeneratedOutput",
    },
    "gen.uuid": {
      kind: "ref",
      named: "gen.GeneratedOutput",
    },
    "git.fetch": {
      kind: "ref",
      named: "git.FetchOutput",
    },
    "git.pull": {
      kind: "ref",
      named: "git.PullOutput",
    },
    "git.status": {
      kind: "ref",
      named: "git.StatusOutput",
    },
    "git.switch": {
      kind: "ref",
      named: "git.SwitchOutput",
    },
    "net.check": {
      kind: "ref",
      named: "net.CheckOutput",
    },
    "net.ip": {
      kind: "ref",
      named: "net.AddressesOutput",
    },
    "net.dns": {
      kind: "ref",
      named: "net.DnsOutput",
    },
    open: {
      kind: "ref",
      named: "open.OpenOutput",
    },
    "port.kill": {
      kind: "ref",
      named: "port.KillPortOutput",
    },
    "port.free": {
      kind: "ref",
      named: "port.FreeOutput",
    },
    "port.who": {
      kind: "ref",
      named: "port.WhoOutput",
    },
    "proc.kill": {
      kind: "ref",
      named: "proc.KillOutput",
    },
    "proc.list": {
      kind: "ref",
      named: "proc.ProcessesOutput",
    },
    "proc.find": {
      kind: "ref",
      named: "proc.ProcessesOutput",
    },
    "proc.tree": {
      kind: "ref",
      named: "proc.TreeOutput",
    },
    "secrets.scan": {
      kind: "ref",
      named: "secrets.ScanOutput",
    },
    "self-update": {
      kind: "ref",
      named: "self-update.SelfUpdateOutput",
    },
    "sys.report": {
      kind: "ref",
      named: "sys.ReportOutput",
    },
    "sys.tools": {
      kind: "ref",
      named: "sys.ToolsOutput",
    },
    "sys.info": {
      kind: "ref",
      named: "sys.InfoOutput",
    },
    "wait.file": {
      kind: "ref",
      named: "wait.WaitFileOutput",
    },
    "wait.port": {
      kind: "ref",
      named: "wait.WaitPortOutput",
    },
    "wait.url": {
      kind: "ref",
      named: "wait.WaitUrlOutput",
    },
  },
};
