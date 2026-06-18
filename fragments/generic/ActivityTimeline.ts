/** ActivityTimeline — recent records as a vertical dot-rail timeline. */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { textEl } from "./_shared";

const Params = z.object({
  entity: z.string(),
  title: z.string(),
  titleField: z.string(),
  dateField: z.string(),
  descriptionField: z.string().optional(),
  limit: z.number().int().min(3).max(20).default(8),
});
type P = z.infer<typeof Params>;

export const ActivityTimeline: Fragment<P> = {
  id: "fragment-activity-timeline",
  name: "Activity Timeline",
  version: "1.0.0",
  description:
    "Vertical timeline card of the N most recent records (dot + title + date + optional description). " +
    "Datasource name '<ns>-list'.",
  whenToUse:
    "Use when the user wants a timeline or activity feed of the latest records — recent orders, updates, or events shown newest first with a date on each entry.",
  category: "display",
  previewParams: {
    entity: "Order",
    title: "Recent activity",
    titleField: "CustomerName",
    dateField: "PlacedAt",
    descriptionField: "Status",
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
          props: { direction: "vertical", gap: "none" },
          repeat: { statePath: `/queries/${ds}/data`, key: "_id" },
          children: [`${ns}-row`],
        },
        [`${ns}-row`]: {
          type: "Stack",
          props: { direction: "horizontal", gap: "md", align: "start", className: "border-l-2 border-border pl-4 pb-4 relative" },
          children: [`${ns}-row-body`],
        },
        [`${ns}-row-body`]: { type: "Stack", props: { direction: "vertical", gap: "none" }, children: [`${ns}-row-head`, ...(params.descriptionField ? [`${ns}-row-desc`] : [])] },
        [`${ns}-row-head`]: { type: "Stack", props: { direction: "horizontal", justify: "between", align: "center" }, children: [`${ns}-row-title`, `${ns}-row-date`] },
        [`${ns}-row-title`]: textEl({ $item: params.titleField }, "body"),
        [`${ns}-row-date`]: textEl({ $item: params.dateField }, "muted"),
        ...(params.descriptionField ? { [`${ns}-row-desc`]: textEl({ $item: params.descriptionField }, "muted") } : {}),
        [`${ns}-empty`]: {
          type: "Empty",
          props: { title: "No activity", description: "Recent records appear here." },
          visible: { $state: `/queries/${ds}/page/total`, eq: 0 },
        },
      } as never,
      datasources: {
        [ds]: { type: "bdo.list", params: { bdo: params.entity, Sort: [{ [params.dateField]: "DESC" }], Page: { number: 1, size: params.limit } } },
      } as never,
      init: [{ action: "datasource.refresh", params: { names: [ds] } }],
    };
  },
};
