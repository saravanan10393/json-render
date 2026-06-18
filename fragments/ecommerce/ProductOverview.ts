/**
 * ProductOverview — the PDP buy-box: a two-column hero (image left, details
 * right) for ONE product loaded by id via bdo.get. Everything beyond the core
 * (title · price · rating · qty · add-to-cart) is OPTIONAL and degrades when
 * the data/flag is absent:
 *   brand · sale price (compareAt) · review count · color/size variant pickers ·
 *   buy-now · specifications · shipping note · trust/incentives row · wishlist.
 *
 * The product is chosen by `productId` — a literal _id or a binding
 * ({ $state: "/route/productId" }); the agent wires it. Variant selection is
 * cosmetic (writes /ui/<ns>/color|size); it isn't persisted to the cart yet
 * (CartItem has no variant fields).
 *
 * Deferred: a thumbnail GALLERY lives in its own Product Gallery fragment.
 *
 * Requires Product: Name, Description, Price, Category, ImageUrl, Rating, Stock.
 * Optional Product: Brand, CompareAtPrice, ReviewCount, Colors[], Sizes[].
 * Cart entity: ProductId, Name, Price, Quantity, LineTotal.
 */
import { z } from "zod";
import { BindingSchema, type Fragment } from "@/lib/jr/schema";

const Params = z.object({
  productBdo: z.string().default("Product").describe("Product entity name."),
  cartBdo: z.string().default("CartItem").describe("Cart line-item entity name."),
  productId: z
    .union([z.string(), BindingSchema])
    .describe('Product _id to load — a literal id OR a binding like {"$state":"/ui/selectedProductId"} for a route/state-driven PDP.'),
  currency: z.string().nullable().default(null).describe("ISO 4217 code for the price (default USD)."),
  showGallery: z.boolean().default(false).describe("Multi-image gallery (main carousel + synced thumbnail strip; needs Product.Images); else a single hero image."),
  imagesField: z.string().default("Images").describe("Product field holding the gallery image objects [{image}]."),
  showBrand: z.boolean().default(false).describe("Show a 'by <Brand>' line (needs Product.Brand)."),
  compareAtField: z
    .string()
    .nullable()
    .default(null)
    .describe("Product field holding the original/list price → struck-through sale price (e.g. 'CompareAtPrice')."),
  showReviewCount: z.boolean().default(false).describe("Show '(<N> reviews)' beside the rating (needs Product.ReviewCount)."),
  showVariants: z.boolean().default(false).describe("Show color (Product.Colors) + size (Product.Sizes) variant pickers."),
  showBuyNow: z.boolean().default(false).describe("Add a 'Buy now' button (adds to cart, then navigates / toasts)."),
  checkoutPath: z.string().nullable().default(null).describe("Buy-now navigation target; toasts when unset."),
  showWishlist: z.boolean().default(true).describe("Show a 'Save to wishlist' button."),
  showSpecs: z.boolean().default(false).describe("Show a collapsible Specifications section built from `specs`."),
  specs: z
    .array(z.object({ label: z.string(), field: z.string() }))
    .default([])
    .describe("Spec rows {label, field} (Product field ids). Falls back to Category/Rating/Stock when empty."),
  showShipping: z.boolean().default(false).describe("Show a collapsible 'Shipping & returns' section."),
  shippingNote: z.string().default("Free standard shipping. 30-day returns.").describe("Shipping section body text."),
  incentives: z
    .array(z.object({ icon: z.string(), label: z.string() }))
    .default([])
    .describe("Trust/incentive row: {icon (lucide kebab name), label}. Empty = hidden."),
  cartRefresh: z
    .array(z.string())
    .default([])
    .describe("SAME-PAGE datasource names to re-fire after add-to-cart (e.g. a CartSummary's '<cartNs>-items')."),
});

type P = z.infer<typeof Params>;

