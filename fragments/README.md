# `fragments/` — prebuilt blocks for the app-builder agent

A **fragment** is a typed, tested building block: given `params` and a
namespace `ns`, it produces a json-render subtree (elements + datasources +
state seeds + init). The agent never sees fragment internals — it emits a tiny
reference and the **eject-on-write expander** materialises it to primitives
when the page is saved:

```jsonc
// what the agent emits inside spec.elements — the KEY becomes ns,
// the $fragment VALUE is the fragment's id (not its display name)
"products-grid": { "$fragment": "fragment-product-grid", "params": { "columns": 3 } }
```

Fragment **docs are not in the agent's prompt**. They live in a vector index
(sqlite-vector inside `data/builder.db`, embedded with OpenRouter
`text-embedding-3-small`); the agent retrieves applicable fragments per page
via its `searchFragments` tool. That's why every fragment carries retrieval
metadata (`description`, `whenToUse`) and why **indexing is part of shipping a
fragment**.

```
fragments/
├── index.ts            root registry — unions all category bundles
├── ecommerce/          category bundle (one file per fragment + index.ts)
└── <new-category>/     created automatically by `fragment:new`
```

---

## Adding a NEW fragment — two ways

### Way 1: Fragment Studio (visual, recommended)

Open **`/studio`** (linked from the home page). The studio is SESSION-based:
**one session = one fragment**, with its own id, chat thread, and lifecycle.
Start a **new fragment** session, or hit **edit** on a library fragment (forks
its current source into the session draft). Describe what you want in chat —
the agent writes real TypeScript, every save renders LIVE in the preview
against sandbox data (standard Product/CartItem/Order entities, pre-seeded).
Iterate via chat, the **params playground** (re-render with different param
values), or the **source tab** (view + quick-edit the .ts directly). When it's
right, pick a category and **Promote** — the file lands in
`fragments/<category>/` (edits overwrite with a version bump), gets
registered, and is vector-indexed immediately. Sessions stay open after
promotion, so the same thread keeps iterating on that fragment. Drafts live in
`fragments/.drafts/<sessionId>/` (gitignored) until promoted or discarded.

Note: approval edits registry source files — instant in `next dev` (hot
reload); a production deployment needs a rebuild to ship the new fragment.

### Way 2: CLI — step by step

### 0. Prerequisites (once per machine)

- `OPENROUTER_API_KEY` in `.env.local` (embeddings).
- The sqlite-vector extension auto-downloads to `vendor/` on first index run.
- macOS + bun scripts need Homebrew SQLite: `brew install sqlite`.

### 1. Scaffold

```bash
bun run fragment:new <category> <PascalCaseName>
bun run fragment:new ecommerce WishlistButton
```

This creates `fragments/<category>/<Name>.ts` from a template, registers it in
the category `index.ts` (and the root registry for a new category), and syncs
the vector index. The scaffold compiles and validates as-is.

### 2. Implement

Edit the generated file. The contract (`Fragment<P>` in `lib/jr/schema/types.ts`):

| Field | Purpose |
|---|---|
| `id` | unique MACHINE key — kebab-case, `fragment-` prefixed (`fragment-cart-summary`). The registry key, the value the agent emits as `$fragment`, the vector-index PK. MUST equal `fragment-` + kebab(file/export name). |
| `name` | human display label, WITH spaces (`"Cart Summary"`) — shown in the showcase/studio + folded into retrieval text; never a key |
| `section` | optional journey grouping within the bundle — the single bucket the block lives under in the showcase drilldown (Tier → Bundle → Section → Block). Freeform per domain (ecommerce: `discovery`/`browse`/`product-detail`/`reviews`/`cart`/`checkout`/`account`/`promotion`/`admin`). |
| `version`, `category` | identity; category is a coarse grouping for telemetry/prompts |
| `description` | what it renders + WHICH ENTITY FIELDS it requires — shown to the agent on retrieval |
| `whenToUse` | retrieval hint, "Use when the user wants …" — embedded for semantic search |
| `params` | Zod schema; declare defaults IN the schema (`.default()`), use `.describe()` on every param |
| `previewParams` | sample params for previews/tests — REQUIRED when `params` has required fields without defaults (studio preview, `fragment:test`, and the promote gate evaluate with these) |
| `build(params, ns)` | pure + idempotent function returning `{ root, elements, state?, datasources?, init? }` |

Authoring rules (enforced by the expander/validators — violations come back as
issues):

1. **ns-prefixing**: every element id and datasource name is `ns` or
   `` `${ns}-…` ``; `root` MUST equal `ns`. This makes multi-instance
   composition collision-free.
2. **State conventions**: seed via top-level subtrees that deep-merge into the
   page — `state: { ui: { [ns]: {...} }, filters: { [targetNs]: {...} } }`
   lands at `/ui/<ns>/*`, `/filters/<ns>/*`. Filter PANELS own the
   `/filters/<gridNs>` seeds; grids deliberately seed none (avoids scalar
   merge conflicts when composed).
3. **Datasources**: READ types auto-refire when any `$state` ref in their
   params changes; nothing fires on mount — add
   `init: [{ action: "datasource.refresh", params: { names: [...] } }]`.
   Results land in the envelope `/queries/<name>` =
   `{ data, page: {number,size,total}, isLoading, error }` — bind with
   `{"$datasource": "<name>/data"}`, totals at `<name>/page/total` (lists) or
   `<name>/data/value` (metrics).
4. **THE repeat-scope trap**: in ACTION params, `{$item: "field"}` resolves to
   the item's state **path**, not its value. To capture row values into state
   (selected record, add-to-cart payload), copy fields with `$template` bare
   names — see `ProductGrid.ts` `itemSnapshot`. Values arrive as strings; the
   executor coerces numerics.
