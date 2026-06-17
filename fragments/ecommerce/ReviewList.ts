/**
 * ReviewList — individual customer reviews (bdo.list): per review a star
 * rating, author, date, title, and body. Optional `productId` scopes to one
 * product; newest first.
 *
 * Requires Review fields: Author, Rating, Title, Body, CreatedAt (+ ProductId when scoped).
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  reviewBdo: z.string().default("Review").describe("Review entity name."),
  productId: z.string().nullable().default(null).describe("Scope to one product's reviews (filters Review.ProductId). null = all."),
  pageSize: z.number().int().min(1).max(50).default(10),
});

type P = z.infer<typeof Params>;

export const ReviewList: Fragment<P> = {
  id: "fragment-review-list",
  section: "reviews",
  name: "Review List",
  version: "1.0.0",
  description:
    "List of customer reviews (bdo.list, newest first): each shows a star rating, author, date, title, and body. Optional productId scopes to one product. Requires Review fields Author, Rating, Title, Body, CreatedAt (+ ProductId when scoped).",
  whenToUse:
    "Use under a product (or on a reviews page) to show individual customer reviews. Pair with Review Summary for the aggregate.",
  category: "review",
  previewParams: { productId: "Product-0" },
  params: Params as z.ZodType<P>,
  build: ({ reviewBdo, productId, pageSize }, ns) => {
    const ds = `${ns}-reviews`;
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none", className: "w-full max-w-2xl" },
        children: [`${ns}-list`, `${ns}-empty`],
      },
      [`${ns}-list`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none" },
        repeat: { statePath: `/queries/${ds}/data`, key: "_id" },
        children: [`${ns}-item`],
      },
      [`${ns}-item`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "sm", className: "border-b border-border py-4" },
        children: [`${ns}-item-head`, `${ns}-item-title`, `${ns}-item-body`],
      },
      [`${ns}-item-head`]: {
        type: "Stack",
        props: { direction: "horizontal", justify: "between", align: "center" },
        children: [`${ns}-item-left`, `${ns}-item-date`],
      },
      [`${ns}-item-left`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center" },
        children: [`${ns}-item-rating`, `${ns}-item-author`],
      },
      [`${ns}-item-rating`]: { type: "Rating", props: { value: { $item: "Rating" }, max: 5, symbol: null, icons: null, readOnly: true, name: null } },
      [`${ns}-item-author`]: { type: "Text", props: { text: { $item: "Author" }, variant: "body", className: "font-medium" } },
      [`${ns}-item-date`]: { type: "Text", props: { text: { $item: "CreatedAt" }, variant: "muted", className: null } },
      [`${ns}-item-title`]: { type: "Heading", props: { text: { $item: "Title" }, level: "h4", className: null } },
      [`${ns}-item-body`]: { type: "Text", props: { text: { $item: "Body" }, variant: "body", className: "leading-relaxed text-muted-foreground" } },
      [`${ns}-empty`]: {
        type: "Empty",
        props: { title: "No reviews yet", description: "Be the first to review this product." },
        visible: { $state: `/queries/${ds}/page/total`, eq: 0 },
      },
    };

    const filter = productId ? { Filter: { Operator: "AND", Condition: [{ LHSField: "ProductId", Operator: "EQ", RHSValue: productId }] } } : {};

    return {
      root: ns,
      elements: elements as unknown as ReturnType<Fragment<P>["build"]>["elements"],
      datasources: {
        [ds]: { type: "bdo.list", params: { bdo: reviewBdo, ...filter, Sort: [{ CreatedAt: "DESC" }], Page: { number: 1, size: pageSize } } },
      },
      init: [{ action: "datasource.refresh", params: { names: [ds] } }],
    };
  },
};
