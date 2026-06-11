/**
 * ContactCard — grid of Contact records, each showing Name/Title/Company/Status.
 *
 * Clicking a card stores the contact _id to detailStatePath (for ContactDetail).
 *
 * Datasources:
 *   <ns>-list — bdo.list of Contact, Page size <pageSize>
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  columns: z.number().int().min(2).max(4).default(3),
  pageSize: z.number().int().min(6).max(50).default(12),
  detailStatePath: z
    .string()
    .optional()
    .describe("State path to write the clicked contact's _id into (e.g. /ui/selectedContactId)."),
});
type P = z.infer<typeof Params>;

export const ContactCard: Fragment<P> = {
  name: "ContactCard",
  version: "1.0.0",
  description:
    "CRM contact grid: cards showing Name, Title, Company, and Status badge. " +
    "Clicking a card writes the contact _id to detailStatePath for use with ContactDetail. " +
    "Entity contract: Contact(Name, Email, Phone, Company, Title, Status:select[Lead|Active|Inactive]). " +
    "Datasource: '<ns>-list' (bdo.list, Contact).",
  category: "display",
  params: Params as z.ZodType<P>,
  build: ({ columns, pageSize, detailStatePath }, ns) => {
    const ds = `${ns}-list`;

    const cardPressActions = detailStatePath
      ? [{ action: "setState", params: { statePath: detailStatePath, value: { $template: "${_id}" } } }]
      : [];

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "vertical", gap: "md" },
        children: [`${ns}-grid`, `${ns}-empty`],
      },
      [`${ns}-grid`]: {
        type: "Grid",
        props: { columns, gap: "md" },
        repeat: { statePath: `/queries/${ds}/data`, key: "_id" },
        children: [`${ns}-card`],
      },
      [`${ns}-card`]: {
        type: "Stack",
        props: {
          direction: "vertical",
          gap: "sm",
          className: "rounded-xl border border-border bg-card p-4",
          ...(detailStatePath ? { clickable: true } : {}),
        },
        children: [
          `${ns}-card-top`,
          `${ns}-card-company`,
          `${ns}-card-title-text`,
        ],
        ...(detailStatePath && cardPressActions.length
          ? { on: { press: cardPressActions } }
          : {}),
      },
      [`${ns}-card-top`]: {
        type: "Stack",
        props: { direction: "horizontal", justify: "between", align: "center" },
        children: [`${ns}-card-name`, `${ns}-card-status`],
      },
      [`${ns}-card-name`]: {
        type: "Text",
        props: { text: { $item: "Name" }, variant: "body" },
      },
      [`${ns}-card-status`]: {
        type: "Badge",
        props: { text: { $item: "Status" }, variant: "secondary" },
      },
      [`${ns}-card-company`]: {
        type: "Text",
        props: { text: { $item: "Company" }, variant: "muted" },
      },
      [`${ns}-card-title-text`]: {
        type: "Text",
        props: { text: { $item: "Title" }, variant: "muted" },
      },
      [`${ns}-empty`]: {
        type: "Empty",
        props: { title: "No contacts", description: "No contacts found." },
        visible: { $state: `/queries/${ds}/page/total`, eq: 0 },
      },
    };

    return {
      root: ns,
      elements: elements as never,
      datasources: {
        [ds]: {
          type: "bdo.list",
          params: {
            bdo: "Contact",
            Page: { number: 1, size: pageSize },
          },
        },
      } as never,
      init: [{ action: "datasource.refresh", params: { names: [ds] } }],
    };
  },
};
