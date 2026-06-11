/**
 * File: page.zod.ts
 * Created: 10/06/26.
 *
 * The COMPLETE Zod schema for a json-render PAGE in the rapp runtime.
 *
 * This is the canonical, self-documenting reference for the page spec the LLM
 * emits and the renderer (`ScreenRenderer.tsx`) interprets. It models:
 *
 *   - the base `@json-render/core` Spec  ........  { root, elements, state }
 *   - the rapp extensions  .....................  { datasources, init }  + `watch`
 *   - the full binding / expression language  ..  PropExpression
 *   - visibility conditions
 *   - the (rapp-constrained) action vocabulary
 *   - the on-disk wrappers  ....................  app.json index + pages/{id}.json
 *
 * Pairs with:
 *   - `datasource.zod.ts`  — the 9-type datasource contract (imported here).
 *   - `fragment.zod.ts`    — the fragment contract + eject boundary manifest.
 *
 * NOTE on scope: this models the PERSISTED / EXPANDED page — elements are
 * primitives only. The pre-expansion `$fragment` reference form lives in
 * `fragment.zod.ts` (FragmentRefSchema). `_meta` / `_boundaries` passthrough
 * fields are tolerated here (the renderer ignores them) but their strict shape
 * is defined in `fragment.zod.ts` to keep this file free of a back-dependency.
 */

import { z } from "zod";

import {
  ActionDescriptorSchema,
  DataSourceMapSchema,
  LOCAL_ACTION_TYPES,
} from "./datasource.zod";

// ─────────────────────────────────────────────────────────────────────── //
//  Visibility conditions.                                                  //
//                                                                          //
//  `visible` on an element evaluates one of these. Comparison operators    //
//  attach to a single $state / $item / $index condition; arrays are an     //
//  implicit AND; $and / $or nest.                                          //
// ─────────────────────────────────────────────────────────────────────── //

const NumberOrStateRef = z.union([
  z.number(),
  z.object({ $state: z.string() }).strict(),
]);

const ComparisonOperators = {
  eq: z.unknown().optional(),
  neq: z.unknown().optional(),
  gt: NumberOrStateRef.optional(),
  gte: NumberOrStateRef.optional(),
  lt: NumberOrStateRef.optional(),
  lte: NumberOrStateRef.optional(),
  not: z.literal(true).optional(),
} as const;

const StateConditionSchema = z
  .object({ $state: z.string(), ...ComparisonOperators })
  .strict();
const ItemConditionSchema = z
  .object({ $item: z.string(), ...ComparisonOperators })
  .strict();
const IndexConditionSchema = z
  .object({ $index: z.literal(true), ...ComparisonOperators })
  .strict();

const SingleConditionSchema = z.union([
  StateConditionSchema,
  ItemConditionSchema,
  IndexConditionSchema,
]);

export const VisibilityConditionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.boolean(),
    SingleConditionSchema,
    z.array(SingleConditionSchema).describe("Implicit AND of conditions."),
    z.object({ $and: z.array(VisibilityConditionSchema) }).strict(),
    z.object({ $or: z.array(VisibilityConditionSchema) }).strict(),
  ]),
);

// ─────────────────────────────────────────────────────────────────────── //
//  PropExpression — the directive vocabulary any prop value can carry.     //
//                                                                          //
//  Superset of the params-level BindingSchema in datasource.zod.ts: adds   //
//  $bindItem (two-way repeat-item binding) and $cond (inline ternary).     //
//  Two $computed shapes exist in the wild and both are accepted:           //
//    - json-render core:  { $computed: "fnName", args?: {...} }            //
//    - rapp bindings:     { $computed: { fn, args: [...] } }               //
// ─────────────────────────────────────────────────────────────────────── //

export const PropExpressionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.object({ $state: z.string() }).strict(),
    z.object({ $item: z.string() }).strict(),
    z.object({ $index: z.literal(true) }).strict(),
    z.object({ $bindState: z.string() }).strict(),
    z.object({ $bindItem: z.string() }).strict(),
    z.object({ $datasource: z.string() }).strict(),
    z.object({ $template: z.string() }).strict(),
    z
      .object({
        $computed: z.string(),
        args: z.record(z.string(), z.unknown()).optional(),
      })
      .strict(),
    z
      .object({
        $computed: z.object({
          fn: z.string(),
          args: z.array(z.unknown()),
        }),
      })
      .strict(),
    z
      .object({
        $cond: VisibilityConditionSchema,
        $then: PropExpressionSchema,
        $else: PropExpressionSchema,
      })
      .strict(),
  ]),
);

