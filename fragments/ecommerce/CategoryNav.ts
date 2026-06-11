/**
 * CategoryNav — horizontal category pills that drive a sibling ProductGrid's
 * category filter by writing to /filters/<targetGridNs>/category.
 *
 * The runtime prunes EQ filters whose bound value is "All", so selecting
 * "All" relaxes the category filter.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  targetGridNs: z
    .string()
    .describe(
      "Element key (ns) of the ProductGrid instance these pills control.",
    ),
  categories: z
    .array(z.string())
    .min(1)
    .describe("Category values, matching the Product entity's Category field."),
  includeAll: z
    .boolean()
    .default(true)
    .describe("Prepend an 'All' pill that clears the category filter."),
});

type P = z.infer<typeof Params>;

export const CategoryNav: Fragment<P> = {
  name: "CategoryNav",
  version: "1.0.0",
  description:
    "Horizontal category pill bar. Writes the picked category to /filters/<targetGridNs>/category so the target ProductGrid auto-refilters. Requires the grid's Product entity to have a Category field.",
  whenToUse:
    "Use when products should be browsable by category with one-click pills above a product grid (electronics departments, clothing types, menu sections).",
  category: "browse",
  previewParams: {
    targetGridNs: "products-grid",
    categories: ["Audio", "Wearables", "Accessories"],
  },
  params: Params as z.ZodType<P>,
  build: ({ targetGridNs, categories, includeAll }, ns) => ({
    root: ns,
    elements: {
      [ns]: {
        type: "ButtonGroup",
        props: {
          buttons: [
            ...(includeAll ? [{ label: "All", value: "All" }] : []),
            ...categories.map((c) => ({ label: c, value: c })),
          ],
          selected: { $bindState: `/filters/${targetGridNs}/category` },
        },
      },
    },
  }),
};
