/**
 * ContactDetail — full detail view for one Contact + related Deals.
 *
 * Layout:
 *   - Header band: Name (h1), Company (subtitle), Status badge
 *   - Facts card: Email, Phone, Title
 *   - Related deals table filtered by ContactName EQ value at contactNameStatePath
 *
 * The page must:
 *   1. Seed idPath in state (e.g. "" or a real id).
 *   2. Seed contactNameStatePath in state (the Contact's Name string).
 *   3. When a contact row is selected, setState both idPath (the _id) and
 *      contactNameStatePath (the Name field value).
 *
 * Datasources:
 *   <ns>-get    — bdo.get Contact by idPath, skipUntilReady
 *   <ns>-deals  — bdo.list Deal filtered by ContactName EQ contactNameStatePath,
 *                 skipUntilReady
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  idPath: z
    .string()
    .describe("State path holding the selected Contact _id (e.g. /ui/selectedContactId)."),
  contactNameStatePath: z
    .string()
    .optional()
    .describe(
      "State path holding the selected Contact Name for filtering related deals " +
      "(e.g. /ui/selectedContactName). Defaults to /ui/<ns>/contactName.",
    ),
});
type P = z.infer<typeof Params>;

export const ContactDetail: Fragment<P> = {
  id: "fragment-contact-detail",
  name: "Contact Detail",
  version: "1.0.0",
  description:
    "CRM detail panel for one Contact: Name/Company/Status header, Email/Phone/Title facts, " +
    "and a related Deals table filtered by ContactName. Reads Contact via bdo.get (skipUntilReady). " +
    "The page must seed idPath and contactNameStatePath in state, and set both when a contact is selected. " +
    "Entity contract: Contact(Name, Email, Phone, Company, Title, Status:select[Lead|Active|Inactive]); " +
    "Deal(Name, ContactName, Value:number, Stage:select, CloseDate:date, Owner). " +
    "Datasources: '<ns>-get' (bdo.get Contact), '<ns>-deals' (bdo.list Deal filtered by ContactName).",
  whenToUse:
    "Use when the user wants to see one contact's full profile — email, phone, job title, company, and status — together with a table of the deals linked to that person.",
  category: "display",
  previewParams: {
    idPath: "/ui/selectedContactId",
    contactNameStatePath: "/ui/selectedContactName",
  },
  params: Params as z.ZodType<P>,
  build: ({ idPath, contactNameStatePath }, ns) => {
    const getDs = `${ns}-get`;
    const dealsDs = `${ns}-deals`;
    const namePath = contactNameStatePath ?? `/ui/${ns}/contactName`;
    const get = (field: string) => ({ $datasource: `${getDs}/data/${field}` });

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "vertical", gap: "lg" },
        children: [`${ns}-header`, `${ns}-facts-section`, `${ns}-deals-section`],
      },

      // ── Header ──────────────────────────────────────────────────────── //
      [`${ns}-header`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "sm", className: "border-b border-border pb-4" },
        children: [`${ns}-header-top`, `${ns}-header-company`],
      },
      [`${ns}-header-top`]: {
        type: "Stack",
        props: { direction: "horizontal", justify: "between", align: "center" },
        children: [`${ns}-header-name`, `${ns}-header-status`],
      },
      [`${ns}-header-name`]: {
        type: "Heading",
        props: { text: get("Name"), level: "h1" },
      },
      [`${ns}-header-status`]: {
        type: "Badge",
        props: { text: get("Status"), variant: "secondary" },
      },
      [`${ns}-header-company`]: {
        type: "Text",
        props: { text: get("Company"), variant: "muted" },
      },

      // ── Facts ────────────────────────────────────────────────────────── //
      [`${ns}-facts-section`]: {
        type: "Card",
        props: { title: "Contact Info", description: null, maxWidth: null, centered: null, className: null },
        children: [`${ns}-facts`],
      },
      [`${ns}-facts`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "lg", align: "center" },
        children: [`${ns}-fact-email`, `${ns}-fact-phone`, `${ns}-fact-title`],
      },

      [`${ns}-fact-email`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none" },
        children: [`${ns}-fact-email-label`, `${ns}-fact-email-value`],
      },
      [`${ns}-fact-email-label`]: {
        type: "Text",
        props: { text: "Email", variant: "muted" },
      },
      [`${ns}-fact-email-value`]: {
        type: "Text",
        props: { text: get("Email"), variant: "body" },
      },

      [`${ns}-fact-phone`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none" },
        children: [`${ns}-fact-phone-label`, `${ns}-fact-phone-value`],
      },
      [`${ns}-fact-phone-label`]: {
        type: "Text",
        props: { text: "Phone", variant: "muted" },
      },
      [`${ns}-fact-phone-value`]: {
        type: "Text",
        props: { text: get("Phone"), variant: "body" },
      },

      [`${ns}-fact-title`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none" },
        children: [`${ns}-fact-title-label`, `${ns}-fact-title-value`],
      },
      [`${ns}-fact-title-label`]: {
        type: "Text",
        props: { text: "Title", variant: "muted" },
      },
      [`${ns}-fact-title-value`]: {
        type: "Text",
        props: { text: get("Title"), variant: "body" },
      },

      // ── Related Deals ────────────────────────────────────────────────── //
      [`${ns}-deals-section`]: {
        type: "Card",
        props: { title: "Related Deals", description: null, maxWidth: null, centered: null, className: null },
        children: [`${ns}-deals-head`, `${ns}-deals-rows`, `${ns}-deals-empty`],
      },
      [`${ns}-deals-head`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "md", align: "center", className: "border-b border-border pb-2" },
        children: [
          `${ns}-deals-head-0`,
          `${ns}-deals-head-1`,
          `${ns}-deals-head-2`,
          `${ns}-deals-head-3`,
        ],
      },
      [`${ns}-deals-head-0`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-deals-head-0-t`],
      },
      [`${ns}-deals-head-0-t`]: { type: "Text", props: { text: "Deal", variant: "muted", className: null } },
      [`${ns}-deals-head-1`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-deals-head-1-t`],
      },
      [`${ns}-deals-head-1-t`]: { type: "Text", props: { text: "Stage", variant: "muted", className: null } },
      [`${ns}-deals-head-2`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-deals-head-2-t`],
      },
      [`${ns}-deals-head-2-t`]: { type: "Text", props: { text: "Value", variant: "muted", className: null } },
      [`${ns}-deals-head-3`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-deals-head-3-t`],
      },
      [`${ns}-deals-head-3-t`]: { type: "Text", props: { text: "Close Date", variant: "muted", className: null } },

      [`${ns}-deals-rows`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none" },
        repeat: { statePath: `/queries/${dealsDs}/data`, key: "_id" },
        children: [`${ns}-deals-row`],
      },
      [`${ns}-deals-row`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "md", align: "center", className: "border-b border-border py-2" },
        children: [
          `${ns}-deals-cell-0`,
          `${ns}-deals-cell-1`,
          `${ns}-deals-cell-2`,
          `${ns}-deals-cell-3`,
        ],
      },
      [`${ns}-deals-cell-0`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-deals-cell-0-v`],
      },
      [`${ns}-deals-cell-0-v`]: { type: "Text", props: { text: { $item: "Name" }, variant: "body" } },
      [`${ns}-deals-cell-1`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-deals-cell-1-v`],
      },
      [`${ns}-deals-cell-1-v`]: { type: "Badge", props: { text: { $item: "Stage" }, variant: "secondary" } },
      [`${ns}-deals-cell-2`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-deals-cell-2-v`],
      },
      [`${ns}-deals-cell-2-v`]: { type: "Text", props: { text: { $item: "Value" }, variant: "body" } },
      [`${ns}-deals-cell-3`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "none", align: "center", className: "flex-1" },
        children: [`${ns}-deals-cell-3-v`],
      },
      [`${ns}-deals-cell-3-v`]: { type: "Text", props: { text: { $item: "CloseDate" }, variant: "muted" } },

      [`${ns}-deals-empty`]: {
        type: "Empty",
        props: { title: "No deals", description: "No deals linked to this contact." },
        visible: { $state: `/queries/${dealsDs}/page/total`, eq: 0 },
      },
    };

    return {
      root: ns,
      elements: elements as never,
      datasources: {
        [getDs]: {
          type: "bdo.get",
          params: { bdo: "Contact", _id: { $state: idPath } },
          skipUntilReady: true,
        },
        [dealsDs]: {
          type: "bdo.list",
          params: {
            bdo: "Deal",
            Filter: {
              Operator: "AND",
              Condition: [{ LHSField: "ContactName", Operator: "EQ", RHSValue: { $state: namePath } }],
            },
            Page: { number: 1, size: 20 },
          },
          skipUntilReady: true,
        },
      } as never,
      init: [{ action: "datasource.refresh", params: { names: [getDs, dealsDs] } }],
    };
  },
};
