/**
 * EmptyCart — a full empty-cart state: an Empty placeholder (icon + title +
 * description) with an optional "Continue shopping" CTA as its child. For the
 * inline empty state inside a populated cart, Cart Summary already has one;
 * this is the standalone block for a dedicated empty-cart page/region.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  title: z.string().default("Your cart is empty"),
  description: z.string().default("Looks like you haven't added anything yet."),
  ctaLabel: z.string().default("Continue shopping"),
  ctaTarget: z.string().nullable().default(null).describe("Page NAME the CTA navigates to. null hides the button."),
});

type P = z.infer<typeof Params>;

export const EmptyCart: Fragment<P> = {
  id: "fragment-empty-cart",
  section: "cart",
  name: "Empty Cart",
  version: "1.0.0",
  description:
    "Standalone empty-cart state: an Empty placeholder (title + description) with an optional 'Continue shopping' CTA. No entities required.",
  whenToUse:
    "Use as the empty-cart page/region when the cart has no items, with a call-to-action back to the store.",
  category: "cart-checkout",
  previewParams: {},
  params: Params as z.ZodType<P>,
  build: ({ title, description, ctaLabel, ctaTarget }, ns) => {
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Empty",
        props: { title, description },
        children: ctaTarget ? [`${ns}-cta`] : [],
      },
    };
    if (ctaTarget) {
      elements[`${ns}-cta`] = {
        type: "Button",
        props: { label: ctaLabel, variant: "primary", disabled: null },
        on: { press: { action: "ui.navigate", params: { to: ctaTarget } } },
      };
    }
    return { root: ns, elements: elements as unknown as ReturnType<Fragment<P>["build"]>["elements"] };
  },
};
