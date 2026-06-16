/**
 * MilestoneTimeline — Projects listed by DueDate as a timeline.
 *
 * Layout (Card):
 *   Repeat list: Status badge + Name (body) + DueDate (muted)
 *   Empty state
 *   Optional sort toggle (ASC/DESC by DueDate)
 *
 * Datasources:
 *   <ns>-list — bdo.list Project, Sort DueDate <sortOrder>, Page <pageSize>
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  title: z.string().default("Milestone Timeline").describe("Card title."),
  pageSize: z.number().int().min(5).max(100).default(25),
  sortOrder: z
    .enum(["ASC", "DESC"])
    .default("ASC")
    .describe("Sort Projects by DueDate: ASC = soonest first, DESC = latest first."),
});
type P = z.infer<typeof Params>;

export const MilestoneTimeline: Fragment<P> = {
  id: "fragment-milestone-timeline",
  name: "Milestone Timeline",
  version: "1.0.0",
  description:
    "Project-management milestone timeline: list of Projects sorted by DueDate (Status badge + Name + DueDate). " +
    "Entity contract: Project(Name, Description, Status:select[Planning|Active|OnHold|Done], Owner, DueDate:date). " +
    "Datasource: '<ns>-list' (bdo.list Project sorted by DueDate).",
  whenToUse:
    "Use when the user wants a timeline or roadmap of upcoming project milestones and deadlines — projects listed in due-date order with their status at a glance.",
  category: "display",
  params: Params as z.ZodType<P>,
  build: ({ title, pageSize, sortOrder }, ns) => {
    const listDs = `${ns}-list`;

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Card",
        props: { title, description: null, maxWidth: null, centered: null, className: null },
        children: [`${ns}-body`],
      },
      [`${ns}-body`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "md" },
        children: [`${ns}-list`, `${ns}-empty`],
      },

      // Repeat list
      [`${ns}-list`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "sm" },
        repeat: { statePath: `/queries/${listDs}/data`, key: "_id" },
        children: [`${ns}-milestone-row`],
      },
      [`${ns}-milestone-row`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center", className: "border-b border-border py-2" },
        children: [`${ns}-milestone-status`, `${ns}-milestone-name`, `${ns}-milestone-date`],
      },
      [`${ns}-milestone-status`]: {
        type: "Badge",
        props: { text: { $item: "Status" }, variant: "secondary" },
      },
      [`${ns}-milestone-name`]: {
        type: "Text",
        props: { text: { $item: "Name" }, variant: "body" },
      },
      [`${ns}-milestone-date`]: {
        type: "Text",
        props: { text: { $item: "DueDate" }, variant: "muted" },
      },

      // Empty state
      [`${ns}-empty`]: {
        type: "Empty",
        props: { title: "No milestones", description: "No projects with due dates found." },
        visible: { $state: `/queries/${listDs}/page/total`, eq: 0 },
      },
    };

    return {
      root: ns,
      elements: elements as never,
      datasources: {
        [listDs]: {
          type: "bdo.list",
          params: {
            bdo: "Project",
            Sort: [{ DueDate: sortOrder }],
            Page: { number: 1, size: pageSize },
          },
        },
      } as never,
      init: [{ action: "datasource.refresh", params: { names: [listDs] } }],
    };
  },
};
