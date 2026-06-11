/**
 * ReplyThread — replies for a ticket + inline reply add.
 *
 * Layout (Card):
 *   1. Repeat list: Author badge + Internal-note badge (if Internal) + Body + CreatedAt
 *   2. Empty state
 *   3. Add reply row: Body textarea + Internal toggle + "Reply" button
 *
 * The page must:
 *   1. Seed idPath in state (e.g. "" or a real ticket id).
 *   2. When a ticket is selected, set idPath to the ticket _id.
 *
 * Datasources:
 *   <ns>-list — bdo.list Reply, filtered by TicketId EQ idPath, Sort CreatedAt ASC, skipUntilReady
 *   <ns>-add  — bdo.save CREATE Reply, values from /form/<ns>/Body + Internal + TicketId from idPath
 *               refresh [<ns>-list], on.success resets Body to ""
 *
 * State seed: /form/<ns>: { Body: "", Internal: false }
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  idPath: z
    .string()
    .describe(
      "State path holding the selected Ticket _id (e.g. /ui/selectedTicketId). " +
      "Replies are filtered to show only those with TicketId matching this value.",
    ),
  title: z.string().default("Reply Thread").describe("Card title."),
  pageSize: z.number().int().min(5).max(100).default(50),
});
type P = z.infer<typeof Params>;

export const ReplyThread: Fragment<P> = {
  name: "ReplyThread",
  version: "1.0.0",
  description:
    "Helpdesk reply thread: reverse-chronological list of Reply records for a ticket " +
    "(Author badge + optional 'Internal' note badge + Body + CreatedAt) " +
    "with an inline quick-reply form. Reads replies filtered by TicketId from idPath (skipUntilReady). " +
    "Entity contract: Reply(TicketId:text, Author:text, Body:text, CreatedAt:date, Internal:boolean). " +
    "The page must seed idPath in state. " +
    "Datasources: '<ns>-list' (bdo.list Reply filtered by TicketId, sorted CreatedAt ASC, skipUntilReady) " +
    "and '<ns>-add' (bdo.save CREATE Reply, binds /form/<ns>/Body and /form/<ns>/Internal and idPath).",
  category: "display",
  params: Params as z.ZodType<P>,
  build: ({ idPath, title, pageSize }, ns) => {
    const listDs = `${ns}-list`;
    const addDs = `${ns}-add`;
    const formPath = `/form/${ns}`;

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Card",
        props: { title, description: null, maxWidth: null, centered: null, className: null },
        children: [`${ns}-body`],
      },
      [`${ns}-body`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "md" },
        children: [`${ns}-list`, `${ns}-empty`, `${ns}-add-row`],
      },

      // Repeat list
      [`${ns}-list`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "sm" },
        repeat: { statePath: `/queries/${listDs}/data`, key: "_id" },
        children: [`${ns}-reply-row`],
      },
      [`${ns}-reply-row`]: {
        type: "Stack",
        props: {
          direction: "vertical",
          gap: "xs",
          className: "rounded-lg border border-border p-3",
        },
        children: [`${ns}-reply-meta`, `${ns}-reply-body`, `${ns}-reply-date`],
      },
      [`${ns}-reply-meta`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center" },
        children: [`${ns}-reply-author`, `${ns}-reply-internal`],
      },
      [`${ns}-reply-author`]: {
        type: "Badge",
        props: { text: { $item: "Author" }, variant: "secondary" },
      },
      [`${ns}-reply-internal`]: {
        type: "Badge",
        props: { text: "Internal", variant: "outline" },
        visible: { $item: "Internal", eq: true },
      },
      [`${ns}-reply-body`]: {
        type: "Text",
        props: { text: { $item: "Body" }, variant: "body" },
      },
      [`${ns}-reply-date`]: {
        type: "Text",
        props: { text: { $item: "CreatedAt" }, variant: "muted" },
      },

      // Empty state
      [`${ns}-empty`]: {
        type: "Empty",
        props: { title: "No replies yet", description: "Be the first to reply." },
        visible: { $state: `/queries/${listDs}/page/total`, eq: 0 },
      },

      // Add reply row
      [`${ns}-add-row`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "sm", className: "border-t border-border pt-3" },
        children: [`${ns}-add-body`, `${ns}-add-footer`],
      },
      [`${ns}-add-body`]: {
        type: "Input",
        props: {
          label: "Reply",
          name: "Body",
          type: "textarea",
          value: { $bindState: `${formPath}/Body` },
          placeholder: "Write a reply…",
        },
      },
      [`${ns}-add-footer`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center", justify: "between" },
        children: [`${ns}-add-internal`, `${ns}-add-btn`],
      },
      [`${ns}-add-internal`]: {
        type: "Input",
        props: {
          label: "Internal note",
          name: "Internal",
          type: "checkbox",
          value: { $bindState: `${formPath}/Internal` },
          placeholder: null,
        },
      },
      [`${ns}-add-btn`]: {
        type: "Button",
        props: { label: "Reply", variant: "primary", disabled: null },
        on: { press: { action: "datasource.fire", params: { name: addDs } } },
      },
    };

    return {
      root: ns,
      elements: elements as never,
      state: { form: { [ns]: { Body: "", Internal: false } } },
      datasources: {
        [listDs]: {
          type: "bdo.list",
          params: {
            bdo: "Reply",
            Filter: {
              Operator: "AND",
              Condition: [
                { LHSField: "TicketId", Operator: "EQ", RHSValue: { $state: idPath } },
              ],
            },
            Sort: [{ CreatedAt: "ASC" }],
            Page: { number: 1, size: pageSize },
          },
          skipUntilReady: true,
        },
        [addDs]: {
          type: "bdo.save",
          params: {
            bdo: "Reply",
            values: {
              Body: { $state: `${formPath}/Body` },
              Internal: { $state: `${formPath}/Internal` },
              TicketId: { $state: idPath },
            },
          },
          refresh: [listDs],
          on: {
            success: [
              { action: "setState", params: { statePath: `${formPath}/Body`, value: "" } },
              { action: "setState", params: { statePath: `${formPath}/Internal`, value: false } },
            ],
          },
        },
      } as never,
      init: [{ action: "datasource.refresh", params: { names: [listDs] } }],
    };
  },
};
