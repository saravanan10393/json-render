/**
 * FeatureHighlights — a row of feature cards with icon, title, and description.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  sectionTitle: z
    .string()
    .optional()
    .describe("Optional centered section title displayed above the feature cards."),
  items: z
    .array(
      z.object({
        icon: z.string().describe("Icon text (emoji or 1-2 letter glyph)."),
        title: z.string().describe("Feature title."),
        description: z.string().describe("One line of supporting text."),
      })
    )
    .min(1)
    .max(6)
    .default([
      {
        icon: "⚡",
        title: "Lightning Fast",
        description: "Optimized for speed and performance",
      },
      {
        icon: "🔒",
        title: "Secure by Default",
        description: "Enterprise-grade security built in",
      },
      {
        icon: "🎨",
        title: "Beautiful Design",
        description: "Stunning UI that users love",
      },
    ])
    .describe("Feature items to display."),
  columns: z
    .number()
    .int()
    .min(1)
    .max(6)
    .default(3)
    .describe("Number of columns in the grid."),
});

type P = z.infer<typeof Params>;

export const FeatureHighlights: Fragment<P> = {
  name: "FeatureHighlights",
  version: "1.0.1",
  description:
    "Feature highlights — a grid of feature cards with icon badge, title, and supporting text. Optional centered section title. Pure display — no entities required.",
  whenToUse:
    "Use to showcase product features, benefits, or highlights on landing pages, marketing pages, or product detail pages. No data required.",
  category: "display",
  params: Params as z.ZodType<P>,
  build: ({ sectionTitle, items, columns }, ns) => {
    const elements: Record<string, any> = {};
    const rootChildren: string[] = [];

    // Add optional section title
    if (sectionTitle) {
      const titleKey = `${ns}-section-title`;
      elements[titleKey] = {
        type: "Heading",
        props: { text: sectionTitle, level: "h2" },
      };
      rootChildren.push(titleKey);
    }

    // Add the grid
    const gridKey = `${ns}-grid`;
    elements[gridKey] = {
      type: "Grid",
      props: { columns, gap: "lg" },
      children: items.map((_, i) => `${ns}-card-${i}`),
    };
    rootChildren.push(gridKey);

    // Root stack
    elements[ns] = {
      type: "Stack",
      props: { 
        direction: "vertical", 
        gap: "xl", 
        align: "center", 
        justify: null, 
        className: null, 
        style: null 
      },
      children: rootChildren,
    };

    // Build feature cards
    items.forEach((item, i) => {
      const cardKey = `${ns}-card-${i}`;
      const stackKey = `${ns}-stack-${i}`;
      const iconKey = `${ns}-icon-${i}`;
      const titleKey = `${ns}-title-${i}`;
      const descKey = `${ns}-desc-${i}`;

      elements[cardKey] = {
        type: "Card",
        props: { title: null, description: null, maxWidth: null, centered: false, className: null },
        children: [stackKey],
      };

      elements[stackKey] = {
        type: "Stack",
        props: { direction: "vertical", gap: "md", align: "start", justify: null, className: null, style: null },
        children: [iconKey, titleKey, descKey],
      };

      elements[iconKey] = {
        type: "Badge",
        props: { text: item.icon, variant: "secondary" },
      };

      elements[titleKey] = {
        type: "Heading",
        props: { text: item.title, level: "h3" },
      };

      elements[descKey] = {
        type: "Text",
        props: { text: item.description, variant: "muted" },
      };
    });

    return { root: ns, elements };
  },
};
