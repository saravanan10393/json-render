/**
 * HeroBanner — promotional hero with headline, supporting copy, and an
 * optional CTA button that navigates to another page of the app.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  title: z.string().describe("Headline, e.g. 'Summer sale is live'."),
  subtitle: z
    .string()
    .nullable()
    .default(null)
    .describe("Supporting copy under the headline."),
  ctaLabel: z.string().nullable().default(null).describe("CTA button label."),
  ctaTarget: z
    .string()
    .nullable()
    .default(null)
    .describe("Page NAME the CTA navigates to (ui.navigate target)."),
  imageUrl: z
    .string()
    .nullable()
    .default(null)
    .describe("Optional hero image shown beside the copy."),
});

type P = z.infer<typeof Params>;

export const HeroBanner: Fragment<P> = {
  name: "HeroBanner",
  version: "1.0.0",
  description:
    "Promotional hero banner: headline + subtitle + optional CTA button (navigates to a page) + optional image. Pure display — no entities required.",
  category: "promotion",
  params: Params as z.ZodType<P>,
  build: ({ title, subtitle, ctaLabel, ctaTarget, imageUrl }, ns) => ({
    root: ns,
    elements: {
      [ns]: {
        type: "Stack",
        props: {
          direction: "horizontal",
          gap: "xl",
          align: "center",
          justify: "between",
          className:
            "rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-background to-background p-10",
        },
        children: [
          `${ns}-copy`,
          ...(imageUrl ? [`${ns}-image`] : []),
        ],
      },
      [`${ns}-copy`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "md", className: "max-w-xl" },
        children: [
          `${ns}-title`,
          ...(subtitle ? [`${ns}-subtitle`] : []),
          ...(ctaLabel && ctaTarget ? [`${ns}-cta-row`] : []),
        ],
      },
      [`${ns}-title`]: {
        type: "Heading",
        props: { text: title, level: "h1" },
      },
      ...(subtitle
        ? {
            [`${ns}-subtitle`]: {
              type: "Text",
              props: { text: subtitle, variant: "lead" },
            },
          }
        : {}),
      ...(ctaLabel && ctaTarget
        ? {
            [`${ns}-cta-row`]: {
              type: "Stack",
              props: { direction: "horizontal", gap: "sm" },
              children: [`${ns}-cta`],
            },
            [`${ns}-cta`]: {
              type: "Button",
              props: { label: ctaLabel, variant: "primary" },
              on: {
                press: {
                  action: "ui.navigate",
                  params: { to: ctaTarget },
                },
              },
            },
          }
        : {}),
      ...(imageUrl
        ? {
            [`${ns}-image`]: {
              type: "Image",
              props: { src: imageUrl, alt: title, width: 320, height: 220 },
            },
          }
        : {}),
    },
  }),
};
