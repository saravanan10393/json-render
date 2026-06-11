/**
 * Retrieval check — see exactly what the agent's searchFragments tool would
 * return for a query (use it to tune a fragment's description/whenToUse).
 *
 *   bun run fragment:search "browse products with filters"
 *
 * Syncs the index first (hash-guarded no-op when clean), so it always tests
 * the registry as it exists on disk. Requires OPENROUTER_API_KEY.
 */
import { fragmentRegistry } from "../fragments";
import { searchFragments } from "../lib/server/fragment-index";

const query = process.argv.slice(2).join(" ").trim();
if (!query) {
  console.error('usage: bun run fragment:search "<query>"');
  process.exit(1);
}

const matches = await searchFragments(fragmentRegistry, query);
console.log(`query: "${query}"\n`);
if (matches.length === 0) {
  console.log("no matches (index empty?)");
  process.exit(0);
}
for (const m of matches) {
  const flag = m.belowThreshold ? "  ⚠ belowThreshold — library likely has nothing relevant" : "";
  console.log(`${m.name.padEnd(20)} score=${m.score}  cosine=${m.similarity}${flag}`);
}
console.log(
  "\nscore = similarity relative to the best match (cutoff ≥ 0.8); cosine = absolute similarity (floor 0.35).",
);
