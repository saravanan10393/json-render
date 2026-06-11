/** ProgressTracker — one ungrouped metric rendered as value-vs-target Progress. */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { FilterPair, andFilter, literalConditions, metricDs, textEl } from "./_shared";

const Params = z
  .object({
    entity: z.string(),
    title: z.string(),
    metricType: z.enum(["COUNT", "SUM", "AVG"]).default("COUNT"),
    field: z.string().optional(),
    target: z.number().positive().describe("The goal — Progress maxes out here."),
    filter: z.array(FilterPair).optional(),
  })
  .refine((p) => p.metricType === "COUNT" || Boolean(p.field), {
    message: "field is required for SUM/AVG",
  });
type P = z.infer<typeof Params>;

export const ProgressTracker: Fragment<P> = {
  name: "ProgressTracker",
  version: "1.0.0",
  description:
    "Metric-vs-target progress card (e.g. 'Done tasks vs target 20'). ONE ungrouped aggregation; " +
    "Progress fills value/target. Datasource name '<ns>-metric'.",
  whenToUse:
    "Use when the user wants to track progress toward a goal or target number — like '7 of 10 orders delivered' shown as a filling progress bar.",
  category: "display",
  previewParams: {
    entity: "Order",
    title: "Delivered orders",
    metricType: "COUNT",
    target: 10,
    filter: [{ field: "Status", operator: "EQ", value: "Delivered" }],
  },
  params: Params as z.ZodType<P>,
  build: (params, ns) => ({
    root: ns,
    elements: {
      [ns]: { type: "Card", props: { title: params.title, description: null, maxWidth: null, centered: null, className: null }, children: [`${ns}-body`] },
      [`${ns}-body`]: { type: "Stack", props: { direction: "vertical", gap: "sm" }, children: [`${ns}-bar`, `${ns}-caption`] },
      [`${ns}-bar`]: { type: "Progress", props: { value: { $datasource: `${ns}-metric/data/value` }, max: params.target, label: null } },
      [`${ns}-caption`]: { type: "Stack", props: { direction: "horizontal", justify: "between", align: "center" }, children: [`${ns}-current`, `${ns}-target`] },
      [`${ns}-current`]: textEl({ $datasource: `${ns}-metric/data/value` }, "lead"),
      [`${ns}-target`]: textEl(`of ${params.target}`, "muted"),
    } as never,
    datasources: {
      [`${ns}-metric`]: metricDs(
        params.entity,
        { Type: params.metricType, ...(params.field ? { Field: params.field } : {}) },
        { filter: andFilter(literalConditions(params.filter)) },
      ),
    } as never,
    init: [{ action: "datasource.refresh", params: { names: [`${ns}-metric`] } }],
  }),
};
