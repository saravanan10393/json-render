/**
 * FilterSidebar — the faceted left-rail filter for a sibling ProductGrid (the
 * richer counterpart of the compact ProductFilters card). Facets only — NO
 * search (global search belongs in the header / a SearchBar block). Renders
 * disclosure sections: Category (multi-select checkboxes → array), Price
 * (RangeSlider), Rating ("N & up"). `mode` switches between an always-visible
 * left rail and a mobile slide-in Sheet.
 *
 * Shared filter contract (this panel OWNS its seeds; the grid seeds nothing):
 *   /filters/<gridNs>/categories  — string[]  (grid: Category IN […])
 *   /filters/<gridNs>/priceRange  — [min,max] (grid: Price GTE/LTE)
 *   /filters/<gridNs>/minRating   — string    (grid: Rating GTE)
 *
 * Pair with ProductGrid, which prunes any facet whose state is unset — so this
 * sidebar, the ProductFilters card, and a bare grid all target the same grid.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  targetGridNs: z.string().describe("Element key (ns) of the ProductGrid these filters drive."),
  categories: z
    .array(z.string())
    .default([])
    .describe("Category options (Product.Category values). Empty = no category facet."),
  showPrice: z.boolean().default(true),
  priceMin: z.number().default(0),
  priceMax: z.number().default(1000),
  priceStep: z.number().default(10),
  showRating: z.boolean().default(true),
  mode: z
    .enum(["sidebar", "drawer"])
    .default("drawer")
    .describe("'drawer' = a 'Filters' button opening a slide-in Sheet (default; mobile-friendly); 'sidebar' = an always-visible left rail."),
  title: z.string().default("Filters"),
});

type P = z.infer<typeof Params>;

export const FilterSidebar: Fragment<P> = {
  id: "fragment-filter-sidebar",
  section: "browse",
  name: "Filter Sidebar",
  version: "1.0.0",
  description:
    "Faceted filter rail for a sibling ProductGrid — collapsible Category (multi-select), Price (range slider), and Rating facets, plus Clear all. NO search (use a SearchBar/header for that). Writes /filters/<targetGridNs>/{categories,priceRange,minRating}. `mode` = sidebar (left rail) or drawer (mobile Sheet). Requires Product fields: Category, Price, Rating.",
  whenToUse:
    "Use for a storefront category/listing page that needs a left-pane faceted filter (multi-select categories, price range, rating) beside a ProductGrid. For a compact all-in-one filter with search use ProductFilters instead.",
  category: "browse",
  previewParams: {
    targetGridNs: "products-grid",
    categories: ["Audio", "Wearables", "Accessories", "Home"],
    priceMax: 500,
  },
  params: Params as z.ZodType<P>,
  build: ({ targetGridNs, categories, showPrice, priceMin, priceMax, priceStep, showRating, mode, title }, ns) => {
    const filters = `/filters/${targetGridNs}`;
    const defaults = { categories: [], priceRange: [priceMin, priceMax], minRating: "" };
    const isDrawer = mode === "drawer";

    const facetChildren = [
      ...(categories.length > 0 ? [`${ns}-facet-category`] : []),
      ...(showPrice ? [`${ns}-facet-price`] : []),
      ...(showRating ? [`${ns}-facet-rating`] : []),
      `${ns}-clear`,
    ];

    return {
      root: ns,
      elements: {
        [ns]: isDrawer
          ? {
              type: "Stack",
              props: { direction: "vertical", gap: "md" },
              children: [`${ns}-trigger`, `${ns}-sheet`],
            }
          : {
              type: "Stack",
              props: { direction: "vertical", gap: "md", className: "w-full" },
              children: [`${ns}-title`, `${ns}-facets`],
            },

        ...(isDrawer
          ? {
              [`${ns}-trigger`]: {
                type: "Button",
                props: { label: title, variant: "secondary", disabled: null },
                on: { press: { action: "setState", params: { statePath: `/ui/${ns}/open`, value: true } } },
              },
              [`${ns}-sheet`]: {
                type: "Sheet",
                props: { title, description: null, side: "left", openPath: `/ui/${ns}/open` },
                children: [`${ns}-facets`],
              },
            }
          : {
              [`${ns}-title`]: {
                type: "Heading",
                props: { text: title, level: "h3", className: null },
              },
            }),

        [`${ns}-facets`]: {
          type: "Stack",
          props: { direction: "vertical", gap: "lg" },
          children: facetChildren,
        },

        ...(categories.length > 0
          ? {
              [`${ns}-facet-category`]: {
                type: "Collapsible",
                props: { title: "Category", defaultOpen: true },
                children: [`${ns}-cb-category`],
              },
              [`${ns}-cb-category`]: {
                type: "CheckboxGroup",
                props: {
                  label: null,
                  options: categories,
                  value: { $bindState: `${filters}/categories` },
                  columns: null,
                  name: `${ns}-category`,
                  className: null,
                },
              },
            }
          : {}),

        ...(showPrice
          ? {
              [`${ns}-facet-price`]: {
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

        ...(showRating
          ? {
              [`${ns}-facet-rating`]: {
                type: "Collapsible",
                props: { title: "Rating", defaultOpen: true },
                children: [`${ns}-tg-rating`],
              },
              [`${ns}-tg-rating`]: {
                type: "ToggleGroup",
                props: {
                  type: "single",
                  value: { $bindState: `${filters}/minRating` },
                  items: [
                    { label: "4 & up", value: "4" },
                    { label: "3 & up", value: "3" },
                    { label: "2 & up", value: "2" },
                    { label: "1 & up", value: "1" },
                  ],
                },
              },
            }
          : {}),

        [`${ns}-clear`]: {
          type: "Button",
          props: { label: "Clear all", variant: "secondary", disabled: null },
          on: { press: { action: "setState", params: { statePath: filters, value: defaults } } },
        },
      },
      state: {
        filters: { [targetGridNs]: defaults },
        ui: { [ns]: { open: false } },
      },
    };
  },
};
