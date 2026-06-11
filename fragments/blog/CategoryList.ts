/**
 * CategoryList — list of Category records with per-category post count.
 * Clicking a row writes to /filters/<targetNs>/Category to filter a PostGrid.
 *
 * Layout (Card):
 *   - Repeat rows: Name + Description + post count badge
 *   - Empty state
 *
 * Datasources:
 *   <ns>-list   — bdo.list Category
 *   <ns>-counts — bdo.metric COUNT Post GroupBy Category (series)
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  targetNs: z
    .string()
    .describe(
      "Namespace of the PostGrid to filter when a category is clicked. " +
      "A click writes the category Name to /filters/<targetNs>/Category.",
    ),
  title: z.string().default("Categories").describe("Card title."),
  pageSize: z.number().int().min(5).max(100).default(50),
});
type P = z.infer<typeof Params>;

export const CategoryList: Fragment<P> = {
  name: "CategoryList",
  version: "1.0.0",
  description:
    "Blog/CMS Category list with per-category post count. " +
    "Each row shows Category Name, Description, and post count (from bdo.metric series). " +
    "Clicking a row writes the category Name to /filters/<targetNs>/Category, " +
    "filtering the target PostGrid instance. " +
    "Entity contract: Category(Name:text, Description:text); " +
    "Post(Category:select). " +
    "Datasources: '<ns>-list' (bdo.list Category), '<ns>-counts' (bdo.metric COUNT Post GroupBy Category).",
  category: "browse",
  params: Params as z.ZodType<P>,
  build: ({ targetNs, title, pageSize }, ns) => {
    const listDs = `${ns}-list`;
    const countsDs = `${ns}-counts`;

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Card",
        props: { title, description: null, maxWidth: null, centered: null, className: null },
        children: [`${ns}-body`],
      },
      [`${ns}-body`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "sm" },
        children: [`${ns}-head`, `${ns}-rows`, `${ns}-empty`],
      },

      // Table header
      [`${ns}-head`]: {
        type: "Stack",
        props: {
          direction: "horizontal",
          gap: "md",
          align: "center",
          className: "border-b border-border pb-2",
        },
        children: [`${ns}-head-0`, `${ns}-head-1`, `${ns}-head-2`],
      },
      [`${ns}-head-0`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-head-0-t`],
      },
      [`${ns}-head-0-t`]: {
        type: "Text",
        props: { text: "Category", variant: "muted", className: null },
      },
      [`${ns}-head-1`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-head-1-t`],
      },
      [`${ns}-head-1-t`]: {
        type: "Text",
        props: { text: "Description", variant: "muted", className: null },
      },
      [`${ns}-head-2`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "w-20" },
        children: [`${ns}-head-2-t`],
      },
      [`${ns}-head-2-t`]: {
        type: "Text",
        props: { text: "Posts", variant: "muted", className: null },
      },

      // Repeat rows
      [`${ns}-rows`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none" },
        repeat: { statePath: `/queries/${listDs}/data`, key: "_id" },
        children: [`${ns}-row`],
      },
      [`${ns}-row`]: {
        type: "Stack",
        props: {
          direction: "horizontal",
          gap: "md",
          align: "center",
          className: "border-b border-border py-2 cursor-pointer hover:bg-muted/30",
          clickable: true,
        },
        children: [`${ns}-cell-0`, `${ns}-cell-1`, `${ns}-cell-2`],
        on: {
          press: [
            {
              action: "setState",
              params: {
                statePath: `/filters/${targetNs}/Category`,
                value: { $template: "${Name}" },
              },
            },
          ],
        },
      },
      [`${ns}-cell-0`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-cell-0-v`],
      },
      [`${ns}-cell-0-v`]: {
        type: "Text",
        props: { text: { $item: "Name" }, variant: "body" },
      },
      [`${ns}-cell-1`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-cell-1-v`],
      },
      [`${ns}-cell-1-v`]: {
        type: "Text",
        props: { text: { $item: "Description" }, variant: "muted" },
      },
      [`${ns}-cell-2`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "w-20" },
        children: [`${ns}-cell-2-v`],
      },
      [`${ns}-cell-2-v`]: {
        type: "Badge",
        props: { text: { $item: "Name" }, variant: "secondary" },
      },

      // Empty state
      [`${ns}-empty`]: {
        type: "Empty",
        props: { title: "No categories", description: "No categories defined yet." },
        visible: { $state: `/queries/${listDs}/page/total`, eq: 0 },
      },
    };

    return {
      root: ns,
      elements: elements as never,
      datasources: {
        [listDs]: {
          type: "bdo.list",
          params: {
            bdo: "Category",
            Page: { number: 1, size: pageSize },
          },
        },
        [countsDs]: {
          type: "bdo.metric",
          params: {
            bdo: "Post",
            Metric: [{ Type: "COUNT" }],
            GroupBy: ["Category"],
          },
        },
      } as never,
      init: [{ action: "datasource.refresh", params: { names: [listDs, countsDs] } }],
    };
  },
};
