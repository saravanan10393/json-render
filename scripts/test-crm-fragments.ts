/**
 * Expansion + validation smoke test for the CRM fragment bundle.
 * Run: bun scripts/test-crm-fragments.ts
 */
import { fragmentRegistry } from "../fragments";
import { expandFragments } from "../lib/server/fragment-expander";
import { validatePageSpec } from "../lib/server/spec-validators";
import type { EntityDefinition } from "../lib/server/entity-store";

const entities: EntityDefinition[] = [
  {
    name: "Contact",
    label: "Contacts",
    fields: [
      { id: "Name", name: "Name", type: "text" },
      { id: "Email", name: "Email", type: "text" },
      { id: "Phone", name: "Phone", type: "text" },
      { id: "Company", name: "Company", type: "text" },
      { id: "Title", name: "Title", type: "text" },
      { id: "Status", name: "Status", type: "select", options: ["Lead", "Active", "Inactive"] },
    ],
  },
  {
    name: "Company",
    label: "Companies",
    fields: [
      { id: "Name", name: "Name", type: "text" },
      { id: "Industry", name: "Industry", type: "select", options: ["Tech", "Finance", "Healthcare"] },
      { id: "Size", name: "Size", type: "select", options: ["Small", "Medium", "Large", "Enterprise"] },
      { id: "Website", name: "Website", type: "text" },
    ],
  },
  {
    name: "Deal",
    label: "Deals",
    fields: [
      { id: "Name", name: "Name", type: "text" },
      { id: "ContactName", name: "Contact Name", type: "text" },
      { id: "Company", name: "Company", type: "text" },
      { id: "Value", name: "Value", type: "number" },
      { id: "Stage", name: "Stage", type: "select", options: ["Lead", "Qualified", "Proposal", "Won", "Lost"] },
      { id: "CloseDate", name: "Close Date", type: "date" },
      { id: "Owner", name: "Owner", type: "text" },
    ],
  },
  {
    name: "Activity",
    label: "Activities",
    fields: [
      { id: "Subject", name: "Subject", type: "text" },
      { id: "Type", name: "Type", type: "select", options: ["Call", "Email", "Meeting", "Note"] },
      { id: "RelatedTo", name: "Related To", type: "text" },
      { id: "Date", name: "Date", type: "date" },
      { id: "Notes", name: "Notes", type: "text" },
    ],
  },
];

const PAGES: Record<string, { root: string; elements: Record<string, unknown>; state?: Record<string, unknown> }> = {
  "CRM Dashboard": {
    root: "page",
    elements: {
      page: { type: "Stack", props: { direction: "vertical", gap: "lg", className: "p-8" }, children: ["deal-stats", "deal-stage-chart"] },
      "deal-stats": {
        $fragment: "DealStats",
        params: {
          stats: [
            { label: "Total Deals", bdo: "Deal", type: "COUNT" },
            { label: "Won Deals", bdo: "Deal", type: "COUNT", filterField: "Stage", filterValue: "Won" },
            { label: "Total Value", bdo: "Deal", type: "SUM", field: "Value", prefix: "$" },
            { label: "Won Value", bdo: "Deal", type: "SUM", field: "Value", filterField: "Stage", filterValue: "Won", prefix: "$" },
          ],
          columns: 4,
          showChart: true,
          chartEntity: "Deal",
          chartGroupBy: "Stage",
        },
      },
      "deal-stage-chart": {
        $fragment: "DealStats",
        params: {
          stats: [
            { label: "Leads", bdo: "Deal", type: "COUNT", filterField: "Stage", filterValue: "Lead" },
          ],
          columns: 2,
          showChart: false,
        },
      },
    },
  },
  "Pipeline": {
    root: "page",
    elements: {
      page: { type: "Stack", props: { direction: "vertical", gap: "lg", className: "p-8" }, children: ["pipeline"] },
      pipeline: {
        $fragment: "DealPipeline",
        params: {
          stages: ["Lead", "Qualified", "Proposal", "Won", "Lost"],
          pageSize: 20,
        },
      },
    },
  },
  "Contacts": {
    root: "page",
    elements: {
      page: { type: "Stack", props: { direction: "vertical", gap: "lg", className: "p-8" }, children: ["contact-cards"] },
      "contact-cards": {
        $fragment: "ContactCard",
        params: {
          columns: 3,
          pageSize: 12,
          detailStatePath: "/ui/selectedContactId",
        },
      },
    },
  },
  "Contact Detail": {
    root: "page",
    elements: {
      page: { type: "Stack", props: { direction: "vertical", gap: "lg", className: "p-8" }, children: ["contact-detail"] },
      "contact-detail": {
        $fragment: "ContactDetail",
        params: {
          idPath: "/ui/selectedContactId",
          contactNameStatePath: "/ui/selectedContactName",
        },
      },
    },
    state: { ui: { selectedContactId: "", selectedContactName: "" } },
  },
  "Activities": {
    root: "page",
    elements: {
      page: { type: "Stack", props: { direction: "vertical", gap: "lg", className: "p-8" }, children: ["activity-log"] },
      "activity-log": {
        $fragment: "ActivityLog",
        params: {
          pageSize: 25,
        },
      },
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
