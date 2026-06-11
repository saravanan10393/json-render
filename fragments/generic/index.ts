/** Generic widget kit — entity-agnostic fragments modeled on the rapp widget set. */
import type { FragmentRegistry } from "@/lib/jr/schema";
import { PageHeader } from "./PageHeader";
import { StatsRow } from "./StatsRow";
import { ChartCard } from "./ChartCard";
import { Leaderboard } from "./Leaderboard";
import { ProgressTracker } from "./ProgressTracker";
import { RecentList } from "./RecentList";
import { ActivityTimeline } from "./ActivityTimeline";

export const genericFragments = {
  PageHeader,
  StatsRow,
  ChartCard,
  Leaderboard,
  ProgressTracker,
  RecentList,
  ActivityTimeline,
} as unknown as FragmentRegistry;
