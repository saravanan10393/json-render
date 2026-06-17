/**
 * FeaturedProduct — a landscape highlight card for ONE product (image left,
 * details right), loaded by id via bdo.get. A storefront "featured / spotlight"
 * block — distinct from the full PDP (Product Overview) and from the grid's
 * in-card quick-view Sheet.
 *
 * (Refactored from the old ProductQuickView: real Money pricing + sale, optional
 * ImageGallery, rating + optional review count, no fabricated "Sale!"/review
 * copy, and a preview id that actually resolves.)
 *
 * Requires Product: Name, Description, Price, Category, ImageUrl, Rating.
 * Optional Product: Brand, CompareAtPrice, ReviewCount, Images[].
 * Cart entity: ProductId, Name, Price, Quantity, LineTotal.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  productBdo: z.string().default("Product").describe("Product entity name."),
  cartBdo: z.string().default("CartItem").describe("Cart line-item entity name."),
  productId: z.string().describe("Product _id to feature (literal, or bind to a route/state path)."),
  currency: z.string().nullable().default(null).describe("ISO 4217 code for the price (default USD)."),
  showGallery: z.boolean().default(false).describe("Use a multi-image gallery (needs Product.Images); else a single hero image."),
  imagesField: z.string().default("Images").describe("Product field holding the gallery image objects [{image}]."),
  showBrand: z.boolean().default(false).describe("Show a 'by <Brand>' line (needs Product.Brand)."),
  compareAtField: z
    .string()
    .nullable()
    .default(null)
    .describe("Product field with the original price → struck-through sale price (e.g. 'CompareAtPrice')."),
  showReviewCount: z.boolean().default(false).describe("Show '(<N> reviews)' beside the rating (needs Product.ReviewCount)."),
  detailPath: z.string().nullable().default(null).describe("'View details' navigation target; the button is hidden when unset."),
  showAddToCart: z.boolean().default(true),
  cartRefresh: z
    .array(z.string())
    .default([])
    .describe("SAME-PAGE datasource names to re-fire after add-to-cart (e.g. a CartSummary's '<cartNs>-items')."),
});

type P = z.infer<typeof Params>;

export const FeaturedProduct: Fragment<P> = {
  id: "fragment-featured-product",
  section: "discovery",
  name: "Featured Product",
  version: "2.0.0",
  description:
    "Landscape spotlight card for one product (image left, details right) loaded by id (bdo.get): title, rating, currency price (+ optional sale), description, add-to-cart and optional 'View details'. Requires Product Name/Description/Price/Category/ImageUrl/Rating; optional Brand/CompareAtPrice/ReviewCount/Images[]. Cart: ProductId/Name/Price/Quantity/LineTotal.",
  whenToUse:
    "Use to spotlight/feature a single product on a homepage or landing section (image + price + add-to-cart). For the full product page use Product Overview; for browsing many products use Product Grid.",
  category: "product-display",
  previewParams: {
    productId: "Product-0",
    showGallery: true,
    showBrand: true,
    compareAtField: "CompareAtPrice",
    showReviewCount: true,
  },
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const { productBdo, cartBdo, productId, currency, showGallery, imagesField, showBrand, compareAtField, showReviewCount, detailPath, showAddToCart, cartRefresh } =
      params;
    const ui = `/ui/${ns}`;
    const ds = `${ns}-product`;
    const f = (field: string) => ({ $datasource: `${ds}/data/${field}` });

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: {
          direction: "horizontal",
          gap: "none",
          align: "stretch",
          className: "w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        },
        children: [`${ns}-media`, `${ns}-details`],
      },
      [`${ns}-media`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none", justify: "center", className: "min-w-[260px] flex-1 bg-muted p-4" },
        children: [showGallery ? `${ns}-gallery` : `${ns}-image`],
      },
      [`${ns}-details`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "md", className: "min-w-[260px] flex-1 p-6" },
        children: [
          `${ns}-category`,
          `${ns}-title`,
          ...(showBrand ? [`${ns}-brand`] : []),
          `${ns}-ratingrow`,
          `${ns}-price`,
          `${ns}-description`,
          `${ns}-actions`,
        ],
      },
      [`${ns}-category`]: {
        type: "Text",
        props: { text: f("Category"), variant: "caption", className: "uppercase tracking-wide text-muted-foreground" },
      },
      [`${ns}-title`]: { type: "Heading", props: { text: f("Name"), level: "h2", className: null } },
      [`${ns}-ratingrow`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center" },
        children: [`${ns}-rating`, ...(showReviewCount ? [`${ns}-reviewcount`] : [])],
      },
      [`${ns}-rating`]: {
        type: "Rating",
        props: { value: f("Rating"), max: 5, symbol: null, icons: null, readOnly: true, name: null },
      },
      [`${ns}-price`]: {
        type: "Money",
        props: { value: f("Price"), currency, locale: null, compareAt: compareAtField ? f(compareAtField) : null, showDiscount: null, size: "lg", className: null },
      },
      [`${ns}-description`]: {
        type: "Text",
        props: { text: f("Description"), variant: "body", className: "leading-relaxed text-muted-foreground" },
      },
      [`${ns}-actions`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center", className: "pt-1" },
        children: [...(showAddToCart ? [`${ns}-add`] : []), ...(detailPath ? [`${ns}-view`] : [])],
      },
    };

    if (showGallery) {
      elements[`${ns}-gallery`] = {
        type: "ImageGallery",
        props: { images: { $datasource: `${ds}/data/${imagesField}` }, aspectRatio: "1/1", alt: f("Name"), className: null },
      };
    } else {
      elements[`${ns}-image`] = {
        type: "Image",
        props: { src: f("ImageUrl"), alt: f("Name"), aspectRatio: "1/1", fit: "cover", width: null, height: null, className: "rounded-xl" },
      };
    }
    if (showBrand) {
      elements[`${ns}-brand`] = { type: "Text", props: { text: { $template: `by \${/queries/${ds}/data/Brand}` }, variant: "muted", className: null } };
    }
    if (showReviewCount) {
      elements[`${ns}-reviewcount`] = {
        type: "Text",
        props: { text: { $template: `(\${/queries/${ds}/data/ReviewCount} reviews)` }, variant: "muted", className: null },
      };
    }
    if (showAddToCart) {
      elements[`${ns}-add`] = {
        type: "Button",
        props: { label: "Add to cart", variant: "primary", disabled: null },
        on: {
          press: [
            {
              action: "setState",
              params: {
                statePath: `${ui}/pending`,
                value: { ProductId: f("_id"), Name: f("Name"), Price: f("Price"), Quantity: 1, LineTotal: f("Price"), ImageUrl: f("ImageUrl") },
              },
            },
            { action: "datasource.fire", params: { name: `${ns}-add-cart` } },
          ],
        },
      };
    }
    if (detailPath) {
      elements[`${ns}-view`] = {
        type: "Button",
        props: { label: "View details", variant: "secondary", disabled: null },
        on: { press: [{ action: "ui.navigate", params: { to: detailPath } }] },
      };
    }

    return {
      root: ns,
      elements: elements as unknown as ReturnType<Fragment<P>["build"]>["elements"],
      state: { ui: { [ns]: { pending: null } } },
      datasources: {
        [ds]: { type: "bdo.get", params: { bdo: productBdo, _id: productId } },
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
              ImageUrl: { $state: `${ui}/pending/ImageUrl` },
            },
          },
          refresh: cartRefresh,
          on: { success: [{ action: "ui.toast", params: { message: "Added to cart", kind: "success" } }] },
        },
      },
      init: [{ action: "datasource.refresh", params: { names: [ds] } }],
    };
  },
};
