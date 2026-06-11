/** Generic widget kit — entity-agnostic fragments modeled on the rapp widget set. */
import type { FragmentRegistry } from "@/lib/jr/schema";
import { PageHeader } from "./PageHeader";
import { StatsRow } from "./StatsRow";

export const genericFragments = {
  PageHeader,
  StatsRow,
} as unknown as FragmentRegistry;
