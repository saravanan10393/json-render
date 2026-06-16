/**
 * ActivityLog — reverse-chronological Activity list + inline quick-add.
 *
 * Layout (Card):
 *   1. Repeat list: Type badge + Subject (body) + Date (muted)
 *   2. Empty state
 *   3. Add row: Subject Input + Type Select + "Log" button
 *
 * Datasources:
 *   <ns>-list — bdo.list Activity, Sort Date DESC, Page 50
 *   <ns>-add  — bdo.save CREATE Activity, values from /form/<ns>/Subject + Type,
 *               refresh [<ns>-list], on.success resets Subject to ""
 *
 * State seed: /form/<ns>: { Subject: "", Type: "Note" }
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  title: z.string().default("Activity Log").describe("Card title."),
  pageSize: z.number().int().min(5).max(100).default(25),
});
type P = z.infer<typeof Params>;

export const ActivityLog: Fragment<P> = {
  id: "fragment-activity-log",
  name: "Activity Log",
  version: "1.0.0",
  description:
    "CRM Activity timeline: reverse-chronological list of Activity records (Type badge + Subject + Date) " +
    "with an inline quick-add row. " +
    "Entity contract: Activity(Subject:text, Type:select[Call|Email|Meeting|Note], RelatedTo:text, Date:date, Notes:text). " +
    "Datasources: '<ns>-list' (bdo.list Activity sorted by Date DESC) and '<ns>-add' (bdo.save CREATE, " +
    "binds /form/<ns>/Subject and /form/<ns>/Type, refreshes list on success).",
  whenToUse:
    "Use when the user wants a timeline or log of recent activities — calls, emails, meetings, or notes — shown newest first, with a quick inline way to log a new entry.",
  category: "display",
  params: Params as z.ZodType<P>,
  build: ({ title, pageSize }, ns) => {
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
        children: [`${ns}-activity-row`],
      },
      [`${ns}-activity-row`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center", className: "border-b border-border py-2" },
        children: [`${ns}-activity-type`, `${ns}-activity-subject`, `${ns}-activity-date`],
      },
      [`${ns}-activity-type`]: {
        type: "Badge",
        props: { text: { $item: "Type" }, variant: "secondary" },
      },
      [`${ns}-activity-subject`]: {
        type: "Text",
        props: { text: { $item: "Subject" }, variant: "body" },
      },
      [`${ns}-activity-date`]: {
        type: "Text",
        props: { text: { $item: "Date" }, variant: "muted" },
      },

      // Empty state
      [`${ns}-empty`]: {
        type: "Empty",
        props: { title: "No activities yet", description: "Log the first activity below." },
        visible: { $state: `/queries/${listDs}/page/total`, eq: 0 },
      },

      // Add row
      [`${ns}-add-row`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "end" },
        children: [`${ns}-add-subject`, `${ns}-add-type`, `${ns}-add-btn`],
      },
      [`${ns}-add-subject`]: {
        type: "Input",
        props: {
          label: "Subject",
          name: "Subject",
          type: "text",
          value: { $bindState: `${formPath}/Subject` },
          placeholder: "Activity subject…",
        },
      },
      [`${ns}-add-type`]: {
        type: "Select",
        props: {
          label: "Type",
          name: "Type",
          options: ["Call", "Email", "Meeting", "Note"],
          value: { $bindState: `${formPath}/Type` },
          placeholder: "Type",
        },
      },
      [`${ns}-add-btn`]: {
        type: "Button",
        props: { label: "Log", variant: "primary", disabled: null },
        on: { press: { action: "datasource.fire", params: { name: addDs } } },
      },
    };

    return {
      root: ns,
      elements: elements as never,
      state: { form: { [ns]: { Subject: "", Type: "Note" } } },
      datasources: {
        [listDs]: {
          type: "bdo.list",
          params: {
            bdo: "Activity",
            Sort: [{ Date: "DESC" }],
            Page: { number: 1, size: pageSize },
          },
        },
        [addDs]: {
          type: "bdo.save",
          params: {
            bdo: "Activity",
            values: {
              Subject: { $state: `${formPath}/Subject` },
              Type: { $state: `${formPath}/Type` },
            },
          },
          refresh: [listDs],
          on: {
            success: [
              { action: "setState", params: { statePath: `${formPath}/Subject`, value: "" } },
            ],
          },
        },
      } as never,
      init: [{ action: "datasource.refresh", params: { names: [listDs] } }],
    };
  },
};
