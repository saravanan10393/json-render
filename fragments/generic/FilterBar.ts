/**
 * FilterBar — filter inputs that write /filters/<targetNs>/* for a sibling
 * DataTable/CardGrid (whose filterBindings read the same keys). State-key
 * contract per kind:
 *   search       → search                 (target binds Search)
 *   select       → <field>                (EQ; "All" = no filter)
 *   boolean      → <field>                (EQ "true"/"false"; "All" = none)
 *   numberRange  → <field>Min, <field>Max (GTE/LTE bindings)
 *   dateRange    → <field>From, <field>To (GTE/LTE bindings)
 *   reference    → <field>                (EQ the picked record's _id)
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { textEl } from "./_shared";

const Params = z.object({
  targetNs: z.string().describe("Instance id of the DataTable/CardGrid this bar filters."),
  layout: z.enum(["toolbar", "sidebar"]).default("toolbar"),
  filters: z
    .array(
      z.object({
        field: z.string(),
        label: z.string(),
        kind: z.enum(["search", "select", "boolean", "numberRange", "dateRange", "reference"]),
        options: z.array(z.string()).optional().describe("select only."),
        lookupEntity: z.string().optional().describe("reference only."),
        lookupLabelField: z.string().optional().describe("reference only."),
      }),
    )
    .min(1)
    .max(6),
});
type P = z.infer<typeof Params>;

export const FilterBar: Fragment<P> = {
  name: "FilterBar",
  version: "1.0.0",
  description:
    "Filter inputs writing /filters/<targetNs>/* — the paired DataTable/CardGrid declares matching " +
    "filterBindings: select/boolean/reference → {field}, numberRange → {field, GTE, stateKey '<field>Min'} + " +
    "{field, LTE, '<field>Max'}, dateRange → '<field>From'/'<field>To', search → the target's Search param. " +
    "layout 'sidebar' renders a vertical Card (put it beside the list in a horizontal Stack). " +
    "If this bar has a search kind, set the target's searchable=false.",
  category: "browse",
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const base = `/filters/${params.targetNs}`;
    const horizontal = params.layout === "toolbar";
    const elements: Record<string, Record<string, unknown>> = {};
    const datasources: Record<string, Record<string, unknown>> = {};
    const seeds: Record<string, unknown> = {};
    const children: string[] = [];

    params.filters.forEach((f, i) => {
      const key = `${ns}-f-${i}`;
      children.push(key);
      if (f.kind === "search") {
        seeds.search = "";
        elements[key] = { type: "Input", props: { label: horizontal ? "" : f.label, name: "search", type: "text", placeholder: `Search ${f.label}…`, value: { $bindState: `${base}/search` } } };
      } else if (f.kind === "select") {
        seeds[f.field] = "All";
        elements[key] = { type: "Select", props: { label: f.label, name: f.field, options: ["All", ...(f.options ?? [])], value: { $bindState: `${base}/${f.field}` }, placeholder: f.label } };
      } else if (f.kind === "boolean") {
        seeds[f.field] = "All";
        elements[key] = { type: "Select", props: { label: f.label, name: f.field, options: ["All", "true", "false"], value: { $bindState: `${base}/${f.field}` }, placeholder: f.label } };
      } else if (f.kind === "numberRange" || f.kind === "dateRange") {
        const [a, b] = f.kind === "numberRange" ? ["Min", "Max"] : ["From", "To"];
        seeds[`${f.field}${a}`] = "";
        seeds[`${f.field}${b}`] = "";
        const inputType = f.kind === "numberRange" ? "number" : "text";
        const ph = f.kind === "dateRange" ? "YYYY-MM-DD" : "";
        elements[key] = { type: "Stack", props: { direction: "horizontal", gap: "sm", align: "end" }, children: [`${key}-a`, `${key}-b`] };
        elements[`${key}-a`] = { type: "Input", props: { label: `${f.label} ${a.toLowerCase()}`, name: `${f.field}${a}`, type: inputType, placeholder: ph, value: { $bindState: `${base}/${f.field}${a}` } } };
        elements[`${key}-b`] = { type: "Input", props: { label: `${f.label} ${b.toLowerCase()}`, name: `${f.field}${b}`, type: inputType, placeholder: ph, value: { $bindState: `${base}/${f.field}${b}` } } };
      } else {
        // reference
        const ds = `${ns}-lookup-${i}`;
        seeds[f.field] = "";
        datasources[ds] = { type: "bdo.list", params: { bdo: f.lookupEntity ?? "", Page: { number: 1, size: 100 } } };
        elements[key] = { type: "Stack", props: { direction: "vertical", gap: "sm" }, children: [`${key}-label`, `${key}-input`] };
        elements[`${key}-label`] = textEl(f.label, "muted");
        elements[`${key}-input`] = { type: "Combobox", props: { value: { $bindState: `${base}/${f.field}` }, options: { $datasource: `${ds}/data` }, labelKey: f.lookupLabelField ?? null, placeholder: f.label, name: f.field } };
      }
    });

    elements[ns] = horizontal
      ? { type: "Stack", props: { direction: "horizontal", gap: "md", align: "end", className: "flex-wrap" }, children }
      : { type: "Card", props: { title: "Filters", description: null, maxWidth: null, centered: null, className: "w-64 shrink-0" }, children: [`${ns}-body`] };
    if (!horizontal) {
      elements[`${ns}-body`] = { type: "Stack", props: { direction: "vertical", gap: "md" }, children };
    }

    const lookupNames = Object.keys(datasources);
    return {
      root: ns,
      elements: elements as never,
      state: { filters: { [params.targetNs]: seeds } },
      ...(lookupNames.length ? { datasources: datasources as never, init: [{ action: "datasource.refresh", params: { names: lookupNames } }] } : {}),
    };
  },
};
