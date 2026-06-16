/**
 * CartSummary — cart line items (bdo.list) with remove buttons and a running
 * total (bdo.metric SUM of LineTotal), plus an optional checkout CTA.
 *
 * Remove uses the repeat-scope two-step: setState the row's _id into
 * /ui/<ns>/removeId, then fire the delete datasource which reads it back.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  cartBdo: z.string().default("CartItem").describe("Cart line-item entity name."),
  title: z.string().default("Your cart"),
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
  version: "1.0.0",
  description:
    "Cart panel: line items with remove buttons, total (SUM of LineTotal), item count, and optional 'Proceed to checkout' navigation. Requires cart entity fields: ProductId, Name, Price, Quantity, LineTotal. Its list datasource is '<ns>-items' — pass it in a sibling ProductGrid's cartRefresh to live-update on add.",
  whenToUse:
    "Use on cart or checkout pages to show the shopping cart contents: line items with remove buttons, item count, running total, and a checkout call-to-action.",
  category: "cart-checkout",
  params: Params as z.ZodType<P>,
  build: ({ cartBdo, title, checkoutTarget }, ns) => {
    const ui = `/ui/${ns}`;
    const items = `${ns}-items`;
    const total = `${ns}-total`;

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
            `${ns}-rows`,
            `${ns}-empty`,
            `${ns}-divider`,
            `${ns}-total-row`,
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
          props: {
            direction: "horizontal",
            justify: "between",
            align: "center",
            className: "rounded-lg border border-border px-3 py-2",
          },
          children: [`${ns}-row-info`, `${ns}-row-actions`],
        },
        [`${ns}-row-info`]: {
          type: "Stack",
          props: { direction: "vertical", gap: "none" },
          children: [`${ns}-row-name`, `${ns}-row-price`],
        },
        [`${ns}-row-name`]: {
          type: "Text",
          props: { text: { $item: "Name" }, variant: "body" },
        },
        [`${ns}-row-price`]: {
          type: "Stack",
          props: { direction: "horizontal", gap: "none" },
          children: [`${ns}-row-price-symbol`, `${ns}-row-price-value`],
        },
        [`${ns}-row-price-symbol`]: {
          type: "Text",
          props: { text: "$", variant: "muted" },
        },
        [`${ns}-row-price-value`]: {
          type: "Text",
          props: { text: { $item: "LineTotal" }, variant: "muted" },
        },
        [`${ns}-row-actions`]: {
          type: "Button",
          props: { label: "Remove", variant: "secondary", disabled: null },
          on: {
            press: [
              {
                // {$item} in action params yields the item's PATH — $template
                // bare names are the value-copy mechanism.
                action: "setState",
                params: {
                  statePath: `${ui}/removeId`,
                  value: { $template: "${_id}" },
                },
              },
              { action: "datasource.fire", params: { name: `${ns}-remove` } },
            ],
          },
        },
        [`${ns}-empty`]: {
          type: "Empty",
          props: {
            title: "Cart is empty",
            description: "Add products to see them here.",
          },
          visible: { $state: `/queries/${items}/page/total`, eq: 0 },
        },
        [`${ns}-divider`]: {
          type: "Separator",
          props: { orientation: "horizontal" },
        },
        [`${ns}-total-row`]: {
          type: "Stack",
          props: { direction: "horizontal", justify: "between", align: "center" },
          children: [`${ns}-total-label`, `${ns}-total-value`],
        },
        [`${ns}-total-label`]: {
          type: "Text",
          props: {
            text: { $template: `Total (\${/queries/${items}/page/total} items)` },
            variant: "lead",
          },
        },
        [`${ns}-total-value`]: {
          type: "Text",
          props: {
            text: { $template: `$\${/queries/${total}/data/value}` },
            variant: "lead",
          },
        },
        ...(checkoutTarget
          ? {
              [`${ns}-checkout`]: {
                type: "Button",
                props: { label: "Proceed to checkout", variant: "primary", disabled: null },
                on: {
                  press: { action: "ui.navigate", params: { to: checkoutTarget } },
                },
              },
            }
          : {}),
      },
      state: {
        ui: { [ns]: { removeId: null } },
      },
      datasources: {
        [items]: {
          type: "bdo.list",
          params: { bdo: cartBdo, Sort: [{ _id: "ASC" }] },
        },
        [total]: {
          type: "bdo.metric",
          params: { bdo: cartBdo, Metric: [{ Type: "SUM", Field: "LineTotal" }] },
        },
        [`${ns}-remove`]: {
          type: "bdo.delete",
          params: { bdo: cartBdo, _id: { $state: `${ui}/removeId` } },
          refresh: [items, total],
          on: {
            success: [
              { action: "ui.toast", params: { message: "Removed from cart", kind: "default" } },
            ],
          },
        },
      },
      init: [{ action: "datasource.refresh", params: { names: [items, total] } }],
    };
  },
};
