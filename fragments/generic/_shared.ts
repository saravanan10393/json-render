/**
 * Shared param schemas + spec-JSON builders for the generic widget kit.
 * Everything here emits PLAIN spec JSON (elements/datasources) — no React.
 * All element keys passed in MUST already be ns-prefixed by the caller.
 */
import { z } from "zod";

// ── Param shapes ──────────────────────────────────────────────────────── //

export const FilterPair = z.object({
  field: z.string().describe("Entity field id (LHS)."),
  operator: z
    .enum(["EQ", "NEQ", "GT", "GTE", "LT", "LTE", "CONTAINS"])
    .default("EQ"),
  value: z.union([z.string(), z.number(), z.boolean()]).describe("Literal RHS value."),
});
export type FilterPairT = z.infer<typeof FilterPair>;

export const FilterBinding = z.object({
  field: z.string().describe("Entity field id (LHS)."),
  operator: z.enum(["EQ", "NEQ", "GT", "GTE", "LT", "LTE", "CONTAINS"]).default("EQ"),
  stateKey: z
    .string()
    .optional()
    .describe("Key under /filters/<ns>/ the RHS binds to — defaults to the field id. A FilterBar with targetNs=<ns> writes these keys."),
});
export type FilterBindingT = z.infer<typeof FilterBinding>;

export const DisplayKind = z
  .enum(["text", "muted", "money", "date", "badge", "boolean", "rating", "progress"])
  .describe("How the value renders.");
export type DisplayKindT = z.infer<typeof DisplayKind>;

export const FormFieldDef = z.object({
  field: z.string().describe("Entity field id."),
  label: z.string(),
  input: z
    .enum(["text", "textarea", "number", "date", "boolean", "select", "reference"])
    .default("text")
    .describe("date renders a text input expecting YYYY-MM-DD. reference renders a Combobox over another entity."),
  options: z.array(z.string()).optional().describe("select only — fixed options."),
  lookupEntity: z.string().optional().describe("reference only — the entity to list."),
  lookupLabelField: z.string().optional().describe("reference only — field shown as the option label (stored value is the record _id)."),
});
export type FormFieldDefT = z.infer<typeof FormFieldDef>;

// ── Datasource builders ───────────────────────────────────────────────── //

export function andFilter(conditions: Array<Record<string, unknown>>): Record<string, unknown> | undefined {
  return conditions.length ? { Operator: "AND", Condition: conditions } : undefined;
}

export function literalConditions(pairs: FilterPairT[] = []): Array<Record<string, unknown>> {
  return pairs.map((p) => ({ LHSField: p.field, Operator: p.operator, RHSValue: p.value }));
}

/** Conditions whose RHS binds /filters/<ns>/<stateKey> — null/""/"All" prune at runtime. */
export function boundConditions(ns: string, bindings: FilterBindingT[] = []): Array<Record<string, unknown>> {
  return bindings.map((b) => ({
    LHSField: b.field,
    Operator: b.operator,
    RHSValue: { $state: `/filters/${ns}/${b.stateKey ?? b.field}` },
  }));
}

export function metricDs(
  entity: string,
  metric: { Type: string; Field?: string },
  opts: { groupBy?: string[]; filter?: Record<string, unknown> } = {},
): Record<string, unknown> {
  return {
    type: "bdo.metric",
    params: {
      bdo: entity,
      Metric: [metric],
      ...(opts.groupBy?.length ? { GroupBy: opts.groupBy } : {}),
      ...(opts.filter ? { Filter: opts.filter } : {}),
    },
  };
}

// ── Element builders ──────────────────────────────────────────────────── //

type El = Record<string, unknown>;

export function textEl(text: unknown, variant = "body"): El {
  return { type: "Text", props: { text, variant } };
}

/**
 * Elements for one display-kind value. Returns the root key plus all elements
 * (money needs a 2-child Stack). `keyBase` must be ns-prefixed.
 * `ref` is the value expression: {$item}, {$state} or {$datasource}.
 * boolean: with an {$item} ref renders a Yes/No badge via $cond; with any
 * other ref it falls back to showing the raw value in a Badge.
 */
