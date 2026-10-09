/**
 * Reads each command's `--json` `data` shape out of its TypeScript output type.
 *
 * Nothing about a shape is written by hand: a command class already declares
 * `implements Command<Input, Output>`, and its `spec` already carries the id, so both ends of
 * the link are in the code. Writing the shapes down a second time is what `docs/development/design.md`
 * rejects for the reference as a whole — a hand-written one drifts — and it would also need a
 * catalog key for text the fields already carry as JSDoc.
 */
import path from "node:path";
import ts from "typescript";
import type { OutputShapes, Shape, ShapeFields } from "../src/core/domain/output-shape.js";

/**
 * Commands whose class cannot say which id it serves, because one class serves several and
 * builds its spec in the constructor. Everything else is found in the code; `extractShapes`
 * fails when a registered command reaches neither route, so this cannot silently fall behind.
 */
const BY_CLASS: Readonly<Record<string, readonly string[]>> = {
  // codecSpec(name) makes `convert.base64`, `convert.hex` and `convert.url` from one class.
  ConvertCodec: ["convert.base64", "convert.hex", "convert.url"],
  // StartProject takes its spec as a constructor argument: upSpec or rebuildSpec.
  StartProject: ["docker.up", "docker.rebuild"],
};

/** How deep an unnamed record may nest before it is called unknown rather than walked forever. */
const MAX_DEPTH = 8;

/**
 * Past this many, a union of string literals is reported as text. `MessageKey` is a union of
 * every key in the catalog, some eight hundred of them: listing those inside a schema tells a
 * reader nothing they can act on and cost 20 KB each time a `Message` appeared in an output.
 */
const MAX_CHOICES = 24;

export interface ExtractedShapes extends OutputShapes {
  /** What stopped a command's shape being read, for the caller to fail on. */
  readonly problems: readonly string[];
}

const isIdentifier = (node: ts.Node | undefined, name: string): boolean =>
  node !== undefined && ts.isIdentifier(node) && node.text === name;

