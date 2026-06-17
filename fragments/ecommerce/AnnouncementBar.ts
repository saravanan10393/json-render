/**
 * AnnouncementBar — a full-width top strip for a promo / shipping / sale
 * message: optional leading icon, the message, an optional promo-code chip, an
 * optional inline CTA, and a dismiss (X). Dismissal flips /ui/<ns>/dismissed and
 * the bar hides via `visible` eq. Pure display — no entities.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  message: z.string().describe("The announcement text, e.g. 'Free shipping on orders over $50'."),
  icon: z.string().nullable().default(null).describe("Optional leading lucide icon name (kebab-case), e.g. 'truck', 'sparkles'."),
  code: z.string().nullable().default(null).describe("Optional promo code shown as a chip, e.g. 'SAVE20'."),
  ctaLabel: z.string().nullable().default(null).describe("Optional inline CTA label."),
  ctaTarget: z.string().nullable().default(null).describe("Page NAME the CTA navigates to."),
  tone: z.enum(["primary", "dark", "subtle"]).default("primary").describe("Color: primary (brand), dark, or subtle (muted)."),
  dismissible: z.boolean().default(true).describe("Show a dismiss (X) that hides the bar."),
});

type P = z.infer<typeof Params>;

const TONE: Record<string, string> = {
  primary: "bg-primary text-primary-foreground",
  dark: "bg-zinc-900 text-zinc-50",
  subtle: "bg-muted text-foreground border-b border-border",
};

export const AnnouncementBar: Fragment<P> = {
  id: "fragment-announcement-bar",
  section: "discovery",
  name: "Announcement Bar",
  version: "1.0.0",
  description:
    "Full-width top strip for a promo/shipping/sale message: optional leading icon, message, promo-code chip, inline CTA, and a dismiss (X). Tones: primary/dark/subtle. Pure display — no entities.",
  whenToUse:
    "Use as a thin notification strip at the very top of a storefront for sales, free-shipping thresholds, or announcements, optionally with a promo code and a 'Shop now' link.",
  category: "promotion",
  previewParams: {
    message: "Free shipping on orders over $50 — this week only.",
    icon: "truck",
    code: "FREESHIP",
    ctaLabel: "Shop now",
    ctaTarget: "Shop",
  },
  params: Params as z.ZodType<P>,
  build: ({ message, icon, code, ctaLabel, ctaTarget, tone, dismissible }, ns) => {
    const ui = `/ui/${ns}`;
    const hasCta = ctaLabel && ctaTarget;
    const content: string[] = [];
    const elements: Record<string, Record<string, unknown>> = {};

    if (icon) {
      content.push(`${ns}-icon`);
      elements[`${ns}-icon`] = { type: "Icon", props: { name: icon, size: 16, color: null, strokeWidth: null, className: "shrink-0" } };
    }
    content.push(`${ns}-message`);
    elements[`${ns}-message`] = { type: "Text", props: { text: message, variant: "body", className: "text-current" } };
    if (code) {
      content.push(`${ns}-code`);
      elements[`${ns}-code`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center", className: "rounded border border-current/30 py-0.5 pl-2 pr-0.5 font-mono text-xs font-medium" },
        children: [`${ns}-code-text`, `${ns}-code-copy`],
      };
      elements[`${ns}-code-text`] = { type: "Text", props: { text: code, variant: "body", className: "text-current" } };
      // The coupon code is copyable — CopyButton (icon-only ghost inherits the bar's color).
      elements[`${ns}-code-copy`] = { type: "CopyButton", props: { text: code, label: null, variant: "ghost", className: "size-6" } };
    }
    if (hasCta) {
      content.push(`${ns}-cta`);
      elements[`${ns}-cta`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", clickable: true, className: "cursor-pointer" },
        on: { press: { action: "ui.navigate", params: { to: ctaTarget } } },
        children: [`${ns}-cta-text`],
      };
      elements[`${ns}-cta-text`] = { type: "Text", props: { text: ctaLabel, variant: "body", className: "font-medium text-current underline underline-offset-4" } };
    }

    elements[ns] = {
      type: "Stack",
      props: {
        direction: "horizontal",
        gap: "sm",
        align: "center",
        justify: "center",
        className: `relative w-full px-10 py-2 text-sm ${TONE[tone] ?? TONE.primary}`,
      },
      visible: { $state: `${ui}/dismissed`, eq: false },
      children: [...content, ...(dismissible ? [`${ns}-dismiss`] : [])],
    };
    if (dismissible) {
      elements[`${ns}-dismiss`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", justify: "center", clickable: true, className: "absolute right-3 cursor-pointer rounded p-1 opacity-70 hover:opacity-100" },
        on: { press: { action: "setState", params: { statePath: `${ui}/dismissed`, value: true } } },
        children: [`${ns}-dismiss-icon`],
      };
      elements[`${ns}-dismiss-icon`] = { type: "Icon", props: { name: "x", size: 16, color: null, strokeWidth: null, className: null } };
    }

    return {
      root: ns,
      elements: elements as unknown as ReturnType<Fragment<P>["build"]>["elements"],
      state: { ui: { [ns]: { dismissed: false } } },
    };
  },
};
