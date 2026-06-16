/**
 * SLAStats — Helpdesk KPI row + optional by-Priority bar chart.
 *
 * Stats: COUNT/SUM/AVG/MAX/MIN on Ticket entity fields.
 * Chart: bdo.metric GroupBy Priority (bar by default).
 * Datasources: <ns>-stat-0…N-1 (one per stat), <ns>-chart (if showChart).
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const StatSchema = z.object({
  label: z.string().describe("Card label, e.g. 'Open Tickets'."),
  bdo: z.string().describe("Entity to aggregate (usually 'Ticket' or 'Agent')."),
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
    .describe("Rendered before the value, e.g. '#'."),
  filterField: z.string().nullable().default(null),
  filterValue: z.string().nullable().default(null),
});

const Params = z.object({
  stats: z.array(StatSchema).min(1).max(6),
  columns: z.number().int().min(2).max(6).default(4),
  showChart: z
    .boolean()
    .default(false)
    .describe("Render a by-Priority bar chart below the KPI row."),
  chartEntity: z
    .string()
    .optional()
    .describe("Entity for the chart metric (required when showChart is true)."),
  chartGroupBy: z
    .string()
    .default("Priority")
    .describe("Field to group the chart by — defaults to 'Priority'."),
});

type P = z.infer<typeof Params>;

export const SLAStats: Fragment<P> = {
  id: "fragment-sla-stats",
  name: "SLA Stats",
  version: "1.0.0",
  description:
    "Helpdesk KPI stat card row for support dashboards — each stat is a bdo.metric (COUNT/SUM/AVG/MAX/MIN with optional EQ filter). " +
    "Optionally renders a by-Priority bar chart (showChart: true, chartEntity: 'Ticket', chartGroupBy: 'Priority'). " +
    "Entity contract: Ticket(Subject, Description, Status:select[Open|In Progress|Waiting|Resolved|Closed], " +
    "Priority:select[Low|Medium|High|Urgent], Requester, Assignee, Category:select, CreatedAt:date). " +
    "Datasources: '<ns>-stat-0…N-1' per KPI, '<ns>-chart' for the priority chart.",
  whenToUse:
    "Use when the user wants a support or SLA dashboard with headline numbers — open tickets, resolved today, average response — optionally with a breakdown chart of tickets by priority.",
  category: "display",
  previewParams: {
    stats: [
      { label: "Open orders", bdo: "Order", type: "COUNT", filterField: "Status", filterValue: "Placed" },
      { label: "Revenue", bdo: "Order", type: "SUM", field: "Total", prefix: "$" },
      { label: "Avg order value", bdo: "Order", type: "AVG", field: "Total", prefix: "$" },
      { label: "Delivered", bdo: "Order", type: "COUNT", filterField: "Status", filterValue: "Delivered" },
    ],
    columns: 4,
    showChart: true,
    chartEntity: "Order",
    chartGroupBy: "Status",
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
        props: { title: `Tickets by ${chartGroupBy}`, description: null, maxWidth: null, centered: null, className: null },
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
