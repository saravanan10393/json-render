/**
 * TicketQueue — filterable table of Ticket records.
 *
 * Columns: Subject / Status / Priority (badge) / Assignee / CreatedAt
 * Controls: search (Subject contains), Status filter, Priority filter, New Ticket button
 * Row click: writes ticket _id to detailStatePath
 *
 * Datasources:
 *   <ns>-list — bdo.list Ticket, filtered by search + status + priority state
 *   <ns>-new  — bdo.save CREATE Ticket (no _id); values from /form/<ns>/* ; refresh list
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  pageSize: z.number().int().min(5).max(100).default(25),
  detailStatePath: z
    .string()
    .optional()
    .describe("State path to write the clicked ticket's _id into (e.g. /ui/selectedTicketId)."),
  showNewButton: z
    .boolean()
    .default(true)
    .describe("Show a 'New Ticket' button that opens an inline add form."),
});
type P = z.infer<typeof Params>;

const STATUSES = ["Open", "In Progress", "Waiting", "Resolved", "Closed"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

export const TicketQueue: Fragment<P> = {
  name: "TicketQueue",
  version: "1.0.0",
  description:
    "Helpdesk ticket queue table: Subject/Status/Priority/Assignee/CreatedAt columns, " +
    "search by Subject, Status filter, Priority filter, optional New Ticket inline form. " +
    "Row click writes ticket _id to detailStatePath for use with TicketDetail. " +
    "Entity contract: Ticket(Subject, Description, Status:select[Open|In Progress|Waiting|Resolved|Closed], " +
    "Priority:select[Low|Medium|High|Urgent], Requester, Assignee, Category:select, CreatedAt:date). " +
    "Datasources: '<ns>-list' (bdo.list Ticket), '<ns>-new' (bdo.save CREATE Ticket, optional).",
  category: "display",
  params: Params as z.ZodType<P>,
  build: ({ pageSize, detailStatePath, showNewButton }, ns) => {
    const listDs = `${ns}-list`;
    const newDs = `${ns}-new`;
    const filterPath = `/ui/${ns}/filters`;
    const formPath = `/form/${ns}`;

    const rowPressActions = detailStatePath
      ? [{ action: "setState", params: { statePath: detailStatePath, value: { $template: "${_id}" } } }]
      : [];

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "vertical", gap: "md" },
        children: [
          `${ns}-toolbar`,
          `${ns}-table`,
          `${ns}-empty`,
          ...(showNewButton ? [`${ns}-new-form`] : []),
        ],
      },

      // Toolbar: search + filters + new button
      [`${ns}-toolbar`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "end", className: "flex-wrap" },
        children: [
          `${ns}-search`,
          `${ns}-filter-status`,
          `${ns}-filter-priority`,
          ...(showNewButton ? [`${ns}-new-btn`] : []),
        ],
      },
      [`${ns}-search`]: {
        type: "Input",
        props: {
          label: "Search",
          name: "search",
          type: "text",
          value: { $bindState: `${filterPath}/search` },
          placeholder: "Search tickets…",
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

      // Table header
      [`${ns}-table`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none" },
        children: [`${ns}-thead`, `${ns}-tbody`],
      },
      [`${ns}-thead`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "md", align: "center", className: "border-b border-border pb-2" },
        children: [
          `${ns}-th-0`,
          `${ns}-th-1`,
          `${ns}-th-2`,
          `${ns}-th-3`,
          `${ns}-th-4`,
        ],
      },
      [`${ns}-th-0`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-[2]" },
        children: [`${ns}-th-0-t`],
      },
      [`${ns}-th-0-t`]: { type: "Text", props: { text: "Subject", variant: "muted", className: null } },
      [`${ns}-th-1`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-th-1-t`],
      },
      [`${ns}-th-1-t`]: { type: "Text", props: { text: "Status", variant: "muted", className: null } },
      [`${ns}-th-2`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-th-2-t`],
      },
      [`${ns}-th-2-t`]: { type: "Text", props: { text: "Priority", variant: "muted", className: null } },
      [`${ns}-th-3`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-th-3-t`],
      },
      [`${ns}-th-3-t`]: { type: "Text", props: { text: "Assignee", variant: "muted", className: null } },
      [`${ns}-th-4`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-th-4-t`],
      },
      [`${ns}-th-4-t`]: { type: "Text", props: { text: "Created", variant: "muted", className: null } },

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
          ...(detailStatePath ? { clickable: true } : {}),
        },
        children: [
          `${ns}-cell-0`,
          `${ns}-cell-1`,
          `${ns}-cell-2`,
          `${ns}-cell-3`,
          `${ns}-cell-4`,
        ],
        ...(detailStatePath && rowPressActions.length
          ? { on: { press: rowPressActions } }
          : {}),
      },
      [`${ns}-cell-0`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-[2]" },
        children: [`${ns}-cell-0-v`],
      },
      [`${ns}-cell-0-v`]: { type: "Text", props: { text: { $item: "Subject" }, variant: "body" } },
      [`${ns}-cell-1`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-cell-1-v`],
      },
      [`${ns}-cell-1-v`]: { type: "Badge", props: { text: { $item: "Status" }, variant: "secondary" } },
      [`${ns}-cell-2`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-cell-2-v`],
      },
      [`${ns}-cell-2-v`]: { type: "Badge", props: { text: { $item: "Priority" }, variant: "outline" } },
      [`${ns}-cell-3`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-cell-3-v`],
      },
      [`${ns}-cell-3-v`]: { type: "Text", props: { text: { $item: "Assignee" }, variant: "muted" } },
      [`${ns}-cell-4`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-cell-4-v`],
      },
      [`${ns}-cell-4-v`]: { type: "Text", props: { text: { $item: "CreatedAt" }, variant: "muted" } },

      // Empty state
      [`${ns}-empty`]: {
        type: "Empty",
        props: { title: "No tickets", description: "No tickets match the current filters." },
        visible: { $state: `/queries/${listDs}/page/total`, eq: 0 },
      },
    };

    // New ticket button + inline form
    if (showNewButton) {
      elements[`${ns}-new-btn`] = {
        type: "Button",
        props: { label: "New Ticket", variant: "primary", disabled: null },
        on: {
          press: [
            {
              action: "setState",
              params: { statePath: `/ui/${ns}/showNewForm`, value: true },
            },
          ],
        },
      };
      elements[`${ns}-new-form`] = {
        type: "Stack",
        props: {
          direction: "vertical",
          gap: "sm",
          className: "rounded-xl border border-border bg-card p-4",
        },
        visible: { $state: `/ui/${ns}/showNewForm`, eq: true },
        children: [
          `${ns}-new-subject`,
          `${ns}-new-requester`,
          `${ns}-new-priority`,
          `${ns}-new-actions`,
        ],
      };
      elements[`${ns}-new-subject`] = {
        type: "Input",
        props: {
          label: "Subject",
          name: "Subject",
          type: "text",
          value: { $bindState: `${formPath}/Subject` },
          placeholder: "Ticket subject…",
        },
      };
      elements[`${ns}-new-requester`] = {
        type: "Input",
        props: {
          label: "Requester",
          name: "Requester",
          type: "text",
          value: { $bindState: `${formPath}/Requester` },
          placeholder: "Requester name…",
        },
      };
      elements[`${ns}-new-priority`] = {
        type: "Select",
        props: {
          label: "Priority",
          name: "Priority",
          options: PRIORITIES,
          value: { $bindState: `${formPath}/Priority` },
          placeholder: "Select priority",
        },
      };
      elements[`${ns}-new-actions`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", justify: "end" },
        children: [`${ns}-new-cancel`, `${ns}-new-save`],
      };
      elements[`${ns}-new-cancel`] = {
        type: "Button",
        props: { label: "Cancel", variant: "secondary", disabled: null },
        on: {
          press: [
            {
              action: "setState",
              params: { statePath: `/ui/${ns}/showNewForm`, value: false },
            },
          ],
        },
      };
      elements[`${ns}-new-save`] = {
        type: "Button",
        props: { label: "Create", variant: "primary", disabled: null },
        on: { press: { action: "datasource.fire", params: { name: newDs } } },
      };
    }

    const datasources: Record<string, unknown> = {
      [listDs]: {
        type: "bdo.list",
        params: {
          bdo: "Ticket",
          Filter: {
            Operator: "AND",
            Condition: [
              { LHSField: "Subject", Operator: "CONTAINS", RHSValue: { $state: `${filterPath}/search` } },
              { LHSField: "Status", Operator: "EQ", RHSValue: { $state: `${filterPath}/status` } },
              { LHSField: "Priority", Operator: "EQ", RHSValue: { $state: `${filterPath}/priority` } },
            ],
          },
          Sort: [{ CreatedAt: "DESC" }],
          Page: { number: 1, size: pageSize },
        },
      },
    };

    if (showNewButton) {
      datasources[newDs] = {
        type: "bdo.save",
        params: {
          bdo: "Ticket",
          values: {
            Subject: { $state: `${formPath}/Subject` },
            Requester: { $state: `${formPath}/Requester` },
            Priority: { $state: `${formPath}/Priority` },
            Status: "Open",
          },
        },
        refresh: [listDs],
        on: {
          success: [
            { action: "setState", params: { statePath: `${formPath}/Subject`, value: "" } },
            { action: "setState", params: { statePath: `${formPath}/Requester`, value: "" } },
            { action: "setState", params: { statePath: `/ui/${ns}/showNewForm`, value: false } },
          ],
        },
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
            showNewForm: false,
          },
        },
        form: { [ns]: { Subject: "", Requester: "", Priority: "Medium" } },
      },
      init: [{ action: "datasource.refresh", params: { names: [listDs] } }],
    };
  },
};
