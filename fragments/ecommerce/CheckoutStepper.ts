/**
 * CheckoutStepper — a horizontal step indicator for a multi-step checkout
 * (Cart → Information → Shipping → Review). `currentStep` (1-based) is a
 * build-time param, so completed/active/upcoming styling is computed at build —
 * no runtime state needed. Place at the top of each checkout step page with the
 * matching currentStep. Purely presentational.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  steps: z.array(z.string()).default(["Cart", "Information", "Shipping", "Review"]).describe("Step labels, in order."),
  currentStep: z.number().int().min(1).default(2).describe("Active step, 1-based."),
});

type P = z.infer<typeof Params>;

export const CheckoutStepper: Fragment<P> = {
  id: "fragment-checkout-stepper",
  section: "checkout",
  name: "Checkout Stepper",
  version: "1.0.0",
  description:
    "Horizontal checkout progress indicator: numbered/checked steps with labels and connectors; completed steps show a check, the active step is emphasized. `currentStep` is 1-based. Presentational — no entities.",
  whenToUse:
    "Use at the top of each checkout step page to show progress through Cart → Information → Shipping → Review (set currentStep per page).",
  category: "cart-checkout",
  previewParams: { currentStep: 2 },
  params: Params as z.ZodType<P>,
  build: ({ steps, currentStep }, ns) => {
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center", className: "w-full max-w-2xl" },
        children: steps.flatMap((_, i) => (i < steps.length - 1 ? [`${ns}-step-${i}`, `${ns}-conn-${i}`] : [`${ns}-step-${i}`])),
      },
    };

    steps.forEach((label, i) => {
      const step = i + 1;
      const done = step < currentStep;
      const active = step === currentStep;
      const circleClass = done
        ? "bg-primary text-primary-foreground"
        : active
          ? "bg-primary text-primary-foreground ring-2 ring-ring ring-offset-2 ring-offset-background"
          : "bg-muted text-muted-foreground";

      elements[`${ns}-step-${i}`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center" },
        children: [`${ns}-circle-${i}`, `${ns}-label-${i}`],
      };
      elements[`${ns}-circle-${i}`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", justify: "center", className: `size-7 shrink-0 rounded-full text-sm font-medium ${circleClass}` },
        children: [`${ns}-circle-${i}-content`],
      };
      elements[`${ns}-circle-${i}-content`] = done
        ? { type: "Icon", props: { name: "check", size: 16, color: null, strokeWidth: null, className: null } }
        : { type: "Text", props: { text: String(step), variant: "caption", className: "leading-none" } };
      elements[`${ns}-label-${i}`] = {
        type: "Text",
        props: { text: label, variant: "body", className: active ? "font-medium text-foreground" : done ? "text-foreground" : "text-muted-foreground" },
      };
      if (i < steps.length - 1) {
        elements[`${ns}-conn-${i}`] = {
          type: "Stack",
          props: { direction: "horizontal", gap: "none", className: `h-0.5 flex-1 rounded-full ${step < currentStep ? "bg-primary" : "bg-border"}` },
        };
      }
    });

    return { root: ns, elements: elements as unknown as ReturnType<Fragment<P>["build"]>["elements"] };
  },
};
