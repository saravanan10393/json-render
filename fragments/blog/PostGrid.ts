/**
 * PostGrid — card grid of Post records with cover image, title, excerpt,
 * author, status badge, and category. Supports search + Status/Category
 * filters. Clicking a card selects the post (detail/edit).
 *
 * Datasources:
 *   <ns>-list — bdo.list of Post, filtered by search/status/category state
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  columns: z.number().int().min(2).max(4).default(3),
  pageSize: z.number().int().min(6).max(50).default(12),
  detailStatePath: z
    .string()
    .optional()
    .describe(
      "State path to write the clicked post's _id into (e.g. /ui/selectedPostId).",
    ),
  editIdStatePath: z
    .string()
    .optional()
    .describe(
      "State path to write the clicked post's _id for editing (e.g. /ui/<editorNs>/editId).",
    ),
  editorOpenPath: z
    .string()
    .optional()
    .describe(
      "State path to open the PostEditor dialog (e.g. /ui/<editorNs>/open).",
    ),
});
type P = z.infer<typeof Params>;

export const PostGrid: Fragment<P> = {
  name: "PostGrid",
  version: "1.0.0",
  description:
    "Blog/CMS post card grid: cards showing cover image, Title, Excerpt, AuthorName, Status badge, and Category. " +
    "Includes search input and Status/Category filter selects. " +
    "Clicking a card writes the post _id to detailStatePath and/or opens a PostEditor dialog via editIdStatePath + editorOpenPath. " +
    "Entity contract: Post(Title, Slug, Excerpt, Body, AuthorName, Category:select, Status:select[Draft|Published|Archived], CoverUrl, PublishedAt:date). " +
    "Datasource: '<ns>-list' (bdo.list, Post, filtered by /filters/<ns>/search, /filters/<ns>/Status, /filters/<ns>/Category).",
  whenToUse:
    "Use when the user wants a grid of blog posts or articles as cards with cover images, titles, excerpts, authors, and category/status labels, with built-in search and filters. Good for a blog home page or a content-management post list where clicking a card opens or edits the post.",
  category: "browse",
  params: Params as z.ZodType<P>,
  build: ({ columns, pageSize, detailStatePath, editIdStatePath, editorOpenPath }, ns) => {
    const ds = `${ns}-list`;
    const filterBase = `/filters/${ns}`;

    const cardPressActions: Array<Record<string, unknown>> = [];
    if (detailStatePath) {
      cardPressActions.push({
        action: "setState",
        params: { statePath: detailStatePath, value: { $template: "${_id}" } },
      });
    }
    if (editIdStatePath) {
      cardPressActions.push({
        action: "setState",
        params: { statePath: editIdStatePath, value: { $template: "${_id}" } },
      });
    }
    if (editorOpenPath) {
      cardPressActions.push({
        action: "setState",
        params: { statePath: editorOpenPath, value: true },
      });
    }

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "vertical", gap: "md" },
        children: [`${ns}-filters`, `${ns}-grid`, `${ns}-empty`],
      },

      // Filters row
      [`${ns}-filters`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "end" },
        children: [`${ns}-search`, `${ns}-filter-status`, `${ns}-filter-category`],
      },
      [`${ns}-search`]: {
        type: "Input",
        props: {
          label: "Search",
          name: "search",
          type: "text",
          value: { $bindState: `${filterBase}/search` },
          placeholder: "Search posts…",
        },
      },
      [`${ns}-filter-status`]: {
        type: "Select",
        props: {
          label: "Status",
          name: "Status",
          options: ["", "Draft", "Published", "Archived"],
          value: { $bindState: `${filterBase}/Status` },
          placeholder: "All Statuses",
        },
      },
      [`${ns}-filter-category`]: {
        type: "Select",
        props: {
          label: "Category",
          name: "Category",
          options: [""],
          value: { $bindState: `${filterBase}/Category` },
          placeholder: "All Categories",
        },
      },

      // Card grid
      [`${ns}-grid`]: {
        type: "Grid",
        props: { columns, gap: "md" },
        repeat: { statePath: `/queries/${ds}/data`, key: "_id" },
        children: [`${ns}-card`],
      },
      [`${ns}-card`]: {
        type: "Stack",
        props: {
          direction: "vertical",
          gap: "sm",
          className: "rounded-xl border border-border bg-card overflow-hidden",
          ...(cardPressActions.length ? { clickable: true } : {}),
        },
        children: [
          `${ns}-card-cover`,
          `${ns}-card-body`,
        ],
        ...(cardPressActions.length ? { on: { press: cardPressActions } } : {}),
      },
      [`${ns}-card-cover`]: {
        type: "Image",
        props: {
          src: { $item: "CoverUrl" },
          alt: { $item: "Title" },
          width: 400,
          height: 200,
        },
      },
      [`${ns}-card-body`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "xs", className: "p-4" },
        children: [
          `${ns}-card-top`,
          `${ns}-card-title`,
          `${ns}-card-excerpt`,
          `${ns}-card-footer`,
        ],
      },
      [`${ns}-card-top`]: {
        type: "Stack",
        props: { direction: "horizontal", justify: "between", align: "center" },
        children: [`${ns}-card-category`, `${ns}-card-status`],
      },
      [`${ns}-card-category`]: {
        type: "Text",
        props: { text: { $item: "Category" }, variant: "muted" },
      },
      [`${ns}-card-status`]: {
        type: "Badge",
        props: { text: { $item: "Status" }, variant: "secondary" },
      },
      [`${ns}-card-title`]: {
        type: "Text",
        props: { text: { $item: "Title" }, variant: "body" },
      },
      [`${ns}-card-excerpt`]: {
        type: "Text",
        props: { text: { $item: "Excerpt" }, variant: "muted" },
      },
      [`${ns}-card-footer`]: {
        type: "Text",
        props: { text: { $item: "AuthorName" }, variant: "muted" },
      },

      // Empty state
      [`${ns}-empty`]: {
        type: "Empty",
        props: { title: "No posts", description: "No posts found." },
        visible: { $state: `/queries/${ds}/page/total`, eq: 0 },
      },
    };

    return {
      root: ns,
      elements: elements as never,
      state: {
        filters: { [ns]: { search: "", Status: "", Category: "" } },
      },
      datasources: {
        [ds]: {
          type: "bdo.list",
          params: {
            bdo: "Post",
            Search: { $state: `${filterBase}/search` },
            Filter: {
              Operator: "AND",
              Condition: [
                {
                  LHSField: "Status",
                  Operator: "EQ",
                  RHSValue: { $state: `${filterBase}/Status` },
                },
                {
                  LHSField: "Category",
                  Operator: "EQ",
                  RHSValue: { $state: `${filterBase}/Category` },
                },
              ],
            },
            Page: { number: 1, size: pageSize },
          },
          debounceMs: 300,
        },
      } as never,
      init: [{ action: "datasource.refresh", params: { names: [ds] } }],
    };
  },
};
