/**
 * File: fragment.zod.ts
 * Created: 10/06/26.
 *
 * The COMPLETE schema for the FRAGMENT system — the reusable, parameterized
 * widget layer that sits on top of json-render via eject-on-write.
 *
 * A fragment is a typed function `(params, ns) => FragmentOutput`. The LLM
 * never emits primitives for a fragment; it emits a tiny `$fragment` REFERENCE
 * and the write-time expander materialises it to primitives + boundary
 * metadata. Customization is via `params` or sibling-composition ONLY — there
 * are no slots, no slotScope, no _overrides. Anything beyond that is an eject.
 *
 * This file captures the four schema-able surfaces of the system:
 *   1. FragmentRefSchema      — what the LLM emits inside spec.elements.
 *   2. FragmentOutputSchema   — what build() returns (merged into the page).
 *   3. FragmentMetaSchema     — the static authoring metadata.
 *   4. Boundary metadata      — inline _meta.boundary tags + the _boundaries
 *                               manifest the edit pipeline reconciles.
 *
 * The full `Fragment<P>` authoring contract (with `params: z.ZodType<P>` and
 * `build`, neither of which Zod can validate at runtime) lives in `../types.ts`
 * and is re-exported below for convenience.
 *
 * THE ONE LOAD-BEARING INVARIANT: every element id, datasource name, and state
 * key a fragment emits MUST be prefixed with `${ns}`, and the output root MUST
 * equal `ns`. Because `ns` is the (unique) element-map key of the reference,
 * every inner key is unique by construction → collision-free multi-instance
 * composition with no ownership registry. `assertNsInvariants` below enforces it.
 *
 * Pairs with: `page.zod.ts` (UIElement/Spec) and `datasource.zod.ts` (DataSource).
 */

import { z } from "zod";

import { ActionDescriptorSchema, DataSourceMapSchema } from "./datasource.zod";
import { PropValueSchema, UIElementSchema } from "./page.zod";

// Re-export the TS authoring contract (the parts Zod cannot express).
// `FragmentOutput` is omitted — defined locally below from FragmentOutputSchema
// (z.infer). `DataSource` is omitted — datasource.zod.ts owns the canonical,
// schema-derived `DataSource`; the loose interface in types.ts would shadow it.
export type {
  Binding,
  ElementSpec,
  ActionDescriptor,
  InitAction,
  Fragment,
  FragmentRegistry,
} from "./types";

// ─────────────────────────────────────────────────────────────────────── //
//  1. The $fragment reference — what the LLM emits inside spec.elements.   //
//                                                                          //
//  e.g. { "aapl-summary": { "$fragment": "StockSummary",                   //
//                           "params": { "ticker": "AAPL" } } }             //
//                                                                          //
//  The element KEY ("aapl-summary") becomes the `ns` passed to build().    //
//  Params are validated against the fragment's own Zod `params` schema by  //
//  the expander (not here — this is the structural envelope only).         //
// ─────────────────────────────────────────────────────────────────────── //

export const FragmentRefSchema = z
  .object({
    $fragment: z.string().describe("Registered fragment id (e.g. 'fragment-cart-summary')."),
    params: z
      .record(z.string(), PropValueSchema)
      .optional()
      .describe("Fragment params; bindings allowed at any leaf."),
  })
  .strict();

export type FragmentRef = z.infer<typeof FragmentRefSchema>;

/**
 * A SOURCE-spec element is EITHER a primitive UIElement OR a $fragment ref.
 * Use this for the pre-expansion spec; the persisted/expanded page uses the
 * primitive UIElementSchema from page.zod.ts.
 */
export const SourceElementSchema = z.union([FragmentRefSchema, UIElementSchema]);

// ─────────────────────────────────────────────────────────────────────── //
//  2. FragmentOutput — what build(params, ns) returns.                     //
//                                                                          //
//  Four namespaces, each merged into the page with one collision guard:    //
//  elements, datasources, init, state. `root` MUST equal `ns`.             //
// ─────────────────────────────────────────────────────────────────────── //

export const FragmentOutputSchema = z
  .object({
    root: z.string().describe("MUST equal the `ns` passed to build()."),
    elements: z.record(z.string(), UIElementSchema),
    state: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Seeded under /state/<ns>/... — keys ns-prefixed."),
    datasources: DataSourceMapSchema.optional().describe(
      "ns-prefixed datasource names; merged into spec.datasources.",
    ),
    init: z
      .array(ActionDescriptorSchema)
      .optional()
      .describe("Appended to the page-level init chain."),
  })
  .strict();

export type FragmentOutput = z.infer<typeof FragmentOutputSchema>;

