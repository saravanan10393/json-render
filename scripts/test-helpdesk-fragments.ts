/**
 * Expansion + validation smoke test for the Helpdesk fragment bundle.
 * Run: bun scripts/test-helpdesk-fragments.ts
 *
 * Imports directly from the helpdesk bundle — does NOT rely on the combined
 * fragments/index.ts registry (other bundles may not be wired in yet).
 */
import { helpdeskFragments } from "../fragments/helpdesk";
import { expandFragments } from "../lib/server/fragment-expander";
import { validatePageSpec } from "../lib/server/spec-validators";
import type { EntityDefinition } from "../lib/server/entity-store";

const entities: EntityDefinition[] = [
  {
    name: "Ticket",
    label: "Tickets",
    fields: [
      { id: "Subject", name: "Subject", type: "text" },
      { id: "Description", name: "Description", type: "text" },
      { id: "Status", name: "Status", type: "select", options: ["Open", "In Progress", "Waiting", "Resolved", "Closed"] },
      { id: "Priority", name: "Priority", type: "select", options: ["Low", "Medium", "High", "Urgent"] },
      { id: "Requester", name: "Requester", type: "text" },
      { id: "Assignee", name: "Assignee", type: "text" },
      { id: "Category", name: "Category", type: "select", options: ["Billing", "Technical", "General", "Account"] },
      { id: "CreatedAt", name: "Created At", type: "date" },
    ],
  },
  {
    name: "Agent",
    label: "Agents",
    fields: [
      { id: "Name", name: "Name", type: "text" },
      { id: "Email", name: "Email", type: "text" },
      { id: "Team", name: "Team", type: "select", options: ["Support", "Engineering", "Billing"] },
      { id: "ResolvedCount", name: "Resolved Count", type: "number" },
    ],
  },
  {
    name: "Reply",
    label: "Replies",
    fields: [
      { id: "TicketId", name: "Ticket ID", type: "text" },
      { id: "Author", name: "Author", type: "text" },
      { id: "Body", name: "Body", type: "text" },
      { id: "CreatedAt", name: "Created At", type: "date" },
      { id: "Internal", name: "Internal", type: "boolean" },
    ],
  },
];

const PAGES: Record<string, { root: string; elements: Record<string, unknown>; state?: Record<string, unknown> }> = {
  "Helpdesk Dashboard": {
    root: "page",
    elements: {
      page: {
        type: "Stack",
        props: { direction: "vertical", gap: "lg", className: "p-8" },
        children: ["sla-stats", "agent-board"],
      },
      "sla-stats": {
        $fragment: "SLAStats",
        params: {
          stats: [
            { label: "Open Tickets", bdo: "Ticket", type: "COUNT", filterField: "Status", filterValue: "Open" },
            { label: "Urgent Tickets", bdo: "Ticket", type: "COUNT", filterField: "Priority", filterValue: "Urgent" },
            { label: "Resolved", bdo: "Ticket", type: "COUNT", filterField: "Status", filterValue: "Resolved" },
            { label: "Total Tickets", bdo: "Ticket", type: "COUNT" },
          ],
          columns: 4,
          showChart: true,
          chartEntity: "Ticket",
          chartGroupBy: "Priority",
        },
      },
      "agent-board": {
        $fragment: "AgentLeaderboard",
        params: {
          title: "Top Agents",
          limit: 10,
          height: 320,
        },
      },
    },
  },

  "Ticket Queue": {
    root: "page",
    elements: {
      page: {
        type: "Stack",
        props: { direction: "vertical", gap: "lg", className: "p-8" },
        children: ["ticket-queue"],
      },
      "ticket-queue": {
        $fragment: "TicketQueue",
        params: {
          pageSize: 25,
          detailStatePath: "/ui/selectedTicketId",
          showNewButton: true,
        },
      },
    },
  },

  "Ticket Detail": {
    root: "page",
    elements: {
      page: {
        type: "Stack",
        props: { direction: "vertical", gap: "lg", className: "p-8" },
        children: ["ticket-detail", "reply-thread"],
      },
      "ticket-detail": {
        $fragment: "TicketDetail",
        params: {
          idPath: "/ui/selectedTicketId",
          targetStatuses: ["In Progress", "Waiting", "Resolved", "Closed"],
        },
      },
      "reply-thread": {
        $fragment: "ReplyThread",
        params: {
          idPath: "/ui/selectedTicketId",
          title: "Replies",
          pageSize: 50,
        },
      },
    },
    state: { ui: { selectedTicketId: "" } },
  },
};

let failed = false;
for (const [name, page] of Object.entries(PAGES)) {
  const { spec, issues, expanded } = expandFragments(
    page as unknown as Record<string, unknown>,
    helpdeskFragments as any,
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
