/**
 * FaqAccordion — a collapsible list of question/answer pairs (Accordion). Pure
 * presentational: the Q&A come from params, no entity. Use on storefront,
 * product, or support pages.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  title: z.string().nullable().default("Frequently asked questions").describe("Optional heading above the list; null hides it."),
  items: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .min(1)
    .describe("Q&A pairs."),
  type: z.enum(["single", "multiple"]).default("single").describe("single = one open at a time; multiple = independent toggles."),
});

type P = z.infer<typeof Params>;

export const FaqAccordion: Fragment<P> = {
  id: "fragment-faq-accordion",
  section: "discovery",
  name: "FAQ Accordion",
  version: "1.0.0",
  description:
    "Collapsible FAQ — question/answer pairs in an Accordion (single or multiple open). Presentational, content from params. Use on storefront, PDP, or support pages.",
  whenToUse:
    "Use to answer common questions in a compact expandable list (shipping/returns FAQ, product questions, support).",
  category: "display",
  previewParams: {
    items: [
      { question: "What is your return policy?", answer: "Returns are free within 30 days of delivery — items must be unused and in original packaging." },
      { question: "How long does shipping take?", answer: "Standard shipping is 5–7 business days; express is 2–3. You'll get a tracking link by email." },
      { question: "Do you ship internationally?", answer: "Yes — to 40+ countries. Duties and taxes are calculated at checkout." },
      { question: "Can I change or cancel my order?", answer: "Orders can be changed or cancelled within 1 hour of placing them, before they enter fulfillment." },
    ],
  },
  params: Params as z.ZodType<P>,
  build: ({ title, items, type }, ns) => {
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "vertical", gap: "md", className: "w-full max-w-2xl" },
        children: [...(title ? [`${ns}-title`] : []), `${ns}-accordion`],
      },
      [`${ns}-accordion`]: {
        type: "Accordion",
        props: { items: items.map((i) => ({ title: i.question, content: i.answer })), type },
      },
    };
    if (title) elements[`${ns}-title`] = { type: "Heading", props: { text: title, level: "h2", className: null } };
    return { root: ns, elements: elements as unknown as ReturnType<Fragment<P>["build"]>["elements"] };
  },
};
