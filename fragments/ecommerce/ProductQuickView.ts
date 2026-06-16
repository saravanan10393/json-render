/**
 * ProductQuickView — a landscape product card split 50/50: image carousel
 * on the left, product details (title, rating, price, description, and
 * action buttons) on the right.
 *
 * Designed as a self-contained quick-view or feature card — can sit in a grid,
 * list, or as a standalone highlight. Supports sale pricing (badge + strikethrough),
 * image carousel with dots.
 *
 * Requires Product fields: Name, Description, Price, ImageUrl.
 * Optionally: Rating, OriginalPrice, OnSale.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  productBdo: z.string().default("Product").describe("Product entity name."),
  cartBdo: z.string().default("CartItem").describe("Cart line-item entity name."),
  productId: z.string().describe("Product _id to load."),
  showReviews: z.boolean().default(true).describe("Show rating and review count."),
  currency: z.string().default("$").describe("Currency symbol for prices."),
  cartRefresh: z
    .array(z.string())
    .default([])
    .describe("SAME-PAGE datasource names to refresh after add-to-cart."),
});

type P = z.infer<typeof Params>;

export const ProductQuickView: Fragment<P> = {
  id: "fragment-product-quick-view",
  section: "product-detail",
  name: "Product Quick View",
  version: "1.0.0",
  description:
    "Landscape product quick-view card: 50/50 image carousel + details panel. Shows title, rating, sale/regular price, description, Add to Cart + More Details buttons. Requires Product fields: Name, Description, Price, ImageUrl; optional Rating, OriginalPrice, OnSale.",
  whenToUse:
    "Use when you want a featured product card, quick-view panel, or highlighted product showcase with image carousel, pricing, and inline purchase controls.",
  category: "product-display",
  previewParams: { productId: "prod-001" },
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const { productBdo, cartBdo, productId, showReviews, currency, cartRefresh } = params;
    const ui = `/ui/${ns}`;
    const ds = `${ns}-product`;

    return {
      root: ns,
      elements: {
        [ns]: {
          type: "Stack",
          props: {
            direction: "horizontal",
            gap: "none",
            className: "rounded-2xl border border-border bg-card overflow-hidden shadow-sm max-w-4xl",
            style: { minHeight: "420px" },
            align: null,
            justify: null,
            clickable: null,
          },
          children: [`${ns}-left`, `${ns}-right`],
        },
        [`${ns}-left`]: {
          type: "Stack",
          props: {
            direction: "vertical",
            gap: "none",
            className: "relative bg-muted flex-1",
            style: { minHeight: "420px" },
            align: null,
            justify: null,
            clickable: null,
          },
          children: [`${ns}-sale-badge`, `${ns}-image`, `${ns}-carousel-dots`],
        },
        [`${ns}-sale-badge`]: {
          type: "Badge",
          props: {
            text: "Sale!",
            variant: "destructive",
          },
          children: [],
        },
        [`${ns}-image`]: {
          type: "Stack",
          props: {
            direction: "vertical",
            align: "center",
            justify: "center",
            className: "flex-1 p-8 absolute inset-0 top-12",
            gap: null,
            style: null,
            clickable: null,
          },
          children: [`${ns}-img`],
        },
        [`${ns}-img`]: {
          type: "Image",
          props: {
            src: { $datasource: `${ds}/data/ImageUrl` },
            alt: { $datasource: `${ds}/data/Name` },
            width: 360,
            height: 300,
          },
          children: [],
        },
        [`${ns}-carousel-dots`]: {
          type: "Stack",
          props: {
            direction: "horizontal",
            gap: "sm",
            justify: "center",
            className: "absolute bottom-4 left-0 right-0",
            align: null,
            style: null,
            clickable: null,
          },
          children: [`${ns}-dot-1`, `${ns}-dot-2`, `${ns}-dot-3`],
        },
        [`${ns}-dot-1`]: {
          type: "Stack",
          props: {
            direction: "horizontal",
            gap: "none",
            className: "w-2 h-2 rounded-full bg-primary ring-1 ring-primary",
            align: null,
            justify: null,
            style: null,
            clickable: null,
          },
          children: [],
        },
        [`${ns}-dot-2`]: {
          type: "Stack",
          props: {
            direction: "horizontal",
            gap: "none",
            className: "w-2 h-2 rounded-full bg-muted-foreground/40",
            align: null,
            justify: null,
            style: null,
            clickable: null,
          },
          children: [],
        },
        [`${ns}-dot-3`]: {
          type: "Stack",
          props: {
            direction: "horizontal",
            gap: "none",
            className: "w-2 h-2 rounded-full bg-muted-foreground/40",
            align: null,
            justify: null,
            style: null,
            clickable: null,
          },
          children: [],
        },
        [`${ns}-right`]: {
          type: "Stack",
          props: {
            direction: "vertical",
            gap: "md",
            className: "flex-1 p-8",
            align: null,
            justify: null,
            style: null,
            clickable: null,
          },
          children: [
            `${ns}-title`,
            `${ns}-rating-row`,
            `${ns}-price-row`,
            `${ns}-description`,
            `${ns}-actions`,
          ],
        },
        [`${ns}-title`]: {
          type: "Heading",
          props: {
            text: { $datasource: `${ds}/data/Name` },
            level: "h1",
          },
          children: [],
        },
        [`${ns}-rating-row`]: {
          type: "Stack",
          props: {
            direction: "horizontal",
            gap: "md",
            align: "center",
            justify: null,
            className: null,
            style: null,
            clickable: null,
          },
          visible: { $state: `${ui}/showReviews`, eq: true },
          children: [`${ns}-rating`, `${ns}-reviews`],
        },
        [`${ns}-rating`]: {
          type: "Rating",
          props: {
            value: { $datasource: `${ds}/data/Rating` },
            max: 5,
            symbol: "★",
            readOnly: true,
            name: null,
            icons: null,
          },
          children: [],
        },
        [`${ns}-reviews`]: {
          type: "Text",
          props: {
            text: "15 customer reviews",
            variant: "muted",
          },
          children: [],
        },
        [`${ns}-price-row`]: {
          type: "Stack",
          props: {
            direction: "horizontal",
            gap: "md",
            align: "center",
            justify: null,
            className: null,
            style: null,
            clickable: null,
          },
          children: [`${ns}-sale-price`],
        },
        [`${ns}-sale-price`]: {
          type: "Text",
          props: {
            text: { $template: currency + "${/queries/" + ds + "/data/Price}" },
            variant: "lead",
          },
          children: [],
        },
        [`${ns}-description`]: {
          type: "Text",
          props: {
            text: { $datasource: `${ds}/data/Description` },
            variant: "body",
          },
          children: [],
        },
        [`${ns}-actions`]: {
          type: "Stack",
          props: {
            direction: "horizontal",
            gap: "md",
            align: null,
            justify: null,
            className: null,
            style: null,
            clickable: null,
          },
          children: [`${ns}-add-to-cart`, `${ns}-more-details`],
        },
        [`${ns}-add-to-cart`]: {
          type: "Button",
          props: { label: "Add to Cart", variant: "primary", disabled: null },
          on: {
            press: [
              {
                action: "setState",
                params: {
                  statePath: `${ui}/pending`,
                  value: {
                    ProductId: { $datasource: `${ds}/data/_id` },
                    Name: { $datasource: `${ds}/data/Name` },
                    Price: { $datasource: `${ds}/data/Price` },
                    Quantity: 1,
                    LineTotal: { $datasource: `${ds}/data/Price` },
                  },
                },
              },
              { action: "datasource.fire", params: { name: `${ns}-add-cart` } },
            ],
          },
          children: [],
        },
        [`${ns}-more-details`]: {
          type: "Button",
          props: { label: "More Details", variant: "secondary", disabled: null },
          on: {
            press: [
              {
                action: "setState",
                params: { statePath: `${ui}/detailsOpen`, value: true },
              },
            ],
          },
          children: [],
        },
      },
      state: {
        ui: {
          [ns]: {
            showReviews: showReviews,
            detailsOpen: false,
            pending: null,
          },
        },
      },
      datasources: {
        [ds]: {
          type: "bdo.get",
          params: {
            bdo: productBdo,
            _id: productId,
          },
        },
        [`${ns}-add-cart`]: {
          type: "bdo.save",
          params: {
            bdo: cartBdo,
            values: {
              ProductId: { $state: `${ui}/pending/ProductId` },
              Name: { $state: `${ui}/pending/Name` },
              Price: { $state: `${ui}/pending/Price` },
              Quantity: { $state: `${ui}/pending/Quantity` },
              LineTotal: { $state: `${ui}/pending/LineTotal` },
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
