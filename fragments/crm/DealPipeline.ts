/**
 * DealPipeline — Kanban board of Deals grouped by Stage.
 *
 * One column per stage (Lead → Qualified → Proposal → Won → Lost).
 * Each card shows Deal Name, Value, and Owner; ← / → buttons move the stage.
 * Move is two-step: setState(moveId) + setState(moveTo) + datasource.fire(<ns>-move).
 *
 * Datasources:
 *   <ns>-col-0…4  — bdo.list filtered by Stage EQ <stage>, Page size <pageSize>
 *   <ns>-move     — bdo.save _id from state, Stage from state; refreshes all columns
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const STAGES = ["Lead", "Qualified", "Proposal", "Won", "Lost"] as const;

const Params = z.object({
  stages: z
    .array(z.enum(STAGES))
    .min(2)
    .max(5)
    .default([...STAGES])
    .describe("Deal stages to show as columns — subset hides cards in missing stages."),
  pageSize: z.number().int().min(5).max(50).default(20),
  refreshOnMove: z
    .array(z.string())
    .default([])
    .describe("Extra same-page datasource names to refresh after a stage move."),
});
type P = z.infer<typeof Params>;

export const DealPipeline: Fragment<P> = {
  name: "DealPipeline",
  version: "1.0.0",
  description:
    "CRM Kanban board for Deals by Stage: one column per stage, cards show Name/Value/Owner, " +
    "← / → buttons move the deal to the adjacent stage (two-step setState + datasource.fire). " +
    "Entity contract: Deal(Name, ContactName, Company, Value:number, Stage:select[Lead|Qualified|Proposal|Won|Lost], CloseDate:date, Owner). " +
    "Datasources: '<ns>-col-0…N-1' (bdo.list per stage), '<ns>-move' (bdo.save).",
  category: "display",
  params: Params as z.ZodType<P>,
  build: ({ stages, pageSize, refreshOnMove }, ns) => {
    const ui = `/ui/${ns}`;
    const colDs = stages.map((_, i) => `${ns}-col-${i}`);

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Grid",
        props: { columns: stages.length, gap: "md" },
        children: stages.map((_, i) => `${ns}-col-${i}-wrap`),
      },
    };

    const datasources: Record<string, Record<string, unknown>> = {
      [`${ns}-move`]: {
        type: "bdo.save",
        params: {
          bdo: "Deal",
          values: { Stage: { $state: `${ui}/moveTo` } },
          _id: { $state: `${ui}/moveId` },
        },
        refresh: [...colDs, ...refreshOnMove],
        on: {
          success: [{ action: "ui.toast", params: { message: "Deal moved", kind: "default" } }],
        },
      },
    };

    stages.forEach((stage, i) => {
      const ds = colDs[i];
      datasources[ds] = {
        type: "bdo.list",
        params: {
          bdo: "Deal",
          Filter: {
            Operator: "AND",
            Condition: [{ LHSField: "Stage", Operator: "EQ", RHSValue: stage }],
          },
          Page: { number: 1, size: pageSize },
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
      elements[`${ns}-col-${i}-title`] = {
        type: "Heading",
        props: { text: stage, level: "h4" },
      };
      elements[`${ns}-col-${i}-count`] = {
        type: "Text",
        props: { text: { $datasource: `${ds}/page/total` }, variant: "muted" },
      };
      elements[`${ns}-col-${i}-cards`] = {
        type: "Stack",
        props: { direction: "vertical", gap: "sm" },
        repeat: { statePath: `/queries/${ds}/data`, key: "_id" },
        children: [`${ns}-col-${i}-card`],
      };

      const actionChildren: string[] = [];
      if (i > 0) actionChildren.push(`${ns}-col-${i}-card-left`);
      if (i < stages.length - 1) actionChildren.push(`${ns}-col-${i}-card-right`);

      elements[`${ns}-col-${i}-card`] = {
        type: "Stack",
        props: {
          direction: "vertical",
          gap: "sm",
          className: "rounded-lg border border-border bg-card p-3",
        },
        children: [
          `${ns}-col-${i}-card-name`,
          `${ns}-col-${i}-card-value`,
          `${ns}-col-${i}-card-owner`,
          ...(actionChildren.length ? [`${ns}-col-${i}-card-actions`] : []),
        ],
      };
      elements[`${ns}-col-${i}-card-name`] = {
        type: "Text",
        props: { text: { $item: "Name" }, variant: "body" },
      };
      elements[`${ns}-col-${i}-card-value`] = {
        type: "Text",
        props: { text: { $item: "Value" }, variant: "muted" },
      };
      elements[`${ns}-col-${i}-card-owner`] = {
        type: "Text",
        props: { text: { $item: "Owner" }, variant: "muted" },
      };

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
          on: { press: moveActions(stages[i - 1]) },
        };
      }
      if (i < stages.length - 1) {
        elements[`${ns}-col-${i}-card-right`] = {
          type: "Button",
          props: { label: "→", variant: "secondary", disabled: null },
          on: { press: moveActions(stages[i + 1]) },
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
