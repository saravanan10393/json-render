/**
 * ProductFilters — faceted filter panel for a sibling ProductGrid. Writes every
 * input to /filters/<targetGridNs>/* ; the grid's bdo.list declares $state refs
 * on those paths and auto-refires (debounced) on change.
 *
 * Shared filter contract (this panel OWNS the seed; the grid seeds nothing
 * there so the two compose without state collisions):
 *   /filters/<gridNs>/search      — string
 *   /filters/<gridNs>/category    — string ("All" = no facet; pruned by the grid)
 *   /filters/<gridNs>/priceRange  — [min, max] tuple (RangeSlider)
 *
 * v1.1 — price min/max → a single RangeSlider tuple; category dropdown → pills.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  targetGridNs: z.string().describe("Element key (ns) of the ProductGrid these filters drive."),
  categories: z
    .array(z.string())
    .default([])
    .describe("Category options (Product.Category values). Empty = no category facet."),
  showSearch: z.boolean().default(true),
  showPriceRange: z.boolean().default(true),
  priceMin: z.number().default(0).describe("Price slider lower bound."),
  priceMax: z.number().default(1000).describe("Price slider upper bound."),
  priceStep: z.number().default(10).describe("Price slider step."),
  title: z.string().default("Filters"),
});

type P = z.infer<typeof Params>;

export const ProductFilters: Fragment<P> = {
  id: "fragment-product-filters",
  section: "browse",
  name: "Product Filters",
  version: "1.1.0",
  description:
    "Faceted filter panel (search, category pills, price RangeSlider) for a sibling ProductGrid — writes to /filters/<targetGridNs>/{search,category,priceRange}. Place in a sidebar column next to the grid. Requires Product fields: Category (when categories given), Price.",
  whenToUse:
    "Use when a product listing needs faceted filtering: text search, category selection, a min/max price range slider. Place beside or above a ProductGrid.",
  category: "browse",
  previewParams: {
    targetGridNs: "products-grid",
    categories: ["Audio", "Wearables", "Accessories"],
    priceMax: 500,
  },
  params: Params as z.ZodType<P>,
  build: ({ targetGridNs, categories, showSearch, showPriceRange, priceMin, priceMax, priceStep, title }, ns) => {
    const filters = `/filters/${targetGridNs}`;
    const defaults = { search: "", category: "All", priceRange: [priceMin, priceMax] };

    return {
      root: ns,
      elements: {
        [ns]: {
          type: "Card",
          props: { title, maxWidth: null, centered: null, description: null, className: null },
          children: [`${ns}-body`],
        },
        [`${ns}-body`]: {
          type: "Stack",
          props: { direction: "vertical", gap: "lg" },
          children: [
            ...(showSearch ? [`${ns}-search`] : []),
            ...(categories.length > 0 ? [`${ns}-category`] : []),
            ...(showPriceRange ? [`${ns}-price`] : []),
            `${ns}-clear`,
          ],
        },
        ...(showSearch
          ? {
              [`${ns}-search`]: {
                type: "Input",
                props: {
                  label: "Search",
                  name: `${ns}-search`,
                  type: "text",
                  placeholder: "Search products…",
                  value: { $bindState: `${filters}/search` },
                },
              },
            }
          : {}),
        ...(categories.length > 0
          ? {
              [`${ns}-category`]: {
                type: "Stack",
                props: { direction: "vertical", gap: "sm" },
                children: [`${ns}-category-label`, `${ns}-category-pills`],
              },
              [`${ns}-category-label`]: {
                type: "Text",
                props: { text: "Category", variant: "caption", className: "uppercase tracking-wide text-muted-foreground" },
              },
              [`${ns}-category-pills`]: {
                type: "ToggleGroup",
                props: {
                  type: "single",
                  value: { $bindState: `${filters}/category` },
                  items: [
                    { label: "All", value: "All" },
                    ...categories.map((c) => ({ label: c, value: c })),
                  ],
                },
              },
            }
          : {}),
        ...(showPriceRange
          ? {
              [`${ns}-price`]: {
                type: "RangeSlider",
                props: {
                  label: "Price",
                  value: { $bindState: `${filters}/priceRange` },
                  min: priceMin,
                  max: priceMax,
                  step: priceStep,
                  minGap: null,
                  name: `${ns}-price`,
                  className: null,
                },
              },
            }
          : {}),
        [`${ns}-clear`]: {
          type: "Button",
          props: { label: "Clear filters", variant: "secondary", disabled: null },
          on: {
            press: { action: "setState", params: { statePath: filters, value: defaults } },
          },
        },
      },
      state: {
        filters: {
          [targetGridNs]: defaults,
        },
      },
    };
  },
};
