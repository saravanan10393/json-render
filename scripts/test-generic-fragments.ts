/**
 * Expansion + validation smoke test for the GENERIC kit. Three pages exercise
 * all 16 fragments against a Task/Customer model. Run: bun scripts/test-generic-fragments.ts
 */
import { fragmentRegistry } from "../fragments";
import { expandFragments } from "../lib/server/fragment-expander";
import { validatePageSpec } from "../lib/server/spec-validators";
import type { EntityDefinition } from "../lib/server/entity-store";

const entities: EntityDefinition[] = [
  {
    name: "Task",
    label: "Tasks",
    fields: [
      { id: "Title", name: "Title", type: "text" },
      { id: "Description", name: "Description", type: "text" },
      { id: "Status", name: "Status", type: "select", options: ["Open", "In Progress", "Done"] },
      { id: "Priority", name: "Priority", type: "select", options: ["Low", "Medium", "High"] },
      { id: "DueDate", name: "Due date", type: "date" },
      { id: "Estimate", name: "Estimate", type: "number" },
      { id: "Done", name: "Done", type: "boolean" },
      { id: "CustomerId", name: "Customer", type: "text" },
    ],
  },
  {
    name: "Customer",
    label: "Customers",
    fields: [
      { id: "Name", name: "Name", type: "text" },
      { id: "Email", name: "Email", type: "text" },
    ],
  },
];

// Pages reference fragments; each kit task adds its refs + parent children.
// `state` is optional — detail pages seed the idPath keys the validator checks.
const PAGES: Record<string, { root: string; elements: Record<string, unknown>; state?: Record<string, unknown> }> = {
  Dashboard: {
    root: "page",
    elements: {
      page: { type: "Stack", props: { direction: "vertical", gap: "lg", className: "p-8" }, children: [] },
    },
  },
  Tasks: {
    root: "page",
    elements: {
      page: { type: "Stack", props: { direction: "vertical", gap: "lg", className: "p-8" }, children: [] },
    },
  },
  "Task Detail": {
    root: "page",
    elements: {
      page: { type: "Stack", props: { direction: "vertical", gap: "lg", className: "p-8" }, children: [] },
    },
  },
};

let failed = false;
for (const [name, page] of Object.entries(PAGES)) {
  const { spec, issues, expanded } = expandFragments(
    page as unknown as Record<string, unknown>,
    fragmentRegistry,
  );
  if (issues.length) {
    failed = true;
    console.error(`${name}: EXPANSION ISSUES`);
    for (const i of issues) console.error("  -", i);
    continue;
  }
  const v = validatePageSpec({
    spec,
    validPageNames: Object.keys(PAGES),
    entities,
  });
  if (v.length) {
    failed = true;
    console.error(`${name}: VALIDATION ISSUES`);
    for (const i of v) console.error("  -", i);
    continue;
  }
  console.log(
    `${name}: ${expanded.length} fragments → ${Object.keys(spec.elements as object).length} elements, ` +
    `${Object.keys((spec.datasources as object) ?? {}).length} datasources — clean ✓`,
  );
}
process.exit(failed ? 1 : 0);
