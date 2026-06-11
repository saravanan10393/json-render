/**
 * ProductFilters — faceted filter panel for a sibling ProductGrid. Writes
 * every input to /filters/<targetGridNs>/* ; the grid's bdo.list declares
 * $state refs on those paths and auto-refires (debounced) on change.
 *
 * This fragment OWNS the /filters/<targetGridNs> seed (search/category/price
 * defaults) — the grid deliberately seeds nothing there so the two compose
 * without state collisions.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  targetGridNs: z
    .string()
    .describe("Element key (ns) of the ProductGrid these filters drive."),
  categories: z
    .array(z.string())
    .default([])
    .describe(
      "Category options (Product.Category values). Empty = no category facet.",
    ),
  showSearch: z.boolean().default(true),
  showPriceRange: z.boolean().default(true),
  title: z.string().default("Filters"),
});

type P = z.infer<typeof Params>;

export const ProductFilters: Fragment<P> = {
  name: "ProductFilters",
  version: "1.0.0",
  description:
    "Faceted filter panel (search, category, min/max price) for a sibling ProductGrid — writes to /filters/<targetGridNs>/*. Place in a sidebar column next to the grid. Requires Product fields: Category (when categories given), Price.",
  whenToUse:
    "Use when a product listing needs faceted filtering: text search, category dropdown, min/max price range. Place beside or above a ProductGrid.",
  category: "browse",
  previewParams: {
    targetGridNs: "products-grid",
    categories: ["Audio", "Wearables", "Accessories"],
  },
  params: Params as z.ZodType<P>,
  build: ({ targetGridNs, categories, showSearch, showPriceRange, title }, ns) => {
    const filters = `/filters/${targetGridNs}`;
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
            ...(showPriceRange ? [`${ns}-min-price`, `${ns}-max-price`] : []),
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
                type: "Select",
                props: {
                  label: "Category",
                  name: `${ns}-category`,
                  options: ["All", ...categories],
                  placeholder: "All",
                  value: { $bindState: `${filters}/category` },
                },
              },
            }
          : {}),
        ...(showPriceRange
          ? {
              [`${ns}-min-price`]: {
                type: "InputGroup",
                props: {
                  prefix: "$",
                  suffix: null,
                  placeholder: "Min price",
                  type: "number",
                  name: `${ns}-min`,
                  value: { $bindState: `${filters}/minPrice` },
                },
              },
              [`${ns}-max-price`]: {
                type: "InputGroup",
                props: {
                  prefix: "$",
                  suffix: null,
                  placeholder: "Max price",
                  type: "number",
                  name: `${ns}-max`,
                  value: { $bindState: `${filters}/maxPrice` },
                },
              },
            }
          : {}),
        [`${ns}-clear`]: {
          type: "Button",
          props: { label: "Clear filters", variant: "secondary", disabled: null },
          on: {
            press: {
              action: "setState",
              params: {
                statePath: filters,
                value: { search: "", category: "All", minPrice: "", maxPrice: "" },
              },
            },
          },
        },
      },
      state: {
        filters: {
          [targetGridNs]: {
            search: "",
            category: "All",
            minPrice: "",
            maxPrice: "",
          },
        },
      },
    };
  },
};
