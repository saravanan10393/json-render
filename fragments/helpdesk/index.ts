/**
 * Helpdesk fragment bundle.
 *
 * Standard entity contracts these fragments expect (field ids are FIXED —
 * define entities with exactly these ids):
 *
 *   Ticket: Subject(text) Description(text)
 *           Status(select: Open|In Progress|Waiting|Resolved|Closed)
 *           Priority(select: Low|Medium|High|Urgent)
 *           Requester(text) Assignee(text) Category(select) CreatedAt(date)
 *   Agent:  Name(text) Email(text) Team(select) ResolvedCount(number)
 *   Reply:  TicketId(text) Author(text) Body(text) CreatedAt(date) Internal(boolean)
 */
import type { FragmentRegistry } from "@/lib/jr/schema";
import { SLAStats } from "./SLAStats";
import { TicketQueue } from "./TicketQueue";
import { TicketDetail } from "./TicketDetail";
import { AgentLeaderboard } from "./AgentLeaderboard";
import { ReplyThread } from "./ReplyThread";

export const helpdeskFragments = {
  SLAStats,
  TicketQueue,
  TicketDetail,
  AgentLeaderboard,
  ReplyThread,
} as unknown as FragmentRegistry;
