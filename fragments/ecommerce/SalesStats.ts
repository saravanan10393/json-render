/**
 * SalesStats — KPI stat row. Each stat declares its own bdo.metric
 * datasource; values land in /queries/<ns>-stat-<i> and render via $template.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const StatSchema = z.object({
  label: z.string().describe("Card label, e.g. 'Total revenue'."),
  bdo: z.string().describe("Entity to aggregate."),
  type: z.enum(["COUNT", "SUM", "AVG", "MAX", "MIN"]).default("COUNT"),
  field: z
    .string()
    .nullable()
    .default(null)
    .describe("Field to aggregate — required for everything except COUNT."),
  prefix: z
    .string()
    .nullable()
    .default(null)
    .describe("Rendered before the value, e.g. '$'."),
  filterField: z.string().nullable().default(null),
  filterValue: z.string().nullable().default(null),
});

const Params = z.object({
  stats: z.array(StatSchema).min(1).max(6),
  columns: z.number().int().min(2).max(6).default(4),
});

type P = z.infer<typeof Params>;

export const SalesStats: Fragment<P> = {
  name: "SalesStats",
  version: "1.0.0",
  description:
    "KPI stat card row for dashboards — each stat is a bdo.metric (COUNT/SUM/AVG/MAX/MIN with optional EQ filter). Use only on dashboard-style pages.",
  whenToUse:
    "Use on admin or analytics dashboards to show KPI stat cards (counts, revenue sums, averages) over any entity. Dashboard pages only.",
  category: "display",
  previewParams: {
    stats: [
      { label: "Products", bdo: "Product", type: "COUNT" },
      { label: "Revenue", bdo: "Order", type: "SUM", field: "Total", prefix: "$" },
      { label: "Orders", bdo: "Order", type: "COUNT" },
      { label: "Avg rating", bdo: "Product", type: "AVG", field: "Rating" },
    ],
    columns: 4,
  },
  params: Params as z.ZodType<P>,
  build: ({ stats, columns }, ns) => {
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Grid",
        props: { columns, gap: "md" },
        children: stats.map((_, i) => `${ns}-stat-${i}`),
      },
    };
    const datasources: Record<string, unknown> = {};

    stats.forEach((stat, i) => {
      const ds = `${ns}-stat-${i}`;
      elements[`${ns}-stat-${i}`] = {
        type: "Card",
        props: { title: stat.label, description: null, maxWidth: null, centered: null, className: null },
        children: [`${ns}-stat-${i}-value`],
      };
      elements[`${ns}-stat-${i}-value`] = {
        type: "Heading",
        props: {
          text: {
            $template: `${stat.prefix ?? ""}\${/queries/${ds}/data/value}`,
          },
          level: "h2",
        },
      };
      datasources[ds] = {
        type: "bdo.metric",
        params: {
          bdo: stat.bdo,
          Metric: [
            stat.field
              ? { Type: stat.type, Field: stat.field }
              : { Type: stat.type },
          ],
          ...(stat.filterField && stat.filterValue
            ? {
                Filter: {
                  Operator: "AND",
                  Condition: [
                    {
                      LHSField: stat.filterField,
                      Operator: "EQ",
                      RHSValue: stat.filterValue,
                    },
                  ],
                },
              }
            : {}),
        },
      };
    });

    return {
      root: ns,
      elements: elements as never,
      datasources: datasources as never,
      init: [
        {
          action: "datasource.refresh",
          params: { names: stats.map((_, i) => `${ns}-stat-${i}`) },
        },
      ],
    };
  },
};