5. **Components**: only catalog components (see `mastra/component-reference.generated.ts`
   or `bun run gen:docs`). No `$computed` functions exist in this runtime; no
   emoji in UI text.
6. **Cross-fragment wiring is by instance id**, passed through params
   (`targetGridNs`, `cartSummaryNs`, `cartRefresh: ["<ns>-items"]`). WRITE
   datasources may only `refresh` datasources on the SAME page.

### 3. Test in isolation (no app needed)

```bash
# expand + run ALL page validators with default params; prints the element tree
bun run fragment:test WishlistButton

# explicit params; --full prints the entire expanded spec
bun run fragment:test WishlistButton '{"productBdo":"Product"}' --full
```

This runs exactly what `savePage` runs (expansion → ns invariants → page
validators) against the standard Product/CartItem/Order test entities. Fix
issues until clean. Also keep `bun scripts/test-fragment-expansion.ts` green —
it tests a full composed page.

### 4. Tune retrieval

```bash
bun run fragment:index                      # re-embed after editing description/whenToUse
bun run fragment:search "what a user would ask for"
```

The agent receives every fragment scoring ≥ 0.8 **relative to the best match**
with an absolute cosine floor of 0.35. Check that:
- queries your fragment SHOULD answer rank it ≥ 0.8 (ideally with the right
  companions);
- unrelated queries do NOT surface it above threshold.

If retrieval misses, rewrite `whenToUse` with the words a user would actually
say (UI nouns + verbs: "browse", "filter", "history", "form"), not
implementation terms. Re-run `fragment:index` after every edit — sync is
hash-guarded, so only the changed fragment re-embeds.

### 5. Agent E2E (visual check)

Create a scratch app on the home page and prompt the builder agent with a
request your fragment serves (you can name it explicitly: "use the
WishlistButton fragment"). Watch for:
- a `searchFragments` chip in chat retrieving your fragment for that page,
- `savePage` passing (the audit copy with the un-expanded ref is written to
  `data/<appId>/temp/<pageId>.json`),
- the rendered behavior in the preview.

Delete the scratch app from the home page when done.

---

## MIGRATING an existing fragment (e.g. from rapp-render-kit / rapp-render-runtime)

Fragments written for the reference runtime do not drop in unchanged. Port
checklist:

1. **Scaffold the target file** with `bun run fragment:new <category> <Name>`,
   then copy the reference `params` schema and `build()` body into it.
2. **Component vocabulary** — replace reference components/props with ours:
   - `Text` uses `text`/`variant` (not `content`/`tone`/`size`).
   - No `FragmentRef` ELEMENTS inside build output as repeat templates —
     inline the child elements instead (nested `$fragment` refs in build
     output do work, one level, but repeat templates must be primitives).
   - No `$computed` (`lt`, `add`, `lookupSortField`…) — precompute statically
     from params, or drop the feature (e.g. fixed sort instead of dynamic).
   - `Pagination` here takes `totalPages`/`page` — page-size math can't be
     computed in-spec, so prefer a fixed `Page: {number: 1, size: N}`.
3. **Envelope shape** — reference fragments read `…/data/items` and
   `…/data/total`; our `bdo.list` puts the ARRAY at `…/data` and the total at
   `…/page/total`.
4. **Datasource types** — only `bdo.list/get/metric/save/delete` execute
   locally; `activity.*`/`workflow.start` are not available — replace
   (e.g. `workflow.start` checkout → `bdo.save` an Order).
5. **`visible` inside props** — move to the ELEMENT level (reference code
   sometimes inlines it; our validator rejects it in props).
6. **Repeat-scope writes** — apply the `$template` snapshot pattern (rule 4
   above); reference code's `{$item: ""}` action params silently break here.
7. **State seeds** — reference `state: { [ns]: {...} }` flat keys become our
   deep-merge subtrees (`{ ui: { [ns]: {...} } }`).
8. Then run the same loop as a new fragment: `fragment:test` → fix →
   `fragment:index` → `fragment:search` → agent E2E.

Already-registered fragments need **no migration for the vector store** —
`bun run fragment:index` (or any agent search) indexes everything in
`fragments/index.ts` automatically; the index lives per-machine in
`data/builder.db` and rebuilds itself on first use.

---

## Script reference

| Command | What it does |
|---|---|
| `bun run fragment:new <category> <Name>` | scaffold + register + index a new fragment |
| `bun run fragment:test <Name> [params] [--full]` | expand + validate ONE fragment in isolation |
| `bun run fragment:index` | sync the vector index (hash-guarded; removes deleted fragments) |
| `bun run fragment:search "<query>"` | show exactly what the agent's searchFragments returns |
| `bun scripts/test-fragment-expansion.ts` | smoke test: full page composed from 5 fragments |

## Troubleshooting

- **`OPENROUTER_API_KEY is required`** — indexing/search embeds via OpenRouter; set the key in `.env.local`.
- **Extension download fails** — drop the right binary from
  [sqlite-vector releases](https://github.com/sqliteai/sqlite-vector/releases)
  into `vendor/sqlite-vector/` manually (`vector.dylib`/`.so`/`.dll`).
- **`dlopen … no such file` on macOS for a file that exists** — quarantine
  xattr; run `xattr -c vendor/sqlite-vector/vector.dylib`.
- **bun script: "This build of sqlite3 does not support dynamic extension loading"** —
  `brew install sqlite` (bun needs Homebrew SQLite for extensions on macOS).
- **Search returns one `belowThreshold` hit** — the library has nothing
  relevant to the query; that's the intended signal (absolute floor 0.35).
