/** Leaderboard — Ranked top-N card from one bdo.metric GroupBy series. */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { FilterPair, andFilter, literalConditions, metricDs } from "./_shared";

const Params = z
  .object({
    entity: z.string(),
    title: z.string(),
    metricType: z.enum(["COUNT", "SUM", "AVG"]).default("COUNT"),
    field: z.string().optional().describe("Required for SUM/AVG."),
    groupBy: z.string().describe("Field id to group by (leaderboard categories)."),
    filter: z.array(FilterPair).optional(),
    valueFormat: z.enum(["plain", "currency", "percent"]).default("plain"),
    limit: z.number().int().min(3).max(20).default(5),
  })
  .refine((p) => p.metricType === "COUNT" || Boolean(p.field), {
    message: "field is required for SUM/AVG",
  });
type P = z.infer<typeof Params>;

export const Leaderboard: Fragment<P> = {
  name: "Leaderboard",
  version: "1.0.0",
  description:
    "Ranked top-N card (rank, label, bar, value) from ONE grouped aggregation — " +
    "e.g. SUM of Value by Owner. Datasource name '<ns>-metric'.",
  category: "display",
  params: Params as z.ZodType<P>,
  build: (params, ns) => ({
    root: ns,
    elements: {
      [ns]: { type: "Card", props: { title: params.title, description: null, maxWidth: null, centered: null, className: null }, children: [`${ns}-chart`] },
      [`${ns}-chart`]: {
        type: "Chart",
        props: {
          kind: "leaderboard",
          data: { $datasource: `${ns}-metric/data/series` },
          labelKey: params.groupBy,
          valueKey: "value",
          sort: "desc",
          limit: params.limit,
          height: null,
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
