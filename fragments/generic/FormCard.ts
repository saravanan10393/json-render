/**
 * FormCard — page-level CREATE form (no dialog, no edit/prefill).
 * Renders a Card wrapping field inputs + a submit button.
 * After save: toasts "Saved", resets the form, and optionally navigates
 * to successTarget. For edit flows use RecordFormDialog instead.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { FormFieldDef, formFieldOutput } from "./_shared";

const Params = z.object({
  entity: z.string(),
  title: z.string(),
  fields: z.array(FormFieldDef).min(1).max(10),
  refresh: z.array(z.string()).default([]).describe("Same-page datasource names to re-fire after save."),
  successTarget: z.string().nullable().default(null).describe("Page NAME to navigate to after save."),
});
type P = z.infer<typeof Params>;

export const FormCard: Fragment<P> = {
  id: "fragment-form-card",
  name: "Form Card",
  version: "1.0.0",
  description:
    "Page-level CREATE form (Card). Same field model as RecordFormDialog; " +
    "navigates to successTarget after save. For edit flows use RecordFormDialog instead.",
  whenToUse:
    "Use when the user wants a standalone form on a page to add a new record — an 'Add product' or sign-up style form with labeled inputs and a save button.",
  category: "form",
  previewParams: {
    entity: "Product",
    title: "Add product",
    fields: [
      { field: "Name", label: "Name" },
      { field: "Description", label: "Description", input: "textarea" },
      { field: "Price", label: "Price", input: "number" },
      { field: "Category", label: "Category", input: "select", options: ["Audio", "Wearables", "Accessories"] },
    ],
  },
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const formPath = `/form/${ns}`;
    const fieldOuts = params.fields.map((f) => formFieldOutput(ns, f, formPath));
    const lookupDs = fieldOuts.flatMap((o) => Object.keys(o.datasources));
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Card",
        props: { title: params.title, description: null, maxWidth: "md", centered: null, className: null },
        children: [`${ns}-body`],
      },
      [`${ns}-body`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "md" },
        children: [...fieldOuts.map((o) => o.rootKey), `${ns}-submit`],
      },
      [`${ns}-submit`]: {
        type: "Button",
        props: { label: "Save", variant: "primary", disabled: null },
        on: { press: { action: "datasource.fire", params: { name: `${ns}-save` } } },
      },
    };
    for (const o of fieldOuts) Object.assign(elements, o.elements);
    const successActions: Array<Record<string, unknown>> = [
      { action: "ui.toast", params: { message: "Saved", kind: "success" } },
      { action: "setState", params: { statePath: formPath, value: {} } },
      ...(params.successTarget ? [{ action: "ui.navigate", params: { to: params.successTarget } }] : []),
    ];
    const datasources: Record<string, Record<string, unknown>> = {
      [`${ns}-save`]: {
        type: "bdo.save",
        params: { bdo: params.entity, valuesPath: formPath },
        refresh: params.refresh,
        on: { success: successActions },
      },
    };
    for (const o of fieldOuts) Object.assign(datasources, o.datasources);
    return {
      root: ns,
      elements: elements as never,
      state: { form: { [ns]: {} } },
      datasources: datasources as never,
      ...(lookupDs.length ? { init: [{ action: "datasource.refresh", params: { names: lookupDs } }] } : {}),
    };
  },
};
