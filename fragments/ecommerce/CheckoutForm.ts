/**
 * CheckoutForm — shipping/contact form that places an Order (bdo.save) on
 * submit. Reads the order total from a sibling CartSummary's metric when
 * `cartSummaryNs` is given. Form draft lives at /form/<ns>/*.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  orderBdo: z.string().default("Order").describe("Order entity name."),
  cartSummaryNs: z
    .string()
    .nullable()
    .default(null)
    .describe(
      "ns of a SAME-PAGE CartSummary instance — its total becomes the order total and its datasources refresh after placing the order.",
    ),
  successTarget: z
    .string()
    .nullable()
    .default(null)
    .describe("Page NAME to navigate to after the order is placed."),
  title: z.string().default("Checkout"),
});

type P = z.infer<typeof Params>;

export const CheckoutForm: Fragment<P> = {
  id: "fragment-checkout-form",
  section: "checkout",
  name: "Checkout Form",
  version: "1.1.0",
  description:
    "Checkout form (name, email, address, city, zip) that saves an Order with Status 'Placed' on submit. Requires Order fields: CustomerName, Email, Address, City, Zip, Status, Total. Pair with a same-page CartSummary via cartSummaryNs to capture the cart total.",
  whenToUse:
    "Use for the checkout/purchase step: shipping and contact form that places the order, captures the cart total, and clears/navigates on success.",
  category: "cart-checkout",
  previewParams: { title: "Checkout" },
  params: Params as z.ZodType<P>,
  build: ({ orderBdo, cartSummaryNs, successTarget, title }, ns) => {
    const form = `/form/${ns}`;

    const field = (
      key: string,
      label: string,
      type: string,
      placeholder: string,
    ) => ({
      type: "Input",
      props: {
        label,
        type,
        placeholder,
        value: { $bindState: `${form}/${key}` },
      },
    });
    const heading = (text: string) => ({
      type: "Text",
      props: { text, variant: "caption", className: "uppercase tracking-wide text-muted-foreground" },
    });

    return {
      root: ns,
      elements: {
        [ns]: {
          type: "Card",
          props: { title, description: null, maxWidth: "md", centered: null, className: null },
          children: [`${ns}-body`],
        },
        [`${ns}-body`]: {
          type: "Stack",
          props: { direction: "vertical", gap: "md" },
          children: [
            `${ns}-contact-heading`,
            `${ns}-name`,
            `${ns}-email`,
            `${ns}-shipping-heading`,
            `${ns}-address`,
            `${ns}-city-row`,
            `${ns}-submit`,
          ],
        },
        [`${ns}-contact-heading`]: heading("Contact"),
        [`${ns}-shipping-heading`]: heading("Shipping address"),
        [`${ns}-name`]: field("CustomerName", "Full name", "text", "Jane Smith"),
        [`${ns}-email`]: field("Email", "Email", "email", "jane@example.com"),
        [`${ns}-address`]: field("Address", "Address", "text", "221B Baker Street"),
        [`${ns}-city-row`]: {
          type: "Grid",
          props: { columns: 2, gap: "md" },
          children: [`${ns}-city`, `${ns}-zip`],
        },
        [`${ns}-city`]: field("City", "City", "text", "London"),
        [`${ns}-zip`]: field("Zip", "ZIP / Postal code", "text", "NW1 6XE"),
        [`${ns}-submit`]: {
          type: "Button",
          props: { label: "Place order", variant: "primary", disabled: null },
          on: {
            press: { action: "datasource.fire", params: { name: `${ns}-place-order` } },
          },
        },
      },
      state: {
        form: {
          [ns]: { CustomerName: "", Email: "", Address: "", City: "", Zip: "" },
        },
      },
      datasources: {
        [`${ns}-place-order`]: {
          type: "bdo.save",
          params: {
            bdo: orderBdo,
            values: {
              CustomerName: { $state: `${form}/CustomerName` },
              Email: { $state: `${form}/Email` },
              Address: { $state: `${form}/Address` },
              City: { $state: `${form}/City` },
              Zip: { $state: `${form}/Zip` },
              Status: "Placed",
              Total: cartSummaryNs
                ? { $datasource: `${cartSummaryNs}-total/data/value` }
                : 0,
            },
          },
          refresh: cartSummaryNs
            ? [`${cartSummaryNs}-items`, `${cartSummaryNs}-total`]
            : [],
          on: {
            success: [
              {
                action: "ui.toast",
                params: { message: "Order placed — thank you!", kind: "success" },
              },
              {
                action: "setState",
                params: {
                  statePath: form,
                  value: { CustomerName: "", Email: "", Address: "", City: "", Zip: "" },
                },
              },
              ...(successTarget
                ? [{ action: "ui.navigate", params: { to: successTarget } }]
                : []),
            ],
          },
        },
      },
    };
  },
};
