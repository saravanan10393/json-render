/**
 * AgentLeaderboard — Agents ranked by ResolvedCount as a leaderboard chart.
 *
 * Uses bdo.metric GroupBy Name, SUM ResolvedCount to produce the series.
 * Renders a Chart with kind "leaderboard".
 *
 * Datasources:
 *   <ns>-metric — bdo.metric Agent, GroupBy Name, SUM ResolvedCount
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  title: z.string().default("Agent Leaderboard").describe("Card title."),
  limit: z
    .number()
    .int()
    .min(3)
    .max(20)
    .default(10)
    .describe("Max number of agents to show in the chart."),
  height: z
    .number()
    .int()
    .min(160)
    .max(600)
    .default(320)
    .describe("Chart height in pixels."),
});
type P = z.infer<typeof Params>;

export const AgentLeaderboard: Fragment<P> = {
  id: "fragment-agent-leaderboard",
  name: "Agent Leaderboard",
  version: "1.0.0",
  description:
    "Helpdesk agent leaderboard: ranks agents by ResolvedCount using a bdo.metric GroupBy Name SUM ResolvedCount. " +
    "Renders a 'leaderboard' Chart. " +
    "Entity contract: Agent(Name:text, Email:text, Team:select, ResolvedCount:number). " +
    "Datasource: '<ns>-metric' (bdo.metric Agent, GroupBy Name, SUM ResolvedCount).",
  whenToUse:
    "Use when the user wants to see which support agents are performing best — a ranked leaderboard of agents by how many tickets they have resolved.",
  category: "display",
  params: Params as z.ZodType<P>,
  build: ({ title, limit, height }, ns) => {
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
          labelKey: "Name",
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
            bdo: "Agent",
            Metric: [{ Type: "SUM", Field: "ResolvedCount" }],
            GroupBy: ["Name"],
          },
        },
      } as never,
      init: [{ action: "datasource.refresh", params: { names: [metricDs] } }],
    };
  },
};
