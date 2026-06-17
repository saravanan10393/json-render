/**
 * OfferModal — a promotional pop-up (Dialog) that auto-opens on mount, in two
 * modes (`mode`): "code" (a copyable coupon chip + shop CTA) and "email" (an
 * email-capture field + submit). Optional eyebrow badge, big discount, and
 * image. A "No thanks" link and the Dialog's X both dismiss it.
 *
 * Opens via a seeded /ui/<ns>/open = true; dismiss flips it false. Pure
 * display — no entities (email submit is presentational: toast + close).
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  mode: z.enum(["code", "email"]).default("code").describe("'code' = copyable coupon + shop CTA; 'email' = capture an email then confirm."),
  eyebrow: z.string().nullable().default(null).describe("Small badge above the headline, e.g. 'Welcome offer'."),
  title: z.string().describe("Headline, e.g. 'Get 20% off your first order'."),
  subtitle: z.string().nullable().default(null).describe("Supporting line under the headline."),
  discount: z.string().nullable().default(null).describe("Big offer text, e.g. '20% OFF'."),
  imageUrl: z.string().nullable().default(null).describe("Optional image at the top of the modal."),
  code: z.string().nullable().default(null).describe("Coupon code shown in a copyable chip (mode 'code')."),
  ctaLabel: z.string().default("Shop now").describe("Primary CTA (mode 'code')."),
  ctaTarget: z.string().nullable().default(null).describe("Page NAME the CTA navigates to; closes the modal regardless."),
  emailPlaceholder: z.string().default("you@email.com"),
  submitLabel: z.string().default("Get my code"),
  successMessage: z.string().default("You're in — check your inbox!"),
  dismissLabel: z.string().default("No thanks"),
});

type P = z.infer<typeof Params>;

export const OfferModal: Fragment<P> = {
  id: "fragment-offer-modal",
  section: "promotion",
  name: "Offer Modal",
  version: "1.0.0",
  description:
    "Auto-opening promotional modal (Dialog) in two modes: 'code' (copyable coupon chip + shop CTA) or 'email' (email capture + submit). Optional eyebrow badge, big discount, image; 'No thanks' dismiss. Presentational — no entities.",
  whenToUse:
    "Use for a welcome/discount pop-up on a storefront: reveal a coupon code to copy, or capture an email in exchange for an offer.",
  category: "promotion",
  previewParams: {
    eyebrow: "Welcome offer",
    title: "Get 20% off your first order",
    subtitle: "Use this code at checkout — today only.",
    discount: "20% OFF",
    code: "WELCOME20",
    ctaTarget: "Shop",
  },
  params: Params as z.ZodType<P>,
  build: ({ mode, eyebrow, title, subtitle, discount, imageUrl, code, ctaLabel, ctaTarget, emailPlaceholder, submitLabel, successMessage, dismissLabel }, ns) => {
    const ui = `/ui/${ns}`;
    const form = `/form/${ns}`;
    const close = { action: "setState", params: { statePath: `${ui}/open`, value: false } };
    const body: string[] = [];
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: { type: "Dialog", props: { title, description: subtitle, openPath: `${ui}/open` }, children: [`${ns}-body`] },
      [`${ns}-body`]: { type: "Stack", props: { direction: "vertical", gap: "md", align: "center", className: "text-center" }, children: body },
    };

    if (imageUrl) {
      body.push(`${ns}-image`);
      elements[`${ns}-image`] = { type: "Image", props: { src: imageUrl, alt: title, aspectRatio: "16/9", fit: "cover", width: null, height: null, className: "w-full rounded-lg" } };
    }
    if (eyebrow) {
      body.push(`${ns}-eyebrow`);
      elements[`${ns}-eyebrow`] = { type: "Badge", props: { text: eyebrow, variant: "secondary" } };
    }
    if (discount) {
      body.push(`${ns}-discount`);
      elements[`${ns}-discount`] = { type: "Heading", props: { text: discount, level: "h1", className: "text-primary" } };
    }

    if (mode === "email") {
      body.push(`${ns}-email`, `${ns}-submit`);
      elements[`${ns}-email`] = { type: "Input", props: { label: null, type: "email", placeholder: emailPlaceholder, value: { $bindState: `${form}/email` } } };
      elements[`${ns}-submit`] = {
        type: "Button",
        props: { label: submitLabel, variant: "primary", disabled: null },
        on: { press: [{ action: "ui.toast", params: { message: successMessage, kind: "success" } }, close] },
      };
    } else {
      if (code) {
        body.push(`${ns}-code-row`);
        elements[`${ns}-code-row`] = {
          type: "Stack",
          props: { direction: "horizontal", gap: "sm", align: "center", justify: "center", className: "rounded-lg border border-dashed border-border px-4 py-2" },
          children: [`${ns}-code`, `${ns}-copy`],
        };
        elements[`${ns}-code`] = { type: "Text", props: { text: code, variant: "body", className: "font-mono text-lg font-semibold tracking-wider" } };
        elements[`${ns}-copy`] = { type: "CopyButton", props: { text: code, label: null, variant: "ghost", className: null } };
      }
      body.push(`${ns}-cta`);
      elements[`${ns}-cta`] = {
        type: "Button",
        props: { label: ctaLabel, variant: "primary", disabled: null },
        on: { press: ctaTarget ? [{ action: "ui.navigate", params: { to: ctaTarget } }, close] : [close] },
      };
    }

    body.push(`${ns}-dismiss`);
    elements[`${ns}-dismiss`] = {
      type: "Stack",
      props: { direction: "horizontal", gap: "none", align: "center", justify: "center", clickable: true, className: "cursor-pointer" },
      on: { press: [close] },
      children: [`${ns}-dismiss-text`],
    };
    elements[`${ns}-dismiss-text`] = { type: "Text", props: { text: dismissLabel, variant: "caption", className: "text-muted-foreground underline underline-offset-4" } };

    return {
      root: ns,
      elements: elements as unknown as ReturnType<Fragment<P>["build"]>["elements"],
      state: { ui: { [ns]: { open: true } }, form: { [ns]: { email: "" } } },
    };
  },
};