export function extractShapes(root: string, commandIds: readonly string[]): ExtractedShapes {
  const configPath = path.join(root, "tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = program.getTypeChecker();
  const problems: string[] = [];
  const commands: Record<string, Shape> = {};
  const records: Record<string, Shape> = {};
  /** Where each catalog name was declared, so two different types cannot claim one name. */
  const declarations = new Map<string, string>();

  const describe = (symbol: ts.Symbol): string =>
    ts.displayPartsToString(symbol.getDocumentationComment(checker)).replace(/\s+/g, " ").trim();

  function fieldsOf(type: ts.Type, depth: number): ShapeFields {
    const fields: Record<string, Shape> = {};
    for (const property of type.getProperties()) {
      const at = property.valueDeclaration ?? property.declarations?.[0];
      const of =
        at === undefined ? checker.getDeclaredTypeOfSymbol(property) : checker.getTypeOfSymbolAtLocation(property, at);
      const description = describe(property);
      const optional = (property.flags & ts.SymbolFlags.Optional) !== 0;
      fields[property.getName()] = {
        ...shapeOf(of, depth + 1),
        ...(optional ? { optional: true as const } : {}),
        ...(description === "" ? {} : { description }),
      };
    }
    return fields;
  }

  function shapeOf(type: ts.Type, depth: number): Shape {
    if (depth > MAX_DEPTH) return { kind: "unknown" };
    if (type.isUnion()) return unionShape(type, depth);

    const { flags } = type;
    if ((flags & ts.TypeFlags.StringLiteral) !== 0) {
      return { kind: "choice", of: [(type as ts.StringLiteralType).value] };
    }
    if ((flags & ts.TypeFlags.StringLike) !== 0) return { kind: "string" };
    if ((flags & ts.TypeFlags.NumberLike) !== 0) return { kind: "number" };
    if ((flags & ts.TypeFlags.BooleanLike) !== 0) return { kind: "boolean" };

    const name = type.getSymbol()?.getName();
    if (name === "Array" || name === "ReadonlyArray") {
      const [item] = checker.getTypeArguments(type as ts.TypeReference);
      return { kind: "list", of: item === undefined ? { kind: "unknown" } : shapeOf(item, depth + 1) };
    }
    if (type.getProperties().length === 0) return { kind: "unknown" };
    // A name earns a place in the catalog, so it is described once however often it appears,
    // and a type that contains itself has a ref to stop at.
    if (name !== undefined && !name.startsWith("__")) return { kind: "ref", named: catalogue(name, type) };
    return { kind: "record", fields: fieldsOf(type, depth) };
  }

  /**
   * Where a type is declared, as `files` for `src/modules/files/...` and `core` for the rest.
   * A bare name is not unique: `ListOutput` is both `config.list`'s output and `files.list`'s,
   * and keying the catalog by the bare name gave one command the other's shape.
   */
  function areaOf(type: ts.Type): string {
    const file = type.getSymbol()?.declarations?.[0]?.getSourceFile().fileName;
    if (file === undefined) return "core";
    const relative = path.relative(root, file).split(path.sep).join("/");
    return relative.startsWith("src/modules/") ? (relative.split("/")[2] ?? "core") : "core";
  }

  /** The catalog name, with its record stored. The placeholder goes in first, or recursion never ends. */
  function catalogue(name: string, type: ts.Type): string {
    const key = `${areaOf(type)}.${name}`;
    const declared = type.getSymbol()?.declarations?.[0]?.getSourceFile().fileName;
    const where = declared === undefined ? key : path.relative(root, declared).split(path.sep).join("/");
    const already = declarations.get(key);
    if (already !== undefined && already !== where) {
      problems.push(`${key}: two types share this name, in ${already} and in ${where}`);
      return key;
    }
    if (records[key] === undefined) {
      declarations.set(key, where);
      records[key] = { kind: "record", fields: {} };
      records[key] = { kind: "record", fields: fieldsOf(type, 0) };
    }
    return key;
  }

  /**
   * null and undefined become notes on what is left, since every other kind would otherwise
   * have to carry them. `boolean` arrives here too, as `true | false`, and collapses back.
   */
  function unionShape(type: ts.UnionType, depth: number): Shape {
    const nullable = type.types.some((part) => (part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)) !== 0);
    const rest = type.types.filter((part) => (part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)) === 0);
    const note = nullable ? { nullable: true as const } : {};
    if (rest.length === 0) return { kind: "unknown", ...note };

    const parts = rest.map((part) => shapeOf(part, depth));
    const first = parts[0];
    if (first === undefined) return { kind: "unknown", ...note };
    if (parts.length === 1) return { ...first, ...note };
    if (parts.every((part) => part.kind === "boolean")) return { kind: "boolean", ...note };
    // A union of string literals is the one union worth keeping, because it names its values.
    const choices = parts.filter((part): part is Extract<Shape, { kind: "choice" }> => part.kind === "choice");
    if (choices.length === parts.length) {
      const of = choices.flatMap((part) => part.of);
      return of.length > MAX_CHOICES ? { kind: "string", ...note } : { kind: "choice", of, ...note };
    }
    // Anything else — a union of records, say — is more than a shape can say honestly.
    return { kind: "unknown", ...note };
  }

  /** Every `id: "..."` on an object-literal const in this file, by the const's name. */
  function specIds(source: ts.SourceFile): ReadonlyMap<string, string> {
    const ids = new Map<string, string>();
    for (const statement of source.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declared of statement.declarationList.declarations) {
        const { name, initializer } = declared;
        if (!ts.isIdentifier(name) || initializer === undefined || !ts.isObjectLiteralExpression(initializer)) continue;
        for (const property of initializer.properties) {
          if (!ts.isPropertyAssignment(property) || !isIdentifier(property.name, "id")) continue;
          if (ts.isStringLiteral(property.initializer)) ids.set(name.text, property.initializer.text);
        }
      }
    }
    return ids;
  }

  /** The command ids a class serves: the one its own spec names, or the ones listed above. */
  function idsOf(declaration: ts.ClassDeclaration, ids: ReadonlyMap<string, string>): readonly string[] {
    const className = declaration.name?.text ?? "";
    const listed = BY_CLASS[className];
    if (listed !== undefined) return listed;
    for (const member of declaration.members) {
      if (!ts.isPropertyDeclaration(member) || !isIdentifier(member.name, "spec")) continue;
      if (member.initializer === undefined || !ts.isIdentifier(member.initializer)) continue;
      const id = ids.get(member.initializer.text);
      if (id !== undefined) return [id];
    }
    return [];
  }

  for (const source of program.getSourceFiles()) {
    const relative = path.relative(root, source.fileName).split(path.sep).join("/");
    if (source.isDeclarationFile || !relative.startsWith("src/modules/")) continue;
    const ids = specIds(source);
    for (const statement of source.statements) {
      if (!ts.isClassDeclaration(statement)) continue;
      const implemented = (statement.heritageClauses ?? [])
        .flatMap((clause) => clause.types)
        .find((type) => isIdentifier(type.expression, "Command"));
      if (implemented === undefined) continue;
      const outputNode = implemented.typeArguments?.[1];
      const names = idsOf(statement, ids);
      if (names.length === 0) {
        problems.push(`${relative}: ${statement.name?.text ?? "a class"} implements Command but names no command id`);
        continue;
      }
      if (outputNode === undefined) {
        problems.push(`${relative}: ${statement.name?.text ?? "a class"} implements Command with no output type`);
        continue;
      }
      const shape = shapeOf(checker.getTypeFromTypeNode(outputNode), 0);
      for (const id of names) commands[id] = shape;
    }
  }

  for (const id of commandIds) {
    if (commands[id] === undefined) {
      problems.push(`${id}: no output shape found; name its class in BY_CLASS in tools/output-shapes.ts`);
    }
  }
  for (const id of Object.keys(commands)) {
    if (!commandIds.includes(id)) problems.push(`${id}: a shape for a command that is not registered`);
  }
  // Nothing may point at a record the catalog lacks, or the reference pages and the schemas
  // would both have a dangling name to explain away.
  for (const [name, shape] of Object.entries(records)) {
    for (const missing of danglingRefs(shape, records)) {
      problems.push(`${name}: points at ${missing}, which the catalog does not hold`);
    }
  }
  return { records, commands, problems };
}

/** Ref names a shape reaches that the catalog does not hold. */
function danglingRefs(shape: Shape, records: Readonly<Record<string, Shape>>): readonly string[] {
  if (shape.kind === "ref") return records[shape.named] === undefined ? [shape.named] : [];
  if (shape.kind === "list") return danglingRefs(shape.of, records);
  if (shape.kind === "record") {
    return Object.values(shape.fields).flatMap((field) => danglingRefs(field, records));
  }
  return [];
}
