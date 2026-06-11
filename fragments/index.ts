/**
 * Fragment registry — unions every category bundle. The eject-on-write
 * expander (lib/server/fragment-expander.ts) and the agent prompt enumerator
 * both consume this map. Server-safe: fragments import zod + types only.
 *
 * Bundles: ecommerce (8) + generic kit (18) + four domain bundles
 * (crm, helpdesk, projects, blog — 5 each). Fragment names are GLOBALLY
 * unique across all bundles (one flat map).
 */
import type { FragmentRegistry } from "@/lib/jr/schema";
import { blogFragments } from "./blog";
import { crmFragments } from "./crm";
import { ecommerceFragments } from "./ecommerce";
import { genericFragments } from "./generic";
import { helpdeskFragments } from "./helpdesk";
import { projectsFragments } from "./projects";

export const fragmentRegistry: FragmentRegistry = {
  ...ecommerceFragments,
  ...genericFragments,
  ...crmFragments,
  ...helpdeskFragments,
  ...projectsFragments,
  ...blogFragments,
};