/** Any value a prop slot accepts — literal, list, object, or expression. */
export const PropValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    PropExpressionSchema,
    z.array(PropValueSchema),
    z.record(z.string(), PropValueSchema),
  ]),
);

// ─────────────────────────────────────────────────────────────────────── //
//  Action bindings — what fires from `on.*`, `watch`, and `init`.          //
//                                                                          //
//  rapp constrains actions to the 5 LOCAL action types (see datasource.zod //
//  — LOCAL_ACTION_TYPES). Backend ops are NEVER actions; they are          //
//  datasources fired via `datasource.fire`. The optional confirm /         //
//  onSuccess / onError / preventDefault keys come from json-render core.   //
// ─────────────────────────────────────────────────────────────────────── //

export const ActionConfirmSchema = z
  .object({
    title: z.string(),
    message: z.string(),
    confirmLabel: z.string().optional(),
    cancelLabel: z.string().optional(),
    variant: z.enum(["default", "danger"]).optional(),
  })
  .strict();

const ActionOnSuccessSchema = z.union([
  z.object({ navigate: z.string() }).strict(),
  z.object({ set: z.record(z.string(), z.unknown()) }).strict(),
  z.object({ action: z.string() }).strict(),
]);

const ActionOnErrorSchema = z.union([
  z.object({ set: z.record(z.string(), z.unknown()) }).strict(),
  z.object({ action: z.string() }).strict(),
]);

export const ActionBindingSchema = z
  .object({
    action: z
      .enum(LOCAL_ACTION_TYPES)
      .describe("One of the 5 LOCAL actions. Backend ops use datasource.fire."),
    params: z.record(z.string(), PropValueSchema).optional(),
    confirm: ActionConfirmSchema.optional(),
    onSuccess: ActionOnSuccessSchema.optional(),
    onError: ActionOnErrorSchema.optional(),
    preventDefault: z.boolean().optional(),
  })
  .strict();

/** Event name → action(s). Used by element `on` and element/spec `watch`. */
export const EventHandlersSchema = z.record(
  z.string(),
  z.union([ActionBindingSchema, z.array(ActionBindingSchema)]),
);

// ─────────────────────────────────────────────────────────────────────── //
//  UIElement — one node in the flat element graph.                         //
//                                                                          //
//  Parent → child links are by KEY (`children: string[]`), never inline.   //
//  `repeat` renders children once per array item and opens $item / $index  //
//  scope. `_meta` carries fragment-boundary tags (ignored by the renderer).//
// ─────────────────────────────────────────────────────────────────────── //

export const RepeatSchema = z
  .object({
    statePath: z
      .string()
      .describe("JSON-Pointer to the array to iterate (often /queries/<ds>/data)."),
    key: z.string().optional().describe("Stable item key field (e.g. _id)."),
  })
  .strict();

export const UIElementSchema = z
  .object({
    type: z.string().describe("Catalog component name (Card, Table, Stat, ...)."),
    props: z
      .record(z.string(), PropValueSchema)
      .describe("Component props. Values may be literals or PropExpressions."),
    children: z.array(z.string()).optional().describe("Child element KEYS."),
    visible: z
      .union([VisibilityConditionSchema, PropExpressionSchema])
      .optional(),
    on: EventHandlersSchema.optional().describe("Event name → action binding(s)."),
    repeat: RepeatSchema.optional(),
    watch: EventHandlersSchema.optional().describe(
      "JSON-Pointer state path → action(s) fired on change.",
    ),
    _meta: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Fragment-boundary tags etc. Ignored by the renderer."),
  })
  // passthrough so an un-expanded `$fragment` ref element still parses in a
  // SOURCE spec; the expander materialises it to primitives before persist.
  .passthrough();

