/**
 * File: datasource.zod.ts
 * Created: 10/06/26.
 *
 * Zod schema for a single datasource entry in a json-render spec.
 *
 * Consumers:
 *   - Fragment authors who emit `datasources` in build() — call
 *     `DataSourceSchema.parse(entry)` to validate before returning.
 *   - The Bun fragments-cli prompt renderer, to enumerate the per-type
 *     params for the LLM (one Zod schema per datasource type means one
 *     compact prompt block per type).
 *   - Local rapp Python validators that check generated specs reference
 *     real BDOs / processes / activities (cross-spec checks; this file
 *     does shape only).
 *
 * Models the rapp runtime contract documented in CLAUDE.md under
 * "RAPP RUNTIME — DATASOURCES + ACTIONS (UNIFIED SHAPE)". Nine types
 * total: 5 READ + 4 WRITE.
 *
 * Bindings ($state, $datasource, $item, etc.) are allowed at every leaf
 * of a params value via `ParamValueSchema`, so any field may carry a
 * directive object instead of a literal.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────── //
//  Bindings — the directive vocabulary params values can carry.            //
//  Recursive because $computed.args can contain other bindings.            //
// ─────────────────────────────────────────────────────────────────────── //

export const BindingSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.object({ $state:      z.string() }).strict(),
    z.object({ $bindState:  z.string() }).strict(),
    z.object({ $datasource: z.string() }).strict(),
    z.object({ $item:       z.string() }).strict(),
    z.object({ $index:      z.literal(true) }).strict(),
    z
      .object({
        $template: z.string(),
        args: z
          .record(
            z.string(),
            z.union([z.string(), z.number(), z.boolean(), BindingSchema]),
          )
          .optional(),
      })
      .strict(),
    z
      .object({
        $computed: z.object({
          fn: z.string(),
          args: z.array(
            z.union([
              z.string(),
              z.number(),
              z.boolean(),
              z.null(),
              BindingSchema,
              z.record(z.string(), z.unknown()),
            ]),
          ),
        }),
      })
      .strict(),
  ]),
);

/** Any value a param slot accepts — literal, list, object, or binding. */
export const ParamValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    BindingSchema,
    z.array(ParamValueSchema),
    z.record(z.string(), ParamValueSchema),
  ]),
);

// ─────────────────────────────────────────────────────────────────────── //
//  Filter / Sort / Page / Metric — shared subshapes across READ types.    //
// ─────────────────────────────────────────────────────────────────────── //

export const FilterOperatorSchema = z.enum([
  "EQ",
  "NEQ",
  "IN",
  "NOT_IN",
  "GT",
  "GTE",
  "LT",
  "LTE",
  "CONTAINS",
  "STARTS_WITH",
  "ENDS_WITH",
  "EMPTY",
  "NOT_EMPTY",
  "BETWEEN",
]);

export const FilterConditionSchema = z
  .object({
    LHSField: z.string().describe("BDO field id on the left-hand side."),
    Operator: FilterOperatorSchema,
    RHSValue: ParamValueSchema.optional().describe(
      "Right-hand side value — literal, list, or { $state: '/path' } binding.",
    ),
    RHSType: z.enum(["Constant", "Field", "State"]).optional(),
  })
  .strict();

export const FilterGroupSchema: z.ZodType<unknown> = z.lazy(() =>
  z
    .object({
      Operator: z.enum(["AND", "OR"]).describe("How sibling conditions combine."),
      Condition: z
        .array(z.union([FilterConditionSchema, FilterGroupSchema]))
        .min(1),
    })
    .strict(),
);

export const SortSchema = z
  .union([BindingSchema, z.array(z.record(z.string(), z.enum(["ASC", "DESC"])))])
  .describe('[{<FieldId>: "ASC" | "DESC"}, ...] — multi-key sort. May be a binding (e.g. a Sort/Results toolbar writing the whole array to state).');

export const PageSchema = z
  .object({
    number: z
      .union([z.number().int().min(1), BindingSchema])
      .optional()
      .describe("1-based page number; binding ok."),
    size: z.number().int().min(1).max(500).optional(),
  })
  .strict();

export const MetricEntrySchema = z
  .object({
    Type: z.enum([
      "SUM",
      "AVG",
      "COUNT",
      "DISTINCT_COUNT",
      "BLANK_COUNT",
      "NOT_BLANK_COUNT",
      "CONCAT",
      "DISTINCT_CONCAT",
      "MAX",
      "MIN",
    ]),
    Field: z
      .string()
      .optional()
      .describe(
        "BDO field id. Required for every aggregation except COUNT. COUNT with no Field counts all records.",
      ),
  })
  .strict();

// ─────────────────────────────────────────────────────────────────────── //
//  Per-type params — one Zod schema per datasource type.                  //
// ─────────────────────────────────────────────────────────────────────── //

