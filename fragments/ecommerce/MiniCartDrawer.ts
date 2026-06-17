/**
 * MiniCartDrawer — a cart trigger (cart icon + item-count badge) that opens a
 * slide-in Sheet containing the cart: line items (thumbnail, name, unit price,
 * qty, line total, remove), subtotal, and an optional checkout CTA. The
 * header/anywhere companion to the full Cart Summary; shares the same cart
 * datasources + remove pattern.
 *
 * Quantity is read-only here (same constraint as Cart Summary — no client-side
 * line recompute). Requires cart fields ProductId, Name, Price, Quantity,
 * LineTotal; optional ImageUrl.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  cartBdo: z.string().default("CartItem").describe("Cart line-item entity name."),
  triggerLabel: z.string().default("Cart").describe("Text beside the cart icon in the trigger."),
  currency: z.string().nullable().default(null).describe("ISO 4217 code (default USD)."),
  checkoutTarget: z.string().nullable().default(null).describe("Page NAME the checkout button navigates to. null hides the CTA."),
});

type P = z.infer<typeof Params>;

export const MiniCartDrawer: Fragment<P> = {
  id: "fragment-mini-cart-drawer",
  section: "cart",
  name: "Mini Cart Drawer",
  version: "1.0.0",
  description:
    "Cart trigger (icon + item-count badge) opening a slide-in Sheet with cart line items (thumbnail, name, unit price, qty, line total, remove), subtotal, and optional checkout CTA. Requires cart fields ProductId, Name, Price, Quantity, LineTotal; optional ImageUrl. Its list datasource is '<ns>-items' — pass it in a ProductGrid's cartRefresh.",
  whenToUse:
    "Use for a header cart button that slides out a mini-cart with the current items, subtotal, and checkout. For an inline/full cart panel use Cart Summary.",
  category: "cart-checkout",
  previewParams: { checkoutTarget: null },
  params: Params as z.ZodType<P>,
  build: ({ cartBdo, triggerLabel, currency, checkoutTarget }, ns) => {
    const ui = `/ui/${ns}`;
    const items = `${ns}-items`;
    const total = `${ns}-total`;
    const money = (value: unknown, size: string, className: string | null = null) => ({
      type: "Money",
      props: { value, currency, locale: null, compareAt: null, showDiscount: null, size, className },
    });

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: { type: "Stack", props: { direction: "vertical", gap: "none", className: "w-fit" }, children: [`${ns}-trigger`, `${ns}-sheet`] },
      [`${ns}-trigger`]: {
        type: "Stack",
        props: {
          direction: "horizontal",
          gap: "sm",
          align: "center",
          clickable: true,
          className: "w-fit cursor-pointer rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-muted",
        },
        on: { press: [{ action: "setState", params: { statePath: `${ui}/open`, value: true } }] },
        children: [`${ns}-trigger-icon`, `${ns}-trigger-label`, `${ns}-trigger-count`],
      },
      [`${ns}-trigger-icon`]: { type: "Icon", props: { name: "shopping-cart", size: 18, color: null, strokeWidth: null, className: null } },
      [`${ns}-trigger-label`]: { type: "Text", props: { text: triggerLabel, variant: "body", className: "font-medium" } },
      [`${ns}-trigger-count`]: { type: "Badge", props: { text: { $datasource: `${items}/page/total` }, variant: "secondary" } },

      [`${ns}-sheet`]: {
        type: "Sheet",
        props: { title: "Your cart", description: null, side: "right", openPath: `${ui}/open` },
        children: [`${ns}-body`],
      },
      [`${ns}-body`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "md" },
        children: [`${ns}-rows`, `${ns}-empty`, `${ns}-divider`, `${ns}-subtotal-row`, ...(checkoutTarget ? [`${ns}-checkout`] : [])],
      },
      [`${ns}-rows`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "sm" },
        repeat: { statePath: `/queries/${items}/data`, key: "_id" },
        children: [`${ns}-row`],
      },
      [`${ns}-row`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center", className: "rounded-lg border border-border p-2" },
        children: [`${ns}-row-thumb`, `${ns}-row-info`, `${ns}-row-total`, `${ns}-row-remove`],
      },
      [`${ns}-row-thumb`]: {
        type: "Image",
        props: { src: { $item: "ImageUrl" }, alt: { $item: "Name" }, aspectRatio: "1/1", fit: "cover", width: null, height: null, className: "w-12 shrink-0 rounded-md border border-border" },
      },
      [`${ns}-row-info`]: { type: "Stack", props: { direction: "vertical", gap: "none", className: "min-w-0 flex-1" }, children: [`${ns}-row-name`, `${ns}-row-meta`] },
      [`${ns}-row-name`]: { type: "Text", props: { text: { $item: "Name" }, variant: "body", className: "font-medium" } },
      [`${ns}-row-meta`]: { type: "Text", props: { text: { $template: "Qty ${Quantity}" }, variant: "muted", className: null } },
      [`${ns}-row-total`]: money({ $item: "LineTotal" }, "sm", "shrink-0 font-medium"),
      [`${ns}-row-remove`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", justify: "center", clickable: true, className: "size-7 shrink-0 rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive" },
        on: {
          press: [
            { action: "setState", params: { statePath: `${ui}/removeId`, value: { $template: "${_id}" } } },
            { action: "datasource.fire", params: { name: `${ns}-remove` } },
          ],
        },
        children: [`${ns}-row-remove-icon`],
      },
      [`${ns}-row-remove-icon`]: { type: "Icon", props: { name: "trash-2", size: 15, color: null, strokeWidth: null, className: null } },
      [`${ns}-empty`]: {
        type: "Empty",
        props: { title: "Your cart is empty", description: "Add products to see them here." },
        visible: { $state: `/queries/${items}/page/total`, eq: 0 },
      },
      [`${ns}-divider`]: { type: "Separator", props: {} },
      [`${ns}-subtotal-row`]: {
        type: "Stack",
        props: { direction: "horizontal", justify: "between", align: "center" },
        children: [`${ns}-subtotal-label`, `${ns}-subtotal-value`],
      },
      [`${ns}-subtotal-label`]: { type: "Text", props: { text: { $template: `Subtotal · \${/queries/${items}/page/total} items` }, variant: "body", className: "font-medium" } },
      [`${ns}-subtotal-value`]: money({ $datasource: `${total}/data/value` }, "lg"),
    };

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
      state: { ui: { [ns]: { open: false, removeId: null } } },
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