// ─────────────────────────────────────────────────────────────────────── //
//  The page spec — base Spec + rapp extensions.                            //
// ─────────────────────────────────────────────────────────────────────── //

export const SpecSchema = z
  .object({
    /** Root element key. Must exist in `elements`. */
    root: z.string(),
    /** Flat map of elements by key. */
    elements: z.record(z.string(), UIElementSchema),
    /**
     * Initial state model (JSON-Pointer addressed). Conventional namespaces:
     *   /ui/*      transient UI flags (dialogs, toasts)
     *   /filters/* filter inputs (drive READ datasource $state deps)
     *   /form/*    form drafts (written by WRITE datasources)
     *   /state/<ns>/* fragment-owned state
     * RESERVED — never seed without a matching datasource `into`:
     *   /queries/* READ results   /metrics/* metric results
     */
    state: z.record(z.string(), z.unknown()).optional(),
    /**
     * RAPP EXTENSION — every backend operation. Name → DataSource. READ types
     * auto-fire on $state dep change; WRITE types fire via datasource.fire.
     * Widgets read results via { $datasource: "<name>/<path>" }.
     */
    datasources: DataSourceMapSchema.optional(),
    /**
     * RAPP EXTENSION — mount-time action chain. Runs ONCE after datasources
     * register, typically `datasource.refresh` to trigger the first loads in
     * order. Only the 5 LOCAL actions are valid here — never a fetch/mutation.
     */
    init: z.array(ActionDescriptorSchema).optional(),
    /** Top-level side-effect hooks: state path → action(s). Side effects only. */
    watch: EventHandlersSchema.optional(),
    /**
     * Eject-on-write boundary manifest (boundaryId → entry). Strict shape in
     * fragment.zod.ts (BoundariesSchema). Loose here to avoid a back-dependency;
     * the renderer ignores it.
     */
    _boundaries: z.record(z.string(), z.unknown()).optional(),
    _meta: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough()
  .superRefine((spec, ctx) => {
    if (!(spec.root in spec.elements)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `root "${spec.root}" is not present in elements`,
        path: ["root"],
      });
    }
  });

export type Spec = z.infer<typeof SpecSchema>;

// ─────────────────────────────────────────────────────────────────────── //
//  On-disk wrappers — app.json index + pages/{pageId}.json.                //
//                                                                          //
//  Page ID format: {role-slug}-{entity-slug}-{page-name-slug}.            //
//  URL shape:      /{role}/{page-name-slug}  (entity stripped from URL).   //
// ─────────────────────────────────────────────────────────────────────── //

export const SHELL_LAYOUTS = [
  "sidebar",
  "topnav",
  "icon-rail",
  "compact-rail",
  "minimal",
  "split-rail",
] as const;

export const SHELL_VARIANTS = ["standard", "floating", "inset"] as const;

export const NavEntrySchema = z
  .object({
    label: z.string(),
    icon: z.string().optional(),
    page: z.string().describe("Page ID this nav entry targets."),
    group: z.string().optional().describe("Optional module/section cluster."),
  })
  .strict();

export const RoleIndexSchema = z
  .object({
    home: z
      .string()
      .nullable()
      .describe("Landing page ID for /{role}; must appear in `pages`."),
    navigation: z.array(NavEntrySchema),
    pages: z.array(z.string()).describe("Every pageId belonging to this role."),
    shellLayout: z.enum(SHELL_LAYOUTS).optional(),
    shellVariant: z.enum(SHELL_VARIANTS).optional(),
  })
  .strict();

export const AppIndexSchema = z
  .object({
    version: z.string().describe('Bundle version (current: "2.0").'),
    app: z.string().describe("App id."),
    roles: z.record(z.string(), RoleIndexSchema),
  })
  .strict();

export type AppIndex = z.infer<typeof AppIndexSchema>;

export const PageFileSchema = z
  .object({
    id: z.string().describe("Page ID: {role-slug}-{entity-slug}-{page-name-slug}."),
    role: z.string(),
    businessEntity: z.string(),
    name: z.string().describe("Screen name (drives the URL segment)."),
    spec: SpecSchema,
  })
  .strict();

export type PageFile = z.infer<typeof PageFileSchema>;
