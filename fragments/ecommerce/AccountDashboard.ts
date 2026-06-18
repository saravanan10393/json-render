/**
 * AccountDashboard — an order-account overview: a row of metric tiles (total /
 * delivered / in-transit order counts via bdo.metric COUNT) and a recent-orders
 * list (bdo.list, newest first). Each tile is its own COUNT datasource (an
 * optional Filter narrows by Status).
 *
 * Requires Order fields: Status, Total, PlacedAt.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  orderBdo: z.string().default("Order").describe("Order entity name."),
  currency: z.string().nullable().default(null).describe("ISO 4217 code (default USD)."),
  recentLimit: z.number().int().min(1).max(20).default(5).describe("How many recent orders to list."),
  title: z.string().default("Your account"),
});

type P = z.infer<typeof Params>;

export const AccountDashboard: Fragment<P> = {
  id: "fragment-account-dashboard",
  section: "account",
  name: "Account Dashboard",
  version: "1.0.0",
  description:
    "Account overview: metric tiles (total / delivered / in-transit order COUNTs via bdo.metric) + a recent-orders list (bdo.list newest first) with status badge and Money total. Requires Order fields Status, Total, PlacedAt.",
  whenToUse:
    "Use as the landing view of a customer account / orders area: at-a-glance order counts plus the most recent orders.",
  category: "account",
  previewParams: {},
  params: Params as z.ZodType<P>,
  build: ({ orderBdo, currency, recentLimit, title }, ns) => {
    const total = `${ns}-total`;
    const delivered = `${ns}-delivered`;
    const transit = `${ns}-transit`;
    const recent = `${ns}-recent`;
    const countFilter = (status: string) => ({ Operator: "AND", Condition: [{ LHSField: "Status", Operator: "EQ", RHSValue: status }] });

    const tile = (key: string, label: string, ds: string) => ({
      [`${ns}-tile-${key}`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none", className: "rounded-xl border border-border p-4" },
        children: [`${ns}-tile-${key}-value`, `${ns}-tile-${key}-label`],
      },
      [`${ns}-tile-${key}-value`]: { type: "Heading", props: { text: { $datasource: `${ds}/data/value` }, level: "h1", className: "tabular-nums" } },
      [`${ns}-tile-${key}-label`]: { type: "Text", props: { text: label, variant: "muted", className: null } },
    });

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "vertical", gap: "lg", className: "w-full max-w-3xl" },
        children: [`${ns}-title`, `${ns}-tiles`, `${ns}-recent-heading`, `${ns}-recent-list`, `${ns}-empty`],
      },
      [`${ns}-title`]: { type: "Heading", props: { text: title, level: "h2", className: null } },
      [`${ns}-tiles`]: {
        type: "Grid",
        props: { columns: 3, gap: "md" },
        children: [`${ns}-tile-total`, `${ns}-tile-delivered`, `${ns}-tile-transit`],
      },
      ...tile("total", "Total orders", total),
      ...tile("delivered", "Delivered", delivered),
      ...tile("transit", "In transit", transit),
      [`${ns}-recent-heading`]: { type: "Heading", props: { text: "Recent orders", level: "h3", className: null } },
      [`${ns}-recent-list`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "sm" },
        repeat: { statePath: `/queries/${recent}/data`, key: "_id" },
        children: [`${ns}-row`],
      },
      [`${ns}-row`]: {
        type: "Stack",
        props: { direction: "horizontal", justify: "between", align: "center", className: "rounded-lg border border-border px-4 py-3" },
        children: [`${ns}-row-left`, `${ns}-row-right`],
      },
      [`${ns}-row-left`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none" },
        children: [`${ns}-row-name`, `${ns}-row-date`],
      },
      [`${ns}-row-name`]: { type: "Text", props: { text: { $item: "CustomerName" }, variant: "body", className: "font-medium" } },
      [`${ns}-row-date`]: { type: "Text", props: { text: { $item: "PlacedAt" }, variant: "muted", className: null } },
      [`${ns}-row-right`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "md", align: "center" },
        children: [`${ns}-row-status`, `${ns}-row-total`],
      },
      [`${ns}-row-status`]: { type: "Badge", props: { text: { $item: "Status" }, variant: "secondary" } },
      [`${ns}-row-total`]: {
        type: "Money",
        props: { value: { $item: "Total" }, currency, locale: null, compareAt: null, showDiscount: null, size: "sm", className: "font-medium" },
      },
      [`${ns}-empty`]: {
        type: "Empty",
        props: { title: "No orders yet", description: "Orders will appear here once placed." },
        visible: { $state: `/queries/${recent}/page/total`, eq: 0 },
      },
    };

    return {
      root: ns,
      elements: elements as unknown as ReturnType<Fragment<P>["build"]>["elements"],
      datasources: {
        [total]: { type: "bdo.metric", params: { bdo: orderBdo, Metric: [{ Type: "COUNT" }] } },
        [delivered]: { type: "bdo.metric", params: { bdo: orderBdo, Metric: [{ Type: "COUNT" }], Filter: countFilter("Delivered") } },
        [transit]: { type: "bdo.metric", params: { bdo: orderBdo, Metric: [{ Type: "COUNT" }], Filter: countFilter("Shipped") } },
        [recent]: { type: "bdo.list", params: { bdo: orderBdo, Sort: [{ PlacedAt: "DESC" }], Page: { number: 1, size: recentLimit } } },
      },
      init: [{ action: "datasource.refresh", params: { names: [total, delivered, transit, recent] } }],
    };
  },
};
