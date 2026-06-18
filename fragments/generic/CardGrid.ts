/** CardGrid — responsive card grid over bdo.list (title/subtitles/badge/image). */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { FilterBinding, andFilter, boundConditions, textEl } from "./_shared";

const Params = z.object({
  entity: z.string(),
  titleField: z.string(),
  subtitleFields: z.array(z.string()).default([]),
  badgeField: z.string().optional(),
  imageField: z.string().optional().describe("Field holding an image URL — adds a thumbnail."),
  columns: z.number().int().min(2).max(4).default(3),
  pageSize: z.number().int().min(4).max(48).default(9),
  filterBindings: z.array(FilterBinding).default([]),
  pressTarget: z.string().nullable().default(null).describe("Page NAME a card click navigates to. NOTE: navigation carries NO row context — the target page cannot know which card was clicked. For card→detail flows keep the detail on the SAME page (DetailHeader/RecordView reading an idPath) and write that idPath from a hand-built press handler instead."),
});
type P = z.infer<typeof Params>;

export const CardGrid: Fragment<P> = {
  id: "fragment-card-grid",
  name: "Card Grid",
  version: "1.0.0",
  description:
    "Card grid over records: title, subtitle fields, optional status badge + image thumbnail, optional " +
    "card-click navigation (page-level only — no row context crosses pages). List datasource '<ns>-list'; pair with FilterBar via filterBindings.",
  whenToUse:
    "Use when the user wants records shown as a grid of cards with a picture, title, and status badge instead of a table — good for browsing items, listings, or galleries.",
  category: "display",
  previewParams: {
    entity: "Product",
    titleField: "Name",
    subtitleFields: ["Description"],
    badgeField: "Category",
    imageField: "ImageUrl",
    columns: 3,
  },
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const ds = `${ns}-list`;
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: { type: "Stack", props: { direction: "vertical", gap: "sm" }, children: [`${ns}-grid`, `${ns}-empty`] },
      [`${ns}-grid`]: {
        type: "Grid",
        props: { columns: params.columns, gap: "md" },
        repeat: { statePath: `/queries/${ds}/data`, key: "_id" },
        children: [`${ns}-card`],
      },
      [`${ns}-card`]: {
        type: "Stack",
        props: {
          direction: "vertical",
          gap: "sm",
          className: "rounded-xl border border-border bg-card p-4",
          ...(params.pressTarget ? { clickable: true } : {}),
        },
        children: [
          ...(params.imageField ? [`${ns}-card-img`] : []),
          `${ns}-card-head`,
          ...params.subtitleFields.map((_, i) => `${ns}-card-sub-${i}`),
        ],
        ...(params.pressTarget ? { on: { press: { action: "ui.navigate", params: { to: params.pressTarget } } } } : {}),
      },
      ...(params.imageField
        ? { [`${ns}-card-img`]: { type: "Image", props: { src: { $item: params.imageField }, alt: { $item: params.titleField }, width: 280, height: 160 } } }
        : {}),
      [`${ns}-card-head`]: {
        type: "Stack",
        props: { direction: "horizontal", justify: "between", align: "center" },
        children: [`${ns}-card-title`, ...(params.badgeField ? [`${ns}-card-badge`] : [])],
      },
      [`${ns}-card-title`]: { type: "Heading", props: { text: { $item: params.titleField }, level: "h4" } },
      ...(params.badgeField ? { [`${ns}-card-badge`]: { type: "Badge", props: { text: { $item: params.badgeField }, variant: "secondary" } } } : {}),
      [`${ns}-empty`]: {
        type: "Empty",
        props: { title: "No records", description: "Adjust filters or add a record." },
        visible: { $state: `/queries/${ds}/page/total`, eq: 0 },
      },
    };
    params.subtitleFields.forEach((f, i) => {
      elements[`${ns}-card-sub-${i}`] = textEl({ $item: f }, "muted");
    });
    return {
      root: ns,
      elements: elements as never,
      datasources: {
        [ds]: {
          type: "bdo.list",
          params: {
            bdo: params.entity,
            ...(params.filterBindings.length
              ? { Search: { $state: `/filters/${ns}/search` }, Filter: andFilter(boundConditions(ns, params.filterBindings)) }
              : {}),
            Page: { number: 1, size: params.pageSize },
          },
          debounceMs: 300,
        },
      } as never,
      init: [{ action: "datasource.refresh", params: { names: [ds] } }],
    };
  },
};
