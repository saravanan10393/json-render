/**
 * DataTable — searchable, paged record list with display-kind columns and
 * row actions. Built from repeat Stacks (the catalog Table takes static rows).
 *
 * Filters: `searchable` adds its own search input writing /filters/<ns>/search;
 * `filterBindings` adds Filter conditions reading /filters/<ns>/<stateKey> —
 * pair with a FilterBar(targetNs=<this ns>) that writes those keys (do NOT
 * also set searchable=true if the FilterBar has a search kind).
 * Row actions: "edit" needs `formDialogNs` (a sibling RecordFormDialog
 * instance id); "delete" fires '<ns>-delete' with a confirm dialog.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { DisplayKind, FilterBinding, andFilter, boundConditions, flexCell } from "./_shared";

const Params = z.object({
  entity: z.string(),
  columns: z
    .array(z.object({ field: z.string(), label: z.string(), display: DisplayKind.default("text") }))
    .min(1)
    .max(7),
  searchable: z.boolean().default(true),
  pageSize: z.number().int().min(5).max(50).default(10),
  filterBindings: z
    .array(FilterBinding)
    .default([])
    .describe("Filter conditions bound to /filters/<ns>/<stateKey> — written by a paired FilterBar."),
  baseFilter: z
    .array(z.object({ field: z.string(), operator: z.enum(["EQ", "NEQ"]).default("EQ"), value: z.union([z.string(), z.number(), z.boolean()]) }))
    .default([])
    .describe("Permanent literal conditions (e.g. scope to Status EQ 'Active')."),
  rowActions: z.array(z.enum(["edit", "delete"])).default([]),
  formDialogNs: z.string().nullable().default(null).describe("Sibling RecordFormDialog instance id — required when rowActions includes 'edit'."),
  refreshOnWrite: z.array(z.string()).default([]).describe("EXTRA same-page datasource names to re-fire after a delete (this table's list auto-refreshes)."),
})
  .refine((p) => !p.rowActions.includes("edit") || Boolean(p.formDialogNs), {
    message: "rowActions 'edit' requires formDialogNs (a sibling RecordFormDialog instance id)",
  });
type P = z.infer<typeof Params>;

export const DataTable: Fragment<P> = {
  name: "DataTable",
  version: "1.0.0",
  description:
    "Searchable, paged data table with typed columns (text|muted|money|date|badge|boolean|rating|progress) " +
    "and row actions: 'edit' opens a sibling RecordFormDialog (set formDialogNs), 'delete' soft-deletes with " +
    "confirm. List datasource is '<ns>-list' — pass it to form dialogs' refresh. Pair with FilterBar via " +
    "filterBindings (FilterBar targetNs = this instance id).",
  category: "display",
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const ds = `${ns}-list`;
    const cols = params.columns;
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "vertical", gap: "sm" },
        children: [...(params.searchable ? [`${ns}-toolbar`] : []), `${ns}-head`, `${ns}-rows`, `${ns}-empty`],
      },
      [`${ns}-head`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "md", align: "center", className: "border-b border-border pb-2 px-3" },
        children: [...cols.map((_, i) => `${ns}-head-${i}`), ...(params.rowActions.length ? [`${ns}-head-actions`] : [])],
      },
      [`${ns}-rows`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none" },
        repeat: { statePath: `/queries/${ds}/data`, key: "_id" },
        children: [`${ns}-row`],
      },
      [`${ns}-row`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "md", align: "center", className: "border-b border-border py-2 px-3" },
        children: [...cols.map((_, i) => `${ns}-cell-${i}`), ...(params.rowActions.length ? [`${ns}-row-actions`] : [])],
      },
      [`${ns}-empty`]: {
        type: "Empty",
        props: { title: "No records", description: "Adjust filters or add a record." },
        visible: { $state: `/queries/${ds}/page/total`, eq: 0 },
      },
    };
    cols.forEach((c, i) => {
      elements[`${ns}-head-${i}`] = { type: "Stack", props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" }, children: [`${ns}-head-${i}-t`] };
      elements[`${ns}-head-${i}-t`] = { type: "Text", props: { text: c.label, variant: "muted", className: null } };
      const cell = flexCell(`${ns}-cell-${i}`, c.display, { $item: c.field });
      Object.assign(elements, cell.elements);
    });
    if (params.searchable) {
      elements[`${ns}-toolbar`] = { type: "Stack", props: { direction: "horizontal", gap: "md", align: "center" }, children: [`${ns}-search`] };
      elements[`${ns}-search`] = { type: "Input", props: { label: "", name: "search", type: "text", placeholder: "Search…", value: { $bindState: `/filters/${ns}/search` } } };
    }
    const datasources: Record<string, Record<string, unknown>> = {
      [ds]: {
        type: "bdo.list",
        params: {
          bdo: params.entity,
          ...(params.searchable || params.filterBindings.length ? { Search: { $state: `/filters/${ns}/search` } } : {}),
          ...(params.filterBindings.length || params.baseFilter.length
            ? {
                Filter: andFilter([
                  ...params.baseFilter.map((b) => ({ LHSField: b.field, Operator: b.operator, RHSValue: b.value })),
                  ...boundConditions(ns, params.filterBindings),
                ]),
              }
            : {}),
          Page: { number: 1, size: params.pageSize },
        },
        debounceMs: 300,
      },
    };
    if (params.rowActions.length) {
      elements[`${ns}-head-actions`] = { type: "Text", props: { text: "", variant: "muted", className: "w-36" } };
      elements[`${ns}-row-actions`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", className: "w-36 justify-end" },
        children: params.rowActions.map((a) => `${ns}-act-${a}`),
      };
      if (params.rowActions.includes("edit") && params.formDialogNs) {
        const dlg = params.formDialogNs;
        elements[`${ns}-act-edit`] = {
          type: "Button",
          props: { label: "Edit", variant: "secondary", disabled: null },
          on: {
            press: [
              // repeat-scope: $template bare names copy the row's values
              { action: "setState", params: { statePath: `/ui/${dlg}/editId`, value: { $template: "${_id}" } } },
              { action: "setState", params: { statePath: `/ui/${dlg}/open`, value: true } },
            ],
          },
        };
      }
      if (params.rowActions.includes("delete")) {
        elements[`${ns}-act-delete`] = {
          type: "Button",
          props: { label: "Delete", variant: "secondary", disabled: null },
          on: {
            press: [
              { action: "setState", params: { statePath: `/ui/${ns}/deleteId`, value: { $template: "${_id}" } } },
              {
                action: "datasource.fire",
                params: { name: `${ns}-delete` },
                confirm: { title: "Delete record", message: "This cannot be undone.", variant: "danger" },
              },
            ],
          },
        };
        datasources[`${ns}-delete`] = {
          type: "bdo.delete",
          params: { bdo: params.entity, _id: { $state: `/ui/${ns}/deleteId` } },
          refresh: [ds, ...params.refreshOnWrite],
          on: { success: [{ action: "ui.toast", params: { message: "Record deleted", kind: "default" } }] },
        };
      }
    }
    return {
      root: ns,
      elements: elements as never,
      state: {
        // filterBindings deliberately seed nothing: unseeded $state RHS resolves undefined and the engine's pruneFilter drops the condition client-side (datasource-engine.ts).
        ...(params.searchable || params.filterBindings.length ? { filters: { [ns]: { search: "" } } } : {}),
        ...(params.rowActions.includes("delete") ? { ui: { [ns]: { deleteId: null } } } : {}),
      },
      datasources: datasources as never,
      init: [{ action: "datasource.refresh", params: { names: [ds] } }],
    };
  },
};
