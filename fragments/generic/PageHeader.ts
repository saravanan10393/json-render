/**
 * PageHeader — title + subtitle + action buttons. Actions either navigate to a
 * page (kind "navigate", target = page NAME) or open a sibling dialog fragment
 * (kind "openDialog", target = the dialog instance ns → sets /ui/<target>/open).
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { textEl } from "./_shared";

const Params = z.object({
  title: z.string(),
  subtitle: z.string().nullable().default(null),
  actions: z
    .array(
      z.object({
        label: z.string(),
        kind: z.enum(["navigate", "openDialog"]).default("navigate"),
        target: z.string().describe('navigate: a page NAME. openDialog: a same-page RecordFormDialog instance id (its ns).'),
        variant: z.enum(["primary", "secondary"]).default("primary"),
      }),
    )
    .default([]),
});
type P = z.infer<typeof Params>;

export const PageHeader: Fragment<P> = {
  name: "PageHeader",
  version: "1.0.0",
  description:
    "Page title + subtitle + action buttons. Actions: kind 'navigate' (target = page name) or " +
    "'openDialog' (target = a same-page RecordFormDialog/FormCard instance id — opens /ui/<target>/open " +
    "and clears its edit id so the dialog is in create mode). Use at the top of every page. Action variants are primary|secondary only (no danger in headers).",
  whenToUse:
    "Use at the top of every page for the page title and subtitle, plus primary buttons like 'Add new' or links that jump to other pages.",
  category: "layout",
  previewParams: {
    title: "Products",
    subtitle: "Browse and manage the product catalog",
    actions: [{ label: "Go to orders", kind: "navigate", target: "Orders", variant: "primary" }],
  },
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "horizontal", justify: "between", align: "center" },
        children: [`${ns}-text`, ...(params.actions.length ? [`${ns}-actions`] : [])],
      },
      [`${ns}-text`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none" },
        children: [`${ns}-title`, ...(params.subtitle ? [`${ns}-subtitle`] : [])],
      },
      [`${ns}-title`]: { type: "Heading", props: { text: params.title, level: "h1" } },
      ...(params.subtitle ? { [`${ns}-subtitle`]: textEl(params.subtitle, "muted") } : {}),
    };
    if (params.actions.length) {
      elements[`${ns}-actions`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm" },
        children: params.actions.map((_, i) => `${ns}-action-${i}`),
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
    }
    return { root: ns, elements: elements as never };
  },
};