export function displayElements(
  keyBase: string,
  display: DisplayKindT,
  ref: Record<string, unknown>,
): { rootKey: string; elements: Record<string, El> } {
  switch (display) {
    case "money":
      return {
        rootKey: keyBase,
        elements: {
          [keyBase]: { type: "Stack", props: { direction: "horizontal", gap: "none", align: "center" }, children: [`${keyBase}-sym`, `${keyBase}-val`] },
          [`${keyBase}-sym`]: textEl("$", "muted"),
          [`${keyBase}-val`]: textEl(ref, "body"),
        },
      };
    case "badge":
      return { rootKey: keyBase, elements: { [keyBase]: { type: "Badge", props: { text: ref, variant: "secondary" } } } };
    case "boolean": {
      const text =
        "$item" in ref
          ? { $cond: { $item: ref.$item as string, eq: true }, $then: "Yes", $else: "No" }
          : ref;
      return { rootKey: keyBase, elements: { [keyBase]: { type: "Badge", props: { text, variant: "outline" } } } };
    }
    case "rating":
      return { rootKey: keyBase, elements: { [keyBase]: { type: "Rating", props: { value: ref, max: 5, symbol: null, icons: null, readOnly: true, name: null } } } };
    case "progress":
      return { rootKey: keyBase, elements: { [keyBase]: { type: "Progress", props: { value: ref, max: 100, label: null } } } };
    case "date":
    case "muted":
      return { rootKey: keyBase, elements: { [keyBase]: textEl(ref, "muted") } };
    default:
      return { rootKey: keyBase, elements: { [keyBase]: textEl(ref, "body") } };
  }
}

/** KPI value: currency gets a "$" prefix Stack, else a bare Heading. */
export function kpiValueElements(
  keyBase: string,
  format: "plain" | "currency" | "percent",
  valueRef: Record<string, unknown>,
): { rootKey: string; elements: Record<string, El> } {
  if (format === "currency") {
    return {
      rootKey: keyBase,
      elements: {
        [keyBase]: { type: "Stack", props: { direction: "horizontal", gap: "none", align: "center" }, children: [`${keyBase}-sym`, `${keyBase}-val`] },
        [`${keyBase}-sym`]: { type: "Heading", props: { text: "$", level: "h2" } },
        [`${keyBase}-val`]: { type: "Heading", props: { text: valueRef, level: "h2" } },
      },
    };
  }
  return {
    rootKey: keyBase,
    elements:
      format === "percent"
        ? {
            [keyBase]: { type: "Stack", props: { direction: "horizontal", gap: "none", align: "center" }, children: [`${keyBase}-val`, `${keyBase}-sym`] },
            [`${keyBase}-val`]: { type: "Heading", props: { text: valueRef, level: "h2" } },
            [`${keyBase}-sym`]: { type: "Heading", props: { text: "%", level: "h2" } },
          }
        : { [keyBase]: { type: "Heading", props: { text: valueRef, level: "h2" } } },
  };
}

/**
 * One form field bound at `<formPath>/<field>`. Returns the field's root
 * element key, its elements, and any lookup datasources (reference inputs).
 * Lookup datasource names land in the fragment's init refresh list.
 */
export function formFieldOutput(
  ns: string,
  f: FormFieldDefT,
  formPath: string,
): { rootKey: string; elements: Record<string, El>; datasources: Record<string, Record<string, unknown>> } {
  const key = `${ns}-field-${f.field.toLowerCase()}`;
  const bind = { $bindState: `${formPath}/${f.field}` };
  switch (f.input) {
    case "textarea":
      return { rootKey: key, elements: { [key]: { type: "Textarea", props: { label: f.label, name: f.field, value: bind, placeholder: null } } }, datasources: {} };
    case "number":
      return { rootKey: key, elements: { [key]: { type: "Input", props: { label: f.label, name: f.field, type: "number", value: bind, placeholder: null } } }, datasources: {} };
    case "date":
      return { rootKey: key, elements: { [key]: { type: "Input", props: { label: f.label, name: f.field, type: "text", value: bind, placeholder: "YYYY-MM-DD" } } }, datasources: {} };
    case "boolean":
      return { rootKey: key, elements: { [key]: { type: "Checkbox", props: { label: f.label, name: f.field, checked: bind } } }, datasources: {} };
    case "select":
      return { rootKey: key, elements: { [key]: { type: "Select", props: { label: f.label, name: f.field, options: f.options ?? [], value: bind, placeholder: f.label } } }, datasources: {} };
    case "reference": {
      const ds = `${ns}-lookup-${f.field.toLowerCase()}`;
      return {
        rootKey: key,
        elements: {
          [key]: { type: "Stack", props: { direction: "vertical", gap: "sm" }, children: [`${key}-label`, `${key}-input`] },
          [`${key}-label`]: textEl(f.label, "muted"),
          [`${key}-input`]: { type: "Combobox", props: { value: bind, options: { $datasource: `${ds}/data` }, labelKey: f.lookupLabelField ?? null, placeholder: f.label, name: f.field } },
        },
        datasources: { [ds]: { type: "bdo.list", params: { bdo: f.lookupEntity ?? "", Page: { number: 1, size: 100 } } } },
      };
    }
    default:
      return { rootKey: key, elements: { [key]: { type: "Input", props: { label: f.label, name: f.field, type: "text", value: bind, placeholder: null } } }, datasources: {} };
  }
}
