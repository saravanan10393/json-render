/**
 * PublishStats — Blog/CMS KPI row + optional by-Category bar chart.
 *
 * Stats: COUNT/SUM/AVG/MAX/MIN on Post entity fields.
 * Chart: bdo.metric GroupBy Category (bar by default).
 * Datasources: <ns>-stat-0…N-1 (one per stat), <ns>-chart (if showChart).
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const StatSchema = z.object({
  label: z.string().describe("Card label, e.g. 'Total Posts'."),
  bdo: z.string().describe("Entity to aggregate (usually 'Post')."),
  type: z.enum(["COUNT", "SUM", "AVG", "MAX", "MIN"]).default("COUNT"),
  field: z
    .string()
    .nullable()
    .default(null)
    .describe("Field to aggregate — required for SUM/AVG/MAX/MIN."),
  prefix: z
    .string()
    .nullable()
    .default(null)
    .describe("Rendered before the value."),
  filterField: z.string().nullable().default(null),
  filterValue: z.string().nullable().default(null),
});

const Params = z.object({
  stats: z.array(StatSchema).min(1).max(6),
  columns: z.number().int().min(2).max(6).default(4),
  showChart: z
    .boolean()
    .default(false)
    .describe("Render a by-Category bar chart below the KPI row."),
  chartEntity: z
    .string()
    .optional()
    .describe("Entity for the chart metric (required when showChart is true)."),
  chartGroupBy: z
    .string()
    .default("Category")
    .describe("Field to group the chart by — defaults to 'Category'."),
});

type P = z.infer<typeof Params>;

export const PublishStats: Fragment<P> = {
  id: "fragment-publish-stats",
  name: "Publish Stats",
  version: "1.0.0",
  description:
    "Blog/CMS KPI stat card row for dashboards — each stat is a bdo.metric (COUNT/SUM/AVG/MAX/MIN with optional EQ filter). " +
    "Optionally renders a by-Category bar chart (showChart: true, chartEntity: 'Post', chartGroupBy: 'Category'). " +
    "Entity contract: Post(Title, Slug, Excerpt, Body, AuthorName, Category:select, Status:select[Draft|Published|Archived], CoverUrl, PublishedAt:date). " +
    "Datasources: '<ns>-stat-0…N-1' per KPI, '<ns>-chart' for the category chart.",
  whenToUse:
    "Use on a blog or content dashboard to show headline numbers like total posts, published vs. draft counts, or averages, optionally with a bar chart breaking posts down by category.",
  category: "display",
  previewParams: {
    stats: [
      { label: "Products", bdo: "Product", type: "COUNT" },
      { label: "Revenue", bdo: "Order", type: "SUM", field: "Total", prefix: "$" },
      { label: "Avg rating", bdo: "Product", type: "AVG", field: "Rating" },
      { label: "In stock", bdo: "Product", type: "SUM", field: "Stock" },
    ],
    columns: 4,
    showChart: true,
    chartEntity: "Product",
    chartGroupBy: "Category",
  },
  params: Params as z.ZodType<P>,
  build: ({ stats, columns, showChart, chartEntity, chartGroupBy }, ns) => {
    const rootChildren: string[] = [`${ns}-kpi-row`];
    if (showChart) rootChildren.push(`${ns}-chart-card`);

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "vertical", gap: "md" },
        children: rootChildren,
      },
      [`${ns}-kpi-row`]: {
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

    if (showChart && chartEntity) {
      const chartDs = `${ns}-chart`;
      elements[`${ns}-chart-card`] = {
        type: "Card",
        props: { title: `Posts by ${chartGroupBy}`, description: null, maxWidth: null, centered: null, className: null },
        children: [`${ns}-chart`],
      };
      elements[`${ns}-chart`] = {
        type: "Chart",
        props: {
          kind: "bar",
          data: { $datasource: `${chartDs}/data/series` },
          labelKey: chartGroupBy,
          valueKey: "value",
          sort: null,
          limit: null,
          height: 240,
          valueFormat: "plain",
        },
      };
      datasources[chartDs] = {
        type: "bdo.metric",
        params: {
          bdo: chartEntity,
          Metric: [{ Type: "COUNT" }],
          GroupBy: [chartGroupBy],
        },
      };
    }

    const allDsNames = [
      ...stats.map((_, i) => `${ns}-stat-${i}`),
      ...(showChart && chartEntity ? [`${ns}-chart`] : []),
    ];

    return {
      root: ns,
      elements: elements as never,
      datasources: datasources as never,
      init: [
        {
          action: "datasource.refresh",
          params: { names: allDsNames },
        },
      ],
    };
  },
};
