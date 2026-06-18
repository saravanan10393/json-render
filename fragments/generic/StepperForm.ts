/**
 * StepperForm — multi-step CREATE wizard in a page-level Card.
 *
 * There is no 'Stepper' component in the catalog. Step navigation is
 * implemented with visible-gated Stack sections: each step panel has
 * visible: { $state: `/ui/<ns>/step`, eq: <index> }.
 *
 * State: /ui/<ns>/step (integer, seeded 0) drives which panel is visible.
 * Back/Next use setState with literal step indices (known at build time).
 * The final step's Submit fires `<ns>-save` (bdo.save, no _id → create).
 *
 * All form fields bind under /form/<ns>/<field> via formFieldOutput.
 * Reference field lookup datasources go into init refresh.
 *
 * successTarget: navigate to this page name after save (nullable).
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { FormFieldDef, formFieldOutput } from "./_shared";

const StepDef = z.object({
  label: z.string().describe("Step label shown in the step indicator row."),
  fields: z.array(FormFieldDef).min(1).describe("Fields rendered in this step's panel."),
});

const Params = z.object({
  entity: z.string().describe("BDO entity to create records in."),
  title: z.string().describe("Card title shown at the top."),
  steps: z
    .array(StepDef)
    .min(2)
    .max(5)
    .describe(
      "Ordered list of wizard steps. Each step shows its fields and Back/Next buttons. " +
        "The final step shows Submit instead of Next, firing '<ns>-save' (CREATE — no _id).",
    ),
  successTarget: z
    .string()
    .nullable()
    .default(null)
    .describe("Page NAME to navigate to after save. null = no navigation."),
});
type P = z.infer<typeof Params>;

export const StepperForm: Fragment<P> = {
  id: "fragment-stepper-form",
  name: "Stepper Form",
  version: "1.0.0",
  description:
    "Multi-step CREATE wizard rendered as a page-level Card. " +
    "Step navigation lives in /ui/<ns>/step (integer, 0-based). " +
    "Each step's panel is visible-gated on that state key — no Stepper catalog component needed. " +
    "Back/Next buttons use setState with literal step indices (built at fragment-expand time). " +
    "The final step's Submit fires '<ns>-save' (bdo.save CREATE, valuesPath /form/<ns>, no _id). " +
    "All field inputs bind under /form/<ns>/<field>. " +
    "Reference field lookup datasources (if any) are listed in init refresh. " +
    "This is CREATE-ONLY: use RecordFormDialog for edit flows.",
  whenToUse:
    "Use when the user wants a multi-step form or wizard that walks through filling in a record across several steps — like a checkout, signup, or onboarding flow.",
  category: "form",
  previewParams: {
    entity: "Order",
    title: "Place order",
    steps: [
      {
        label: "Customer",
        fields: [
          { field: "CustomerName", label: "Name" },
          { field: "Email", label: "Email" },
        ],
      },
      {
        label: "Shipping",
        fields: [
          { field: "Address", label: "Address" },
          { field: "City", label: "City" },
          { field: "Zip", label: "Zip" },
        ],
      },
    ],
  },
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const ui = `/ui/${ns}`;
    const formPath = `/form/${ns}`;
    const steps = params.steps;
    const lastIdx = steps.length - 1;

    // Collect all field outputs across all steps
    const stepFieldOuts = steps.map((step) =>
      step.fields.map((f) => formFieldOutput(ns, f, formPath)),
    );
    // Flatten all lookup datasources across all steps
    const allLookupDs = stepFieldOuts
      .flat()
      .flatMap((o) => Object.keys(o.datasources));

    const elements: Record<string, Record<string, unknown>> = {};
    const datasources: Record<string, Record<string, unknown>> = {};

    // Step indicator row: labels shown at all times
    const indicatorChildren = steps.map((_, i) => `${ns}-step-ind-${i}`);
    elements[`${ns}-indicators`] = {
      type: "Stack",
      props: { direction: "horizontal", gap: "sm", align: "center" },
      children: indicatorChildren,
    };
    steps.forEach((step, i) => {
      elements[`${ns}-step-ind-${i}`] = {
        type: "Text",
        props: {
          text: `${i + 1}. ${step.label}`,
          variant: "muted",
          className: null,
        },
      };
    });

    // Per-step panel (visible only when /ui/<ns>/step === i)
    steps.forEach((step, i) => {
      const fOuts = stepFieldOuts[i];
      const panelKey = `${ns}-panel-${i}`;
      const panelBodyKey = `${ns}-panel-${i}-body`;
      const panelNavKey = `${ns}-panel-${i}-nav`;

      // Nav buttons
      const navChildren: string[] = [];
      if (i > 0) navChildren.push(`${ns}-panel-${i}-back`);
      if (i < lastIdx) navChildren.push(`${ns}-panel-${i}-next`);
      else navChildren.push(`${ns}-panel-${i}-submit`);

      elements[panelKey] = {
        type: "Stack",
        props: { direction: "vertical", gap: "md" },
        visible: { $state: `${ui}/step`, eq: i },
        children: [panelBodyKey, panelNavKey],
      };
      elements[panelBodyKey] = {
        type: "Stack",
        props: { direction: "vertical", gap: "md" },
        children: fOuts.map((o) => o.rootKey),
      };
      elements[panelNavKey] = {
        type: "Stack",
        props: { direction: "horizontal", justify: "end", gap: "sm" },
        children: navChildren,
      };

      if (i > 0) {
        elements[`${ns}-panel-${i}-back`] = {
          type: "Button",
          props: { label: "Back", variant: "secondary", disabled: null },
          on: {
            press: { action: "setState", params: { statePath: `${ui}/step`, value: i - 1 } },
          },
        };
      }
      if (i < lastIdx) {
        elements[`${ns}-panel-${i}-next`] = {
          type: "Button",
          props: { label: "Next", variant: "primary", disabled: null },
          on: {
            press: { action: "setState", params: { statePath: `${ui}/step`, value: i + 1 } },
          },
        };
      } else {
        // Last step: Submit button
        elements[`${ns}-panel-${i}-submit`] = {
          type: "Button",
          props: { label: "Submit", variant: "primary", disabled: null },
          on: {
            press: { action: "datasource.fire", params: { name: `${ns}-save` } },
          },
        };
      }

      // Merge field elements
      for (const o of fOuts) Object.assign(elements, o.elements);
      // Merge lookup datasources
      for (const o of fOuts) Object.assign(datasources, o.datasources);
    });

    // Root Card — declared after panels so element ordering matches tree traversal
    const stepPanelKeys = steps.map((_, i) => `${ns}-panel-${i}`);
    elements[ns] = {
      type: "Card",
      props: { title: params.title, description: null, maxWidth: "md", centered: null, className: null },
      children: [`${ns}-card-body`],
    };
    elements[`${ns}-card-body`] = {
      type: "Stack",
      props: { direction: "vertical", gap: "lg" },
      children: [`${ns}-indicators`, ...stepPanelKeys],
    };

    // Save datasource: CREATE only (no _id)
    const successActions: Array<Record<string, unknown>> = [
      { action: "ui.toast", params: { message: "Saved", kind: "success" } },
      { action: "setState", params: { statePath: formPath, value: {} } },
      { action: "setState", params: { statePath: `${ui}/step`, value: 0 } },
      ...(params.successTarget
        ? [{ action: "ui.navigate", params: { to: params.successTarget } }]
        : []),
    ];
    datasources[`${ns}-save`] = {
      type: "bdo.save",
      params: { bdo: params.entity, valuesPath: formPath },
      on: { success: successActions },
    };

    return {
      root: ns,
      elements: elements as never,
      state: {
        ui: { [ns]: { step: 0 } },
        form: { [ns]: {} },
      },
      datasources: datasources as never,
      ...(allLookupDs.length
        ? { init: [{ action: "datasource.refresh", params: { names: allLookupDs } }] }
        : {}),
    };
  },
};
