/**
 * Fragment registry — unions every category bundle. The eject-on-write
 * expander (lib/server/fragment-expander.ts) and the agent prompt enumerator
 * both consume this map. Server-safe: fragments import zod + types only.
 */
import type { FragmentRegistry } from "@/lib/jr/schema";
import { ecommerceFragments } from "./ecommerce";

export const fragmentRegistry: FragmentRegistry = {
  ...ecommerceFragments,
};
