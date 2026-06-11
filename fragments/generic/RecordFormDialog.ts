/**
 * RecordFormDialog — create/edit dialog over /form/<ns>.
 * Open contract (what siblings write):
 *   create: /ui/<ns>/editId = null, /form/<ns> = {}, /ui/<ns>/open = true
 *   edit:   /ui/<ns>/editId = "<recordId>",          /ui/<ns>/open = true
 * The '<ns>-prefill' bdo.get auto-fires when editId changes and copies the
 * record into the form draft ($cond guards the create case).
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { FormFieldDef, formFieldOutput } from "./_shared";

const Params = z.object({
  entity: z.string(),
  title: z.string(),
  fields: z.array(FormFieldDef).min(1).max(10),
  refresh: z.array(z.string()).default([]).describe("Same-page datasource names to re-fire after save (e.g. the DataTable's '<tableNs>-list')."),
  successMessage: z.string().default("Saved"),
});
type P = z.infer<typeof Params>;

export const RecordFormDialog: Fragment<P> = {
  name: "RecordFormDialog",
  version: "1.0.0",
  description:
    "Create/edit dialog form. Field inputs: text|textarea|number|date|boolean|select|reference " +
    "(reference = Combobox over lookupEntity, stores _id). OPEN it from siblings: create → set " +
    "/ui/<ns>/editId null, /form/<ns> {}, /ui/<ns>/open true; edit → set /ui/<ns>/editId then open " +
    "(DataTable rowActions and PageHeader openDialog do this when given this instance id). Pass the " +
    "page's list datasource names in `refresh`. Prefill refires when editId CHANGES — openers should set editId to null first, then the id (DataTable's edit action does).",
  category: "form",
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const ui = `/ui/${ns}`;
    const formPath = `/form/${ns}`;
    const fieldOuts = params.fields.map((f) => formFieldOutput(ns, f, formPath));
    const lookupDs = fieldOuts.flatMap((o) => Object.keys(o.datasources));
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: { type: "Dialog", props: { title: params.title, description: null, openPath: `${ui}/open` }, children: [`${ns}-body`] },
      [`${ns}-body`]: { type: "Stack", props: { direction: "vertical", gap: "md" }, children: [...fieldOuts.map((o) => o.rootKey), `${ns}-footer`] },
      [`${ns}-footer`]: { type: "Stack", props: { direction: "horizontal", justify: "end", gap: "sm" }, children: [`${ns}-cancel`, `${ns}-submit`] },
      [`${ns}-cancel`]: {
        type: "Button",
        props: { label: "Cancel", variant: "secondary", disabled: null },
        on: { press: { action: "setState", params: { statePath: `${ui}/open`, value: false } } },
      },
      [`${ns}-submit`]: {
        type: "Button",
        props: { label: "Save", variant: "primary", disabled: null },
        on: { press: { action: "datasource.fire", params: { name: `${ns}-save` } } },
      },
    };
    for (const o of fieldOuts) Object.assign(elements, o.elements);
    const datasources: Record<string, Record<string, unknown>> = {
      [`${ns}-save`]: {
        type: "bdo.save",
        params: { bdo: params.entity, valuesPath: formPath, _id: { $state: `${ui}/editId` }, closePath: `${ui}/open` },
        refresh: params.refresh,
        on: {
          success: [
            { action: "ui.toast", params: { message: params.successMessage, kind: "success" } },
            { action: "setState", params: { statePath: formPath, value: {} } },
            { action: "setState", params: { statePath: `${ui}/editId`, value: null } },
          ],
        },
      },
      [`${ns}-prefill`]: {
        type: "bdo.get",
        params: { bdo: params.entity, _id: { $state: `${ui}/editId` } },
        skipUntilReady: true,
        on: {
          success: [
            {
              action: "setState",
              params: {
                statePath: formPath,
                // editId null (create) → keep an empty draft; set → copy the record in.
                value: { $cond: { $state: `${ui}/editId` }, $then: { $datasource: `${ns}-prefill/data` }, $else: {} },
              },
            },
          ],
        },
      },
    };
    for (const o of fieldOuts) Object.assign(datasources, o.datasources);
    return {
      root: ns,
      elements: elements as never,
      state: { ui: { [ns]: { open: false, editId: null } }, form: { [ns]: {} } },
      datasources: datasources as never,
      ...(lookupDs.length ? { init: [{ action: "datasource.refresh", params: { names: lookupDs } }] } : {}),
    };
  },
};
