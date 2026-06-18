/**
 * ProjectBoard — Kanban board of Tasks grouped by Status.
 *
 * One column per status (Todo → In Progress → Review → Done).
 * Each card shows Task Title, Assignee, and Priority badge; ← / → buttons move the status.
 * Move is two-step: setState(moveId) + setState(moveTo) + datasource.fire(<ns>-move).
 *
 * Datasources:
 *   <ns>-col-0…3  — bdo.list filtered by Status EQ <status>, Page size <pageSize>
 *   <ns>-move     — bdo.save _id from state, Status from state; refreshes all columns
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const STATUSES = ["Todo", "In Progress", "Review", "Done"] as const;

const Params = z.object({
  statuses: z
    .array(z.enum(STATUSES))
    .min(2)
    .max(4)
    .default([...STATUSES])
    .describe("Task statuses to show as columns — subset hides cards in missing statuses."),
  pageSize: z.number().int().min(5).max(50).default(20),
  refreshOnMove: z
    .array(z.string())
    .default([])
    .describe("Extra same-page datasource names to refresh after a status move."),
});
type P = z.infer<typeof Params>;

export const ProjectBoard: Fragment<P> = {
  id: "fragment-project-board",
  name: "Project Board",
  version: "1.0.0",
  description:
    "Project-management Kanban board for Tasks by Status: one column per status, cards show Title/Assignee/Priority, " +
    "← / → buttons move the task to the adjacent status (two-step setState + datasource.fire). " +
    "Entity contract: Task(Title, ProjectName, Assignee, Status:select[Todo|In Progress|Review|Done], Priority:select[Low|Medium|High], Estimate:number, DueDate:date). " +
    "Datasources: '<ns>-col-0…N-1' (bdo.list per status), '<ns>-move' (bdo.save).",
  whenToUse:
    "Use when the user wants a sprint or kanban board of tasks organized into status columns (To do, In progress, Review, Done) where cards can be moved between stages.",
  category: "display",
  params: Params as z.ZodType<P>,
  build: ({ statuses, pageSize, refreshOnMove }, ns) => {
    const ui = `/ui/${ns}`;
    const colDs = statuses.map((_, i) => `${ns}-col-${i}`);

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Grid",
        props: { columns: statuses.length, gap: "md" },
        children: statuses.map((_, i) => `${ns}-col-${i}-wrap`),
      },
    };

    const datasources: Record<string, Record<string, unknown>> = {
      [`${ns}-move`]: {
        type: "bdo.save",
        params: {
          bdo: "Task",
          values: { Status: { $state: `${ui}/moveTo` } },
          _id: { $state: `${ui}/moveId` },
        },
        refresh: [...colDs, ...refreshOnMove],
        on: {
          success: [{ action: "ui.toast", params: { message: "Task moved", kind: "default" } }],
        },
      },
    };

    statuses.forEach((status, i) => {
      const ds = colDs[i];
      datasources[ds] = {
        type: "bdo.list",
        params: {
          bdo: "Task",
          Filter: {
            Operator: "AND",
            Condition: [{ LHSField: "Status", Operator: "EQ", RHSValue: status }],
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
        props: { text: status, level: "h4" },
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
      if (i < statuses.length - 1) actionChildren.push(`${ns}-col-${i}-card-right`);

      elements[`${ns}-col-${i}-card`] = {
        type: "Stack",
        props: {
          direction: "vertical",
          gap: "sm",
          className: "rounded-lg border border-border bg-card p-3",
        },
        children: [
          `${ns}-col-${i}-card-title`,
          `${ns}-col-${i}-card-assignee`,
          `${ns}-col-${i}-card-priority`,
          ...(actionChildren.length ? [`${ns}-col-${i}-card-actions`] : []),
        ],
      };
      elements[`${ns}-col-${i}-card-title`] = {
        type: "Text",
        props: { text: { $item: "Title" }, variant: "body" },
      };
      elements[`${ns}-col-${i}-card-assignee`] = {
        type: "Text",
        props: { text: { $item: "Assignee" }, variant: "muted" },
      };
      elements[`${ns}-col-${i}-card-priority`] = {
        type: "Badge",
        props: { text: { $item: "Priority" }, variant: "secondary" },
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
          on: { press: moveActions(statuses[i - 1]) },
        };
      }
      if (i < statuses.length - 1) {
        elements[`${ns}-col-${i}-card-right`] = {
          type: "Button",
          props: { label: "→", variant: "secondary", disabled: null },
          on: { press: moveActions(statuses[i + 1]) },
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
