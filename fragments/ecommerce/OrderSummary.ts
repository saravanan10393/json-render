/**
 * OrderSummary — a totals breakdown card: a list of {label, amount} rows
 * (Subtotal, Shipping, Tax, Discount, …) above an emphasized Total, with an
 * optional fine-print note and checkout CTA.
 *
 * PRESENTATIONAL by design: this runtime has no client-side arithmetic
 * (`bdo.metric SUM` sums ONE field; there's no way to add subtotal + shipping +
 * tax). So each amount is SUPPLIED — a literal, or a binding the agent wires:
 * subtotal → a cart's SUM metric ({ "$datasource": "<cartNs>-total/data/value" }),
 * shipping/tax/total → app state or a backend total. Amounts render through
 * Money (negatives show as -$X for discounts).
 *
 * No entity contract of its own — it only displays the numbers it's given.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

/** A money amount: a literal number/string, or a binding ($datasource/$state/$template). */
const Amount = z.union([z.number(), z.string(), z.record(z.string(), z.unknown())]);

const Params = z.object({
  title: z.string().default("Order summary"),
  currency: z.string().nullable().default(null).describe("ISO 4217 code for all amounts (default USD)."),
  rows: z
    .array(
      z.object({
        label: z.string(),
        amount: Amount.describe("Number, or a binding — e.g. { $datasource: '<cartNs>-total/data/value' } for subtotal."),
        muted: z.boolean().optional().describe("Render this row de-emphasized (e.g. a discount line)."),
      }),
    )
    .default([])
    .describe("Breakdown lines above the total (Subtotal, Shipping, Tax, Discount, …)."),
  total: z
    .object({ label: z.string().default("Total"), amount: Amount })
    .describe("The emphasized grand-total row. `amount` is app/backend-supplied (this block can't sum)."),
  note: z.string().nullable().default(null).describe("Fine print under the total, e.g. 'Taxes calculated at checkout'."),
  checkoutTarget: z.string().nullable().default(null).describe("Page NAME for a 'Checkout' CTA. null hides it."),
});

type P = z.infer<typeof Params>;

export const OrderSummary: Fragment<P> = {
  id: "fragment-order-summary",
  section: "cart",
  name: "Order Summary",
  version: "1.0.0",
  description:
    "Totals breakdown card: {label, amount} rows (Subtotal, Shipping, Tax, Discount) above an emphasized Total, with optional fine-print note and checkout CTA. Presentational — amounts are supplied as literals or bindings (bind subtotal to a cart's SUM metric; shipping/tax/total from app state or backend). No entity contract.",
  whenToUse:
    "Use on cart/checkout pages to show the price breakdown (subtotal, shipping, tax, discount, total). Pair with Cart Summary: bind the Subtotal row to the cart's '<cartNs>-total/data/value'. For the editable line-item list use Cart Summary.",
  category: "cart-checkout",
  previewParams: {
    rows: [
      { label: "Subtotal", amount: 336 },
      { label: "Shipping", amount: 0 },
      { label: "Estimated tax", amount: 26.88 },
      { label: "Discount (SAVE20)", amount: -20, muted: true },
    ],
    total: { label: "Total", amount: 342.88 },
    note: "Shipping & taxes calculated at checkout.",
  },
  params: Params as z.ZodType<P>,
  build: ({ title, currency, rows, total, note, checkoutTarget }, ns) => {
    const money = (value: unknown, size: string, className: string | null = null) => ({
      type: "Money",
      props: { value, currency, locale: null, compareAt: null, showDiscount: null, size, className },
    });

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Card",
        props: { title, description: null, maxWidth: null, centered: null, className: null },
        children: [`${ns}-body`],
      },
      [`${ns}-body`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "sm" },
        children: [
          ...rows.map((_, i) => `${ns}-row-${i}`),
          `${ns}-divider`,
          `${ns}-total`,
          ...(note ? [`${ns}-note`] : []),
          ...(checkoutTarget ? [`${ns}-checkout`] : []),
        ],
      },
      [`${ns}-divider`]: { type: "Separator", props: {} },
      [`${ns}-total`]: {
        type: "Stack",
        props: { direction: "horizontal", justify: "between", align: "center", className: "pt-1" },
        children: [`${ns}-total-label`, `${ns}-total-value`],
      },
      [`${ns}-total-label`]: { type: "Text", props: { text: total.label ?? "Total", variant: "body", className: "text-base font-semibold" } },
      [`${ns}-total-value`]: money(total.amount, "lg"),
    };

    rows.forEach((row, i) => {
      elements[`${ns}-row-${i}`] = {
        type: "Stack",
        props: { direction: "horizontal", justify: "between", align: "center" },
        children: [`${ns}-row-${i}-l`, `${ns}-row-${i}-v`],
      };
      elements[`${ns}-row-${i}-l`] = {
        type: "Text",
        props: { text: row.label, variant: row.muted ? "muted" : "body", className: null },
      };
      elements[`${ns}-row-${i}-v`] = money(row.amount, "sm", row.muted ? "text-muted-foreground" : null);
    });

    if (note) {
      elements[`${ns}-note`] = { type: "Text", props: { text: note, variant: "caption", className: "text-muted-foreground" } };
    }
    if (checkoutTarget) {
      elements[`${ns}-checkout`] = {
        type: "Button",
        props: { label: "Checkout", variant: "primary", disabled: null },
        on: { press: { action: "ui.navigate", params: { to: checkoutTarget } } },
      };
    }

    return {
      root: ns,
      elements: elements as unknown as ReturnType<Fragment<P>["build"]>["elements"],
    };
  },
};
