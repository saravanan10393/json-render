/**
 * OrderDetail — the account view of ONE order (bdo.get): a header with a
 * color-coded status badge, a facts card (placed date, email, total), and the
 * shipping address, plus an optional "Back to orders" link.
 *
 * `orderId` is a literal or a binding (e.g. a route/state path set from an
 * Order History row). Requires Order fields CustomerName, Email, Address, City,
 * Zip, Status, Total, PlacedAt.
 *
 * Note: no line items — the contract has no OrderItem entity (CartItem is the
 * cart, not order lines), so this shows the order header + address.
 */
import { z } from "zod";
import { BindingSchema, type Fragment } from "@/lib/jr/schema";

const Params = z.object({
  orderBdo: z.string().default("Order").describe("Order entity name."),
  orderId: z
    .union([z.string(), BindingSchema])
    .describe('Order _id to show — a literal id OR a binding like {"$state":"/ui/selectedOrderId"} for a route/state-driven page.'),
  currency: z.string().nullable().default(null).describe("ISO 4217 code (default USD)."),
  backTarget: z.string().nullable().default(null).describe("Page NAME for a 'Back to orders' link. null hides it."),
});

type P = z.infer<typeof Params>;

export const OrderDetail: Fragment<P> = {
  id: "fragment-order-detail",
  section: "account",
  name: "Order Detail",
  version: "1.0.0",
  description:
    "Account order detail (bdo.get one order): header with color-coded status badge, facts card (placed date, email, total), and shipping address, plus optional back link. Requires Order fields CustomerName, Email, Address, City, Zip, Status, Total, PlacedAt. No line items (no OrderItem entity).",
  whenToUse:
    "Use on a 'my orders' detail page to show a single order's status, total, date, and shipping address (opened from Order History List). For the post-checkout thank-you use Order Confirmation.",
  category: "account",
  previewParams: { orderId: "Order-0" },
  params: Params as z.ZodType<P>,
  build: ({ orderBdo, orderId, currency, backTarget }, ns) => {
    const ds = `${ns}-order`;
    const f = (field: string) => ({ $datasource: `${ds}/data/${field}` });
    const labelValue = (key: string, label: string, value: Record<string, unknown>) => {
      const row = `${ns}-${key}`;
      return {
        [row]: { type: "Stack", props: { direction: "horizontal", justify: "between", align: "center" }, children: [`${row}-l`, `${row}-v`] },
        [`${row}-l`]: { type: "Text", props: { text: label, variant: "muted", className: null } },
        [`${row}-v`]: value,
      };
    };

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "vertical", gap: "md", className: "w-full max-w-2xl" },
        children: [`${ns}-header`, `${ns}-card`, ...(backTarget ? [`${ns}-back`] : [])],
      },
      [`${ns}-header`]: {
        type: "Stack",
        props: { direction: "horizontal", justify: "between", align: "center" },
        children: [`${ns}-title`, `${ns}-status`],
      },
      [`${ns}-title`]: { type: "Heading", props: { text: "Order details", level: "h2", className: null } },
      // One colored badge per status, gated by `visible` eq (the $cond +
      // $datasource form does NOT evaluate at runtime — see AUTHORING_NOTES).
      [`${ns}-status`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center" },
        children: ["Placed", "Shipped", "Delivered", "Cancelled"].map((s) => `${ns}-status-${s}`),
      },
      ...Object.fromEntries(
        ["Placed", "Shipped", "Delivered", "Cancelled"].map((s) => [
          `${ns}-status-${s}`,
          {
            type: "Badge",
            props: { text: s, variant: s === "Cancelled" ? "destructive" : s === "Delivered" ? "default" : "secondary" },
            visible: { $state: `/queries/${ds}/data/Status`, eq: s },
          },
        ]),
      ),
      [`${ns}-card`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "sm", className: "rounded-xl border border-border p-5" },
        children: [
          `${ns}-placed`,
          `${ns}-email`,
          `${ns}-total`,
          `${ns}-divider`,
          `${ns}-ship-heading`,
          `${ns}-ship-name`,
          `${ns}-ship-addr`,
          `${ns}-ship-city`,
        ],
      },
      ...labelValue("placed", "Placed", { type: "Text", props: { text: f("PlacedAt"), variant: "body", className: null } }),
      ...labelValue("email", "Email", { type: "Text", props: { text: f("Email"), variant: "body", className: null } }),
      ...labelValue("total", "Total", {
        type: "Money",
        props: { value: f("Total"), currency, locale: null, compareAt: null, showDiscount: null, size: "md", className: "font-semibold" },
      }),
      [`${ns}-divider`]: { type: "Separator", props: {} },
      [`${ns}-ship-heading`]: { type: "Text", props: { text: "Shipping address", variant: "caption", className: "uppercase tracking-wide text-muted-foreground" } },
      [`${ns}-ship-name`]: { type: "Text", props: { text: f("CustomerName"), variant: "body", className: "font-medium" } },
      [`${ns}-ship-addr`]: { type: "Text", props: { text: f("Address"), variant: "muted", className: null } },
      [`${ns}-ship-city`]: { type: "Text", props: { text: { $template: `\${/queries/${ds}/data/City}, \${/queries/${ds}/data/Zip}` }, variant: "muted", className: null } },
    };

    if (backTarget) {
      elements[`${ns}-back`] = {
        type: "Button",
        props: { label: "Back to orders", variant: "secondary", disabled: null },
        on: { press: { action: "ui.navigate", params: { to: backTarget } } },
      };
    }

    return {
      root: ns,
      elements: elements as unknown as ReturnType<Fragment<P>["build"]>["elements"],
      datasources: { [ds]: { type: "bdo.get", params: { bdo: orderBdo, _id: orderId } } },
      init: [{ action: "datasource.refresh", params: { names: [ds] } }],
    };
  },
};
