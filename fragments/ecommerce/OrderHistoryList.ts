/**
 * OrderHistoryList — past orders (bdo.list, newest first) with a status
 * filter and color-coded status badges.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  orderBdo: z.string().default("Order").describe("Order entity name."),
  statuses: z
    .array(z.string())
    .default(["Placed", "Shipped", "Delivered", "Cancelled"])
    .describe("Status filter options (Order.Status values)."),
  showStatusFilter: z.boolean().default(true),
  pageSize: z.number().int().min(5).max(50).default(20),
  title: z.string().default("Order history"),
});

type P = z.infer<typeof Params>;

export const OrderHistoryList: Fragment<P> = {
  name: "OrderHistoryList",
  version: "1.0.0",
  description:
    "Paginated order history with status filter and color-coded badges. Requires Order fields: CustomerName, Status, Total; PlacedAt (date) recommended for ordering.",
  whenToUse:
    "Use for 'my orders' / order-tracking pages: list of past orders with status filter, color-coded status badges, totals, and dates.",
  category: "account",
  params: Params as z.ZodType<P>,
  build: ({ orderBdo, statuses, showStatusFilter, pageSize, title }, ns) => {
    const items = `${ns}-orders`;
    const filters = `/filters/${ns}`;

    return {
      root: ns,
      elements: {
        [ns]: {
          type: "Card",
          props: { title, description: null, maxWidth: null, centered: null, className: null },
          children: [`${ns}-body`],
        },
        [`${ns}-body`]: {
          type: "Stack",
          props: { direction: "vertical", gap: "md" },
          children: [
            ...(showStatusFilter ? [`${ns}-filter-row`] : []),
            `${ns}-rows`,
            `${ns}-empty`,
          ],
        },
        ...(showStatusFilter
          ? {
              [`${ns}-filter-row`]: {
                type: "Stack",
                props: { direction: "horizontal", gap: "md", align: "end" },
                children: [`${ns}-status`],
              },
              [`${ns}-status`]: {
                type: "Select",
                props: {
                  label: "Status",
                  name: `${ns}-status`,
                  options: ["All", ...statuses],
                  placeholder: "All",
                  value: { $bindState: `${filters}/status` },
                },
              },
            }
          : {}),
        [`${ns}-rows`]: {
          type: "Stack",
          props: { direction: "vertical", gap: "sm" },
          repeat: { statePath: `/queries/${items}/data`, key: "_id" },
          children: [`${ns}-row`],
        },
        [`${ns}-row`]: {
          type: "Stack",
          props: {
            direction: "horizontal",
            justify: "between",
            align: "center",
            className: "rounded-lg border border-border px-4 py-3",
          },
          children: [`${ns}-row-info`, `${ns}-row-meta`],
        },
        [`${ns}-row-info`]: {
          type: "Stack",
          props: { direction: "vertical", gap: "none" },
          children: [`${ns}-row-customer`, `${ns}-row-date`],
        },
        [`${ns}-row-customer`]: {
          type: "Text",
          props: { text: { $item: "CustomerName" }, variant: "body" },
        },
        [`${ns}-row-date`]: {
          type: "Text",
          props: { text: { $item: "PlacedAt" }, variant: "muted" },
        },
        [`${ns}-row-meta`]: {
          type: "Stack",
          props: { direction: "horizontal", gap: "md", align: "center" },
          children: [`${ns}-row-status`, `${ns}-row-total`],
        },
        [`${ns}-row-status`]: {
          type: "Badge",
          props: {
            text: { $item: "Status" },
            variant: {
              $cond: { $item: "Status", eq: "Cancelled" },
              $then: "destructive",
              $else: {
                $cond: { $item: "Status", eq: "Delivered" },
                $then: "default",
                $else: "secondary",
              },
            },
          },
        },
        [`${ns}-row-total`]: {
          type: "Stack",
          props: { direction: "horizontal", gap: "none", align: "center" },
          children: [`${ns}-row-total-symbol`, `${ns}-row-total-value`],
        },
        [`${ns}-row-total-symbol`]: {
          type: "Text",
          props: { text: "$", variant: "lead" },
        },
        [`${ns}-row-total-value`]: {
          type: "Text",
          props: { text: { $item: "Total" }, variant: "lead" },
        },
        [`${ns}-empty`]: {
          type: "Empty",
          props: {
            title: "No orders yet",
            description: "Orders show up here once placed.",
          },
          visible: { $state: `/queries/${items}/page/total`, eq: 0 },
        },
      },
      state: {
        filters: { [ns]: { status: "All" } },
      },
      datasources: {
        [items]: {
          type: "bdo.list",
          params: {
            bdo: orderBdo,
            Filter: {
              Operator: "AND",
              Condition: [
                {
                  LHSField: "Status",
                  Operator: "EQ",
                  RHSValue: { $state: `${filters}/status` },
                },
              ],
            },
            Sort: [{ PlacedAt: "DESC" }],
            Page: { number: 1, size: pageSize },
          },
          debounceMs: 200,
        },
      },
      init: [{ action: "datasource.refresh", params: { names: [items] } }],
    };
  },
};
