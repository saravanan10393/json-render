/** Generic widget kit — entity-agnostic fragments modeled on the rapp widget set. */
import type { FragmentRegistry } from "@/lib/jr/schema";
import { PageHeader } from "./PageHeader";
import { StatsRow } from "./StatsRow";
import { ChartCard } from "./ChartCard";
import { Leaderboard } from "./Leaderboard";
import { ProgressTracker } from "./ProgressTracker";
import { RecentList } from "./RecentList";
import { ActivityTimeline } from "./ActivityTimeline";
import { DataTable } from "./DataTable";
import { CardGrid } from "./CardGrid";
import { RelatedList } from "./RelatedList";

export const genericFragments = {
  PageHeader,
  StatsRow,
  ChartCard,
  Leaderboard,
  ProgressTracker,
  RecentList,
  ActivityTimeline,
  DataTable,
  CardGrid,
  RelatedList,
} as unknown as FragmentRegistry;
