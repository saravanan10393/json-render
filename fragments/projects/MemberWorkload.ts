/**
 * MemberWorkload — Members ranked by assigned open-task count as a leaderboard chart.
 *
 * Uses bdo.metric GroupBy Assignee COUNT (with open-status filter) to produce the series.
 * Renders a Chart with kind "leaderboard".
 *
 * Datasources:
 *   <ns>-metric — bdo.metric Task, GroupBy Assignee, COUNT (filtered to open statuses)
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  title: z.string().default("Member Workload").describe("Card title."),
  limit: z
    .number()
    .int()
    .min(3)
    .max(20)
    .default(10)
    .describe("Max number of members to show in the chart."),
  height: z
    .number()
    .int()
    .min(160)
    .max(600)
    .default(320)
    .describe("Chart height in pixels."),
  openStatuses: z
    .array(z.string())
    .default(["Todo", "In Progress", "Review"])
    .describe("Task statuses considered 'open' for workload counting."),
});
type P = z.infer<typeof Params>;

export const MemberWorkload: Fragment<P> = {
  id: "fragment-member-workload",
  name: "Member Workload",
  version: "1.0.0",
  description:
    "Project-management member workload chart: ranks members (Assignee) by open-task count " +
    "using bdo.metric GroupBy Assignee COUNT filtered to open statuses. " +
    "Renders a 'leaderboard' Chart. " +
    "Entity contract: Task(Title, ProjectName, Assignee, Status:select[Todo|In Progress|Review|Done], Priority:select[Low|Medium|High], Estimate:number, DueDate:date). " +
    "Datasource: '<ns>-metric' (bdo.metric Task, GroupBy Assignee, COUNT with Status IN open statuses).",
  whenToUse:
    "Use when the user wants to see who on the team is busiest or how work is spread across people — a ranked chart of team members by how many open tasks each one has.",
  category: "display",
  params: Params as z.ZodType<P>,
  build: ({ title, limit, height, openStatuses }, ns) => {
    const metricDs = `${ns}-metric`;

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Card",
        props: { title, description: null, maxWidth: null, centered: null, className: null },
        children: [`${ns}-chart`],
      },
      [`${ns}-chart`]: {
        type: "Chart",
        props: {
          kind: "leaderboard",
          data: { $datasource: `${metricDs}/data/series` },
          labelKey: "Assignee",
          valueKey: "value",
          sort: "desc",
          limit,
          height,
          valueFormat: "plain",
        },
      },
    };

    return {
      root: ns,
      elements: elements as never,
      datasources: {
        [metricDs]: {
          type: "bdo.metric",
          params: {
            bdo: "Task",
            Metric: [{ Type: "COUNT" }],
            GroupBy: ["Assignee"],
            Filter: {
              Operator: "OR",
              Condition: openStatuses.map((s) => ({
                LHSField: "Status",
                Operator: "EQ",
                RHSValue: s,
              })),
            },
          },
        },
      } as never,
      init: [{ action: "datasource.refresh", params: { names: [metricDs] } }],
    };
  },
};