// ─────────────────────────────────────────────────────────────────────── //
//  3. Fragment authoring metadata — the static, Zod-validatable part.      //
//                                                                          //
//  (`params: z.ZodType<P>` and `build` are functions/schemas Zod can't     //
//  validate; see ../types.ts for the full `Fragment<P>` interface.)        //
// ─────────────────────────────────────────────────────────────────────── //

export const FRAGMENT_CATEGORIES = [
  "product-display",
  "browse",
  "cart-checkout",
  "account",
  "promotion",
  "review",
  "layout",
  "form",
  "display",
] as const;

export const FragmentCategorySchema = z.enum(FRAGMENT_CATEGORIES);
export type FragmentCategory = z.infer<typeof FragmentCategorySchema>;

const SEMVER = /^\d+\.\d+\.\d+$/;

export const FragmentMetaSchema = z
  .object({
    name: z.string(),
    version: z.string().regex(SEMVER, "Expected semver (e.g. 1.0.0)."),
    description: z
      .string()
      .describe("Appears in the LLM system-prompt registry enumeration."),
    category: FragmentCategorySchema,
  })
  .strict();

export type FragmentMeta = z.infer<typeof FragmentMetaSchema>;

// ─────────────────────────────────────────────────────────────────────── //
//  4. Eject boundary metadata.                                             //
//                                                                          //
//  Eject-on-write persists primitives only, but tags everything that came  //
//  from a fragment so the edit pipeline can recover the widget boundary:   //
//    - inline `_meta.boundary` on each element / datasource / init item    //
//    - a top-level `_boundaries` manifest (boundaryId → entry)             //
//  The runtime + catalog-cli IGNORE both (json-render passthrough). They   //
//  exist purely for tooling / the edit pipeline.                           //
// ─────────────────────────────────────────────────────────────────────── //

/** Inline tag carried on an element/datasource that came from a fragment. */
export const ElementBoundaryMetaSchema = z
  .object({
    boundary: z.string().describe("Back-reference to a _boundaries key."),
    role: z
      .enum(["root", "child"])
      .optional()
      .describe("Whether this element is the instance root or a descendant."),
  })
  .strict();

/** One manifest entry — a single ejected fragment instance. */
export const BoundaryEntrySchema = z
  .object({
    fragmentName: z.string(),
    fragmentVersion: z.string(),
    instanceId: z.string().describe("The element key (== ns) of the reference."),
    params: z
      .record(z.string(), z.unknown())
      .describe("Params at eject time (lets the editor show/re-apply them)."),
    ejectedAt: z.string().describe("ISO-8601 timestamp."),
    rootElementId: z.string(),
    elementIds: z.array(z.string()),
    datasourceIds: z.array(z.string()),
    initIndices: z
      .array(z.number().int())
      .describe("Indices into spec.init contributed by this instance."),
  })
  .strict();

export type BoundaryEntry = z.infer<typeof BoundaryEntrySchema>;

/** The top-level `_boundaries` manifest: boundaryId → entry. */
export const BoundariesSchema = z.record(z.string(), BoundaryEntrySchema);
export type Boundaries = z.infer<typeof BoundariesSchema>;

// ─────────────────────────────────────────────────────────────────────── //
//  Invariant checker — the ns-prefix rule the expander relies on.          //
//                                                                          //
//  Call from a fragment's build() in tests, or from the expander, to fail  //
//  fast on a mis-namespaced output. Two key groups are intentionally NOT   //
//  prefixed and so are not checked: ui.navigate page names and             //
//  BDO/Process/Activity entity names (both global).                        //
// ─────────────────────────────────────────────────────────────────────── //

export function assertNsInvariants(output: FragmentOutput, ns: string): void {
  const problems: string[] = [];

  if (output.root !== ns) {
    problems.push(`root "${output.root}" must equal ns "${ns}"`);
  }
  if (!(ns in output.elements)) {
    problems.push(`elements is missing the root key "${ns}"`);
  }

  const prefix = `${ns}-`;
  const ok = (key: string) => key === ns || key.startsWith(prefix);

  for (const key of Object.keys(output.elements)) {
    if (!ok(key)) problems.push(`element id "${key}" is not prefixed with "${ns}"`);
  }
  for (const key of Object.keys(output.datasources ?? {})) {
    if (!ok(key)) problems.push(`datasource "${key}" is not prefixed with "${ns}"`);
  }
  for (const key of Object.keys(output.state ?? {})) {
    // state keys are JSON-Pointer-ish; expect /state/<ns>/... or <ns>...
    if (!key.includes(ns)) {
      problems.push(`state key "${key}" does not reference ns "${ns}"`);
    }
  }

  if (problems.length) {
    throw new Error(
      `Fragment ns-invariant violations for ns "${ns}":\n  - ${problems.join("\n  - ")}`,
    );
  }
}
