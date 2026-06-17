/**
 * WriteReviewForm — submit a product review: an interactive star Rating + name,
 * title, and body fields → saves a Review (bdo.save) and clears on success.
 * Draft lives at /form/<ns>/*.
 *
 * Note: CreatedAt is left to the backend default (this runtime can't stamp now).
 * Requires Review fields: ProductId, Author, Rating, Title, Body.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  reviewBdo: z.string().default("Review").describe("Review entity name."),
  productId: z.string().describe("Product _id the review is for (literal or bound)."),
  title: z.string().default("Write a review"),
  refresh: z.array(z.string()).default([]).describe("SAME-PAGE datasource names to re-fire after submit (e.g. a Review List's '<ns>-reviews')."),
});

type P = z.infer<typeof Params>;

export const WriteReviewForm: Fragment<P> = {
  id: "fragment-write-review-form",
  section: "reviews",
  name: "Write Review Form",
  version: "1.0.0",
  description:
    "Form to submit a product review: interactive star Rating + name/title/body fields → bdo.save a Review, clears on success. Requires Review fields ProductId, Author, Rating, Title, Body. Pass productId; pair refresh with a Review List/Summary to update them.",
  whenToUse:
    "Use under a product's reviews section to let a customer write and submit a star rating + written review.",
  category: "review",
  previewParams: { productId: "Product-0" },
  params: Params as z.ZodType<P>,
  build: ({ reviewBdo, productId, title, refresh }, ns) => {
    const form = `/form/${ns}`;
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Card",
        props: { title, description: null, maxWidth: "md", centered: null, className: null },
        children: [`${ns}-body`],
      },
      [`${ns}-body`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "md" },
        children: [`${ns}-rating-field`, `${ns}-author`, `${ns}-title`, `${ns}-comment`, `${ns}-submit`],
      },
      [`${ns}-rating-field`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "sm" },
        children: [`${ns}-rating-label`, `${ns}-rating`],
      },
      [`${ns}-rating-label`]: { type: "Text", props: { text: "Your rating", variant: "caption", className: "font-medium" } },
      [`${ns}-rating`]: { type: "Rating", props: { value: { $bindState: `${form}/Rating` }, max: 5, symbol: null, icons: null, readOnly: null, name: null } },
      [`${ns}-author`]: { type: "Input", props: { label: "Name", type: "text", placeholder: "Your name", value: { $bindState: `${form}/Author` } } },
      [`${ns}-title`]: { type: "Input", props: { label: "Title", type: "text", placeholder: "Sum it up", value: { $bindState: `${form}/Title` } } },
      [`${ns}-comment`]: { type: "Textarea", props: { label: "Review", placeholder: "What did you think?", rows: 4, value: { $bindState: `${form}/Body` } } },
      [`${ns}-submit`]: {
        type: "Button",
        props: { label: "Submit review", variant: "primary", disabled: null },
        on: { press: { action: "datasource.fire", params: { name: `${ns}-save` } } },
      },
    };

    return {
      root: ns,
      elements: elements as unknown as ReturnType<Fragment<P>["build"]>["elements"],
      state: { form: { [ns]: { Rating: 0, Author: "", Title: "", Body: "" } } },
      datasources: {
        [`${ns}-save`]: {
          type: "bdo.save",
          params: {
            bdo: reviewBdo,
            values: {
              ProductId: productId,
              Author: { $state: `${form}/Author` },
              Rating: { $state: `${form}/Rating` },
              Title: { $state: `${form}/Title` },
              Body: { $state: `${form}/Body` },
            },
          },
          refresh,
          on: {
            success: [
              { action: "ui.toast", params: { message: "Thanks for your review!", kind: "success" } },
              { action: "setState", params: { statePath: form, value: { Rating: 0, Author: "", Title: "", Body: "" } } },
            ],
          },
        },
      },
    };
  },
};
