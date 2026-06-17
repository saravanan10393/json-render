/**
 * PromoCodeField — a coupon entry row: a text input + Apply button. On apply it
 * stores the entered code at `appliedPath` and toasts. Presentational: actual
 * discount validation is a backend concern (this runtime can't validate/price a
 * coupon) — wire `appliedPath` to whatever consumes it, or let a backend react.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  placeholder: z.string().default("Promo code"),
  applyLabel: z.string().default("Apply"),
  codePath: z.string().default("/ui/promo/code").describe("State path the typed code binds to."),
  appliedPath: z.string().default("/ui/promo/applied").describe("State path set to the code on Apply."),
  successMessage: z.string().default("Promo code applied"),
});

type P = z.infer<typeof Params>;

export const PromoCodeField: Fragment<P> = {
  id: "fragment-promo-code-field",
  section: "cart",
  name: "Promo Code Field",
  version: "1.0.0",
  description:
    "Coupon entry: a text input + Apply button. On apply, stores the code at `appliedPath` and toasts. Presentational — coupon validation/pricing is a backend concern.",
  whenToUse:
    "Use on cart/checkout pages for a promo/coupon code input with an Apply button. Pair the applied code with a backend or an Order Summary discount row.",
  category: "cart-checkout",
  previewParams: {},
  params: Params as z.ZodType<P>,
  build: ({ placeholder, applyLabel, codePath, appliedPath, successMessage }, ns) => {
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center" },
        children: [`${ns}-input-wrap`, `${ns}-apply`],
      },
      [`${ns}-input-wrap`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none", className: "flex-1" },
        children: [`${ns}-input`],
      },
      [`${ns}-input`]: {
        type: "Input",
        props: { label: null, type: "text", placeholder, value: { $bindState: codePath } },
      },
      [`${ns}-apply`]: {
        type: "Button",
        props: { label: applyLabel, variant: "secondary", disabled: null },
        on: {
          press: [
            { action: "setState", params: { statePath: appliedPath, value: { $state: codePath } } },
            { action: "ui.toast", params: { message: successMessage, kind: "success" } },
          ],
        },
      },
    };
    return { root: ns, elements: elements as unknown as ReturnType<Fragment<P>["build"]>["elements"] };
  },
};
