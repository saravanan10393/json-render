/**
 * TaskList — filterable table of Task records with delete support.
 *
 * Columns: Title / Assignee / Status (badge) / Priority (badge) / Estimate / DueDate / Actions
 * Controls: search (Title contains), Status filter, Priority filter
 * Row actions: delete via two-step setState(deleteId) + datasource.fire confirm:danger
 *
 * Datasources:
 *   <ns>-list   — bdo.list Task, filtered by search + status + priority state
 *   <ns>-delete — bdo.delete Task, _id from /ui/<ns>/deleteId
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  pageSize: z.number().int().min(5).max(100).default(25),
  showDelete: z
    .boolean()
    .default(true)
    .describe("Show a delete action button per row."),
  refreshOnDelete: z
    .array(z.string())
    .default([])
    .describe("Extra datasource names to refresh after delete (e.g. a stats fragment)."),
});
type P = z.infer<typeof Params>;

const STATUSES = ["Todo", "In Progress", "Review", "Done"];
const PRIORITIES = ["Low", "Medium", "High"];

export const TaskList: Fragment<P> = {
  id: "fragment-task-list",
  name: "Task List",
  version: "1.0.0",
  description:
    "Project-management task table: Title/Assignee/Status/Priority/Estimate/DueDate columns, " +
    "search by Title, Status filter, Priority filter, optional row delete with confirm dialog. " +
    "Entity contract: Task(Title, ProjectName, Assignee, Status:select[Todo|In Progress|Review|Done], " +
    "Priority:select[Low|Medium|High], Estimate:number, DueDate:date). " +
    "Datasources: '<ns>-list' (bdo.list Task), '<ns>-delete' (bdo.delete Task, when showDelete).",
  whenToUse:
    "Use when the user wants a searchable, filterable list or table of tasks showing who they're assigned to, their status, priority, and due dates, with the option to delete tasks.",
  category: "display",
  params: Params as z.ZodType<P>,
  build: ({ pageSize, showDelete, refreshOnDelete }, ns) => {
    const listDs = `${ns}-list`;
    const deleteDs = `${ns}-delete`;
    const filterPath = `/ui/${ns}/filters`;
    const deleteIdPath = `/ui/${ns}/deleteId`;

    const headerCols = ["Title", "Assignee", "Status", "Priority", "Estimate", "Due Date"];
    if (showDelete) headerCols.push("Actions");

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "vertical", gap: "md" },
        children: [`${ns}-toolbar`, `${ns}-table`, `${ns}-empty`],
      },

      // Toolbar: search + status filter + priority filter
      [`${ns}-toolbar`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "end", className: "flex-wrap" },
        children: [`${ns}-search`, `${ns}-filter-status`, `${ns}-filter-priority`],
      },
      [`${ns}-search`]: {
        type: "Input",
        props: {
          label: "Search",
          name: "search",
          type: "text",
          value: { $bindState: `${filterPath}/search` },
          placeholder: "Search tasks…",
        },
      },
      [`${ns}-filter-status`]: {
        type: "Select",
        props: {
          label: "Status",
          name: "status",
          options: ["", ...STATUSES],
          value: { $bindState: `${filterPath}/status` },
          placeholder: "All statuses",
        },
      },
      [`${ns}-filter-priority`]: {
        type: "Select",
        props: {
          label: "Priority",
          name: "priority",
          options: ["", ...PRIORITIES],
          value: { $bindState: `${filterPath}/priority` },
          placeholder: "All priorities",
        },
      },

      // Table: header + repeat rows
      [`${ns}-table`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none" },
        children: [`${ns}-thead`, `${ns}-tbody`],
      },

      // Header
      [`${ns}-thead`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "md", align: "center", className: "border-b border-border pb-2" },
        children: [
          `${ns}-th-0`, `${ns}-th-1`, `${ns}-th-2`,
          `${ns}-th-3`, `${ns}-th-4`, `${ns}-th-5`,
          ...(showDelete ? [`${ns}-th-6`] : []),
        ],
      },
      [`${ns}-th-0`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-[2]" },
        children: [`${ns}-th-0-t`],
      },
      [`${ns}-th-0-t`]: { type: "Text", props: { text: "Title", variant: "muted", className: null } },
      [`${ns}-th-1`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-th-1-t`],
      },
      [`${ns}-th-1-t`]: { type: "Text", props: { text: "Assignee", variant: "muted", className: null } },
      [`${ns}-th-2`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-th-2-t`],
      },
      [`${ns}-th-2-t`]: { type: "Text", props: { text: "Status", variant: "muted", className: null } },
      [`${ns}-th-3`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-th-3-t`],
      },
      [`${ns}-th-3-t`]: { type: "Text", props: { text: "Priority", variant: "muted", className: null } },
      [`${ns}-th-4`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-th-4-t`],
      },
      [`${ns}-th-4-t`]: { type: "Text", props: { text: "Estimate", variant: "muted", className: null } },
      [`${ns}-th-5`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-th-5-t`],
      },
      [`${ns}-th-5-t`]: { type: "Text", props: { text: "Due Date", variant: "muted", className: null } },

      // Table body (repeat rows)
      [`${ns}-tbody`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none" },
        repeat: { statePath: `/queries/${listDs}/data`, key: "_id" },
        children: [`${ns}-row`],
      },
      [`${ns}-row`]: {
        type: "Stack",
        props: {
          direction: "horizontal",
          gap: "md",
          align: "center",
          className: "border-b border-border py-2",
        },
        children: [
          `${ns}-cell-0`, `${ns}-cell-1`, `${ns}-cell-2`,
          `${ns}-cell-3`, `${ns}-cell-4`, `${ns}-cell-5`,
          ...(showDelete ? [`${ns}-cell-act`] : []),
        ],
      },
      [`${ns}-cell-0`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-[2]" },
        children: [`${ns}-cell-0-v`],
      },
      [`${ns}-cell-0-v`]: { type: "Text", props: { text: { $item: "Title" }, variant: "body" } },
      [`${ns}-cell-1`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-cell-1-v`],
      },
      [`${ns}-cell-1-v`]: { type: "Text", props: { text: { $item: "Assignee" }, variant: "muted" } },
      [`${ns}-cell-2`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-cell-2-v`],
      },
      [`${ns}-cell-2-v`]: { type: "Badge", props: { text: { $item: "Status" }, variant: "secondary" } },
      [`${ns}-cell-3`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-cell-3-v`],
      },
      [`${ns}-cell-3-v`]: { type: "Badge", props: { text: { $item: "Priority" }, variant: "outline" } },
      [`${ns}-cell-4`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-cell-4-v`],
      },
      [`${ns}-cell-4-v`]: { type: "Text", props: { text: { $item: "Estimate" }, variant: "muted" } },
      [`${ns}-cell-5`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-cell-5-v`],
      },
      [`${ns}-cell-5-v`]: { type: "Text", props: { text: { $item: "DueDate" }, variant: "muted" } },

      // Empty state
      [`${ns}-empty`]: {
        type: "Empty",
        props: { title: "No tasks", description: "No tasks match the current filters." },
        visible: { $state: `/queries/${listDs}/page/total`, eq: 0 },
      },
    };

    if (showDelete) {
      elements[`${ns}-th-6`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-th-6-t`],
      };
      elements[`${ns}-th-6-t`] = { type: "Text", props: { text: "Actions", variant: "muted", className: null } };

      elements[`${ns}-cell-act`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-btn-delete`],
      };
      elements[`${ns}-btn-delete`] = {
        type: "Button",
        props: { label: "Delete", variant: "secondary", disabled: null },
        on: {
          press: [
            { action: "setState", params: { statePath: deleteIdPath, value: { $template: "${_id}" } } },
            {
              action: "datasource.fire",
              params: { name: deleteDs },
              confirm: { title: "Delete task", message: "This cannot be undone.", variant: "danger" },
            },
          ],
        },
      };
    }

    const datasources: Record<string, unknown> = {
      [listDs]: {
        type: "bdo.list",
        params: {
          bdo: "Task",
          Filter: {
            Operator: "AND",
            Condition: [
              { LHSField: "Title", Operator: "CONTAINS", RHSValue: { $state: `${filterPath}/search` } },
              { LHSField: "Status", Operator: "EQ", RHSValue: { $state: `${filterPath}/status` } },
              { LHSField: "Priority", Operator: "EQ", RHSValue: { $state: `${filterPath}/priority` } },
            ],
          },
          Sort: [{ DueDate: "ASC" }],
          Page: { number: 1, size: pageSize },
        },
      },
    };

    if (showDelete) {
      datasources[deleteDs] = {
        type: "bdo.delete",
        params: { bdo: "Task", _id: { $state: deleteIdPath } },
        refresh: [listDs, ...refreshOnDelete],
        on: { success: [{ action: "ui.toast", params: { message: "Task deleted", kind: "default" } }] },
      };
    }

    return {
      root: ns,
      elements: elements as never,
      datasources: datasources as never,
      state: {
        ui: {
          [ns]: {
            filters: { search: "", status: "", priority: "" },
            ...(showDelete ? { deleteId: null } : {}),
          },
        },
      },
      init: [{ action: "datasource.refresh", params: { names: [listDs] } }],
    };
  },
};
