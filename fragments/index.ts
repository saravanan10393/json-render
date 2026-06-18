/**
 * Fragment bundles — the SINGLE SOURCE OF TRUTH for what fragments exist and
 * how they group. Each entry maps 1:1 to a fragments/<name> folder and carries
 * its tier: "generic" (entity-agnostic — pass bdo + a field map) vs "domain"
 * (fixed entity contracts, shipped as a wired bundle, e.g. ecommerce).
 *
 * Everything derives from this list:
 *   - `fragmentRegistry` (below) — the flat name→fragment map the eject-on-write
 *     expander (lib/server/fragment-expander.ts) and the agent prompt
 *     enumerator consume. Names are GLOBALLY unique across all bundles.
 *   - the blocks showcase — groups by bundle/tier (showcase/blocks/blockMeta.ts
 *     imports `fragmentBundles` directly).
 *
 * To add a bundle, add ONE entry here; the agent and the showcase pick it up.
 * Server-safe: fragments import zod + types only.
 */
import type { FragmentRegistry } from "@/lib/jr/schema";
import { blogFragments } from "./blog";
import { crmFragments } from "./crm";
import { ecommerceFragments } from "./ecommerce";
import { genericFragments } from "./generic";
import { helpdeskFragments } from "./helpdesk";
import { projectsFragments } from "./projects";

export type FragmentTier = "generic" | "domain";

export interface FragmentBundle {
  /** Folder name under fragments/, also the showcase sub-group label. */
  name: string;
  tier: FragmentTier;
  fragments: FragmentRegistry;
}

export const fragmentBundles: FragmentBundle[] = [
  { name: "generic", tier: "generic", fragments: genericFragments },
  { name: "ecommerce", tier: "domain", fragments: ecommerceFragments },
  { name: "crm", tier: "domain", fragments: crmFragments },
  { name: "helpdesk", tier: "domain", fragments: helpdeskFragments },
  { name: "projects", tier: "domain", fragments: projectsFragments },
  { name: "blog", tier: "domain", fragments: blogFragments },
];

/**
 * Flat registry derived from the bundles — what the agent + expander consume.
 * Keyed by the fragment's `id` (the machine key the LLM emits as `$fragment`),
 * NOT the export-binding name. Duplicate ids are a build-time error.
 */
const allFragments = fragmentBundles.flatMap((b) => Object.values(b.fragments));
export const fragmentRegistry: FragmentRegistry = Object.fromEntries(
  allFragments.map((f) => [f.id, f]),
) as FragmentRegistry;

if (Object.keys(fragmentRegistry).length !== allFragments.length) {
  const seen = new Set<string>();
  const dupes = allFragments.map((f) => f.id).filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
  throw new Error(`Duplicate fragment id(s): ${[...new Set(dupes)].join(", ")}`);
}