/** bdo.list — paginated / sorted / searched list of BDO records. */
export const BdoListParamsSchema = z
  .object({
    bdo: z.string().describe("BDO id."),
    Search: ParamValueSchema.optional().describe(
      "Free-text search across searchable fields; binding ok.",
    ),
    Category: ParamValueSchema.optional(),
    Filter: FilterGroupSchema.optional(),
    Sort: SortSchema.optional(),
    Page: PageSchema.optional(),
    Fields: z
      .array(z.string())
      .optional()
      .describe("Optional projection — list of field ids to return."),
  })
  .strict();

/** bdo.get — read ONE BDO record by id. */
export const BdoGetParamsSchema = z
  .object({
    bdo: z.string(),
    _id: ParamValueSchema.describe("Record id (literal or binding)."),
  })
  .strict();

/**
 * bdo.metric — aggregate over a BDO.
 * Result shape: `{value: N}` when GroupBy is empty, `{series: [...]}` otherwise.
 * GroupBy is a FLAT array of STRINGS — object form (with Granularity/As/etc.)
 * is rejected here AND by `_check_metric_params_shape` Python-side.
 */
export const BdoMetricParamsSchema = z
  .object({
    bdo: z.string(),
    Metric: z
      .array(MetricEntrySchema)
      .min(1)
      .describe(
        "One or more aggregations. `{Type:'COUNT'}` with no Field counts all records.",
      ),
    GroupBy: z
      .array(z.string())
      .optional()
      .describe(
        "FLAT array of field-id STRINGS for category grouping. Object form is rejected.",
      ),
    Filter: FilterGroupSchema.optional(),
    Search: ParamValueSchema.optional(),
  })
  .strict();

/** activity.list — list workflow activity instances (tasks). */
export const ActivityListParamsSchema = z
  .object({
    process: z.string().describe("Business process id."),
    activity: z.string().optional().describe("Optional activity id filter."),
    Filter: FilterGroupSchema.optional(),
    Sort: SortSchema.optional(),
    Page: PageSchema.optional(),
  })
  .strict();

/** activity.get — read ONE activity instance. */
export const ActivityGetParamsSchema = z
  .object({
    process: z.string(),
    activity: z.string(),
    _id: ParamValueSchema,
  })
  .strict();

/**
 * bdo.save — create-or-update one BDO record.
 *
 * EXACTLY ONE of `valuesPath` or `values` is required:
 *   - `valuesPath` — state path to the draft object. Preferred from a Form.
 *   - `values`     — inline map. Preferred for one-shot writes from a Button.
 *
 * `_id` distinguishes update (set) from create (omit).
 */
export const BdoSaveParamsSchema = z
  .object({
    bdo: z.string(),
    valuesPath: z
      .string()
      .optional()
      .describe("State path to the draft object (e.g. '/form/order')."),
    values: z
      .record(z.string(), ParamValueSchema)
      .optional()
      .describe("Inline values map."),
    _id: ParamValueSchema.optional().describe(
      "Set to update an existing record; omit to create.",
    ),
    closePath: z
      .string()
      .optional()
      .describe(
        "Optional state path the runtime sets to false on success (closes a dialog).",
      ),
  })
  .strict()
  .refine(
    (p) => Boolean(p.valuesPath) !== Boolean(p.values),
    "bdo.save requires exactly ONE of `valuesPath` or `values`.",
  );

/** bdo.delete — soft-delete one BDO record. */
export const BdoDeleteParamsSchema = z
  .object({
    bdo: z.string(),
    _id: ParamValueSchema,
  })
  .strict();

/**
 * activity.submit — submit / approve / reject an activity instance.
 *
 * `decision` carries the branch label when the activity has multiple
 * outcomes (e.g. "Approve" vs "Reject"). When the activity has a single
 * outcome, omit it.
 */
export const ActivitySubmitParamsSchema = z
  .object({
    process: z.string(),
    activity: z.string(),
    _id: ParamValueSchema.describe("Activity instance id."),
    valuesPath: z.string().optional(),
    values: z.record(z.string(), ParamValueSchema).optional(),
    decision: z
      .string()
      .optional()
      .describe(
        "Branch label when the activity has multiple outcomes (e.g. 'Approve', 'Reject').",
      ),
  })
  .strict()
  .refine(
    (p) => p.valuesPath !== undefined || p.values !== undefined,
    "activity.submit requires `valuesPath` or `values`.",
  );

/**
 * workflow.start — start a Business Process.
 *
 * When `activity` is set, also submits the first activity inline with
 * the supplied values. Useful for "Create + start" buttons.
 */
export const WorkflowStartParamsSchema = z
  .object({
    process: z.string(),
    activity: z
      .string()
      .optional()
      .describe(
        "When set, also submits the first activity with the given values.",
      ),
    valuesPath: z.string().optional(),
    values: z.record(z.string(), ParamValueSchema).optional(),
  })
  .strict();

// ─────────────────────────────────────────────────────────────────────── //
//  Lifecycle hooks: on.success / on.error                                  //
//                                                                          //
//  Each entry is a regular action descriptor. Only the 5 LOCAL actions     //
//  are allowed — nested datasource fires here produce confusing cascades   //
//  and are explicitly rejected.                                             //
// ─────────────────────────────────────────────────────────────────────── //

