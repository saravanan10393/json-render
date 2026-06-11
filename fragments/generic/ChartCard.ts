/** ChartCard — Card + Chart over one bdo.metric GroupBy series. */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { FilterPair, andFilter, literalConditions, metricDs } from "./_shared";

const Params = z
  .object({
    entity: z.string(),
    title: z.string(),
    kind: z.enum(["bar", "line", "area", "donut", "pie"]).default("bar"),
    metricType: z.enum(["COUNT", "SUM", "AVG"]).default("COUNT"),
    field: z.string().optional().describe("Required for SUM/AVG."),
    groupBy: z.string().describe("Field id to group by (chart categories)."),
    filter: z.array(FilterPair).optional(),
    valueFormat: z.enum(["plain", "currency", "percent"]).default("plain"),
    height: z.number().int().min(120).max(480).default(240),
  })
  .refine((p) => p.metricType === "COUNT" || Boolean(p.field), {
    message: "field is required for SUM/AVG",
  });
type P = z.infer<typeof Params>;

export const ChartCard: Fragment<P> = {
  name: "ChartCard",
  version: "1.0.0",
  description:
    "Dashboard chart card: bar | line | area | donut | pie over ONE aggregation grouped by a field " +
    "(e.g. COUNT of tasks by Status, SUM of Value by Stage). Datasource name is '<ns>-metric'.",
  whenToUse:
    "Use when the user wants a chart — bar, line, area, pie, or donut — showing counts or totals broken down by a category, like sales by status or products per category.",
  category: "display",
  previewParams: {
    entity: "Order",
    title: "Revenue by status",
    kind: "bar",
    metricType: "SUM",
    field: "Total",
    groupBy: "Status",
    valueFormat: "currency",
  },
  params: Params as z.ZodType<P>,
  build: (params, ns) => ({
    root: ns,
    elements: {
      [ns]: { type: "Card", props: { title: params.title, description: null, maxWidth: null, centered: null, className: null }, children: [`${ns}-chart`] },
      [`${ns}-chart`]: {
        type: "Chart",
        props: {
          kind: params.kind,
          data: { $datasource: `${ns}-metric/data/series` },
          labelKey: params.groupBy,
          valueKey: "value",
          sort: null,
          limit: null,
          height: params.height,
          valueFormat: params.valueFormat,
        },
      },
    } as never,
    datasources: {
      [`${ns}-metric`]: metricDs(
        params.entity,
        { Type: params.metricType, ...(params.field ? { Field: params.field } : {}) },
        { groupBy: [params.groupBy], filter: andFilter(literalConditions(params.filter)) },
      ),
    } as never,
    init: [{ action: "datasource.refresh", params: { names: [`${ns}-metric`] } }],
  }),
};
