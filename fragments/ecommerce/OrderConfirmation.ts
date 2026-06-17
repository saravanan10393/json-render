/**
 * OrderConfirmation — the post-checkout thank-you + order recap for ONE order
 * loaded by id (bdo.get): a success mark, headline, confirmation line, a recap
 * card (status, total, placed date), the shipping address, and an optional
 * "Continue shopping" CTA.
 *
 * `orderId` is a literal or a binding (e.g. the id returned by the place-order
 * save, written to a route/state path). Requires Order fields CustomerName,
 * Email, Address, City, Zip, Status, Total, PlacedAt.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  orderBdo: z.string().default("Order").describe("Order entity name."),
  orderId: z.string().describe("Order _id to show (literal, or bind to a route/state path)."),
  currency: z.string().nullable().default(null).describe("ISO 4217 code (default USD)."),
  continueTarget: z.string().nullable().default(null).describe("Page NAME for the 'Continue shopping' CTA. null hides it."),
});

type P = z.infer<typeof Params>;

export const OrderConfirmation: Fragment<P> = {
  id: "fragment-order-confirmation",
  section: "checkout",
  name: "Order Confirmation",
  version: "1.0.0",
  description:
    "Post-checkout thank-you + order recap (bdo.get one order): success mark, headline, confirmation line, recap card (status, total, placed date), shipping address, optional continue CTA. Requires Order fields CustomerName, Email, Address, City, Zip, Status, Total, PlacedAt.",
  whenToUse:
    "Use on the order-confirmation/thank-you page after checkout to recap the placed order. Pair with CheckoutForm's success navigation, passing the new order id.",
  category: "cart-checkout",
  previewParams: { orderId: "Order-0" },
  params: Params as z.ZodType<P>,
  build: ({ orderBdo, orderId, currency, continueTarget }, ns) => {
    const ds = `${ns}-order`;
    const f = (field: string) => ({ $datasource: `${ds}/data/${field}` });

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "vertical", gap: "md", align: "center", className: "mx-auto w-full max-w-lg text-center" },
        children: [`${ns}-icon`, `${ns}-headline`, `${ns}-sub`, `${ns}-recap`],
      },
      [`${ns}-icon`]: { type: "Icon", props: { name: "circle-check-big", size: 52, color: "var(--primary)", strokeWidth: null, className: null } },
      [`${ns}-headline`]: { type: "Heading", props: { text: "Thank you for your order!", level: "h2", className: null } },
      [`${ns}-sub`]: {
        type: "Text",
        props: { text: { $template: `A confirmation was sent to \${/queries/${ds}/data/Email}.` }, variant: "muted", className: null },
      },
      [`${ns}-recap`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "sm", className: "w-full rounded-xl border border-border p-5 text-left" },
        children: [
          `${ns}-status-row`,
          `${ns}-total-row`,
          `${ns}-placed-row`,
          `${ns}-divider`,
          `${ns}-ship-heading`,
          `${ns}-ship-name`,
          `${ns}-ship-addr`,
          `${ns}-ship-city`,
          ...(continueTarget ? [`${ns}-continue`] : []),
        ],
      },
      [`${ns}-status-row`]: {
        type: "Stack",
        props: { direction: "horizontal", justify: "between", align: "center" },
        children: [`${ns}-status-label`, `${ns}-status-value`],
      },
      [`${ns}-status-label`]: { type: "Text", props: { text: "Status", variant: "muted", className: null } },
      [`${ns}-status-value`]: { type: "Badge", props: { text: f("Status"), variant: "secondary" } },
      [`${ns}-total-row`]: {
        type: "Stack",
        props: { direction: "horizontal", justify: "between", align: "center" },
        children: [`${ns}-total-label`, `${ns}-total-value`],
      },
      [`${ns}-total-label`]: { type: "Text", props: { text: "Total", variant: "muted", className: null } },
      [`${ns}-total-value`]: {
        type: "Money",
        props: { value: f("Total"), currency, locale: null, compareAt: null, showDiscount: null, size: "md", className: "font-semibold" },
      },
      [`${ns}-placed-row`]: {
        type: "Stack",
        props: { direction: "horizontal", justify: "between", align: "center" },
        children: [`${ns}-placed-label`, `${ns}-placed-value`],
      },
      [`${ns}-placed-label`]: { type: "Text", props: { text: "Placed", variant: "muted", className: null } },
      [`${ns}-placed-value`]: { type: "Text", props: { text: f("PlacedAt"), variant: "body", className: null } },
      [`${ns}-divider`]: { type: "Separator", props: {} },
      [`${ns}-ship-heading`]: { type: "Text", props: { text: "Ships to", variant: "caption", className: "uppercase tracking-wide text-muted-foreground" } },
      [`${ns}-ship-name`]: { type: "Text", props: { text: f("CustomerName"), variant: "body", className: "font-medium" } },
      [`${ns}-ship-addr`]: { type: "Text", props: { text: f("Address"), variant: "muted", className: null } },
      [`${ns}-ship-city`]: { type: "Text", props: { text: { $template: `\${/queries/${ds}/data/City}, \${/queries/${ds}/data/Zip}` }, variant: "muted", className: null } },
    };

    if (continueTarget) {
      elements[`${ns}-continue`] = {
        type: "Button",
        props: { label: "Continue shopping", variant: "secondary", disabled: null },
        on: { press: { action: "ui.navigate", params: { to: continueTarget } } },
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
