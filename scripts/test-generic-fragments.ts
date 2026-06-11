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
      page: { type: "Stack", props: { direction: "vertical", gap: "lg", className: "p-8" }, children: ["header", "stats", "status-chart", "top-priorities", "done-progress", "recent", "timeline"] },
      header: {
        $fragment: "PageHeader",
        params: {
          title: "Task Dashboard",
          subtitle: "Live overview of all tasks",
          actions: [{ label: "View tasks", kind: "navigate", target: "Tasks" }],
        },
      },
      stats: {
        $fragment: "StatsRow",
        params: {
          entity: "Task",
          stats: [
            { label: "Total tasks", type: "COUNT" },
            { label: "Open", type: "COUNT", filter: [{ field: "Status", operator: "EQ", value: "Open" }] },
            { label: "Total estimate", type: "SUM", field: "Estimate", format: "currency" },
          ],
        },
      },
      "status-chart": {
        $fragment: "ChartCard",
        params: { entity: "Task", title: "Tasks by status", kind: "donut", groupBy: "Status" },
      },
      "top-priorities": {
        $fragment: "Leaderboard",
        params: { entity: "Task", title: "Estimate by priority", metricType: "SUM", field: "Estimate", groupBy: "Priority", limit: 5 },
      },
      "done-progress": {
        $fragment: "ProgressTracker",
        params: { entity: "Task", title: "Done tasks vs target", target: 20, filter: [{ field: "Status", operator: "EQ", value: "Done" }] },
      },
      recent: {
        $fragment: "RecentList",
        params: { entity: "Task", title: "Recently due", titleField: "Title", sublabelField: "Priority", dateField: "DueDate", limit: 5, pressTarget: "Tasks" },
      },
      timeline: {
        $fragment: "ActivityTimeline",
        params: { entity: "Task", title: "Task timeline", titleField: "Title", dateField: "DueDate", descriptionField: "Status", limit: 8 },
      },
    },
  },
  Tasks: {
    root: "page",
    elements: {
      page: { type: "Stack", props: { direction: "vertical", gap: "lg", className: "p-8" }, children: ["table", "cards", "board", "task-form"] },
      "task-form": {
        $fragment: "RecordFormDialog",
        params: {
          entity: "Task",
          title: "Task",
          fields: [
            { field: "Title", label: "Title", input: "text" },
            { field: "Description", label: "Description", input: "textarea" },
            { field: "Status", label: "Status", input: "select", options: ["Open", "In Progress", "Done"] },
            { field: "Estimate", label: "Estimate", input: "number" },
            { field: "DueDate", label: "Due date", input: "date" },
            { field: "Done", label: "Done", input: "boolean" },
            { field: "CustomerId", label: "Customer", input: "reference", lookupEntity: "Customer", lookupLabelField: "Name" },
          ],
          refresh: ["table-list", "cards-list", "board-col-0", "board-col-1", "board-col-2"],
        },
      },
      table: {
        $fragment: "DataTable",
        params: {
          entity: "Task",
          columns: [
            { field: "Title", label: "Title", display: "text" },
            { field: "Status", label: "Status", display: "badge" },
            { field: "Estimate", label: "Estimate", display: "money" },
            { field: "Done", label: "Done", display: "boolean" },
            { field: "DueDate", label: "Due", display: "date" },
          ],
          searchable: true,
          pageSize: 10,
          filterBindings: [{ field: "Status", operator: "EQ" }],
          rowActions: ["edit", "delete"],
          formDialogNs: "task-form",
        },
      },
      cards: {
        $fragment: "CardGrid",
        params: { entity: "Task", titleField: "Title", subtitleFields: ["Priority", "DueDate"], badgeField: "Status", columns: 3, pageSize: 9, filterBindings: [{ field: "Status" }] },
      },
      board: {
        $fragment: "KanbanBoard",
        params: { entity: "Task", statusField: "Status", statusOptions: ["Open", "In Progress", "Done"], titleField: "Title", metaFields: ["Priority"] },
      },
    },
  },
  "Task Detail": {
    root: "page",
    elements: {
      page: { type: "Stack", props: { direction: "vertical", gap: "lg", className: "p-8" }, children: ["related", "new-task"] },
      "new-task": {
        $fragment: "FormCard",
        params: {
          entity: "Task",
          title: "New task",
          fields: [
            { field: "Title", label: "Title", input: "text" },
            { field: "Status", label: "Status", input: "select", options: ["Open", "In Progress", "Done"] },
          ],
          refresh: ["related-list"],
          successTarget: "Tasks",
        },
      },
      related: {
        $fragment: "RelatedList",
        params: {
          entity: "Task",
          title: "Tasks for this customer",
          parentField: "CustomerId",
          parentIdPath: "/ui/selectedCustomerId",
          columns: [
            { field: "Title", label: "Title", display: "text" },
            { field: "Status", label: "Status", display: "badge" },
          ],
        },
      },
    },
    state: { ui: { selectedCustomerId: "" } },
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
