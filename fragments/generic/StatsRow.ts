/**
 * StatsRow — a Grid of KPI tiles, one bdo.metric per stat. Filters are literal
 * value pairs (e.g. Status EQ "Open"); currency/percent formats add the symbol.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { FilterPair, andFilter, kpiValueElements, literalConditions, metricDs, textEl } from "./_shared";

const Params = z.object({
  entity: z.string().describe("Entity to aggregate."),
  stats: z
    .array(
      z.object({
        label: z.string(),
        type: z.enum(["COUNT", "SUM", "AVG", "MIN", "MAX", "DISTINCT_COUNT"]).default("COUNT"),
        field: z.string().optional().describe("Required for everything except COUNT."),
        format: z.enum(["plain", "currency", "percent"]).default("plain"),
        filter: z.array(FilterPair).optional().describe("Literal AND conditions, e.g. Status EQ 'Open'."),
      }).refine((s) => s.type === "COUNT" || Boolean(s.field), {
        message: "field is required for SUM/AVG/MIN/MAX/DISTINCT_COUNT",
      }),
    )
    .min(1)
    .max(6),
  columns: z.number().int().min(2).max(6).default(3),
});
type P = z.infer<typeof Params>;

export const StatsRow: Fragment<P> = {
  name: "StatsRow",
  version: "1.0.0",
  description:
    "Row of KPI stat cards (Grid), one bdo.metric per stat: { label, type: COUNT|SUM|AVG|MIN|MAX|DISTINCT_COUNT, " +
    "field?, format: plain|currency|percent, filter?: [{field, operator, value}] }. Use ONLY on dashboards. " +
    "Datasource names are '<ns>-stat-<i>' if you need to refresh them after a write.",
  category: "display",
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: { type: "Grid", props: { columns: Math.min(params.columns, params.stats.length), gap: "md" }, children: params.stats.map((_, i) => `${ns}-stat-${i}`) },
    };
    const datasources: Record<string, Record<string, unknown>> = {};
    params.stats.forEach((s, i) => {
      const ds = `${ns}-stat-${i}`;
      datasources[ds] = metricDs(params.entity, { Type: s.type, ...(s.field ? { Field: s.field } : {}) }, { filter: andFilter(literalConditions(s.filter)) });
      const value = kpiValueElements(`${ns}-stat-${i}-value`, s.format, { $datasource: `${ds}/data/value` });
      elements[`${ns}-stat-${i}`] = { type: "Card", props: { title: null, description: null, maxWidth: null, centered: null, className: null }, children: [`${ns}-stat-${i}-body`] };
      elements[`${ns}-stat-${i}-body`] = { type: "Stack", props: { direction: "vertical", gap: "sm" }, children: [`${ns}-stat-${i}-label`, value.rootKey] };
      elements[`${ns}-stat-${i}-label`] = textEl(s.label, "muted");
      Object.assign(elements, value.elements);
    });
    return {
      root: ns,
      elements: elements as never,
      datasources: datasources as never,
      init: [{ action: "datasource.refresh", params: { names: Object.keys(datasources) } }],
    };
  },
};
