/**
 * ShippingMethodSelector — radio-cards for delivery options: each card shows a
 * label, ETA, and price, and selects on click (writes the chosen value to
 * `methodPath`). The selected card shows a filled check (visible when
 * state === that card's value — the value is a build-time literal, so this
 * works with the `eq` visibility condition).
 *
 * Self-contained; no entity contract. Bind/read `methodPath` from checkout.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  methods: z
    .array(z.object({ value: z.string(), label: z.string(), eta: z.string().nullable(), price: z.number() }))
    .default([])
    .describe("Delivery options: { value, label, eta, price }."),
  methodPath: z.string().default("/ui/shipping/method").describe("State path the selected method's value is written to."),
  defaultValue: z.string().nullable().default(null).describe("Pre-selected method value."),
  currency: z.string().nullable().default(null).describe("ISO 4217 code (default USD)."),
});

type P = z.infer<typeof Params>;

/** Build a nested state object from a "/a/b/c" path + value (for the seed). */
function nest(path: string, value: unknown): Record<string, unknown> {
  return path
    .replace(/^\//, "")
    .split("/")
    .reverse()
    .reduce<unknown>((acc, key) => ({ [key]: acc }), value) as Record<string, unknown>;
}

export const ShippingMethodSelector: Fragment<P> = {
  id: "fragment-shipping-method-selector",
  section: "checkout",
  name: "Shipping Method Selector",
  version: "1.0.0",
  description:
    "Radio-card delivery options (label, ETA, price) that select on click and write the chosen value to `methodPath`; the selected card shows a check. Presentational — no entities.",
  whenToUse:
    "Use on checkout/shipping pages to pick a delivery method (Standard / Express / …). Read the selection from methodPath elsewhere on the page.",
  category: "cart-checkout",
  previewParams: {
    methods: [
      { value: "standard", label: "Standard", eta: "5–7 business days", price: 0 },
      { value: "express", label: "Express", eta: "2–3 business days", price: 9.99 },
      { value: "overnight", label: "Overnight", eta: "Next business day", price: 24.99 },
    ],
    defaultValue: "express",
  },
  params: Params as z.ZodType<P>,
  build: ({ methods, methodPath, defaultValue, currency }, ns) => {
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "vertical", gap: "sm" },
        children: methods.map((_, i) => `${ns}-card-${i}`),
      },
    };

    methods.forEach((m, i) => {
      elements[`${ns}-card-${i}`] = {
        type: "Stack",
        props: {
          direction: "horizontal",
          justify: "between",
          align: "center",
          clickable: true,
          className: "cursor-pointer rounded-lg border border-border p-3 transition-colors hover:border-foreground/30",
        },
        on: { press: [{ action: "setState", params: { statePath: methodPath, value: m.value } }] },
        children: [`${ns}-card-${i}-info`, `${ns}-card-${i}-right`],
      };
      elements[`${ns}-card-${i}-info`] = {
        type: "Stack",
        props: { direction: "vertical", gap: "none", className: "min-w-0" },
        children: [`${ns}-card-${i}-label`, ...(m.eta ? [`${ns}-card-${i}-eta`] : [])],
      };
      elements[`${ns}-card-${i}-label`] = { type: "Text", props: { text: m.label, variant: "body", className: "font-medium" } };
      if (m.eta) elements[`${ns}-card-${i}-eta`] = { type: "Text", props: { text: m.eta, variant: "muted", className: null } };
      elements[`${ns}-card-${i}-right`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "md", align: "center" },
        children: [`${ns}-card-${i}-price`, `${ns}-card-${i}-ind`],
      };
      elements[`${ns}-card-${i}-price`] = {
        type: "Money",
        props: { value: m.price, currency, locale: null, compareAt: null, showDiscount: null, size: "sm", className: "font-medium" },
      };
      // Selected indicator: an outline circle always, a filled check overlaid when chosen.
      elements[`${ns}-card-${i}-ind`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", justify: "center", className: "relative size-5 shrink-0" },
        children: [`${ns}-card-${i}-ind-off`, `${ns}-card-${i}-ind-on`],
      };
      elements[`${ns}-card-${i}-ind-off`] = { type: "Icon", props: { name: "circle", size: 20, color: "var(--border)", strokeWidth: null, className: "absolute" } };
      elements[`${ns}-card-${i}-ind-on`] = {
        type: "Icon",
        props: { name: "circle-check-big", size: 20, color: "var(--primary)", strokeWidth: null, className: "absolute" },
        visible: { $state: methodPath, eq: m.value },
      };
    });

    return {
      root: ns,
      elements: elements as unknown as ReturnType<Fragment<P>["build"]>["elements"],
      ...(defaultValue != null ? { state: nest(methodPath, defaultValue) } : {}),
    };
  },
};
