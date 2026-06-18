/**
 * FilterBar — the compact HORIZONTAL filter/sort bar for a sibling ProductGrid
 * (the minimal toolbar pattern: a Sort menu on the left, facet dropdowns on the
 * right). The space-saving counterpart of the FilterSidebar left rail and the
 * ProductFilters card. Each control lives in a Popover so the bar stays one row.
 *
 * Sort writes the full Sort array to /filters/<gridNs>/sort (the grid binds it
 * and seeds its own default). Facets reuse the grid's shared contract:
 *   /filters/<gridNs>/categories  (Category → grid Category IN […])
 *   /filters/<gridNs>/priceRange  (Price   → grid Price GTE/LTE)
 *   /filters/<gridNs>/minRating   (Rating  → grid Rating GTE)
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  targetGridNs: z.string().describe("Element key (ns) of the ProductGrid this bar drives."),
  sortOptions: z
    .array(z.object({ label: z.string(), field: z.string(), direction: z.enum(["ASC", "DESC"]) }))
    .default([
      { label: "Best Rating", field: "Rating", direction: "DESC" },
      { label: "Price: Low to High", field: "Price", direction: "ASC" },
      { label: "Price: High to Low", field: "Price", direction: "DESC" },
      { label: "Name: A to Z", field: "Name", direction: "ASC" },
    ])
    .describe("Sort menu options; each sets the grid's Sort to [{ field: direction }]."),
  categories: z
    .array(z.string())
    .default([])
    .describe("Category facet options (Product.Category values). Empty = no category facet."),
  showPrice: z.boolean().default(true),
  priceMin: z.number().default(0),
  priceMax: z.number().default(1000),
  priceStep: z.number().default(10),
  showRating: z.boolean().default(true),
});

type P = z.infer<typeof Params>;

export const ProductFilterBar: Fragment<P> = {
  id: "fragment-product-filter-bar",
  section: "browse",
  name: "Product Filter Bar",
  version: "1.0.0",
  description:
    "Compact horizontal filter/sort toolbar for a sibling ProductGrid: a Sort menu plus Category / Price / Rating facet dropdowns (each in a Popover). Writes /filters/<targetGridNs>/{sort,categories,priceRange,minRating}. The minimal alternative to FilterSidebar (left rail) and ProductFilters (card). Requires Product fields: Category, Price, Rating.",
  whenToUse:
    "Use for a category/listing page that wants a minimal one-row filter bar above the grid — a Sort dropdown on the left and facet dropdowns (Category, Price, Rating) on the right — instead of a left sidebar.",
  category: "browse",
  previewParams: {
    targetGridNs: "products-grid",
    categories: ["Audio", "Wearables", "Accessories", "Home"],
    priceMax: 500,
  },
  params: Params as z.ZodType<P>,
  build: ({ targetGridNs, sortOptions, categories, showPrice, priceMin, priceMax, priceStep, showRating }, ns) => {
    const filters = `/filters/${targetGridNs}`;

    // One clickable row per sort option (Popover children).
    const sortRows: Record<string, unknown> = {};
    const sortRowIds: string[] = [];
    sortOptions.forEach((opt, i) => {
      const rowId = `${ns}-sort-${i}`;
      const labelId = `${rowId}-label`;
      sortRowIds.push(rowId);
      sortRows[rowId] = {
        type: "Stack",
        props: { direction: "horizontal", clickable: true, className: "rounded-sm px-2 py-1.5" },
        on: { press: { action: "setState", params: { statePath: `${filters}/sort`, value: [{ [opt.field]: opt.direction }] } } },
        children: [labelId],
      };
      sortRows[labelId] = { type: "Text", props: { text: opt.label, variant: "body", className: null } };
    });

    const facetIds = [
      ...(categories.length > 0 ? [`${ns}-facet-category`] : []),
      ...(showPrice ? [`${ns}-facet-price`] : []),
      ...(showRating ? [`${ns}-facet-rating`] : []),
    ];

    const elements = {
        [ns]: {
          type: "Stack",
          props: { direction: "horizontal", justify: "between", align: "center", className: "w-full flex-wrap gap-2" },
          children: [`${ns}-sort`, `${ns}-facets`],
        },

        [`${ns}-sort`]: {
          type: "Popover",
          props: { trigger: "Sort", content: null, badge: null },
          children: [`${ns}-sort-list`],
        },
        [`${ns}-sort-list`]: {
          type: "Stack",
          props: { direction: "vertical", gap: "none" },
          children: sortRowIds,
        },
        ...sortRows,

        [`${ns}-facets`]: {
          type: "Stack",
          props: { direction: "horizontal", gap: "sm", align: "center", className: "flex-wrap" },
          children: facetIds,
        },

        ...(categories.length > 0
          ? {
              [`${ns}-facet-category`]: {
                type: "Popover",
                props: { trigger: "Category", content: null, badge: null },
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
                type: "Popover",
                props: { trigger: "Price", content: null, badge: null },
                children: [`${ns}-rs-price`],
              },
              [`${ns}-rs-price`]: {
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
                type: "Popover",
                props: { trigger: "Rating", content: null, badge: null },
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
    } as unknown as ReturnType<Fragment<P>["build"]>["elements"];
    return {
      root: ns,
      elements,
      state: {
        filters: {
          [targetGridNs]: { categories: [], priceRange: [priceMin, priceMax], minRating: "" },
        },
      },
    };
  },
};
