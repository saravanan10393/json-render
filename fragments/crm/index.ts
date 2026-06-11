/**
 * CRM fragment bundle.
 *
 * Standard entity contracts these fragments expect (field ids are FIXED —
 * define entities with exactly these ids):
 *
 *   Contact:  Name(text) Email(text) Phone(text) Company(text)
 *             Title(text) Status(select: Lead|Active|Inactive)
 *   Company:  Name(text) Industry(select) Size(select: Small|Medium|Large|Enterprise)
 *             Website(text)
 *   Deal:     Name(text) ContactName(text) Company(text) Value(number)
 *             Stage(select: Lead|Qualified|Proposal|Won|Lost)
 *             CloseDate(date) Owner(text)
 *   Activity: Subject(text) Type(select: Call|Email|Meeting|Note)
 *             RelatedTo(text) Date(date) Notes(text)
 */
import type { FragmentRegistry } from "@/lib/jr/schema";
import { DealStats } from "./DealStats";
import { DealPipeline } from "./DealPipeline";
import { ContactCard } from "./ContactCard";
import { ContactDetail } from "./ContactDetail";
import { ActivityLog } from "./ActivityLog";

export const crmFragments = {
  DealStats,
  DealPipeline,
  ContactCard,
  ContactDetail,
  ActivityLog,
} as unknown as FragmentRegistry;
