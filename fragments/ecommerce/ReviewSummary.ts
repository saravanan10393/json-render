/**
 * ReviewSummary — the ratings overview for a product (or the whole store):
 * a big average + star glyphs + total count, beside a 5→1 star-distribution
 * (one Progress bar per star, relative to the total). Each figure is its own
 * bdo.metric (AVG, COUNT, and a per-star COUNT). Optional `productId` scopes it
 * to one product; omit for store-wide.
 *
 * Requires Review fields: Rating (+ ProductId when scoped).
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  reviewBdo: z.string().default("Review").describe("Review entity name."),
  productId: z.string().nullable().default(null).describe("Scope to one product's reviews (filters Review.ProductId). null = store-wide."),
});

type P = z.infer<typeof Params>;

export const ReviewSummary: Fragment<P> = {
  id: "fragment-review-summary",
  section: "reviews",
  name: "Review Summary",
  version: "1.0.0",
  description:
    "Ratings overview: average rating + stars + total count beside a 5→1 star-distribution (Progress bars). Each metric is a bdo.metric (AVG / COUNT / per-star COUNT). Optional productId scopes to one product. Requires Review fields Rating (+ ProductId when scoped).",
  whenToUse:
    "Use atop a product's reviews section (or a store reviews page) to summarize the average rating and how ratings are distributed across stars.",
  category: "review",
  previewParams: { productId: "Product-0" },
  params: Params as z.ZodType<P>,
  build: ({ reviewBdo, productId }, ns) => {
    const avg = `${ns}-avg`;
    const count = `${ns}-count`;
    const pid = productId ? [{ LHSField: "ProductId", Operator: "EQ", RHSValue: productId }] : [];
    const filterOf = (extra: Array<Record<string, unknown>> = []) => {
      const c = [...pid, ...extra];
      return c.length ? { Filter: { Operator: "AND", Condition: c } } : {};
    };
    const stars = [5, 4, 3, 2, 1];

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "xl", align: "center", className: "w-full max-w-2xl" },
        children: [`${ns}-overview`, `${ns}-dist`],
      },
      [`${ns}-overview`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none", align: "center", className: "shrink-0 pr-6" },
        children: [`${ns}-avg`, `${ns}-stars`, `${ns}-count`],
      },
      [`${ns}-avg`]: { type: "Heading", props: { text: { $datasource: `${avg}/data/value` }, level: "h1", className: "tabular-nums" } },
      [`${ns}-stars`]: { type: "Rating", props: { value: { $datasource: `${avg}/data/value` }, max: 5, symbol: null, icons: null, readOnly: true, name: null } },
      [`${ns}-count`]: { type: "Text", props: { text: { $template: `\${/queries/${count}/data/value} reviews` }, variant: "muted", className: null } },
      [`${ns}-dist`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "sm", className: "flex-1" },
        children: stars.map((s) => `${ns}-row-${s}`),
      },
    };

    const datasources: Record<string, unknown> = {
      [avg]: { type: "bdo.metric", params: { bdo: reviewBdo, Metric: [{ Type: "AVG", Field: "Rating" }], ...filterOf() } },
      [count]: { type: "bdo.metric", params: { bdo: reviewBdo, Metric: [{ Type: "COUNT" }], ...filterOf() } },
    };

    stars.forEach((s) => {
      const sds = `${ns}-s${s}`;
      datasources[sds] = { type: "bdo.metric", params: { bdo: reviewBdo, Metric: [{ Type: "COUNT" }], ...filterOf([{ LHSField: "Rating", Operator: "EQ", RHSValue: s }]) } };
      elements[`${ns}-row-${s}`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center" },
        children: [`${ns}-row-${s}-label`, `${ns}-row-${s}-bar`, `${ns}-row-${s}-count`],
      };
      elements[`${ns}-row-${s}-label`] = { type: "Text", props: { text: String(s), variant: "caption", className: "w-3 shrink-0 tabular-nums text-muted-foreground" } };
      elements[`${ns}-row-${s}-bar`] = {
        type: "Stack",
        props: { direction: "vertical", gap: "none", className: "flex-1" },
        children: [`${ns}-row-${s}-progress`],
      };
      elements[`${ns}-row-${s}-progress`] = { type: "Progress", props: { value: { $datasource: `${sds}/data/value` }, max: { $datasource: `${count}/data/value` }, label: null } };
      elements[`${ns}-row-${s}-count`] = { type: "Text", props: { text: { $datasource: `${sds}/data/value` }, variant: "caption", className: "w-6 shrink-0 text-right tabular-nums text-muted-foreground" } };
    });

    return {
      root: ns,
      elements: elements as unknown as ReturnType<Fragment<P>["build"]>["elements"],
      datasources: datasources as never,
      init: [{ action: "datasource.refresh", params: { names: [avg, count, ...stars.map((s) => `${ns}-s${s}`)] } }],
    };
  },
};
