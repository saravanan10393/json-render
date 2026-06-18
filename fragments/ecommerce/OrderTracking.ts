/**
 * OrderTracking — a shipment progress tracker for ONE order (bdo.get): a
 * status badge + a horizontal milestone track (Placed → Shipped → Delivered).
 *
 * Conditional rendering is done with `visible` + `{$state:"/queries/.../Status", eq}`
 * (the only form that BOTH validates and resolves at runtime — `$cond` with a
 * `$datasource` condition does NOT evaluate here). "Reached" is an OR over the
 * statuses from a milestone onward, so each milestone stacks one eq-gated check
 * overlay per reaching status; the status badge likewise renders one colored
 * variant per status, gated by eq. A Cancelled order leaves the track muted.
 *
 * Requires Order fields: Status.
 */
import { z } from "zod";
import { BindingSchema, type Fragment } from "@/lib/jr/schema";

const Params = z.object({
  orderBdo: z.string().default("Order").describe("Order entity name."),
  orderId: z
    .union([z.string(), BindingSchema])
    .describe('Order _id to track — a literal id OR a binding like {"$state":"/ui/selectedOrderId"} for a route/state-driven page.'),
  statuses: z
    .array(z.string())
    .default(["Placed", "Shipped", "Delivered"])
    .describe("Forward progress milestones, in order (must match the Order Status values)."),
});

type P = z.infer<typeof Params>;

export const OrderTracking: Fragment<P> = {
  id: "fragment-order-tracking",
  section: "account",
  name: "Order Tracking",
  version: "1.0.0",
  description:
    "Shipment progress tracker for one order (bdo.get): a color-coded status badge + a horizontal milestone track (Placed → Shipped → Delivered) whose reached steps fill based on the order's Status. Requires Order field Status.",
  whenToUse:
    "Use on an order detail/tracking page to visualize fulfillment progress through the order's status milestones.",
  category: "account",
  previewParams: { orderId: "Order-5" },
  params: Params as z.ZodType<P>,
  build: ({ orderBdo, orderId, statuses }, ns) => {
    const ds = `${ns}-order`;
    const statusQ = `/queries/${ds}/data/Status`;
    const variantFor = (s: string) => (s === "Cancelled" ? "destructive" : s === "Delivered" ? "default" : "secondary");
    const badgeStatuses = [...statuses, "Cancelled"];

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "vertical", gap: "lg", className: "w-full max-w-2xl rounded-xl border border-border p-5" },
        children: [`${ns}-header`, `${ns}-track`],
      },
      [`${ns}-header`]: {
        type: "Stack",
        props: { direction: "horizontal", justify: "between", align: "center" },
        children: [`${ns}-title`, `${ns}-badges`],
      },
      [`${ns}-title`]: { type: "Heading", props: { text: "Order status", level: "h3", className: null } },
      [`${ns}-badges`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center" },
        children: badgeStatuses.map((s) => `${ns}-badge-${s}`),
      },
      [`${ns}-track`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center" },
        children: statuses.flatMap((_, i) => (i < statuses.length - 1 ? [`${ns}-m-${i}`, `${ns}-c-${i}`] : [`${ns}-m-${i}`])),
      },
    };

    // One colored badge per status, only the matching one visible.
    badgeStatuses.forEach((s) => {
      elements[`${ns}-badge-${s}`] = {
        type: "Badge",
        props: { text: s, variant: variantFor(s) },
        visible: { $state: statusQ, eq: s },
      };
    });

    statuses.forEach((label, i) => {
      const reached = statuses.slice(i); // milestone i is "reached" if Status ∈ reached
      elements[`${ns}-m-${i}`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center" },
        children: [`${ns}-m-${i}-ind`, `${ns}-m-${i}-label`],
      };
      elements[`${ns}-m-${i}-ind`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", justify: "center", className: "relative size-6 shrink-0" },
        children: [`${ns}-m-${i}-base`, ...reached.map((s) => `${ns}-m-${i}-on-${s}`)],
      };
      elements[`${ns}-m-${i}-base`] = {
        type: "Icon",
        props: { name: "circle", size: 22, color: "var(--muted-foreground)", strokeWidth: null, className: "absolute" },
      };
      reached.forEach((s) => {
        elements[`${ns}-m-${i}-on-${s}`] = {
          type: "Icon",
          props: { name: "circle-check-big", size: 22, color: "var(--primary)", strokeWidth: null, className: "absolute" },
          visible: { $state: statusQ, eq: s },
        };
      });
      elements[`${ns}-m-${i}-label`] = { type: "Text", props: { text: label, variant: "body", className: "text-foreground" } };
      if (i < statuses.length - 1) {
        elements[`${ns}-c-${i}`] = {
          type: "Stack",
          props: { direction: "horizontal", gap: "none", className: "h-0.5 flex-1 rounded-full bg-border" },
        };
      }
    });

    return {
      root: ns,
      elements: elements as unknown as ReturnType<Fragment<P>["build"]>["elements"],
      datasources: { [ds]: { type: "bdo.get", params: { bdo: orderBdo, _id: orderId } } },
      init: [{ action: "datasource.refresh", params: { names: [ds] } }],
    };
  },
};
