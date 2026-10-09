import type { OutputShapes, Shape, ShapeFields } from "../../domain/output-shape.js";
import type { JsonObject } from "./protocol.js";

/**
 * A command's output shape as the JSON Schema an MCP tool declares for its `data`.
 *
 * Refs are followed and written out in place rather than left as `$ref`, so each tool's schema
 * stands on its own and no client has to resolve anything. A name met twice down one chain —
 * a `Message` whose parameters may be messages — stops as a plain object, which is the honest
 * thing to say about a type that contains itself.
 */
export function dataSchema(shapes: OutputShapes, shape: Shape): JsonObject {
  return schemaOf(shapes, shape, []);
}

/** `["string", "null"]` reads as either, which is what a nullable field is. */
const typeOf = (name: string, nullable: boolean): string | readonly string[] => (nullable ? [name, "null"] : name);

function schemaOf(shapes: OutputShapes, shape: Shape, seen: readonly string[]): JsonObject {
  const nullable = shape.nullable === true;
  const note = shape.description === undefined ? {} : { description: shape.description };
  switch (shape.kind) {
    case "string":
    case "number":
    case "boolean":
      return { type: typeOf(shape.kind, nullable), ...note };
    // Nothing is claimed about it, which an empty schema says exactly.
    case "unknown":
      return { ...note };
    case "choice":
      return { type: typeOf("string", nullable), enum: nullable ? [...shape.of, null] : [...shape.of], ...note };
    case "list":
      return { type: typeOf("array", nullable), items: schemaOf(shapes, shape.of, seen), ...note };
    case "record":
      return { ...objectOf(shapes, shape.fields, seen, nullable), ...note };
    // oneOf, not a merge: a client that validates must be able to tell which answer it got.
    case "variants": {
      const of = shape.of.map((part) => schemaOf(shapes, part, seen));
      return { oneOf: nullable ? [...of, { type: "null" }] : of, ...note };
    }
    case "ref": {
      const record = shapes.records[shape.named];
      if (record === undefined || seen.includes(shape.named)) {
        return { type: typeOf("object", nullable), title: shape.named, ...note };
      }
      const resolved = schemaOf(shapes, record, [...seen, shape.named]);
      return { ...resolved, type: typeOf("object", nullable), title: shape.named, ...note };
    }
  }
}

function objectOf(shapes: OutputShapes, fields: ShapeFields, seen: readonly string[], nullable: boolean): JsonObject {
  const properties: Record<string, JsonObject> = {};
  const required: string[] = [];
  for (const [name, field] of Object.entries(fields)) {
    properties[name] = schemaOf(shapes, field, seen);
    // Every field a command returns is present; nullable says it may be null, not absent.
    if (field.optional !== true) required.push(name);
  }
  return {
    type: typeOf("object", nullable),
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  };
}
