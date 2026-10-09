/**
 * What a command's `--json` `data` holds.
 *
 * These are read out of each command's TypeScript output type by `npm run shapes`, never
 * written by hand. The type is the only source, so a shape cannot drift from the code the way
 * a second declaration would, and the JSDoc already on those fields becomes each description.
 */

export interface ShapeNote {
  /** The value may be null. Present only when it may, never as `false`. */
  readonly nullable?: true;
  /** The field may be absent altogether, from `field?: T`. */
  readonly optional?: true;
  /** The field's own JSDoc, as written on the type. */
  readonly description?: string;
}

/** A value whose kind says all there is to say: text, a number, a boolean, or anything at all. */
export type ScalarKind = "string" | "number" | "boolean" | "unknown";

export type Shape =
  | (ShapeNote & { readonly kind: ScalarKind })
  /** One of a fixed set of strings, from a union of string literals. */
  | (ShapeNote & { readonly kind: "choice"; readonly of: readonly string[] })
  | (ShapeNote & { readonly kind: "list"; readonly of: Shape })
  /**
   * A record the catalog holds under this name. Every type with a name becomes one of these,
   * so a type shared by several commands is described once, and a type that contains itself —
   * a `Message`, whose parameters may be messages — has somewhere to point instead of
   * expanding forever.
   */
  | (ShapeNote & { readonly kind: "ref"; readonly named: string })
  /** A record written inline, which is every object type without a name of its own. */
  | (ShapeNote & { readonly kind: "record"; readonly fields: ShapeFields });

export type ShapeFields = Readonly<Record<string, Shape>>;

export interface OutputShapes {
  /** Every named record, each described once. A `ref` names one of these. */
  readonly records: Readonly<Record<string, Shape>>;
  /** What each command's `data` holds, by command id. */
  readonly commands: Readonly<Record<string, Shape>>;
}

/**
 * The shape a `ref` points at, or undefined when the catalog does not hold it. Following a
 * ref is the caller's job because how far to follow one differs: a reference page can print a
 * name and link to it, while a JSON Schema has to resolve it.
 */
export function recordOf(shapes: OutputShapes, shape: Shape): Shape | undefined {
  return shape.kind === "ref" ? shapes.records[shape.named] : shape;
}
