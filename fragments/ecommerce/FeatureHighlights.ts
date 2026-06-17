/**
 * FeatureHighlights — a row of value-proposition cards: a lucide icon in a
 * tinted badge, a title, and a line of supporting text. Optional centered
 * section title. Pure display — no entities.
 *
 * v2 — quality pass: lucide `Icon` badges (was emoji glyphs), softer tile, and
 * previewParams so it renders in the gallery.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  sectionTitle: z.string().nullable().default(null).describe("Optional centered section title above the cards."),
  items: z
    .array(
      z.object({
        icon: z.string().describe("lucide icon name (kebab-case), e.g. 'truck', 'shield-check'."),
        title: z.string(),
        description: z.string(),
      }),
    )
    .min(1)
    .max(6)
    .describe("Feature items."),
  columns: z.number().int().min(1).max(4).default(3),
});

type P = z.infer<typeof Params>;

export const FeatureHighlights: Fragment<P> = {
  id: "fragment-feature-highlights",
  section: "discovery",
  name: "Feature Highlights",
  version: "2.0.0",
  description:
    "A grid of value-proposition cards — lucide icon badge + title + supporting line, with an optional centered section title. Pure display, no entities.",
  whenToUse:
    "Use to showcase product features, benefits, or store value props on landing/marketing/PDP pages. For the compact free-shipping/returns icon row use Incentives Bar.",
  category: "display",
  previewParams: {
    sectionTitle: "Why shop with us",
    items: [
      { icon: "truck", title: "Free shipping", description: "On all orders over $50, delivered in 2–5 days." },
      { icon: "rotate-ccw", title: "30-day returns", description: "Not the right fit? Send it back, free." },
      { icon: "shield-check", title: "Secure checkout", description: "256-bit encryption on every transaction." },
    ],
    columns: 3,
  },
  params: Params as z.ZodType<P>,
  build: ({ sectionTitle, items, columns }, ns) => {
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "vertical", gap: "lg", align: "stretch", className: "w-full" },
        children: [...(sectionTitle ? [`${ns}-title`] : []), `${ns}-grid`],
      },
      [`${ns}-grid`]: { type: "Grid", props: { columns, gap: "lg" }, children: items.map((_, i) => `${ns}-card-${i}`) },
    };
    if (sectionTitle) {
      elements[`${ns}-title`] = { type: "Heading", props: { text: sectionTitle, level: "h2", className: "text-center" } };
    }

    items.forEach((item, i) => {
      elements[`${ns}-card-${i}`] = {
        type: "Stack",
        props: { direction: "vertical", gap: "sm", align: "start", className: "rounded-xl border border-border bg-card p-5" },
        children: [`${ns}-icon-${i}`, `${ns}-title-${i}`, `${ns}-desc-${i}`],
      };
      elements[`${ns}-icon-${i}`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", justify: "center", className: "size-10 rounded-lg bg-primary/10" },
        children: [`${ns}-glyph-${i}`],
      };
      elements[`${ns}-glyph-${i}`] = { type: "Icon", props: { name: item.icon, size: 20, color: "var(--primary)", strokeWidth: null, className: null } };
      elements[`${ns}-title-${i}`] = { type: "Heading", props: { text: item.title, level: "h4", className: null } };
      elements[`${ns}-desc-${i}`] = { type: "Text", props: { text: item.description, variant: "muted", className: "leading-relaxed" } };
    });

    return { root: ns, elements: elements as unknown as ReturnType<Fragment<P>["build"]>["elements"] };
  },
};
