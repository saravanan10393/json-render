/**
 * TestimonialStrip — social-proof cards: per testimonial an optional star
 * rating, the quote, and an author row (avatar initials + name + role). Pure
 * display — no entities.
 *
 * v2 — quality pass: star Rating + Avatar author row (was a plain separator
 * layout), and previewParams so it renders in the gallery.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  title: z.string().nullable().default("What our customers say").describe("Section heading; null hides it."),
  testimonials: z
    .array(
      z.object({
        quote: z.string(),
        name: z.string(),
        role: z.string().nullable(),
        rating: z.number().nullable(),
      }),
    )
    .min(1)
    .describe("Testimonials: quote, name, optional role, optional star rating (1-5)."),
  columns: z.number().int().min(1).max(3).default(3),
});

type P = z.infer<typeof Params>;

export const TestimonialStrip: Fragment<P> = {
  id: "fragment-testimonial-strip",
  section: "discovery",
  name: "Testimonial Strip",
  version: "2.0.0",
  description:
    "Social-proof cards — optional star rating, a quote, and an author row (avatar initials + name + role). Pure display, content from params.",
  whenToUse:
    "Use to show customer testimonials / social proof on landing, about, or product pages. For real product reviews backed by data use Review List / Review Summary.",
  category: "review",
  previewParams: {
    testimonials: [
      { quote: "This transformed our workflow — the team was responsive and the results beat expectations.", name: "Sarah Johnson", role: "VP Operations, Acme Corp", rating: 5 },
      { quote: "Outstanding quality and service. We've seen a 40% jump in efficiency since switching.", name: "Michael Chen", role: "CTO, TechStart", rating: 5 },
      { quote: "The best investment we've made this year. Highly recommended for any growing team.", name: "Emma Davis", role: "Founder, Growth Labs", rating: 4 },
    ],
    columns: 3,
  },
  params: Params as z.ZodType<P>,
  build: ({ title, testimonials, columns }, ns) => {
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "vertical", gap: "lg", align: "stretch", className: "w-full" },
        children: [...(title ? [`${ns}-title`] : []), `${ns}-grid`],
      },
      [`${ns}-grid`]: { type: "Grid", props: { columns, gap: "lg" }, children: testimonials.map((_, i) => `${ns}-card-${i}`) },
    };
    if (title) elements[`${ns}-title`] = { type: "Heading", props: { text: title, level: "h2", className: "text-center" } };

    testimonials.forEach((t, i) => {
      elements[`${ns}-card-${i}`] = {
        type: "Stack",
        props: { direction: "vertical", gap: "md", align: "start", justify: "between", className: "h-full rounded-xl border border-border bg-card p-5" },
        children: [...(t.rating != null ? [`${ns}-rating-${i}`] : []), `${ns}-quote-${i}`, `${ns}-author-${i}`],
      };
      if (t.rating != null) {
        elements[`${ns}-rating-${i}`] = { type: "Rating", props: { value: t.rating, max: 5, symbol: null, icons: null, readOnly: true, name: null } };
      }
      elements[`${ns}-quote-${i}`] = { type: "Text", props: { text: `“${t.quote}”`, variant: "body", className: "leading-relaxed" } };
      elements[`${ns}-author-${i}`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center" },
        children: [`${ns}-avatar-${i}`, `${ns}-author-meta-${i}`],
      };
      elements[`${ns}-avatar-${i}`] = { type: "Avatar", props: { src: null, name: t.name, size: "sm" } };
      elements[`${ns}-author-meta-${i}`] = {
        type: "Stack",
        props: { direction: "vertical", gap: "none" },
        children: [...(t.role != null ? [`${ns}-name-${i}`, `${ns}-role-${i}`] : [`${ns}-name-${i}`])],
      };
      elements[`${ns}-name-${i}`] = { type: "Text", props: { text: t.name, variant: "body", className: "font-medium" } };
      if (t.role != null) elements[`${ns}-role-${i}`] = { type: "Text", props: { text: t.role, variant: "caption", className: "text-muted-foreground" } };
    });

    return { root: ns, elements: elements as unknown as ReturnType<Fragment<P>["build"]>["elements"] };
  },
};
