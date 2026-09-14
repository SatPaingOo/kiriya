/**
 * The import rules in docs/development/architecture.md, checked with no dependencies.
 * File paths are relative to `src/` and always use `/`.
 */
import path from "node:path";

export interface SourceFile {
  readonly path: string;
  readonly text: string;
}

export interface Violation {
  readonly file: string;
  readonly line: number;
  readonly specifier: string;
  readonly rule: string;
}

type Layer = "domain" | "application" | "infrastructure" | "presentation";

type Place =
  | { readonly kind: "main" | "config" | "i18n" | "unknown" }
  | { readonly kind: "layer"; readonly module: string | null; readonly layer: Layer }
  | { readonly kind: "module-root"; readonly module: string };

const LAYERS: ReadonlySet<string> = new Set(["domain", "application", "infrastructure", "presentation"]);

/** What each layer may import, in core and in every module alike. */
const ALLOWED_LAYERS: Readonly<Record<Layer, ReadonlySet<Layer>>> = {
  domain: new Set(["domain"]),
  application: new Set(["domain", "application"]),
  infrastructure: new Set(["domain", "infrastructure"]),
  presentation: new Set(["domain", "application", "presentation"]),
};

function placeOf(file: string): Place {
  const [area, second, third] = file.split("/");
  if (file === "main.ts") return { kind: "main" };
  if (area === "config" || area === "i18n") return { kind: area };
  if (area === "core" && second !== undefined && LAYERS.has(second)) {
    return { kind: "layer", module: null, layer: second as Layer };
  }
  if (area === "modules" && second !== undefined && third !== undefined) {
    if (third === `${second}.module.ts`) return { kind: "module-root", module: second };
    if (LAYERS.has(third)) return { kind: "layer", module: second, layer: third as Layer };
  }
  return { kind: "unknown" };
}

function moduleOf(place: Place): string | null {
  return place.kind === "layer" || place.kind === "module-root" ? place.module : null;
}

function nodeRule(from: Place, specifier: string): string | null {
  if (from.kind === "main") return null;
  if (from.kind === "layer") {
    if (from.layer === "infrastructure" || from.layer === "presentation") return null;
    if (from.layer === "application" && specifier === "node:path") return null;
    return from.layer === "application" ? "application may use only node:path" : "domain uses no node: module";
  }
  return "only layers of core and modules use node: modules";
}

function fileRule(from: Place, to: Place, typeOnly: boolean): string | null {
  if (to.kind === "unknown") return "imports a file outside the known areas of src/";
  if (from.kind === "main") return null;
  if (to.kind === "main") return "nothing imports main.ts";

  const fromModule = moduleOf(from);
  const toModule = moduleOf(to);
  if (fromModule !== null && toModule !== null && fromModule !== toModule)
    return "a module never imports another module";
  if (fromModule === null && toModule !== null && from.kind !== "config") return "core never imports a module";
  if (to.kind === "i18n" && from.kind !== "i18n" && !typeOnly) return "only main.ts imports the catalog as a value";

  switch (from.kind) {
    case "i18n":
      return to.kind === "i18n" ? null : "the catalog imports nothing";
    case "config":
      if (to.kind === "module-root" || to.kind === "config" || to.kind === "i18n") return null;
      return to.kind === "layer" && to.layer === "domain" ? null : "config imports only module roots and domain types";
    case "module-root":
      if (to.kind === "layer" && (to.module === from.module || to.layer === "domain")) return null;
      return to.kind === "i18n" ? null : "a module root imports its own layers and core domain";
    case "layer":
      if (to.kind === "i18n") return null;
      if (to.kind === "config") return from.layer === "domain" ? "domain does not read config" : null;
      if (to.kind === "module-root") return "only config/modules.ts imports a module root";
      if (to.kind !== "layer") return null;
      return ALLOWED_LAYERS[from.layer].has(to.layer) ? null : `${from.layer} may not import ${to.layer}`;
    default:
      return "file outside the known areas of src/";
  }
}

const STATIC_IMPORT = /^[ \t]*(?:import|export)\s+(type\s+)?(?:([^"';]*?)\s*from\s*)?["']([^"']+)["']/gm;
const DYNAMIC_IMPORT = /\bimport\(\s*["']([^"']+)["']\s*\)/g;

function isTypeOnly(typeKeyword: string | undefined, clause: string | undefined): boolean {
  if (typeKeyword !== undefined) return true;
  const braces = /^\{([^}]*)\}$/.exec(clause?.trim() ?? "");
  if (braces === null) return false;
  const names = (braces[1] ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");
  return names.length > 0 && names.every((name) => name.startsWith("type "));
}

export function findViolations(files: readonly SourceFile[]): Violation[] {
  const violations: Violation[] = [];
  for (const file of files) {
    const from = placeOf(file.path);
    const lineAt = (index: number): number => file.text.slice(0, index).split("\n").length;
    const imports: Array<{ specifier: string; index: number; typeOnly: boolean }> = [];
    for (const match of file.text.matchAll(STATIC_IMPORT)) {
      imports.push({ specifier: match[3] ?? "", index: match.index, typeOnly: isTypeOnly(match[1], match[2]) });
    }
    for (const match of file.text.matchAll(DYNAMIC_IMPORT)) {
      imports.push({ specifier: match[1] ?? "", index: match.index, typeOnly: false });
    }

    for (const { specifier, index, typeOnly } of imports) {
      let rule: string | null;
      if (specifier.startsWith("node:")) {
        rule = nodeRule(from, specifier);
      } else if (!specifier.startsWith(".")) {
        rule = "kiriya has no runtime dependencies; Node.js built-ins use the node: prefix";
      } else {
        const target = path.posix
          .normalize(path.posix.join(path.posix.dirname(file.path), specifier))
          .replace(/[.]js$/, ".ts");
        rule = target.startsWith("../") ? "imports a file outside src/" : fileRule(from, placeOf(target), typeOnly);
      }
      if (rule !== null) violations.push({ file: file.path, line: lineAt(index), specifier, rule });
    }
  }
  return violations;
}