export const ProductOverview: Fragment<P> = {
  id: "fragment-product-overview",
  section: "product-detail",
  name: "Product Overview",
  version: "2.0.0",
  description:
    "Product detail buy-box: two-column hero (image + details) for one product (bdo.get). Core: title, rating, currency price, availability, description, quantity, add-to-cart. Optional: brand, sale price, review count, color/size variant pickers, buy-now, specifications, shipping note, trust row, wishlist. Requires Product Name/Description/Price/Category/ImageUrl/Rating/Stock; optional Brand/CompareAtPrice/ReviewCount/Colors[]/Sizes[]. Cart: ProductId/Name/Price/Quantity/LineTotal.",
  whenToUse:
    "Use as the main product-detail (PDP) block — the hero buy-box on a single-product page with price, rating, variants, quantity, and add-to-cart/buy-now. For a compact peek from a grid use Product Quick View.",
  category: "product-display",
  previewParams: {
    productId: "Product-0",
    showGallery: true,
    showBrand: true,
    compareAtField: "CompareAtPrice",
    showReviewCount: true,
    showVariants: true,
    showBuyNow: true,
    showSpecs: true,
    showShipping: true,
    incentives: [
      { icon: "truck", label: "Free shipping" },
      { icon: "rotate-ccw", label: "30-day returns" },
      { icon: "shield-check", label: "2-year warranty" },
    ],
  },
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const {
      productBdo,
      cartBdo,
      productId,
      currency,
      showGallery,
      imagesField,
      showBrand,
      compareAtField,
      showReviewCount,
      showVariants,
      showBuyNow,
      checkoutPath,
      showWishlist,
      showSpecs,
      specs,
      showShipping,
      shippingNote,
      incentives,
      cartRefresh,
    } = params;
    const ui = `/ui/${ns}`;
    const ds = `${ns}-product`;
    const f = (field: string) => ({ $datasource: `${ds}/data/${field}` });

    const addAction = [
      {
        action: "setState",
        params: {
          statePath: `${ui}/pending`,
          value: {
            ProductId: f("_id"),
            Name: f("Name"),
            Price: f("Price"),
            Quantity: { $state: `${ui}/qty` },
            LineTotal: f("Price"),
            ImageUrl: f("ImageUrl"),
          },
        },
      },
      { action: "datasource.fire", params: { name: `${ns}-add-cart` } },
    ];
    const buyNowTail = checkoutPath
      ? { action: "ui.navigate", params: { to: checkoutPath } }
      : { action: "ui.toast", params: { message: "Proceeding to checkout", kind: "default" } };

    const specRows = (specs.length > 0 ? specs : [
      { label: "Category", field: "Category" },
      { label: "Rating", field: "Rating" },
      { label: "In stock", field: "Stock" },
    ]);

    const detailChildren = [
      `${ns}-category`,
      `${ns}-title`,
      ...(showBrand ? [`${ns}-brand`] : []),
      `${ns}-ratingrow`,
      `${ns}-price`,
      `${ns}-availability`,
      `${ns}-oos`,
      ...(showVariants ? [`${ns}-variants`] : []),
      `${ns}-description`,
      `${ns}-sep`,
      `${ns}-qty`,
      `${ns}-actions`,
      ...(incentives.length > 0 ? [`${ns}-incentives`] : []),
      ...(showSpecs ? [`${ns}-specs`] : []),
      ...(showShipping ? [`${ns}-shipping`] : []),
    ];

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "xl", align: "start", className: "w-full max-w-5xl" },
        children: [`${ns}-media`, `${ns}-details`],
      },
      [`${ns}-media`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "sm", className: "min-w-[280px] flex-1" },
        children: [showGallery ? `${ns}-gallery` : `${ns}-image`],
      },
      [`${ns}-details`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "md", className: "min-w-[280px] flex-1" },
        children: detailChildren,
      },
      [`${ns}-category`]: {
        type: "Text",
        props: { text: f("Category"), variant: "caption", className: "uppercase tracking-wide text-muted-foreground" },
      },
      [`${ns}-title`]: { type: "Heading", props: { text: f("Name"), level: "h1", className: null } },
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
        props: {
          value: f("Price"),
          currency,
          locale: null,
          compareAt: compareAtField ? f(compareAtField) : null,
          showDiscount: null,
          size: "xl",
          className: null,
        },
      },
      [`${ns}-availability`]: {
        type: "Text",
        props: { text: { $template: `\${/queries/${ds}/data/Stock} in stock` }, variant: "muted", className: null },
      },
      [`${ns}-oos`]: {
        type: "Badge",
        props: { text: "Out of stock", variant: "destructive" },
        visible: { $state: `/queries/${ds}/data/Stock`, eq: 0 },
      },
      [`${ns}-description`]: {
        type: "Text",
        props: { text: f("Description"), variant: "body", className: "leading-relaxed text-muted-foreground" },
      },
      [`${ns}-sep`]: { type: "Separator", props: {} },
      [`${ns}-qty`]: {
        type: "Counter",
        props: { label: "Quantity", value: { $bindState: `${ui}/qty` }, min: 1, max: 99, step: 1, className: "max-w-40", name: null },
      },
      [`${ns}-actions`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center", className: "pt-1" },
        children: [
          `${ns}-add`,
          ...(showBuyNow ? [`${ns}-buynow`] : []),
          ...(showWishlist ? [`${ns}-wishlist`] : []),
        ],
      },
      [`${ns}-add`]: {
        type: "Button",
        props: { label: "Add to cart", variant: showBuyNow ? "secondary" : "primary", disabled: null },
        on: { press: addAction },
      },
    };

    if (showGallery) {
      // ImageGallery encapsulates the embla main+thumbnails sync (arrows, swipe,
      // click-to-jump, active-thumb ring) — one element, fed the Images array.
      elements[`${ns}-gallery`] = {
        type: "ImageGallery",
        props: { images: { $datasource: `${ds}/data/${imagesField}` }, aspectRatio: "1/1", alt: f("Name"), className: null },
      };
    } else {
      elements[`${ns}-image`] = {
        type: "Image",
        props: { src: f("ImageUrl"), alt: f("Name"), aspectRatio: "1/1", fit: "cover", width: null, height: null, className: "rounded-xl border border-border" },
      };
    }
    if (showBrand) {
      elements[`${ns}-brand`] = {
        type: "Text",
        props: { text: { $template: `by \${/queries/${ds}/data/Brand}` }, variant: "muted", className: null },
      };
    }
    if (showReviewCount) {
      elements[`${ns}-reviewcount`] = {
        type: "Text",
        props: { text: { $template: `(\${/queries/${ds}/data/ReviewCount} reviews)` }, variant: "muted", className: null },
      };
    }
    if (showVariants) {
      elements[`${ns}-variants`] = {
        type: "Stack",
        props: { direction: "vertical", gap: "md" },
        children: [`${ns}-color`, `${ns}-size`],
      };
      elements[`${ns}-color`] = {
        type: "SwatchGroup",
        props: { label: "Color", swatch: true, options: f("Colors"), value: { $bindState: `${ui}/color` }, name: null, className: null },
      };
      elements[`${ns}-size`] = {
        type: "SwatchGroup",
        props: { label: "Size", swatch: false, options: f("Sizes"), value: { $bindState: `${ui}/size` }, name: null, className: null },
      };
    }
    if (showBuyNow) {
      elements[`${ns}-buynow`] = {
        type: "Button",
        props: { label: "Buy now", variant: "primary", disabled: null },
        on: { press: [...addAction, buyNowTail] },
      };
    }
    if (showWishlist) {
      elements[`${ns}-wishlist`] = {
        type: "Button",
        props: { label: "Save to wishlist", variant: "ghost", disabled: null },
        on: { press: [{ action: "ui.toast", params: { message: "Saved to wishlist", kind: "success" } }] },
      };
    }
    if (incentives.length > 0) {
      elements[`${ns}-incentives`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "lg", align: "center", className: "flex-wrap border-t border-border pt-3 text-sm text-muted-foreground" },
        children: incentives.map((_, i) => `${ns}-inc-${i}`),
      };
      incentives.forEach((inc, i) => {
        elements[`${ns}-inc-${i}`] = {
          type: "Stack",
          props: { direction: "horizontal", gap: "sm", align: "center" },
          children: [`${ns}-inc-${i}-icon`, `${ns}-inc-${i}-label`],
        };
        elements[`${ns}-inc-${i}-icon`] = {
          type: "Icon",
          props: { name: inc.icon, size: 16, color: null, strokeWidth: null, className: null },
        };
        elements[`${ns}-inc-${i}-label`] = { type: "Text", props: { text: inc.label, variant: "muted", className: null } };
      });
    }
    if (showSpecs) {
      elements[`${ns}-specs`] = {
        type: "Collapsible",
        props: { title: "Specifications", defaultOpen: false },
        children: [`${ns}-specs-body`],
      };
      elements[`${ns}-specs-body`] = {
        type: "Stack",
        props: { direction: "vertical", gap: "sm", className: "pt-1" },
        children: specRows.map((_, i) => `${ns}-spec-${i}`),
      };
      specRows.forEach((row, i) => {
        elements[`${ns}-spec-${i}`] = {
          type: "Stack",
          props: { direction: "horizontal", justify: "between", align: "center", className: "border-b border-border/60 py-1.5" },
          children: [`${ns}-spec-${i}-l`, `${ns}-spec-${i}-v`],
        };
        elements[`${ns}-spec-${i}-l`] = { type: "Text", props: { text: row.label, variant: "muted", className: null } };
        elements[`${ns}-spec-${i}-v`] = { type: "Text", props: { text: f(row.field), variant: "body", className: "font-medium" } };
      });
    }
    if (showShipping) {
      elements[`${ns}-shipping`] = {
        type: "Collapsible",
        props: { title: "Shipping & returns", defaultOpen: false },
        children: [`${ns}-shipping-body`],
      };
      elements[`${ns}-shipping-body`] = {
        type: "Text",
        props: { text: shippingNote, variant: "muted", className: "pt-1 leading-relaxed" },
      };
    }

    return {
      root: ns,
      elements: elements as unknown as ReturnType<Fragment<P>["build"]>["elements"],
      state: { ui: { [ns]: { qty: 1, pending: null, color: null, size: null } } },
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
