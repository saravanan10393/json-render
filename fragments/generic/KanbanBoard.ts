/** KanbanBoard — one filtered list per status option; ←/→ buttons move cards. */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { textEl } from "./_shared";

const Params = z.object({
  entity: z.string(),
  statusField: z.string().describe("select field that defines the columns."),
  statusOptions: z.array(z.string()).min(2).max(5).describe("Column values, in board order — must match the field's options. A SUBSET silently hides cards in the missing statuses."),
  titleField: z.string(),
  metaFields: z.array(z.string()).max(2).default([]),
  pageSize: z.number().int().min(5).max(50).default(20),
  refreshOnMove: z.array(z.string()).default([]).describe("EXTRA same-page datasources to re-fire after a move (column lists auto-refresh)."),
});
type P = z.infer<typeof Params>;

export const KanbanBoard: Fragment<P> = {
  id: "fragment-kanban-board",
  name: "Kanban Board",
  version: "1.0.0",
  description:
    "Kanban board grouped by a select field: one column per statusOptions entry, cards with title + meta " +
    "fields and left/right move buttons that update the record's status. Column datasources are " +
    "'<ns>-col-<i>'. statusOptions MUST equal the entity field's options.",
  whenToUse:
    "Use when the user wants a board view with one column per status or stage (like To do / In progress / Done) where cards can be moved between columns.",
  category: "display",
  previewParams: {
    entity: "Order",
    statusField: "Status",
    statusOptions: ["Placed", "Shipped", "Delivered", "Cancelled"],
    titleField: "CustomerName",
    metaFields: ["City"],
  },
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const ui = `/ui/${ns}`;
    const colDs = params.statusOptions.map((_, i) => `${ns}-col-${i}`);
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: { type: "Grid", props: { columns: params.statusOptions.length, gap: "md" }, children: params.statusOptions.map((_, i) => `${ns}-col-${i}-wrap`) },
    };
    const datasources: Record<string, Record<string, unknown>> = {
      [`${ns}-move`]: {
        type: "bdo.save",
        params: {
          bdo: params.entity,
          values: { [params.statusField]: { $state: `${ui}/moveTo` } },
          _id: { $state: `${ui}/moveId` },
        },
        refresh: [...colDs, ...params.refreshOnMove],
        on: { success: [{ action: "ui.toast", params: { message: "Moved", kind: "default" } }] },
      },
    };
    params.statusOptions.forEach((status, i) => {
      const ds = colDs[i];
      datasources[ds] = {
        type: "bdo.list",
        params: {
          bdo: params.entity,
          Filter: { Operator: "AND", Condition: [{ LHSField: params.statusField, Operator: "EQ", RHSValue: status }] },
          Page: { number: 1, size: params.pageSize },
        },
      };
      const moveActions = (target: string) => [
        { action: "setState", params: { statePath: `${ui}/moveId`, value: { $template: "${_id}" } } },
        { action: "setState", params: { statePath: `${ui}/moveTo`, value: target } },
        { action: "datasource.fire", params: { name: `${ns}-move` } },
      ];
      elements[`${ns}-col-${i}-wrap`] = {
        type: "Stack",
        props: { direction: "vertical", gap: "sm", className: "rounded-xl bg-muted/40 p-3" },
        children: [`${ns}-col-${i}-head`, `${ns}-col-${i}-cards`],
      };
      elements[`${ns}-col-${i}-head`] = {
        type: "Stack",
        props: { direction: "horizontal", justify: "between", align: "center" },
        children: [`${ns}-col-${i}-title`, `${ns}-col-${i}-count`],
      };
      elements[`${ns}-col-${i}-title`] = { type: "Heading", props: { text: status, level: "h4" } };
      elements[`${ns}-col-${i}-count`] = textEl({ $datasource: `${ds}/page/total` }, "muted");
      elements[`${ns}-col-${i}-cards`] = {
        type: "Stack",
        props: { direction: "vertical", gap: "sm" },
        repeat: { statePath: `/queries/${ds}/data`, key: "_id" },
        children: [`${ns}-col-${i}-card`],
      };
      const actionChildren = [
        ...(i > 0 ? [`${ns}-col-${i}-card-left`] : []),
        ...(i < params.statusOptions.length - 1 ? [`${ns}-col-${i}-card-right`] : []),
      ];
      elements[`${ns}-col-${i}-card`] = {
        type: "Stack",
        props: { direction: "vertical", gap: "sm", className: "rounded-lg border border-border bg-card p-3" },
        children: [`${ns}-col-${i}-card-title`, ...params.metaFields.map((_, m) => `${ns}-col-${i}-card-meta-${m}`), ...(actionChildren.length ? [`${ns}-col-${i}-card-actions`] : [])],
      };
      elements[`${ns}-col-${i}-card-title`] = textEl({ $item: params.titleField }, "body");
      params.metaFields.forEach((f, m) => {
        elements[`${ns}-col-${i}-card-meta-${m}`] = textEl({ $item: f }, "muted");
      });
      if (actionChildren.length > 0) {
        elements[`${ns}-col-${i}-card-actions`] = {
          type: "Stack",
          props: { direction: "horizontal", justify: "between", align: "center" },
          children: actionChildren,
        };
      }
      if (i > 0) {
        elements[`${ns}-col-${i}-card-left`] = {
          type: "Button",
          props: { label: "←", variant: "secondary", disabled: null },
          on: { press: moveActions(params.statusOptions[i - 1]) },
        };
      }
      if (i < params.statusOptions.length - 1) {
        elements[`${ns}-col-${i}-card-right`] = {
          type: "Button",
          props: { label: "→", variant: "secondary", disabled: null },
          on: { press: moveActions(params.statusOptions[i + 1]) },
        };
      }
    });
    return {
      root: ns,
      elements: elements as never,
      state: { ui: { [ns]: { moveId: null, moveTo: null } } },
      datasources: datasources as never,
      init: [{ action: "datasource.refresh", params: { names: colDs } }],
    };
  },
};
