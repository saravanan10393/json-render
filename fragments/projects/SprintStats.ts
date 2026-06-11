/**
 * SprintStats — Project-management KPI row + optional by-Status bar chart.
 *
 * Stats: COUNT/SUM/AVG/MAX/MIN on Task entity fields.
 * Chart: bdo.metric GroupBy Status (bar by default).
 * Datasources: <ns>-stat-0…N-1 (one per stat), <ns>-chart (if showChart).
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const StatSchema = z.object({
  label: z.string().describe("Card label, e.g. 'Total Tasks'."),
  bdo: z.string().describe("Entity to aggregate (usually 'Task')."),
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
    .describe("Render a by-Status bar chart below the KPI row."),
  chartEntity: z
    .string()
    .optional()
    .describe("Entity for the chart metric (required when showChart is true)."),
  chartGroupBy: z
    .string()
    .default("Status")
    .describe("Field to group the chart by — defaults to 'Status'."),
});

type P = z.infer<typeof Params>;

export const SprintStats: Fragment<P> = {
  name: "SprintStats",
  version: "1.0.0",
  description:
    "Project-management KPI stat card row for task/sprint dashboards — each stat is a bdo.metric (COUNT/SUM/AVG/MAX/MIN with optional EQ filter). " +
    "Optionally renders a by-Status bar chart (showChart: true, chartEntity: 'Task', chartGroupBy: 'Status'). " +
    "Entity contract: Task(Title, ProjectName, Assignee, Status:select[Todo|In Progress|Review|Done], Priority:select[Low|Medium|High], Estimate:number, DueDate:date). " +
    "Datasources: '<ns>-stat-0…N-1' per KPI, '<ns>-chart' for the status chart.",
  category: "display",
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
        props: { title: `Tasks by ${chartGroupBy}`, description: null, maxWidth: null, centered: null, className: null },
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
