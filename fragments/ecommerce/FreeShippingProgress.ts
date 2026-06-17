/**
 * FreeShippingProgress — a progress bar toward a free-shipping threshold: a
 * headline, a Progress fill (cart subtotal vs threshold), and the current
 * subtotal. Computes its own subtotal via a bdo.metric SUM over the cart.
 *
 * Note: the "$X away from free shipping" delta needs subtraction, which this
 * runtime can't do client-side — so it shows the bar + current subtotal rather
 * than the remaining amount.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  cartBdo: z.string().default("CartItem").describe("Cart line-item entity name."),
  threshold: z.number().default(75).describe("Order subtotal that unlocks free shipping."),
  currency: z.string().nullable().default(null).describe("ISO 4217 code (default USD)."),
});

type P = z.infer<typeof Params>;

export const FreeShippingProgress: Fragment<P> = {
  id: "fragment-free-shipping-progress",
  section: "cart",
  name: "Free Shipping Progress",
  version: "1.0.0",
  description:
    "Progress bar toward a free-shipping threshold: headline + Progress (cart subtotal vs threshold) + current subtotal. Computes subtotal via bdo.metric SUM over the cart (LineTotal). Requires cart field LineTotal.",
  whenToUse:
    "Use on cart pages to nudge shoppers toward free shipping with a progress bar from the current cart subtotal to a threshold.",
  category: "promotion",
  previewParams: { threshold: 500 },
  params: Params as z.ZodType<P>,
  build: ({ cartBdo, threshold, currency }, ns) => {
    const total = `${ns}-total`;
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "vertical", gap: "sm", className: "rounded-lg border border-border p-4" },
        children: [`${ns}-headline`, `${ns}-progress`, `${ns}-current`],
      },
      [`${ns}-headline`]: {
        type: "Text",
        props: { text: `Free shipping on orders over $${threshold}`, variant: "body", className: "font-medium" },
      },
      [`${ns}-progress`]: {
        type: "Progress",
        props: { value: { $datasource: `${total}/data/value` }, max: threshold, label: null },
      },
      [`${ns}-current`]: {
        type: "Stack",
        props: { direction: "horizontal", justify: "between", align: "center" },
        children: [`${ns}-current-label`, `${ns}-current-value`],
      },
      [`${ns}-current-label`]: { type: "Text", props: { text: "In your cart", variant: "muted", className: null } },
      [`${ns}-current-value`]: {
        type: "Money",
        props: { value: { $datasource: `${total}/data/value` }, currency, locale: null, compareAt: null, showDiscount: null, size: "sm", className: "font-medium" },
      },
    };
    return {
      root: ns,
      elements: elements as unknown as ReturnType<Fragment<P>["build"]>["elements"],
      datasources: {
        [total]: { type: "bdo.metric", params: { bdo: cartBdo, Metric: [{ Type: "SUM", Field: "LineTotal" }] } },
      },
      init: [{ action: "datasource.refresh", params: { names: [total] } }],
    };
  },
};
