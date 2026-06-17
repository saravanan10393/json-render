/**
 * ProductGrid — product browsing block backed by a bdo.list, in TWO layouts
 * (a `layout` variant): "grid" (image-top cards, N columns) and "list"
 * (horizontal rows, image left / details right). One fragment, multiple looks.
 *
 * Reads filter state from /filters/<ns>/* (search, category, minPrice,
 * maxPrice) — pair with ProductFilters / CategoryNav siblings pointed at this
 * instance's ns. The grid itself seeds NO filter state (the filter fragments
 * own those seeds) so composition is collision-free.
 *
 * Per-card affordances: rating, price, optional wishlist (heart), add-to-cart
 * (bdo.save into the cart entity), and an optional detail Sheet driven by
 * /ui/<ns>/selected + /ui/<ns>/detailOpen. Repeat-scope writes use the two-step
 * pattern: setState the $item snapshot into /ui/<ns>/* first, then
 * datasource.fire reads it back via $state.
 *
 * v1.2 — added `layout` (grid|list) variant + `showWishlist`.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  productBdo: z.string().default("Product").describe("Product entity name."),
  cartBdo: z.string().default("CartItem").describe("Cart line-item entity name."),
  layout: z
    .enum(["grid", "list"])
    .default("grid")
    .describe("'grid' = image-top cards in N columns; 'list' = horizontal rows (image left, details right)."),
  columns: z.number().int().min(2).max(4).default(3).describe("Columns in 'grid' layout (ignored for 'list')."),
  pageSize: z.number().int().min(4).max(48).default(12),
  sortField: z.string().default("Name").describe("Product field to sort by."),
  sortDirection: z.enum(["ASC", "DESC"]).default("ASC"),
  ratingStyle: z
    .enum(["compact", "stars"])
    .default("compact")
    .describe("'compact' = a single star + numeric value pill (default); 'stars' = the full 5-star row."),
  showAddToCart: z.boolean().default(true),
  showWishlist: z
    .boolean()
    .default(false)
    .describe("Adds a heart button that saves the product to a wishlist (toasts; persists when wishlistBdo is set)."),
  wishlistBdo: z
    .string()
    .nullable()
    .default(null)
    .describe("Optional wishlist entity to persist favorites into (bdo.save of { ProductId, Name }). Toast-only when unset."),
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
  id: "fragment-product-grid",
  section: "browse",
  name: "Product Grid",
  version: "1.2.0",
  description:
    "Product browsing block over bdo.list with image, name, category, price, rating, optional wishlist + add-to-cart, and an optional detail Sheet. Two layouts via `layout`: grid (image-top cards) or list (horizontal rows). Filterable via /filters/<ns>/* (pair with ProductFilters/CategoryNav). Requires Product fields: Name, Description, Price, Category, ImageUrl, Rating. Cart entity fields: ProductId, Name, Price, Quantity, LineTotal.",
  whenToUse:
    "Use whenever the user wants to browse, search, or display a catalog of products — as a card grid or a row list — with images, prices, ratings, wishlist, add-to-cart, and a product-detail view.",
  category: "product-display",
  previewParams: { columns: 3, pageSize: 8, showWishlist: true },
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const {
      productBdo,
      cartBdo,
      layout,
      columns,
      pageSize,
      sortField,
      sortDirection,
      ratingStyle,
      showAddToCart,
      showWishlist,
      wishlistBdo,
      withDetailSheet,
      cartRefresh,
    } = params;
    const ui = `/ui/${ns}`;
    const filters = `/filters/${ns}`;
    const ds = `${ns}-products`;
    const isList = layout === "list";

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
      Stock: { $template: "${Stock}" },
    };

    // Two-step add-to-cart: snapshot the source, then stamp Quantity onto it,
    // then fire the save (which reads /ui/<ns>/pending/*). Quantity lives on the
    // pending snapshot so the grid (qty 1) and the Sheet (qty selector) share
    // one datasource without coupling.
    const addToCartAction = (sourceExpr: unknown, qtyExpr: unknown = 1) => [
      { action: "setState", params: { statePath: `${ui}/pending`, value: sourceExpr } },
      { action: "setState", params: { statePath: `${ui}/pending/Quantity`, value: qtyExpr } },
      { action: "datasource.fire", params: { name: `${ns}-add-to-cart` } },
    ];

    const wishlistTail = wishlistBdo
      ? { action: "datasource.fire", params: { name: `${ns}-wishlist` } }
      : { action: "ui.toast", params: { message: "Saved to wishlist", kind: "success" } };
    // Card heart is in repeat scope → capture via $template; the Sheet has no
    // item, so it copies the already-selected record instead.
    const wishlistAction = [
      { action: "setState", params: { statePath: `${ui}/pendingWish`, value: itemSnapshot } },
      wishlistTail,
    ];
    const sheetWishlistAction = [
      { action: "setState", params: { statePath: `${ui}/pendingWish`, value: { $state: `${ui}/selected` } } },
      wishlistTail,
    ];

    const cardClass = isList
      ? "group items-stretch overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-[box-shadow,border-color] duration-200 hover:border-foreground/15 hover:shadow-md"
      : "group overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-lg";

    return {
      root: ns,
      elements: {
        [ns]: {
          type: "Stack",
          props: { direction: "vertical", gap: "md" },
          children: [
            `${ns}-toolbar`,
            `${ns}-items`,
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
          props: { text: { $template: `\${/queries/${ds}/page/total} products` }, variant: "muted" },
        },
        // Container — Grid in 'grid', vertical Stack of rows in 'list'.
        [`${ns}-items`]: {
          type: isList ? "Stack" : "Grid",
          props: isList ? { direction: "vertical", gap: "md" } : { columns, gap: "lg" },
          repeat: { statePath: `/queries/${ds}/data`, key: "_id" },
          children: [`${ns}-card`],
        },
        [`${ns}-card`]: {
          type: "Stack",
          props: {
            direction: isList ? "horizontal" : "vertical",
            gap: "none",
            align: isList ? "stretch" : null,
            className: cardClass,
          },
          children: [`${ns}-card-imagearea`, `${ns}-card-body`],
        },
        // Image area is `relative` so the wishlist heart can overlay it.
        [`${ns}-card-imagearea`]: {
          type: "Stack",
          props: { direction: "vertical", gap: "none", className: isList ? "relative w-40 shrink-0" : "relative" },
          children: [`${ns}-card-image`, ...(showWishlist ? [`${ns}-card-wishlist`] : [])],
        },
        [`${ns}-card-image`]: {
          type: "Image",
          props: {
            src: { $item: "ImageUrl" },
            alt: { $item: "Name" },
            aspectRatio: isList ? "1/1" : "4/3",
            fit: "cover",
            width: null,
            height: null,
            className: isList ? "h-full" : null,
          },
        },
        ...(showWishlist
          ? {
              [`${ns}-card-wishlist`]: {
                type: "Stack",
                props: {
                  direction: "horizontal",
                  gap: "none",
                  align: "center",
                  justify: "center",
                  clickable: true,
                  className:
                    "absolute right-2 top-2 size-8 rounded-full bg-background/80 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-red-500",
                },
                on: { press: wishlistAction },
                children: [`${ns}-card-wishlist-icon`],
              },
              [`${ns}-card-wishlist-icon`]: {
                type: "Icon",
                props: { name: "heart", size: 16, color: null, strokeWidth: null, className: null },
              },
            }
          : {}),
        [`${ns}-card-body`]: {
          type: "Stack",
          props: { direction: "vertical", gap: "sm", className: isList ? "flex-1 px-4 py-3" : "px-4 py-3" },
          children: [`${ns}-card-meta`, `${ns}-card-rating`, `${ns}-card-footer`],
        },
        [`${ns}-card-meta`]: {
          type: "Stack",
          props: { direction: "vertical", gap: "none" },
          children: [`${ns}-card-category`, `${ns}-card-name`],
        },
        [`${ns}-card-category`]: {
          type: "Text",
          props: {
            text: { $item: "Category" },
            variant: "caption",
            className: "uppercase tracking-wide text-muted-foreground",
          },
        },
        [`${ns}-card-name`]: {
          type: "Heading",
          props: { text: { $item: "Name" }, level: "h4", className: null },
        },
        ...(ratingStyle === "compact"
          ? {
              [`${ns}-card-rating`]: {
                type: "Stack",
                props: { direction: "horizontal", gap: "none", align: "center", className: "inline-flex w-fit items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5" },
                children: [`${ns}-card-rating-star`, `${ns}-card-rating-value`],
              },
              [`${ns}-card-rating-star`]: { type: "Icon", props: { name: "star", size: 14, color: "#f59e0b", strokeWidth: null, className: null } },
              [`${ns}-card-rating-value`]: { type: "Text", props: { text: { $item: "Rating" }, variant: "caption", className: "font-medium text-amber-700 dark:text-amber-400" } },
            }
          : {
              [`${ns}-card-rating`]: {
                type: "Rating",
                props: { value: { $item: "Rating" }, max: 5, symbol: null, icons: null, readOnly: true, name: null },
              },
            }),
        [`${ns}-card-footer`]: {
          type: "Stack",
          props: { direction: "horizontal", justify: "between", align: "center", className: "pt-1" },
          children: [`${ns}-card-price`, `${ns}-card-actions`],
        },
        [`${ns}-card-price`]: {
          type: "Money",
          props: {
            value: { $item: "Price" },
            currency: null,
            locale: null,
            compareAt: null,
            showDiscount: null,
            size: "lg",
            className: null,
          },
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
                    { action: "setState", params: { statePath: `${ui}/selected`, value: itemSnapshot } },
                    { action: "setState", params: { statePath: `${ui}/qty`, value: 1 } },
                    { action: "setState", params: { statePath: `${ui}/detailOpen`, value: true } },
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
          props: { title: "No products found", description: "Try adjusting the filters or search." },
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
                  `${ns}-sheet-meta`,
                  `${ns}-sheet-rating`,
                  `${ns}-sheet-price`,
                  `${ns}-sheet-availability`,
                  `${ns}-sheet-description`,
                  `${ns}-sheet-sep`,
                  `${ns}-sheet-qty`,
                  `${ns}-sheet-actions`,
                ],
              },
              [`${ns}-sheet-image`]: {
                type: "Image",
                props: {
                  src: { $state: `${ui}/selected/ImageUrl` },
                  alt: { $state: `${ui}/selected/Name` },
                  aspectRatio: "4/3",
                  fit: "cover",
                  width: null,
                  height: null,
                  className: "rounded-lg",
                },
              },
              [`${ns}-sheet-meta`]: {
                type: "Badge",
                props: { text: { $state: `${ui}/selected/Category` }, variant: "secondary" },
              },
              [`${ns}-sheet-rating`]: {
                type: "Rating",
                props: { value: { $state: `${ui}/selected/Rating` }, max: 5, symbol: null, icons: null, readOnly: true, name: null },
              },
              [`${ns}-sheet-price`]: {
                type: "Money",
                props: {
                  value: { $state: `${ui}/selected/Price` },
                  currency: null,
                  locale: null,
                  compareAt: null,
                  showDiscount: null,
                  size: "xl",
                  className: null,
                },
              },
              [`${ns}-sheet-availability`]: {
                type: "Text",
                props: { text: { $template: `\${${ui}/selected/Stock} in stock` }, variant: "muted", className: null },
              },
              [`${ns}-sheet-description`]: {
                type: "Text",
                props: { text: { $state: `${ui}/selected/Description` }, variant: "body", className: "leading-relaxed" },
              },
              [`${ns}-sheet-sep`]: { type: "Separator", props: {} },
              [`${ns}-sheet-qty`]: {
                type: "Counter",
                props: {
                  label: "Quantity",
                  value: { $bindState: `${ui}/qty` },
                  min: 1,
                  max: 99,
                  step: 1,
                  className: "max-w-40",
                  name: null,
                },
              },
              [`${ns}-sheet-actions`]: {
                type: "Stack",
                props: { direction: "horizontal", gap: "sm", align: "center", className: "pt-1" },
                children: [...(showWishlist ? [`${ns}-sheet-wishlist`] : []), `${ns}-sheet-add`],
              },
              ...(showWishlist
                ? {
                    [`${ns}-sheet-wishlist`]: {
                      type: "Button",
                      props: { label: "Save to wishlist", variant: "secondary", disabled: null },
                      on: { press: sheetWishlistAction },
                    },
                  }
                : {}),
              [`${ns}-sheet-add`]: {
                type: "Button",
                props: { label: "Add to cart", variant: "primary", disabled: null },
                on: { press: addToCartAction({ $state: `${ui}/selected` }, { $state: `${ui}/qty` }) },
              },
            }
          : {}),
      },
      state: {
        ui: {
          [ns]: { detailOpen: false, selected: null, pending: null, pendingWish: null, qty: 1 },
        },
        // The grid OWNS its default sort under /filters/<ns>/sort; a Results
        // Toolbar / Filter Bar overwrites it. Filter panels seed only their own
        // facet keys (categories/priceRange/…), so this deep-merges cleanly.
        filters: {
          [ns]: { sort: [{ [sortField]: sortDirection }] },
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
                // Each facet is pruned by the engine when its state is unset, so a
                // bare grid, the ProductFilters card (scalar category), and the
                // FilterSidebar (multi-select categories + rating) all target this
                // one grid without conflict.
                { LHSField: "Category", Operator: "EQ", RHSValue: { $state: `${filters}/category` } },
                { LHSField: "Category", Operator: "IN", RHSValue: { $state: `${filters}/categories` } },
                { LHSField: "Rating", Operator: "GTE", RHSValue: { $state: `${filters}/minRating` } },
                { LHSField: "Price", Operator: "GTE", RHSValue: { $state: `${filters}/priceRange/0` } },
                { LHSField: "Price", Operator: "LTE", RHSValue: { $state: `${filters}/priceRange/1` } },
              ],
            },
            Sort: { $state: `${filters}/sort` },
            Page: { number: 1, size: pageSize },
          },
          debounceMs: 300,
        },
        [`${ns}-add-to-cart`]: {
          type: "bdo.save",
          params: {
            bdo: cartBdo,
            values: {
              ProductId: { $state: `${ui}/pending/ProductId` },
              Name: { $state: `${ui}/pending/Name` },
              Price: { $state: `${ui}/pending/Price` },
              Quantity: { $state: `${ui}/pending/Quantity` },
              LineTotal: { $state: `${ui}/pending/Price` },
              ImageUrl: { $state: `${ui}/pending/ImageUrl` },
            },
          },
          refresh: cartRefresh,
          on: {
            success: [{ action: "ui.toast", params: { message: "Added to cart", kind: "success" } }],
          },
        },
        ...(showWishlist && wishlistBdo
          ? {
              [`${ns}-wishlist`]: {
                type: "bdo.save",
                params: {
                  bdo: wishlistBdo,
                  values: {
                    ProductId: { $state: `${ui}/pendingWish/_id` },
                    Name: { $state: `${ui}/pendingWish/Name` },
                  },
                },
                on: {
                  success: [{ action: "ui.toast", params: { message: "Saved to wishlist", kind: "success" } }],
                },
              },
            }
          : {}),
      },
      init: [{ action: "datasource.refresh", params: { names: [ds] } }],
    };
  },
};
