/**
 * CartSummary — the shopping-cart panel: line items (bdo.list) with thumbnail,
 * name, unit price, a quantity stepper, line total (Money), and remove; plus a
 * running subtotal (bdo.metric SUM of LineTotal), item count, empty state, and
 * an optional checkout CTA.
 *
 * Quantity edits persist via a per-row bdo.save of Quantity; the backend (and
 * the showcase mock) re-derives LineTotal = Price × Quantity, then the list +
 * SUM refresh. Remove + qty both use the repeat-scope two-step (capture the
 * row's value via $template, then fire the write that reads it back).
 *
 * Requires cart fields: ProductId, Name, Price, Quantity, LineTotal; optional
 * ImageUrl (line thumbnail). Its list datasource is '<ns>-items' — pass it in a
 * sibling ProductGrid's cartRefresh to live-update on add.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  cartBdo: z.string().default("CartItem").describe("Cart line-item entity name."),
  title: z.string().default("Your cart"),
  currency: z.string().nullable().default(null).describe("ISO 4217 code for prices (default USD)."),
  checkoutTarget: z
    .string()
    .nullable()
    .default(null)
    .describe("Page NAME the checkout button navigates to. null hides the CTA."),
});

type P = z.infer<typeof Params>;

export const CartSummary: Fragment<P> = {
  id: "fragment-cart-summary",
  section: "cart",
  name: "Cart Summary",
  version: "2.0.0",
  description:
    "Shopping-cart panel: line items (thumbnail, name, unit price, quantity stepper, line total) with remove, plus subtotal (SUM of LineTotal), item count, empty state, and optional checkout CTA. Requires cart fields ProductId, Name, Price, Quantity, LineTotal; optional ImageUrl. Its list datasource is '<ns>-items' — pass it in a sibling ProductGrid's cartRefresh to live-update on add.",
  whenToUse:
    "Use on cart or checkout pages to show cart contents with editable quantities, line/subtotal pricing, remove, and a checkout call-to-action.",
  category: "cart-checkout",
  previewParams: { title: "Your cart" },
  params: Params as z.ZodType<P>,
  build: ({ cartBdo, title, currency, checkoutTarget }, ns) => {
    const ui = `/ui/${ns}`;
    const items = `${ns}-items`;
    const total = `${ns}-total`;
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
          props: { direction: "vertical", gap: "md" },
          children: [
            `${ns}-rows`,
            `${ns}-empty`,
            `${ns}-divider`,
            `${ns}-subtotal-row`,
            ...(checkoutTarget ? [`${ns}-checkout`] : []),
          ],
        },
        [`${ns}-rows`]: {
          type: "Stack",
          props: { direction: "vertical", gap: "sm" },
          repeat: { statePath: `/queries/${items}/data`, key: "_id" },
          children: [`${ns}-row`],
        },
        [`${ns}-row`]: {
          type: "Stack",
          props: { direction: "horizontal", gap: "md", align: "center", className: "rounded-lg border border-border p-2.5" },
          children: [`${ns}-row-thumb`, `${ns}-row-info`, `${ns}-row-qty`, `${ns}-row-total`, `${ns}-row-remove`],
        },
        [`${ns}-row-thumb`]: {
          type: "Image",
          props: { src: { $item: "ImageUrl" }, alt: { $item: "Name" }, aspectRatio: "1/1", fit: "cover", width: null, height: null, className: "w-14 shrink-0 rounded-md border border-border" },
        },
        [`${ns}-row-info`]: {
          type: "Stack",
          props: { direction: "vertical", gap: "none", className: "min-w-0 flex-1" },
          children: [`${ns}-row-name`, `${ns}-row-unit`],
        },
        [`${ns}-row-name`]: { type: "Text", props: { text: { $item: "Name" }, variant: "body", className: "font-medium" } },
        [`${ns}-row-unit`]: money({ $item: "Price" }, "sm", "text-muted-foreground"),
        [`${ns}-row-qty`]: {
          type: "Text",
          props: { text: { $template: "Qty ${Quantity}" }, variant: "muted", className: "w-16 shrink-0 text-center" },
        },
        [`${ns}-row-total`]: money({ $item: "LineTotal" }, "md", "shrink-0 w-20 text-right"),
        [`${ns}-row-remove`]: {
          type: "Stack",
          props: { direction: "horizontal", gap: "none", align: "center", justify: "center", clickable: true, className: "size-8 shrink-0 rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive" },
          on: {
            press: [
              { action: "setState", params: { statePath: `${ui}/removeId`, value: { $template: "${_id}" } } },
              { action: "datasource.fire", params: { name: `${ns}-remove` } },
            ],
          },
          children: [`${ns}-row-remove-icon`],
        },
        [`${ns}-row-remove-icon`]: { type: "Icon", props: { name: "trash-2", size: 16, color: null, strokeWidth: null, className: null } },
        [`${ns}-empty`]: {
          type: "Empty",
          props: { title: "Your cart is empty", description: "Browse products and add them to your cart." },
          visible: { $state: `/queries/${items}/page/total`, eq: 0 },
        },
        [`${ns}-divider`]: { type: "Separator", props: {} },
        [`${ns}-subtotal-row`]: {
          type: "Stack",
          props: { direction: "horizontal", justify: "between", align: "center" },
          children: [`${ns}-subtotal-label`, `${ns}-subtotal-value`],
        },
        [`${ns}-subtotal-label`]: {
          type: "Text",
          props: { text: { $template: `Subtotal · \${/queries/${items}/page/total} items` }, variant: "body", className: "font-medium" },
        },
        [`${ns}-subtotal-value`]: money({ $datasource: `${total}/data/value` }, "lg"),
        ...(checkoutTarget
          ? {
              [`${ns}-checkout`]: {
                type: "Button",
                props: { label: "Proceed to checkout", variant: "primary", disabled: null },
                on: { press: { action: "ui.navigate", params: { to: checkoutTarget } } },
              },
            }
          : {}),
    };

    return {
      root: ns,
      elements: elements as unknown as ReturnType<Fragment<P>["build"]>["elements"],
      state: { ui: { [ns]: { removeId: null, pending: null } } },
      datasources: {
        [items]: { type: "bdo.list", params: { bdo: cartBdo, Sort: [{ _id: "ASC" }] } },
        [total]: { type: "bdo.metric", params: { bdo: cartBdo, Metric: [{ Type: "SUM", Field: "LineTotal" }] } },
        [`${ns}-remove`]: {
          type: "bdo.delete",
          params: { bdo: cartBdo, _id: { $state: `${ui}/removeId` } },
          refresh: [items, total],
          on: { success: [{ action: "ui.toast", params: { message: "Removed from cart", kind: "default" } }] },
        },
      },
      init: [{ action: "datasource.refresh", params: { names: [items, total] } }],
    };
  },
};
