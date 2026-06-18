/** RelatedList — compact table of child records scoped to a parent id in state. */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { DisplayKind, flexCell } from "./_shared";

const Params = z.object({
  entity: z.string().describe("CHILD entity to list."),
  title: z.string(),
  parentField: z.string().describe("Child field holding the parent record id."),
  parentIdPath: z.string().describe("State path holding the parent id (e.g. /ui/selectedCustomerId)."),
  columns: z.array(z.object({ field: z.string(), label: z.string(), display: DisplayKind.default("text") })).min(1).max(5),
  pageSize: z.number().int().min(5).max(50).default(10),
});
type P = z.infer<typeof Params>;

export const RelatedList: Fragment<P> = {
  id: "fragment-related-list",
  name: "Related List",
  version: "1.0.0",
  description:
    "Child-record table scoped by <parentField> EQ the id at <parentIdPath> — for master-detail pages " +
    "(pairs with DetailHeader/RecordView reading the same id path). Auto-refires when the id changes; " +
    "waits until the id is set. Datasource '<ns>-list'. The page must seed parentIdPath in state (e.g. \"\") and something must setState it (a row press handler or selection) — until it is non-empty this list stays in its empty state.",
  whenToUse:
    "Use on a detail page when the user wants a list of items that belong to the selected record — like a customer's orders, a project's tasks, or a product's reviews.",
  category: "display",
  previewParams: {
    entity: "CartItem",
    title: "Cart items",
    parentField: "ProductId",
    parentIdPath: "/ui/selectedProductId",
    columns: [
      { field: "Name", label: "Name" },
      { field: "Quantity", label: "Qty" },
      { field: "LineTotal", label: "Line total", display: "money" },
    ],
  },
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const ds = `${ns}-list`;
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: { type: "Card", props: { title: params.title, description: null, maxWidth: null, centered: null, className: null }, children: [`${ns}-head`, `${ns}-rows`, `${ns}-empty`] },
      [`${ns}-head`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "md", align: "center", className: "border-b border-border pb-2" },
        children: params.columns.map((_, i) => `${ns}-head-${i}`),
      },
      [`${ns}-rows`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none" },
        repeat: { statePath: `/queries/${ds}/data`, key: "_id" },
        children: [`${ns}-row`],
      },
      [`${ns}-row`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "md", align: "center", className: "border-b border-border py-2" },
        children: params.columns.map((_, i) => `${ns}-cell-${i}`),
      },
      [`${ns}-empty`]: {
        type: "Empty",
        props: { title: "No related records", description: "" },
        visible: { $state: `/queries/${ds}/page/total`, eq: 0 },
      },
    };
    params.columns.forEach((c, i) => {
      // Header: wrap Text in a flex-1 Stack (mirrors DataTable pattern)
      elements[`${ns}-head-${i}`] = { type: "Stack", props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" }, children: [`${ns}-head-${i}-t`] };
      elements[`${ns}-head-${i}-t`] = { type: "Text", props: { text: c.label, variant: "muted", className: null } };
      // Cell: flexCell wraps display element in a flex-1 Stack
      const cell = flexCell(`${ns}-cell-${i}`, c.display, { $item: c.field });
      Object.assign(elements, cell.elements);
    });
    return {
      root: ns,
      elements: elements as never,
      datasources: {
        [ds]: {
          type: "bdo.list",
          params: {
            bdo: params.entity,
            Filter: { Operator: "AND", Condition: [{ LHSField: params.parentField, Operator: "EQ", RHSValue: { $state: params.parentIdPath } }] },
            Page: { number: 1, size: params.pageSize },
          },
          skipUntilReady: true,
        },
      } as never,
      init: [{ action: "datasource.refresh", params: { names: [ds] } }],
    };
  },
};
