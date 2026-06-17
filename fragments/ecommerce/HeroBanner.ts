/**
 * HeroBanner — a promotional hero, in two layouts (`layout`): "split" (copy
 * left, cover image right) and "overlay" (copy over a full-bleed image with a
 * gradient scrim). Optional eyebrow, subtitle, primary + secondary CTAs, image.
 * Pure display — no entities.
 *
 * v2 — modern rebuild: layout variant, eyebrow, dual CTAs, cover image
 * (aspectRatio/fit instead of a fixed 320×220), gradient scrim for overlay.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  eyebrow: z.string().nullable().default(null).describe("Small label above the headline, e.g. 'New collection'."),
  title: z.string().describe("Headline, e.g. 'Summer sale is live'."),
  subtitle: z.string().nullable().default(null).describe("Supporting copy under the headline."),
  ctaLabel: z.string().nullable().default(null).describe("Primary CTA label."),
  ctaTarget: z.string().nullable().default(null).describe("Page NAME the primary CTA navigates to."),
  secondaryLabel: z.string().nullable().default(null).describe("Optional secondary CTA label."),
  secondaryTarget: z.string().nullable().default(null).describe("Page NAME the secondary CTA navigates to."),
  imageUrl: z.string().nullable().default(null).describe("Hero image — the right column in 'split', the full-bleed background in 'overlay'."),
  layout: z.enum(["split", "overlay"]).default("overlay").describe("'overlay' (default) = copy over a full-bleed image with a scrim; 'split' = copy left + cover image right."),
});

type P = z.infer<typeof Params>;

export const HeroBanner: Fragment<P> = {
  id: "fragment-hero-banner",
  section: "discovery",
  name: "Hero Banner",
  version: "2.0.0",
  description:
    "Promotional hero in two layouts (split = copy + cover image; overlay = copy over a full-bleed image with scrim): optional eyebrow, headline, subtitle, primary + secondary CTAs, image. Pure display — no entities.",
  whenToUse:
    "Use for the top promotional banner of a landing/shop page: eyebrow + big headline + supporting copy + call-to-action(s), with an image beside or behind the copy.",
  category: "promotion",
  previewParams: {
    eyebrow: "New season",
    title: "Summer sale is live",
    subtitle: "Up to 40% off headphones and wearables this week.",
    ctaLabel: "Shop deals",
    ctaTarget: "Shop",
    secondaryLabel: "Browse all",
    secondaryTarget: "Shop",
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800",
  },
  params: Params as z.ZodType<P>,
  build: ({ eyebrow, title, subtitle, ctaLabel, ctaTarget, secondaryLabel, secondaryTarget, imageUrl, layout }, ns) => {
    const onDark = layout === "overlay";
    const elements: Record<string, Record<string, unknown>> = {};

    // Shared copy column.
    const copyChildren: string[] = [];
    if (eyebrow) {
      copyChildren.push(`${ns}-eyebrow`);
      elements[`${ns}-eyebrow`] = { type: "Text", props: { text: eyebrow, variant: "caption", className: `uppercase tracking-wide ${onDark ? "text-white/80" : "text-primary"}` } };
    }
    copyChildren.push(`${ns}-title`);
    elements[`${ns}-title`] = { type: "Heading", props: { text: title, level: "h1", className: onDark ? "text-white" : null } };
    if (subtitle) {
      copyChildren.push(`${ns}-subtitle`);
      elements[`${ns}-subtitle`] = { type: "Text", props: { text: subtitle, variant: "lead", className: onDark ? "text-white/90" : null } };
    }
    const hasPrimary = ctaLabel && ctaTarget;
    const hasSecondary = secondaryLabel && secondaryTarget;
    if (hasPrimary || hasSecondary) {
      copyChildren.push(`${ns}-cta-row`);
      elements[`${ns}-cta-row`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", className: "pt-2" },
        children: [...(hasPrimary ? [`${ns}-cta`] : []), ...(hasSecondary ? [`${ns}-cta2`] : [])],
      };
      if (hasPrimary) elements[`${ns}-cta`] = { type: "Button", props: { label: ctaLabel, variant: "primary", disabled: null }, on: { press: { action: "ui.navigate", params: { to: ctaTarget } } } };
      if (hasSecondary) elements[`${ns}-cta2`] = { type: "Button", props: { label: secondaryLabel, variant: "secondary", disabled: null }, on: { press: { action: "ui.navigate", params: { to: secondaryTarget } } } };
    }
    elements[`${ns}-copy`] = { type: "Stack", props: { direction: "vertical", gap: "md", className: onDark ? "relative z-10 max-w-xl" : "max-w-xl" }, children: copyChildren };

    if (layout === "overlay") {
      elements[ns] = {
        type: "Stack",
        props: { direction: "vertical", gap: "none", justify: "center", className: "relative min-h-[360px] w-full overflow-hidden rounded-2xl bg-muted p-10" },
        children: [...(imageUrl ? [`${ns}-image`, `${ns}-scrim`] : []), `${ns}-copy`],
      };
      if (imageUrl) {
        elements[`${ns}-image`] = { type: "Image", props: { src: imageUrl, alt: title, aspectRatio: null, fit: "cover", width: null, height: null, className: "absolute inset-0 h-full w-full" } };
        elements[`${ns}-scrim`] = { type: "Stack", props: { direction: "vertical", gap: "none", className: "absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-transparent" } };
      }
    } else {
      elements[ns] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "xl", align: "center", justify: "between", className: "w-full overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-background to-background p-10" },
        children: [`${ns}-copy`, ...(imageUrl ? [`${ns}-image-wrap`] : [])],
      };
      if (imageUrl) {
        elements[`${ns}-image-wrap`] = { type: "Stack", props: { direction: "vertical", gap: "none", className: "min-w-[280px] flex-1" }, children: [`${ns}-image`] };
        elements[`${ns}-image`] = { type: "Image", props: { src: imageUrl, alt: title, aspectRatio: "4/3", fit: "cover", width: null, height: null, className: "rounded-xl" } };
      }
    }

    return { root: ns, elements: elements as unknown as ReturnType<Fragment<P>["build"]>["elements"] };
  },
};
