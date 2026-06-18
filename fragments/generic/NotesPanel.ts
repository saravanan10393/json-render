/**
 * NotesPanel — reverse-chronological note list with an inline quick-add row.
 *
 * Layout: a Card containing:
 *   1. A Stack repeating over /queries/<ns>-list/data showing note content
 *      (+ dateField if given, + authorField if given).
 *   2. An Empty component (visible when list page/total === 0).
 *   3. An inline add row: Input for the content field + "Add" button.
 *
 * Datasources:
 *   <ns>-list  — bdo.list, Sort by dateField DESC (or _id DESC), Page size 50.
 *   <ns>-add   — bdo.save CREATE (no _id), values {[contentField]: {$state: /form/<ns>/<contentField>}},
 *                refresh [<ns>-list], on.success → reset /form/<ns>/<contentField> to "".
 *
 * State seed: /form/<ns>: {} (contentField sub-key is an empty string initially).
 * Init: refresh [<ns>-list].
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { textEl } from "./_shared";

const Params = z.object({
  entity: z.string().describe("BDO entity to list and add notes on."),
  title: z.string().default("Notes").describe("Card title."),
  contentField: z
    .string()
    .default("Content")
    .describe("Entity field id for the note text. The add input binds /form/<ns>/<contentField>."),
  dateField: z
    .string()
    .optional()
    .describe(
      "Optional entity field id for the note timestamp. Shown per row in muted text; list sorts by this field DESC.",
    ),
  authorField: z
    .string()
    .optional()
    .describe("Optional entity field id for the author. Shown per row in muted text."),
});
type P = z.infer<typeof Params>;

export const NotesPanel: Fragment<P> = {
  id: "fragment-notes-panel",
  name: "Notes Panel",
  version: "1.0.0",
  description:
    "Card showing a reverse-chronological list of notes plus an inline quick-add row. " +
    "Datasources: '<ns>-list' (bdo.list, sort by dateField DESC or _id DESC, page size 50) and " +
    "'<ns>-add' (bdo.save CREATE — no _id, values {[contentField]: state binding}, refreshes '<ns>-list', " +
    "on success resets the input to ''). " +
    "All field bindings are under /form/<ns>/<field>. " +
    "Pair with a detail page: pass the entity and the relevant content/date/author fields.",
  whenToUse:
    "Use when the user wants to jot down and read notes or comments on a page — a running list of short text entries with a quick-add box at the bottom.",
  category: "display",
  previewParams: {
    entity: "Product",
    title: "Notes",
    contentField: "Description",
  },
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const listDs = `${ns}-list`;
    const addDs = `${ns}-add`;
    const formPath = `/form/${ns}`;
    const inputBind = { $bindState: `${formPath}/${params.contentField}` };

    // Row children: content always shown; date and author conditionally
    const rowChildren = [`${ns}-note-content`];
    if (params.dateField) rowChildren.push(`${ns}-note-date`);
    if (params.authorField) rowChildren.push(`${ns}-note-author`);

    const elements: Record<string, Record<string, unknown>> = {
      // Root card
      [ns]: {
        type: "Card",
        props: { title: params.title, description: null, maxWidth: null, centered: null, className: null },
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
        children: [`${ns}-note-row`],
      },
      [`${ns}-note-row`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none", className: "border-b border-border py-2" },
        children: rowChildren,
      },
      [`${ns}-note-content`]: textEl({ $item: params.contentField }, "body"),

      // Empty state
      [`${ns}-empty`]: {
        type: "Empty",
        props: { title: "No notes yet", description: "Add the first note below." },
        visible: { $state: `/queries/${listDs}/page/total`, eq: 0 },
      },

      // Add row
      [`${ns}-add-row`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "end" },
        children: [`${ns}-add-input`, `${ns}-add-btn`],
      },
      [`${ns}-add-input`]: {
        type: "Input",
        props: {
          label: params.contentField,
          name: params.contentField,
          type: "text",
          value: inputBind,
          placeholder: "Add a note…",
        },
      },
      [`${ns}-add-btn`]: {
        type: "Button",
        props: { label: "Add", variant: "primary", disabled: null },
        on: { press: { action: "datasource.fire", params: { name: addDs } } },
      },
    };

    if (params.dateField) {
      elements[`${ns}-note-date`] = textEl({ $item: params.dateField }, "muted");
    }
    if (params.authorField) {
      elements[`${ns}-note-author`] = textEl({ $item: params.authorField }, "muted");
    }

    const sort = params.dateField
      ? [{ [params.dateField]: "DESC" }]
      : [{ _id: "DESC" }];

    const datasources: Record<string, Record<string, unknown>> = {
      [listDs]: {
        type: "bdo.list",
        params: {
          bdo: params.entity,
          Sort: sort,
          Page: { number: 1, size: 50 },
        },
      },
      [addDs]: {
        type: "bdo.save",
        params: {
          bdo: params.entity,
          values: { [params.contentField]: { $state: `${formPath}/${params.contentField}` } },
        },
        refresh: [listDs],
        on: {
          success: [
            {
              action: "setState",
              params: { statePath: `${formPath}/${params.contentField}`, value: "" },
            },
          ],
        },
      },
    };

    return {
      root: ns,
      elements: elements as never,
      state: { form: { [ns]: {} } },
      datasources: datasources as never,
      init: [{ action: "datasource.refresh", params: { names: [listDs] } }],
    };
  },
};
