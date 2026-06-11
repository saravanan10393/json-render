/** DetailHeader — title band for a selected record: title/badge/facts/actions. */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { DisplayKind, displayElements, textEl } from "./_shared";

// boolean display is not supported here (datasource-bound booleans cannot render Yes/No).
const DisplayKindNoBool = DisplayKind.exclude(["boolean"]);
type DisplayKindNoBoolT = z.infer<typeof DisplayKindNoBool>;

const Params = z.object({
  entity: z.string(),
  idPath: z.string().describe("State path holding the selected record id (e.g. /ui/selectedTaskId)."),
  titleField: z.string(),
  subtitleField: z.string().optional(),
  badgeField: z.string().optional(),
  facts: z
    .array(
      z.object({
        field: z.string(),
        label: z.string(),
        display: DisplayKindNoBool.default("text").describe(
          "How the value renders. display 'boolean' is not supported here (datasource-bound booleans cannot render Yes/No).",
        ),
      }),
    )
    .max(4)
    .default([]),
  actions: z
    .array(
      z.object({
        label: z.string(),
        kind: z.enum(["navigate", "openDialog"]).default("navigate"),
        target: z.string().describe("navigate: a page NAME. openDialog: a same-page RecordFormDialog instance id — opens it in CREATE mode (editId null). To EDIT the current record instead, hand-wire a press that sets the dialog's editId to this page's idPath value before opening."),
        variant: z.enum(["primary", "secondary"]).default("secondary"),
      }),
    )
    .default([]),
});
type P = z.infer<typeof Params>;

export const DetailHeader: Fragment<P> = {
  name: "DetailHeader",
  version: "1.0.0",
  description:
    "Detail-page header for ONE record (id read from idPath): big title, optional subtitle/status badge, " +
    "a facts row, and action buttons (navigate or openDialog like PageHeader). Datasource '<ns>-get' " +
    "auto-refires when the id changes. Pair with RecordView/RelatedList on the same idPath. " +
    "display 'boolean' is not supported here (datasource-bound booleans cannot render Yes/No). openDialog actions open dialogs in CREATE mode — editing the current record needs a hand-wired editId setter.",
  category: "display",
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const ds = `${ns}-get`;
    const get = (field: string) => ({ $datasource: `${ds}/data/${field}` });
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "vertical", gap: "sm", className: "border-b border-border pb-4" },
        children: [`${ns}-top`, ...(params.facts.length ? [`${ns}-facts`] : [])],
      },
      [`${ns}-top`]: {
        type: "Stack",
        props: { direction: "horizontal", justify: "between", align: "center" },
        children: [`${ns}-titles`, `${ns}-right`],
      },
      [`${ns}-titles`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none" },
        children: [`${ns}-title`, ...(params.subtitleField ? [`${ns}-subtitle`] : [])],
      },
      [`${ns}-title`]: { type: "Heading", props: { text: get(params.titleField), level: "h1" } },
      ...(params.subtitleField ? { [`${ns}-subtitle`]: textEl(get(params.subtitleField), "muted") } : {}),
      [`${ns}-right`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center" },
        children: [
          ...(params.badgeField ? [`${ns}-badge`] : []),
          ...params.actions.map((_, i) => `${ns}-action-${i}`),
        ],
      },
      ...(params.badgeField
        ? { [`${ns}-badge`]: { type: "Badge", props: { text: get(params.badgeField), variant: "secondary" } } }
        : {}),
    };
    params.actions.forEach((a, i) => {
      elements[`${ns}-action-${i}`] = {
        type: "Button",
        props: { label: a.label, variant: a.variant, disabled: null },
        on: {
          press:
            a.kind === "navigate"
              ? { action: "ui.navigate", params: { to: a.target } }
              : [
                  { action: "setState", params: { statePath: `/ui/${a.target}/editId`, value: null } },
                  { action: "setState", params: { statePath: `/form/${a.target}`, value: {} } },
                  { action: "setState", params: { statePath: `/ui/${a.target}/open`, value: true } },
                ],
        },
      };
    });
    if (params.facts.length) {
      elements[`${ns}-facts`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "lg", align: "center" },
        children: params.facts.map((_, i) => `${ns}-fact-${i}`),
      };
      params.facts.forEach((f, i) => {
        const val = displayElements(`${ns}-fact-${i}-value`, f.display as DisplayKindNoBoolT, get(f.field));
        elements[`${ns}-fact-${i}`] = {
          type: "Stack",
          props: { direction: "vertical", gap: "none" },
          children: [`${ns}-fact-${i}-label`, val.rootKey],
        };
        elements[`${ns}-fact-${i}-label`] = textEl(f.label, "muted");
        Object.assign(elements, val.elements);
      });
    }
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
