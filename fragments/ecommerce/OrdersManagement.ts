/**
 * OrdersManagement — the store operator's (admin) order queue: a filterable
 * list of ALL orders with per-row status, total, and one-click fulfillment
 * actions (advance Placed→Shipped→Delivered, or Cancel). Distinct from the
 * customer's Order History (read-only, own orders) — this MUTATES order status.
 *
 * Status filter writes /filters/<ns>/status (the grid prunes EQ "All").
 * Fulfillment uses the proven repeat-scope pattern: capture the row _id with
 * `$template`, stamp { _id, Status } onto /ui/<ns>/pending, then one bdo.save
 * reads it back and refreshes the list.
 *
 * Requires Order fields: CustomerName, Status, Total, PlacedAt (+ City shown if present).
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  orderBdo: z.string().default("Order").describe("Order entity name."),
  statuses: z
    .array(z.string())
    .default(["Placed", "Shipped", "Delivered", "Cancelled"])
    .describe("Canonical Order.Status values (filter chips + badge colors). Defaulted so they aren't invented."),
  showStatusFilter: z.boolean().default(true),
  allowFulfill: z.boolean().default(true).describe("Show per-row advance/cancel actions that update Order.Status."),
  selectedPath: z.string().default("/ui/selectedOrderId").describe("State path a row's 'View' writes the order _id to (pair with Order Detail)."),
  pageSize: z.number().int().min(1).max(100).default(20),
  currency: z.string().nullable().default(null).describe("ISO 4217 code (default USD)."),
  title: z.string().default("Orders"),
});

type P = z.infer<typeof Params>;

const variantFor = (s: string) =>
  s === "Cancelled" ? "destructive" : s === "Delivered" ? "success" : s === "Shipped" ? "secondary" : "soft";

export const OrdersManagement: Fragment<P> = {
  id: "fragment-orders-management",
  section: "admin",
  name: "Orders Management",
  version: "1.0.0",
  description:
    "Admin order queue (bdo.list all orders): status filter, per-row customer/date/Money total/color-coded status, and one-click fulfillment actions (advance Placed→Shipped→Delivered, Cancel) via bdo.save. Operator-facing — mutates Order.Status. Requires Order fields CustomerName, Status, Total, PlacedAt.",
  whenToUse:
    "Use on an admin/operations dashboard to triage and fulfill orders — filter by status and advance or cancel each order. For a customer's own read-only order list use Order History List.",
  category: "display",
  previewParams: {},
  params: Params as z.ZodType<P>,
  build: ({ orderBdo, statuses, showStatusFilter, allowFulfill, selectedPath, pageSize, currency, title }, ns) => {
    const ui = `/ui/${ns}`;
    const filters = `/filters/${ns}`;
    const items = `${ns}-items`;
    const save = `${ns}-fulfill`;

    // Stamp { _id, Status } onto the pending snapshot (repeat-scope capture via
    // $template), then fire the one save that reads it back.
    const setStatusAction = (status: string) => [
      { action: "setState", params: { statePath: `${ui}/pending`, value: { _id: { $template: "${_id}" }, Status: status } } },
      { action: "datasource.fire", params: { name: save } },
    ];

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "vertical", gap: "md", className: "w-full" },
        children: [`${ns}-header`, `${ns}-count`, `${ns}-table`, `${ns}-empty`],
      },
      [`${ns}-header`]: {
        type: "Stack",
        props: { direction: "horizontal", justify: "between", align: "center", className: "flex-wrap gap-2" },
        children: [`${ns}-title`, ...(showStatusFilter ? [`${ns}-filter`] : [])],
      },
      [`${ns}-title`]: { type: "Heading", props: { text: title, level: "h2", className: null } },
      [`${ns}-count`]: {
        type: "Text",
        props: { text: { $template: `\${/queries/${items}/page/total} orders` }, variant: "muted", className: null },
      },
      [`${ns}-table`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none", className: "overflow-hidden rounded-xl border border-border" },
        repeat: { statePath: `/queries/${items}/data`, key: "_id" },
        children: [`${ns}-row`],
      },
      [`${ns}-row`]: {
        type: "Stack",
        props: { direction: "horizontal", align: "center", gap: "md", className: "border-b border-border px-4 py-3 last:border-b-0" },
        children: [`${ns}-row-info`, `${ns}-row-status`, `${ns}-row-total`, ...(allowFulfill ? [`${ns}-row-actions`] : [])],
      },
      [`${ns}-row-info`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none", className: "min-w-0 flex-1" },
        children: [`${ns}-row-name`, `${ns}-row-date`],
      },
      [`${ns}-row-name`]: { type: "Text", props: { text: { $item: "CustomerName" }, variant: "body", className: "font-medium" } },
      [`${ns}-row-date`]: { type: "Text", props: { text: { $item: "PlacedAt" }, variant: "caption", className: "text-muted-foreground" } },
      // Per-row status: one eq-gated Badge per status (testing visible+$item in repeat scope).
      [`${ns}-row-status`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "w-24 shrink-0" },
        children: statuses.map((s) => `${ns}-row-status-${s}`),
      },
      [`${ns}-row-total`]: {
        type: "Money",
        props: { value: { $item: "Total" }, style: "currency", currency, locale: null, maximumFractionDigits: null, suffix: null, compareAt: null, showDiscount: null, size: "sm", className: "w-24 shrink-0 justify-end font-medium" },
      },
    };

    statuses.forEach((s) => {
      elements[`${ns}-row-status-${s}`] = {
        type: "Badge",
        props: { text: s, variant: variantFor(s) },
        visible: { $item: "Status", eq: s },
      };
    });

    if (allowFulfill) {
      elements[`${ns}-row-actions`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center", justify: "end", className: "w-72 shrink-0 flex-wrap" },
        children: [`${ns}-row-ship`, `${ns}-row-deliver`, `${ns}-row-cancel`, `${ns}-row-view`],
      };
      // Each action is gated to the statuses where it's valid (visible + $item eq).
      elements[`${ns}-row-ship`] = {
        type: "Button",
        props: { label: "Mark shipped", variant: "secondary", disabled: null },
        visible: { $item: "Status", eq: "Placed" },
        on: { press: setStatusAction("Shipped") },
      };
      elements[`${ns}-row-deliver`] = {
        type: "Button",
        props: { label: "Mark delivered", variant: "secondary", disabled: null },
        visible: { $item: "Status", eq: "Shipped" },
        on: { press: setStatusAction("Delivered") },
      };
      elements[`${ns}-row-cancel`] = {
        type: "Button",
        props: { label: "Cancel", variant: "ghost", disabled: null },
        visible: { $item: "Status", eq: "Placed" },
        on: { press: setStatusAction("Cancelled") },
      };
      elements[`${ns}-row-view`] = {
        type: "Button",
        props: { label: "View", variant: "ghost", disabled: null },
        on: { press: [{ action: "setState", params: { statePath: selectedPath, value: { $template: "${_id}" } } }] },
      };
    }

    elements[`${ns}-empty`] = {
      type: "Empty",
      props: { title: "No orders", description: "Orders will appear here as they come in." },
      visible: { $state: `/queries/${items}/page/total`, eq: 0 },
    };

    if (showStatusFilter) {
      elements[`${ns}-filter`] = {
        type: "ToggleGroup",
        props: {
          type: "single",
          items: [{ label: "All", value: "All" }, ...statuses.map((s) => ({ label: s, value: s }))],
          value: { $bindState: `${filters}/status` },
        },
      };
    }

    return {
      root: ns,
      elements: elements as unknown as ReturnType<Fragment<P>["build"]>["elements"],
      state: { filters: { [ns]: { status: "All" } }, ui: { [ns]: { pending: null } } },
      datasources: {
        [items]: {
          type: "bdo.list",
          params: {
            bdo: orderBdo,
            Filter: { Operator: "AND", Condition: [{ LHSField: "Status", Operator: "EQ", RHSValue: { $state: `${filters}/status` } }] },
            Sort: [{ PlacedAt: "DESC" }],
            Page: { number: 1, size: pageSize },
          },
        },
        [save]: {
          type: "bdo.save",
          params: { bdo: orderBdo, _id: { $state: `${ui}/pending/_id` }, values: { Status: { $state: `${ui}/pending/Status` } } },
          refresh: [items],
          on: { success: [{ action: "ui.toast", params: { message: "Order updated", kind: "success" } }] },
        },
      },
      init: [{ action: "datasource.refresh", params: { names: [items] } }],
    };
  },
};
