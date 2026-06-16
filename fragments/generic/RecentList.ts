/** RecentList — top-N records by a date field, newest first. */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { textEl } from "./_shared";

const Params = z.object({
  entity: z.string(),
  title: z.string(),
  titleField: z.string().describe("Field shown as the row title."),
  sublabelField: z.string().optional(),
  dateField: z.string().describe("Date field — sorts DESC and shows right-aligned."),
  limit: z.number().int().min(3).max(20).default(5),
  pressTarget: z.string().nullable().default(null).describe("Page NAME a row click navigates to (null = not clickable)."),
});
type P = z.infer<typeof Params>;

export const RecentList: Fragment<P> = {
  id: "fragment-recent-list",
  name: "Recent List",
  version: "1.0.0",
  description:
    "Card of the N most recent records by a date field (title + optional sublabel + date per row, " +
    "optional row-click navigation). Datasource name '<ns>-list'.",
  whenToUse:
    "Use when the user wants a compact 'latest items' card — the most recent orders, signups, or entries with a date on each row, often on a dashboard.",
  category: "display",
  previewParams: {
    entity: "Order",
    title: "Recent orders",
    titleField: "CustomerName",
    sublabelField: "Status",
    dateField: "PlacedAt",
    limit: 5,
  },
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const ds = `${ns}-list`;
    return {
      root: ns,
      elements: {
        [ns]: { type: "Card", props: { title: params.title, description: null, maxWidth: null, centered: null, className: null }, children: [`${ns}-rows`, `${ns}-empty`] },
        [`${ns}-rows`]: {
          type: "Stack",
          props: { direction: "vertical", gap: "sm" },
          repeat: { statePath: `/queries/${ds}/data`, key: "_id" },
          children: [`${ns}-row`],
        },
        [`${ns}-row`]: {
          type: "Stack",
          props: { direction: "horizontal", justify: "between", align: "center", className: "rounded-lg border border-border px-3 py-2", ...(params.pressTarget ? { clickable: true } : {}) },
          children: [`${ns}-row-main`, `${ns}-row-date`],
          ...(params.pressTarget
            ? { on: { press: { action: "ui.navigate", params: { to: params.pressTarget } } } }
            : {}),
        },
        [`${ns}-row-main`]: {
          type: "Stack",
          props: { direction: "vertical", gap: "none" },
          children: [`${ns}-row-title`, ...(params.sublabelField ? [`${ns}-row-sub`] : [])],
        },
        [`${ns}-row-title`]: textEl({ $item: params.titleField }, "body"),
        ...(params.sublabelField ? { [`${ns}-row-sub`]: textEl({ $item: params.sublabelField }, "muted") } : {}),
        [`${ns}-row-date`]: textEl({ $item: params.dateField }, "muted"),
        [`${ns}-empty`]: {
          type: "Empty",
          props: { title: "Nothing yet", description: "Records appear here as they are added." },
          visible: { $state: `/queries/${ds}/page/total`, eq: 0 },
        },
      } as never,
      datasources: {
        [ds]: {
          type: "bdo.list",
          params: { bdo: params.entity, Sort: [{ [params.dateField]: "DESC" }], Page: { number: 1, size: params.limit } },
        },
      } as never,
      init: [{ action: "datasource.refresh", params: { names: [ds] } }],
    };
  },
};
