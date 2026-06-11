/** RecordView — label/value grid of one record's fields. */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { DisplayKind, displayElements, textEl } from "./_shared";

// boolean display is not supported here (datasource-bound booleans cannot render Yes/No).
const DisplayKindNoBool = DisplayKind.exclude(["boolean"]);
type DisplayKindNoBoolT = z.infer<typeof DisplayKindNoBool>;

const Params = z.object({
  entity: z.string(),
  idPath: z.string().describe("State path holding the selected record id (e.g. /ui/selectedTaskId) — same contract as DetailHeader."),
  title: z.string().default("Details"),
  fields: z
    .array(
      z.object({
        field: z.string(),
        label: z.string(),
        display: DisplayKindNoBool.default("text").describe(
          "How the value renders. display 'boolean' is not supported here (datasource-bound booleans cannot render Yes/No).",
        ),
      }),
    )
    .min(1)
    .max(12),
  columns: z.number().int().min(1).max(3).default(2),
});
type P = z.infer<typeof Params>;

export const RecordView: Fragment<P> = {
  name: "RecordView",
  version: "1.0.0",
  description:
    "Detail body: a Card with a label/value grid of ONE record's fields (display kinds like DataTable " +
    "columns). Reads the id from idPath; datasource '<ns>-get'. Pair with DetailHeader on the same idPath. " +
    "display 'boolean' is not supported here (datasource-bound booleans cannot render Yes/No).",
  whenToUse:
    "Use on a detail page when the user wants to see one record's fields laid out as labeled values — like a customer profile or order summary.",
  category: "display",
  previewParams: {
    entity: "Order",
    idPath: "/ui/selectedOrderId",
    title: "Order details",
    fields: [
      { field: "CustomerName", label: "Customer" },
      { field: "Email", label: "Email" },
      { field: "Status", label: "Status", display: "badge" },
      { field: "Total", label: "Total", display: "money" },
      { field: "City", label: "City" },
      { field: "PlacedAt", label: "Placed at", display: "date" },
    ],
    columns: 2,
  },
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const ds = `${ns}-get`;
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Card",
        props: { title: params.title, description: null, maxWidth: null, centered: null, className: null },
        children: [`${ns}-grid`],
      },
      [`${ns}-grid`]: {
        type: "Grid",
        props: { columns: params.columns, gap: "md" },
        children: params.fields.map((_, i) => `${ns}-f-${i}`),
      },
    };
    params.fields.forEach((f, i) => {
      const val = displayElements(
        `${ns}-f-${i}-value`,
        f.display as DisplayKindNoBoolT,
        { $datasource: `${ds}/data/${f.field}` },
      );
      elements[`${ns}-f-${i}`] = {
        type: "Stack",
        props: { direction: "vertical", gap: "none" },
        children: [`${ns}-f-${i}-label`, val.rootKey],
      };
      elements[`${ns}-f-${i}-label`] = textEl(f.label, "muted");
      Object.assign(elements, val.elements);
    });
    return {
      root: ns,
      elements: elements as never,
      datasources: {
        [ds]: {
          type: "bdo.get",
          params: { bdo: params.entity, _id: { $state: params.idPath } },
          skipUntilReady: true,
        },
      } as never,
      init: [{ action: "datasource.refresh", params: { names: [ds] } }],
    };
  },
};