export const LOCAL_ACTION_TYPES = [
  "setState",
  "ui.toast",
  "ui.navigate",
  "datasource.refresh",
  "datasource.fire",
] as const;

export const ActionDescriptorSchema = z
  .object({
    action: z.enum(LOCAL_ACTION_TYPES).describe(
      "One of the 5 LOCAL actions. No backend ops here.",
    ),
    params: z.record(z.string(), ParamValueSchema).optional(),
  })
  .strict();

export const LifecycleHooksSchema = z
  .object({
    success: z.array(ActionDescriptorSchema).optional(),
    error: z.array(ActionDescriptorSchema).optional(),
  })
  .strict();

// ─────────────────────────────────────────────────────────────────────── //
//  Discriminated union — the per-type params shape selected by `type`.    //
//                                                                          //
//  Shared field groups differ by mode: READ types support debouncing +     //
//  oneShot + skipUntilReady; WRITE types support `refresh` (a list of      //
//  sibling datasource names to re-fire after success).                     //
// ─────────────────────────────────────────────────────────────────────── //

const ReadDatasourceShared = {
  into: z
    .string()
    .optional()
    .describe("Where the result lands. Defaults to /queries/<name>."),
  debounceMs: z
    .number()
    .int()
    .min(0)
    .max(5000)
    .optional()
    .describe("Debounce window for $state-dep refires (READ only)."),
  skipUntilReady: z
    .boolean()
    .optional()
    .describe(
      "Suppress the first fire until every $state dep resolves to a non-empty value.",
    ),
  oneShot: z
    .boolean()
    .optional()
    .describe(
      "When true, never auto-refire on dep change; only via datasource.refresh.",
    ),
  on: LifecycleHooksSchema.optional(),
};

const WriteDatasourceShared = {
  refresh: z
    .array(z.string())
    .optional()
    .describe(
      "Sibling datasource names to re-fire after a successful write (typically the corresponding READ).",
    ),
  on: LifecycleHooksSchema.optional(),
};

export const DataSourceSchema = z.discriminatedUnion("type", [
  // ─── READ ────────────────────────────────────────────────────────────
  z.object({
    type: z.literal("bdo.list"),
    params: BdoListParamsSchema,
    ...ReadDatasourceShared,
  }),
  z.object({
    type: z.literal("bdo.get"),
    params: BdoGetParamsSchema,
    ...ReadDatasourceShared,
  }),
  z.object({
    type: z.literal("bdo.metric"),
    params: BdoMetricParamsSchema,
    ...ReadDatasourceShared,
  }),
  z.object({
    type: z.literal("activity.list"),
    params: ActivityListParamsSchema,
    ...ReadDatasourceShared,
  }),
  z.object({
    type: z.literal("activity.get"),
    params: ActivityGetParamsSchema,
    ...ReadDatasourceShared,
  }),

  // ─── WRITE ───────────────────────────────────────────────────────────
  z.object({
    type: z.literal("bdo.save"),
    params: BdoSaveParamsSchema,
    ...WriteDatasourceShared,
  }),
  z.object({
    type: z.literal("bdo.delete"),
    params: BdoDeleteParamsSchema,
    ...WriteDatasourceShared,
  }),
  z.object({
    type: z.literal("activity.submit"),
    params: ActivitySubmitParamsSchema,
    ...WriteDatasourceShared,
  }),
  z.object({
    type: z.literal("workflow.start"),
    params: WorkflowStartParamsSchema,
    ...WriteDatasourceShared,
  }),
]);

export type DataSource = z.infer<typeof DataSourceSchema>;

// ─────────────────────────────────────────────────────────────────────── //
//  Convenience helpers                                                     //
// ─────────────────────────────────────────────────────────────────────── //

export const READ_DATASOURCE_TYPES = [
  "bdo.list",
  "bdo.get",
  "bdo.metric",
  "activity.list",
  "activity.get",
] as const;

export const WRITE_DATASOURCE_TYPES = [
  "bdo.save",
  "bdo.delete",
  "activity.submit",
  "workflow.start",
] as const;

export type ReadDatasourceType = (typeof READ_DATASOURCE_TYPES)[number];
export type WriteDatasourceType = (typeof WRITE_DATASOURCE_TYPES)[number];
export type DatasourceType = ReadDatasourceType | WriteDatasourceType;

export function isReadDatasource(ds: DataSource): boolean {
  return (READ_DATASOURCE_TYPES as readonly string[]).includes(ds.type);
}

export function isWriteDatasource(ds: DataSource): boolean {
  return (WRITE_DATASOURCE_TYPES as readonly string[]).includes(ds.type);
}

/** Spec-level shape: a map of datasource-name → DataSource entry. */
export const DataSourceMapSchema = z.record(z.string(), DataSourceSchema);
export type DataSourceMap = z.infer<typeof DataSourceMapSchema>;
