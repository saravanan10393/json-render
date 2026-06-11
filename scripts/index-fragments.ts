/**
 * Sync the fragment registry into the vector index (data/builder.db).
 * Hash-guarded: only new/changed fragments are (re-)embedded; fragments
 * removed from the registry are deleted from the index.
 *
 *   bun run fragment:index
 */
import { fragmentRegistry } from "../fragments";
import { syncFragmentIndex } from "../lib/server/fragment-index";

const result = await syncFragmentIndex(fragmentRegistry);
console.log(
  [
    `indexed ${Object.keys(fragmentRegistry).length} fragments`,
    `added: ${result.added.length ? result.added.join(", ") : "—"}`,
    `updated: ${result.updated.length ? result.updated.join(", ") : "—"}`,
    `removed: ${result.removed.length ? result.removed.join(", ") : "—"}`,
    `unchanged: ${result.skipped}`,
  ].join("\n"),
);
