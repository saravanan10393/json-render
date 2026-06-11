/**
 * TicketDetail — full detail view for one Ticket with status-transition buttons.
 *
 * Layout:
 *   - Header: Subject (h1), Status badge, Priority badge
 *   - Facts card: Requester, Assignee, Category, CreatedAt
 *   - Description card
 *   - Status transitions: one button per target status that fires bdo.save
 *
 * Status-transition mechanism (mirrors DealPipeline's moveTo pattern):
 *   Each button: setState(pendingStatus = <literal>) → datasource.fire(<ns>-status)
 *   <ns>-status: bdo.save _id from idPath, Status from /ui/<ns>/pendingStatus
 *   On success: refreshes <ns>-get
 *
 * Datasources:
 *   <ns>-get    — bdo.get Ticket by idPath, skipUntilReady
 *   <ns>-status — bdo.save UPDATE Ticket, sets Status from /ui/<ns>/pendingStatus
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const STATUSES = ["Open", "In Progress", "Waiting", "Resolved", "Closed"] as const;

const Params = z.object({
  idPath: z
    .string()
    .describe("State path holding the selected Ticket _id (e.g. /ui/selectedTicketId)."),
  targetStatuses: z
    .array(z.enum(STATUSES))
    .default(["In Progress", "Waiting", "Resolved", "Closed"])
    .describe("Status values to show as transition buttons."),
});
type P = z.infer<typeof Params>;

export const TicketDetail: Fragment<P> = {
  name: "TicketDetail",
  version: "1.0.0",
  description:
    "Helpdesk detail panel for one Ticket: Subject/Status/Priority header, " +
    "Requester/Assignee/Category/CreatedAt facts, Description, and status-transition buttons. " +
    "Status buttons each set a pending status then fire bdo.save to update the ticket. " +
    "Reads Ticket via bdo.get (skipUntilReady). The page must seed idPath in state. " +
    "Entity contract: Ticket(Subject, Description, Status:select[Open|In Progress|Waiting|Resolved|Closed], " +
    "Priority:select[Low|Medium|High|Urgent], Requester, Assignee, Category:select, CreatedAt:date). " +
    "Datasources: '<ns>-get' (bdo.get Ticket), '<ns>-status' (bdo.save UPDATE Ticket Status).",
  category: "display",
  params: Params as z.ZodType<P>,
  build: ({ idPath, targetStatuses }, ns) => {
    const getDs = `${ns}-get`;
    const statusDs = `${ns}-status`;
    const ui = `/ui/${ns}`;
    const get = (field: string) => ({ $datasource: `${getDs}/data/${field}` });

    const statusBtnChildren = targetStatuses.map(
      (s, i) => `${ns}-status-btn-${i}`,
    );

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "vertical", gap: "lg" },
        children: [
          `${ns}-header`,
          `${ns}-facts-section`,
          `${ns}-desc-section`,
          `${ns}-transitions`,
        ],
      },

      // Header
      [`${ns}-header`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "sm", className: "border-b border-border pb-4" },
        children: [`${ns}-header-subject`, `${ns}-header-badges`],
      },
      [`${ns}-header-subject`]: {
        type: "Heading",
        props: { text: get("Subject"), level: "h1" },
      },
      [`${ns}-header-badges`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center" },
        children: [`${ns}-header-status`, `${ns}-header-priority`],
      },
      [`${ns}-header-status`]: {
        type: "Badge",
        props: { text: get("Status"), variant: "secondary" },
      },
      [`${ns}-header-priority`]: {
        type: "Badge",
        props: { text: get("Priority"), variant: "outline" },
      },

      // Facts
      [`${ns}-facts-section`]: {
        type: "Card",
        props: { title: "Ticket Info", description: null, maxWidth: null, centered: null, className: null },
        children: [`${ns}-facts`],
      },
      [`${ns}-facts`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "lg", align: "center", className: "flex-wrap" },
        children: [
          `${ns}-fact-requester`,
          `${ns}-fact-assignee`,
          `${ns}-fact-category`,
          `${ns}-fact-created`,
        ],
      },

      [`${ns}-fact-requester`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none" },
        children: [`${ns}-fact-requester-label`, `${ns}-fact-requester-value`],
      },
      [`${ns}-fact-requester-label`]: {
        type: "Text",
        props: { text: "Requester", variant: "muted" },
      },
      [`${ns}-fact-requester-value`]: {
        type: "Text",
        props: { text: get("Requester"), variant: "body" },
      },

      [`${ns}-fact-assignee`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none" },
        children: [`${ns}-fact-assignee-label`, `${ns}-fact-assignee-value`],
      },
      [`${ns}-fact-assignee-label`]: {
        type: "Text",
        props: { text: "Assignee", variant: "muted" },
      },
      [`${ns}-fact-assignee-value`]: {
        type: "Text",
        props: { text: get("Assignee"), variant: "body" },
      },

      [`${ns}-fact-category`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none" },
        children: [`${ns}-fact-category-label`, `${ns}-fact-category-value`],
      },
      [`${ns}-fact-category-label`]: {
        type: "Text",
        props: { text: "Category", variant: "muted" },
      },
      [`${ns}-fact-category-value`]: {
        type: "Text",
        props: { text: get("Category"), variant: "body" },
      },

      [`${ns}-fact-created`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none" },
        children: [`${ns}-fact-created-label`, `${ns}-fact-created-value`],
      },
      [`${ns}-fact-created-label`]: {
        type: "Text",
        props: { text: "Created", variant: "muted" },
      },
      [`${ns}-fact-created-value`]: {
        type: "Text",
        props: { text: get("CreatedAt"), variant: "body" },
      },

      // Description
      [`${ns}-desc-section`]: {
        type: "Card",
        props: { title: "Description", description: null, maxWidth: null, centered: null, className: null },
        children: [`${ns}-desc-text`],
      },
      [`${ns}-desc-text`]: {
        type: "Text",
        props: { text: get("Description"), variant: "body" },
      },

      // Status transitions
      [`${ns}-transitions`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "sm" },
        children: [`${ns}-transitions-label`, `${ns}-transitions-btns`],
      },
      [`${ns}-transitions-label`]: {
        type: "Text",
        props: { text: "Move to status:", variant: "muted" },
      },
      [`${ns}-transitions-btns`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center", className: "flex-wrap" },
        children: statusBtnChildren,
      },
    };

    // One button per target status
    targetStatuses.forEach((status, i) => {
      elements[`${ns}-status-btn-${i}`] = {
        type: "Button",
        props: { label: status, variant: "secondary", disabled: null },
        on: {
          press: [
            {
              action: "setState",
              params: { statePath: `${ui}/pendingStatus`, value: status },
            },
            {
              action: "datasource.fire",
              params: { name: statusDs },
            },
          ],
        },
      };
    });

    return {
      root: ns,
      elements: elements as never,
      state: { ui: { [ns]: { pendingStatus: null } } },
      datasources: {
        [getDs]: {
          type: "bdo.get",
          params: { bdo: "Ticket", _id: { $state: idPath } },
          skipUntilReady: true,
        },
        [statusDs]: {
          type: "bdo.save",
          params: {
            bdo: "Ticket",
            _id: { $state: idPath },
            values: {
              Status: { $state: `${ui}/pendingStatus` },
            },
          },
          refresh: [getDs],
          on: {
            success: [
              { action: "ui.toast", params: { message: "Status updated", kind: "default" } },
            ],
          },
        },
      } as never,
      init: [{ action: "datasource.refresh", params: { names: [getDs] } }],
    };
  },
};
