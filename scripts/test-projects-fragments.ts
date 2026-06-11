/**
 * Expansion + validation smoke test for the project-management fragment bundle.
 * Run: bun scripts/test-projects-fragments.ts
 */
import { projectsFragments } from "../fragments/projects";
import { expandFragments } from "../lib/server/fragment-expander";
import { validatePageSpec } from "../lib/server/spec-validators";
import type { EntityDefinition } from "../lib/server/entity-store";

const entities: EntityDefinition[] = [
  {
    name: "Project",
    label: "Projects",
    fields: [
      { id: "Name", name: "Name", type: "text" },
      { id: "Description", name: "Description", type: "text" },
      { id: "Status", name: "Status", type: "select", options: ["Planning", "Active", "OnHold", "Done"] },
      { id: "Owner", name: "Owner", type: "text" },
      { id: "DueDate", name: "Due Date", type: "date" },
    ],
  },
  {
    name: "Task",
    label: "Tasks",
    fields: [
      { id: "Title", name: "Title", type: "text" },
      { id: "ProjectName", name: "Project Name", type: "text" },
      { id: "Assignee", name: "Assignee", type: "text" },
      { id: "Status", name: "Status", type: "select", options: ["Todo", "In Progress", "Review", "Done"] },
      { id: "Priority", name: "Priority", type: "select", options: ["Low", "Medium", "High"] },
      { id: "Estimate", name: "Estimate", type: "number" },
      { id: "DueDate", name: "Due Date", type: "date" },
    ],
  },
  {
    name: "Member",
    label: "Members",
    fields: [
      { id: "Name", name: "Name", type: "text" },
      { id: "Role", name: "Role", type: "text" },
      { id: "Email", name: "Email", type: "text" },
    ],
  },
];

const PAGES: Record<string, { root: string; elements: Record<string, unknown>; state?: Record<string, unknown> }> = {
  "Dashboard": {
    root: "page",
    elements: {
      page: {
        type: "Stack",
        props: { direction: "vertical", gap: "lg", className: "p-8" },
        children: ["sprint-stats", "member-workload"],
      },
      "sprint-stats": {
        $fragment: "SprintStats",
        params: {
          stats: [
            { label: "Total Tasks", bdo: "Task", type: "COUNT" },
            { label: "Done", bdo: "Task", type: "COUNT", filterField: "Status", filterValue: "Done" },
            { label: "In Progress", bdo: "Task", type: "COUNT", filterField: "Status", filterValue: "In Progress" },
            { label: "Total Estimate", bdo: "Task", type: "SUM", field: "Estimate" },
          ],
          columns: 4,
          showChart: true,
          chartEntity: "Task",
          chartGroupBy: "Status",
        },
      },
      "member-workload": {
        $fragment: "MemberWorkload",
        params: {
          title: "Member Workload",
          limit: 10,
          height: 320,
          openStatuses: ["Todo", "In Progress", "Review"],
        },
      },
    },
  },
  "Board": {
    root: "page",
    elements: {
      page: {
        type: "Stack",
        props: { direction: "vertical", gap: "lg", className: "p-8" },
        children: ["project-board"],
      },
      "project-board": {
        $fragment: "ProjectBoard",
        params: {
          statuses: ["Todo", "In Progress", "Review", "Done"],
          pageSize: 20,
        },
      },
    },
  },
  "Tasks": {
    root: "page",
    elements: {
      page: {
        type: "Stack",
        props: { direction: "vertical", gap: "lg", className: "p-8" },
        children: ["task-list"],
      },
      "task-list": {
        $fragment: "TaskList",
        params: {
          pageSize: 25,
          showDelete: true,
        },
      },
    },
  },
  "Milestones": {
    root: "page",
    elements: {
      page: {
        type: "Stack",
        props: { direction: "vertical", gap: "lg", className: "p-8" },
        children: ["milestone-timeline"],
      },
      "milestone-timeline": {
        $fragment: "MilestoneTimeline",
        params: {
          title: "Milestone Timeline",
          pageSize: 25,
          sortOrder: "ASC",
        },
      },
    },
  },
};

let failed = false;
for (const [name, page] of Object.entries(PAGES)) {
  const { spec, issues, expanded } = expandFragments(
    page as unknown as Record<string, unknown>,
    projectsFragments,
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
