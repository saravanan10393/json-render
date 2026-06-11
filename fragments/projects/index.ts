/**
 * Project-management fragment bundle.
 *
 * Standard entity contracts these fragments expect (field ids are FIXED —
 * define entities with exactly these ids):
 *
 *   Project: Name(text) Description(text)
 *            Status(select: Planning|Active|OnHold|Done)
 *            Owner(text) DueDate(date)
 *   Task:    Title(text) ProjectName(text) Assignee(text)
 *            Status(select: Todo|In Progress|Review|Done)
 *            Priority(select: Low|Medium|High)
 *            Estimate(number) DueDate(date)
 *   Member:  Name(text) Role(text) Email(text)
 */
import type { FragmentRegistry } from "@/lib/jr/schema";
import { SprintStats } from "./SprintStats";
import { ProjectBoard } from "./ProjectBoard";
import { TaskList } from "./TaskList";
import { MilestoneTimeline } from "./MilestoneTimeline";
import { MemberWorkload } from "./MemberWorkload";

export const projectsFragments = {
  SprintStats,
  ProjectBoard,
  TaskList,
  MilestoneTimeline,
  MemberWorkload,
} as unknown as FragmentRegistry;
