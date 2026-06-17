/**
 * SalesStats — a KPI stat-card row for dashboards. Each stat declares its own
 * bdo.metric (COUNT/SUM/AVG/MAX/MIN, optional EQ filter); the value lands at
 * /queries/<ns>-stat-<i>/data/value.
 *
 * v1.1 — quality pass: `format` (currency → Money, percent, number) instead of
 * a raw "$" prefix; muted label + big value tile (matches Account Dashboard);
 * optional per-stat lucide `icon` and a presentational `delta`/`trend` line.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const StatSchema = z.object({
  label: z.string().describe("Card label, e.g. 'Total revenue'."),
  bdo: z.string().describe("Entity to aggregate."),
  type: z.enum(["COUNT", "SUM", "AVG", "MAX", "MIN"]).default("COUNT"),
  field: z.string().nullable().default(null).describe("Field to aggregate — required for everything except COUNT."),
  format: z.enum(["number", "currency", "percent"]).default("number").describe("Money formatting: currency (symbol), number (grouped + rounded), or percent (trailing %)."),
  decimals: z.number().int().min(0).max(4).nullable().default(null).describe("Decimal places (default: currency 2, number 1, percent 0). Set 0 for whole counts, 1 for an average rating."),
  icon: z.string().nullable().default(null).describe("Optional lucide icon name (kebab-case) shown by the label."),
  delta: z.string().nullable().default(null).describe("Optional change figure, e.g. '+12.5%' (presentational — supplied, not computed)."),
  deltaLabel: z.string().nullable().default(null).describe("Context for the delta, e.g. 'vs last month' — shown muted beside it. Strongly recommended so the delta isn't ambiguous."),
  trend: z.enum(["up", "down", "flat"]).nullable().default(null).describe("Colors the delta: up=green, down=red, flat=muted."),
  filterField: z.string().nullable().default(null),
  filterValue: z.string().nullable().default(null),
});

const Params = z.object({
  stats: z.array(StatSchema).min(1).max(6),
  columns: z.number().int().min(2).max(6).default(4),
  currency: z.string().nullable().default(null).describe("ISO 4217 code for currency-format stats (default USD)."),
});

type P = z.infer<typeof Params>;

const trendClass = (t: string | null) =>
  t === "up" ? "text-emerald-600 dark:text-emerald-400" : t === "down" ? "text-red-600 dark:text-red-400" : "text-muted-foreground";

export const SalesStats: Fragment<P> = {
  id: "fragment-sales-stats",
  section: "admin",
  name: "Sales Stats",
  version: "1.1.0",
  description:
    "KPI stat-card row for dashboards — each stat is a bdo.metric (COUNT/SUM/AVG/MAX/MIN with optional EQ filter), formatted as number/currency/percent, with an optional icon and delta/trend. Use on dashboard-style pages.",
  whenToUse:
    "Use on admin or analytics dashboards to show KPI cards (order counts, revenue sums, averages) over any entity, with optional icons and change indicators. Dashboard pages only.",
  category: "display",
  previewParams: {
    stats: [
      { label: "Revenue", bdo: "Order", type: "SUM", field: "Total", format: "currency", icon: "dollar-sign", delta: "+12.5%", deltaLabel: "vs last month", trend: "up" },
      { label: "Orders", bdo: "Order", type: "COUNT", icon: "shopping-cart", delta: "+3.2%", deltaLabel: "vs last month", trend: "up" },
      { label: "Products", bdo: "Product", type: "COUNT", icon: "package" },
      { label: "Avg rating", bdo: "Product", type: "AVG", field: "Rating", format: "number", decimals: 1, icon: "star" },
    ],
    columns: 4,
  },
  params: Params as z.ZodType<P>,
  build: ({ stats, columns, currency }, ns) => {
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: { type: "Grid", props: { columns, gap: "md" }, children: stats.map((_, i) => `${ns}-stat-${i}`) },
    };
    const datasources: Record<string, unknown> = {};

    stats.forEach((stat, i) => {
      const ds = `${ns}-stat-${i}`;

      elements[`${ns}-stat-${i}`] = {
        type: "Stack",
        props: { direction: "vertical", gap: "sm", className: "rounded-xl border border-border p-4" },
        children: [`${ds}-head`, `${ds}-value`, ...(stat.delta ? [`${ds}-delta`] : [])],
      };
      elements[`${ds}-head`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center" },
        children: [...(stat.icon ? [`${ds}-icon`] : []), `${ds}-label`],
      };
      if (stat.icon) {
        elements[`${ds}-icon`] = { type: "Icon", props: { name: stat.icon, size: 16, color: "var(--muted-foreground)", strokeWidth: null, className: null } };
      }
      elements[`${ds}-label`] = { type: "Text", props: { text: stat.label, variant: "caption", className: "uppercase tracking-wide text-muted-foreground" } };

      // All formats go through Money so values are rounded (no raw 4.1666… overflow).
      elements[`${ds}-value`] = {
        type: "Money",
        props: {
          value: { $datasource: `${ds}/data/value` },
          style: stat.format === "currency" ? "currency" : stat.format === "percent" ? "percent" : "decimal",
          currency: stat.format === "currency" ? currency : null,
          locale: null,
          maximumFractionDigits: stat.decimals,
          suffix: null,
          compareAt: null,
          showDiscount: null,
          size: "xl",
          className: "font-semibold",
        },
      };

      if (stat.delta) {
        elements[`${ds}-delta`] = {
          type: "Stack",
          props: { direction: "horizontal", gap: "none", align: "baseline" },
          children: [`${ds}-delta-v`, ...(stat.deltaLabel ? [`${ds}-delta-l`] : [])],
        };
        elements[`${ds}-delta-v`] = { type: "Text", props: { text: stat.delta, variant: "caption", className: trendClass(stat.trend) } };
        if (stat.deltaLabel) elements[`${ds}-delta-l`] = { type: "Text", props: { text: stat.deltaLabel, variant: "caption", className: "ml-1 text-muted-foreground" } };
      }

      datasources[ds] = {
        type: "bdo.metric",
        params: {
          bdo: stat.bdo,
          Metric: [stat.field ? { Type: stat.type, Field: stat.field } : { Type: stat.type }],
          ...(stat.filterField && stat.filterValue
            ? { Filter: { Operator: "AND", Condition: [{ LHSField: stat.filterField, Operator: "EQ", RHSValue: stat.filterValue }] } }
            : {}),
        },
      };
    });

    return {
      root: ns,
      elements: elements as never,
      datasources: datasources as never,
      init: [{ action: "datasource.refresh", params: { names: stats.map((_, i) => `${ns}-stat-${i}`) } }],
    };
  },
};
