/**
 * ProductGrid — responsive grid of product cards backed by a bdo.list.
 *
 * Reads filter state from /filters/<ns>/* (search, category, minPrice,
 * maxPrice) — pair with ProductFilters / CategoryNav siblings pointed at this
 * instance's ns. The grid itself seeds NO filter state (the filter fragments
 * own those seeds) so composition is collision-free.
 *
 * Includes per-card add-to-cart (bdo.save into the cart entity) and an
 * optional detail Sheet driven by /ui/<ns>/selected + /ui/<ns>/detailOpen.
 * Repeat-scope writes go through the two-step pattern: setState the $item
 * into /ui/<ns>/* first, then datasource.fire reads it back via $state.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  productBdo: z.string().default("Product").describe("Product entity name."),
  cartBdo: z.string().default("CartItem").describe("Cart line-item entity name."),
  columns: z.number().int().min(2).max(4).default(3),
  pageSize: z.number().int().min(4).max(48).default(12),
  sortField: z.string().default("Name").describe("Product field to sort by."),
  sortDirection: z.enum(["ASC", "DESC"]).default("ASC"),
  showAddToCart: z.boolean().default(true),
  withDetailSheet: z
    .boolean()
    .default(true)
    .describe("Adds a per-product detail Sheet opened from each card."),
  cartRefresh: z
    .array(z.string())
    .default([])
    .describe(
      "SAME-PAGE datasource names to re-fire after an add-to-cart (e.g. a CartSummary instance's '<cartNs>-items').",
    ),
});

type P = z.infer<typeof Params>;

export const ProductGrid: Fragment<P> = {
  name: "ProductGrid",
  version: "1.0.0",
  description:
    "Product card grid over bdo.list with image, name, category, price, rating, add-to-cart, and optional detail Sheet. Filterable via /filters/<ns>/* (pair with ProductFilters/CategoryNav). Requires Product fields: Name, Description, Price, Category, ImageUrl, Rating. Cart entity fields: ProductId, Name, Price, Quantity, LineTotal.",
  category: "product-display",
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const {
      productBdo,
      cartBdo,
      columns,
      pageSize,
      sortField,
      sortDirection,
      showAddToCart,
      withDetailSheet,
      cartRefresh,
    } = params;
    const ui = `/ui/${ns}`;
    const filters = `/filters/${ns}`;
    const ds = `${ns}-products`;

    // In ACTION params {$item} resolves to the item's state PATH, not its
    // value — copying fields via $template bare-name interpolation is the
    // reliable repeat-scope → state transfer (values arrive as strings; the
    // executor coerces numerics).
    const itemSnapshot = {
      ProductId: { $template: "${_id}" },
      Name: { $template: "${Name}" },
      Description: { $template: "${Description}" },
      Category: { $template: "${Category}" },
      ImageUrl: { $template: "${ImageUrl}" },
      Price: { $template: "${Price}" },
      Rating: { $template: "${Rating}" },
    };

    const addToCartAction = (sourceExpr: unknown) => [
      {
        action: "setState",
        params: { statePath: `${ui}/pending`, value: sourceExpr },
      },
      { action: "datasource.fire", params: { name: `${ns}-add-to-cart` } },
    ];

    return {
      root: ns,
      elements: {
        [ns]: {
          type: "Stack",
          props: { direction: "vertical", gap: "md" },
          children: [
            `${ns}-toolbar`,
            `${ns}-grid`,
            `${ns}-empty`,
            ...(withDetailSheet ? [`${ns}-sheet`] : []),
          ],
        },
        [`${ns}-toolbar`]: {
          type: "Stack",
          props: { direction: "horizontal", justify: "between", align: "center" },
          children: [`${ns}-count`],
        },
        [`${ns}-count`]: {
          type: "Text",
          props: {
            text: { $template: `\${/queries/${ds}/page/total} products` },
            variant: "muted",
          },
        },
        [`${ns}-grid`]: {
          type: "Grid",
          props: { columns, gap: "md" },
          repeat: { statePath: `/queries/${ds}/data`, key: "_id" },
          children: [`${ns}-card`],
        },
        [`${ns}-card`]: {
          type: "Stack",
          props: {
            direction: "vertical",
            gap: "sm",
            className: "rounded-xl border border-border bg-card p-4",
          },
          children: [
            `${ns}-card-image`,
            `${ns}-card-name`,
            `${ns}-card-category`,
            `${ns}-card-rating`,
            `${ns}-card-footer`,
          ],
        },
        [`${ns}-card-image`]: {
          type: "Image",
          props: {
            src: { $item: "ImageUrl" },
            alt: { $item: "Name" },
            width: 280,
            height: 180,
          },
        },
        [`${ns}-card-name`]: {
          type: "Heading",
          props: { text: { $item: "Name" }, level: "h4" },
        },
        [`${ns}-card-category`]: {
          type: "Text",
          props: { text: { $item: "Category" }, variant: "muted" },
        },
        [`${ns}-card-rating`]: {
          type: "Rating",
          props: {
            value: { $item: "Rating" },
            max: 5,
            symbol: null,
            icons: null,
            readOnly: true,
            name: null,
          },
        },
        [`${ns}-card-footer`]: {
          type: "Stack",
          props: { direction: "horizontal", justify: "between", align: "center" },
          children: [`${ns}-card-price`, `${ns}-card-actions`],
        },
        [`${ns}-card-price`]: {
          type: "Stack",
          props: { direction: "horizontal", gap: "none", align: "center" },
          children: [`${ns}-card-price-symbol`, `${ns}-card-price-value`],
        },
        [`${ns}-card-price-symbol`]: {
          type: "Text",
          props: { text: "$", variant: "lead" },
        },
        [`${ns}-card-price-value`]: {
          type: "Text",
          props: { text: { $item: "Price" }, variant: "lead" },
        },
        [`${ns}-card-actions`]: {
          type: "Stack",
          props: { direction: "horizontal", gap: "sm" },
          children: [
            ...(withDetailSheet ? [`${ns}-card-view`] : []),
            ...(showAddToCart ? [`${ns}-card-add`] : []),
          ],
        },
        ...(withDetailSheet
          ? {
              [`${ns}-card-view`]: {
                type: "Button",
                props: { label: "View", variant: "secondary", disabled: null },
                on: {
                  press: [
                    {
                      action: "setState",
                      params: { statePath: `${ui}/selected`, value: itemSnapshot },
                    },
                    {
                      action: "setState",
                      params: { statePath: `${ui}/detailOpen`, value: true },
                    },
                  ],
                },
              },
            }
          : {}),
        ...(showAddToCart
          ? {
              [`${ns}-card-add`]: {
                type: "Button",
                props: { label: "Add to cart", variant: "primary", disabled: null },
                on: { press: addToCartAction(itemSnapshot) },
              },
            }
          : {}),
        [`${ns}-empty`]: {
          type: "Empty",
          props: {
            title: "No products found",
            description: "Try adjusting the filters or search.",
          },
          visible: { $state: `/queries/${ds}/page/total`, eq: 0 },
        },
        ...(withDetailSheet
          ? {
              [`${ns}-sheet`]: {
                type: "Sheet",
                props: {
                  title: { $template: `\${${ui}/selected/Name}` },
                  description: null,
                  side: "right",
                  openPath: `${ui}/detailOpen`,
                },
                children: [`${ns}-sheet-body`],
              },
              [`${ns}-sheet-body`]: {
                type: "Stack",
                props: { direction: "vertical", gap: "md" },
                children: [
                  `${ns}-sheet-image`,
                  `${ns}-sheet-category`,
                  `${ns}-sheet-description`,
                  `${ns}-sheet-rating`,
                  `${ns}-sheet-footer`,
                ],
              },
              [`${ns}-sheet-image`]: {
                type: "Image",
                props: {
                  src: { $state: `${ui}/selected/ImageUrl` },
                  alt: { $state: `${ui}/selected/Name` },
                  width: 360,
                  height: 240,
                },
              },
              [`${ns}-sheet-category`]: {
                type: "Badge",
                props: {
                  text: { $state: `${ui}/selected/Category` },
                  variant: "secondary",
                },
              },
              [`${ns}-sheet-description`]: {
                type: "Text",
                props: {
                  text: { $state: `${ui}/selected/Description` },
                  variant: "body",
                },
              },
              [`${ns}-sheet-rating`]: {
                type: "Rating",
                props: {
                  value: { $state: `${ui}/selected/Rating` },
                  max: 5,
                  symbol: null,
                  icons: null,
                  readOnly: true,
                  name: null,
                },
              },
              [`${ns}-sheet-footer`]: {
                type: "Stack",
                props: {
                  direction: "horizontal",
                  justify: "between",
                  align: "center",
                },
                children: [`${ns}-sheet-price`, `${ns}-sheet-add`],
              },
              [`${ns}-sheet-price`]: {
                type: "Text",
                props: {
                  text: { $template: `$\${${ui}/selected/Price}` },
                  variant: "lead",
                },
              },
              [`${ns}-sheet-add`]: {
                type: "Button",
                props: { label: "Add to cart", variant: "primary", disabled: null },
                // selected is a plain string-field snapshot — reuse it directly
                on: { press: addToCartAction({ $state: `${ui}/selected` }) },
              },
            }
          : {}),
      },
      state: {
        ui: {
          [ns]: { detailOpen: false, selected: null, pending: null },
        },
      },
      datasources: {
        [ds]: {
          type: "bdo.list",
          params: {
            bdo: productBdo,
            Search: { $state: `${filters}/search` },
            Filter: {
              Operator: "AND",
              Condition: [
                {
                  LHSField: "Category",
                  Operator: "EQ",
                  RHSValue: { $state: `${filters}/category` },
                },
                {
                  LHSField: "Price",
                  Operator: "GTE",
                  RHSValue: { $state: `${filters}/minPrice` },
                },
                {
                  LHSField: "Price",
                  Operator: "LTE",
                  RHSValue: { $state: `${filters}/maxPrice` },
                },
              ],
            },
            Sort: [{ [sortField]: sortDirection }],
            Page: { number: 1, size: pageSize },
          },
          debounceMs: 300,
        },
        [`${ns}-add-to-cart`]: {
          type: "bdo.save",
          params: {
            bdo: cartBdo,
            values: {
              ProductId: { $state: `${ui}/pending/_id` },
              Name: { $state: `${ui}/pending/Name` },
              Price: { $state: `${ui}/pending/Price` },
              Quantity: 1,
              LineTotal: { $state: `${ui}/pending/Price` },
            },
          },
          refresh: cartRefresh,
          on: {
            success: [
              {
                action: "ui.toast",
                params: { message: "Added to cart", kind: "success" },
              },
            ],
          },
        },
      },
      init: [{ action: "datasource.refresh", params: { names: [ds] } }],
    };
  },
};
