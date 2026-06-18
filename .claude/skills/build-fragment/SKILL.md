---
name: build-fragment
description: >-
  Author or edit a json-render fragment — a prebuilt, typed, plug-and-play block
  the app-builder agent drops into a page (`{ "$fragment": "fragment-…", "params": {…} }`)
  instead of building UI from primitives. Use whenever creating/editing/auditing a
  file under fragments/<bundle>/, scaffolding with `bun run fragment:new`, or designing
  a reusable block. Domain-agnostic (ecommerce, crm, generic, …). Encodes the contract
  plus the hard-won runtime rules that aren't obvious from the types.
---

# Building json-render fragments

A **fragment** is a parameterised block: `build(params, ns)` returns a json-render
subtree (`elements` + `datasources` + state seeds + `init`). The agent emits a tiny
ref; the **eject-on-write expander** materialises it to primitives at save. Goal:
**common, complete, self-contained** blocks — the agent never rebuilds them by hand.

Deep reference: [fragments/README.md](../../../fragments/README.md). Running log of
per-block learnings: [fragments/AUTHORING_NOTES.md](../../../fragments/AUTHORING_NOTES.md)
(append to it as you learn; promote stable rules up into this skill).

## The loop
`bun run fragment:new <bundle> <PascalName>` → implement → add **`previewParams`** →
`bun run fragment:test <id>` (expand + validate in isolation) → check `/showcase/blocks`
→ promote/register → `bun run fragment:index` (re-embed for retrieval). Run
`bun run gen:docs` after changing any **component** (catalog) so the agent's reference matches.

## Contract checklist (`Fragment<P>`)
- **`id`** — machine key, MUST be `fragment-` + kebab(export/file name). The `$fragment`
  value + registry/index key. (Globally unique across ALL bundles — name clashes fail.)
- **`name`** — human label, spaced (“Cart Summary”). Display only.
- **`description` + `whenToUse`** — what it renders + WHICH entity fields it needs + when to
  pick it. This is the retrieval text — make it the obvious match for its use case.
- **`section`** (optional) — journey bucket for the showcase drilldown.
- **`params`** — Zod; `.describe()` every field; `.default()` optional ones.
- **`previewParams`** — **REQUIRED to appear in the gallery.** No previewParams ⇒ the block
  shows **"soon"** with no preview, even if every param has a default. #1 easy miss.
- **`build(params, ns)`** — pure; returns `{ root: ns, elements, state?, datasources?, init? }`.

## build() rules
- **ns-prefix everything**: every element id / datasource name is `ns` or `` `${ns}-…` ``;
  `root` MUST equal `ns`. Makes multi-instance composition collision-free.
- **State conventions**: seed via top-level subtrees that deep-merge — `/ui/<ns>/*`,
  `/filters/<targetNs>/*`, `/form/<ns>/*`. A filter PANEL owns the `/filters/<gridNs>` seeds;
  the grid seeds NONE there (avoids scalar-merge conflicts when composed).
- **Datasources**: READ types auto-refire when a `$state` dep changes; nothing fires on mount
  unless you add `init: [{ action:"datasource.refresh", params:{ names:[…] } }]`. Results land
  at `/queries/<name>` = `{ data, page:{number,size,total}, isLoading, error }`. READ types
  also support `on.success` hooks (e.g. to default a state value after load).
- **TS gotcha** for dynamic/looped element maps: build a
  `Record<string, Record<string, unknown>>` then return
  `elements: map as unknown as ReturnType<Fragment<P>["build"]>["elements"]`.

## The runtime rules that bite (not obvious from the types)

1. **Repeat scope — `$item` is a PATH in actions, a VALUE in props.** In a `repeat`, props
   read `{ $item: "Field" }`. But in an **action param**, `{ $item }` resolves to the item's
   state *path*, not its value — to capture a row value (selected id, add-to-cart payload) use
   `{ $template: "${Field}" }` bare names. Values arrive as strings; the executor coerces numerics.
2. **Scope-correct actions.** A card lives in repeat scope (`$template` capture); a detail
   Sheet/modal does NOT — it copies the already-selected record via `{ $state:"/ui/<ns>/selected" }`.
   Keep a separate action per scope.
3. **Conditional rendering — `$datasource` is for VALUES, `$state` for CONDITIONS.**
   `$datasource` is rapp's own directive (introduced on purpose): in a **prop value** it reads a
   datasource's result envelope (`{ data, page, isLoading, error }`) **by NAME** — the runtime
   resolves the name to that datasource's `into` path (default `/queries/<name>`, but a datasource may
   override `into`), so you never hardcode `/queries/…`. It's deliberately distinct from `$state`
   (user-input state: `/filters`, `/form`, `/ui`) so server results and user state stay separable.
   (Auto-refire is a SEPARATE mechanism — a READ datasource refires when the `$state` refs in ITS OWN
   `params` change; the `$datasource` reader just re-reads the updated envelope.) But the
   visibility-condition evaluator (the `visible` / `$cond` *condition object*) is
   the upstream state-model evaluator: it resolves `$state`, `$item`, `$index`, `eq`, `not`, and
   native `$and`/`$or` — **not** `$datasource`. Datasource results are mirrored into state at
   `/queries/<name>`, so INSIDE A CONDITION reference them via `{ $state:"/queries/<ds>/data/<Field>" }`.
   - **Per-row (repeat):** `$item` works in both `visible` and `$cond`. Color a status badge with
     `visible:{ $item:"Status", eq:V }` (one Badge per status) OR a single
     `variant:{ $cond:{ $item:"Status", eq:"Cancelled" }, $then:"destructive", $else:… }` — both verified.
     A `$item` condition on a `repeat` container filters the list to matching items.
   - **Datasource-gated (counts / single record):** use **`visible` + `{ $state:"/queries/<ds>/…" }`**
     (resolves + validates — e.g. an Empty gated on `…/page/total` eq 0). Don't use `$cond` here: the
     rapp validator nudges you to `$datasource` *inside the condition* (which the condition evaluator
     can't resolve → silent `$else`) and rejects `$state:/queries/` there. So: datasource-gated →
     `visible`; item/state-gated → either.
   - **OR is native:** `{ $or:[condA, condB] }` — don't stack elements to fake it.
4. **Bindable id/amount params.** A param the agent must point at state/route (a `productId`,
   `orderId`, an `amount`) CANNOT be `z.string()`/`z.number()` — a binding object
   `{ "$state": "/ui/selectedProductId" }` fails that Zod check, so the agent passes the path as a
   literal and it never resolves (the "0 results" trap). Type it
   `z.union([z.string(), BindingSchema])` (import `BindingSchema` from `@/lib/jr/schema`) and pass
   the value straight into the datasource param — bindings resolve and READ datasources refire on change.
5. **No client compute.** There is no `$computed` arithmetic. You can't add disparate numbers
   (`bdo.metric SUM` sums ONE field) or do `Price × Qty`. Options: stamp values onto a
   `/ui/<ns>/pending` snapshot before a save; let the backend/mock derive fields (e.g. LineTotal);
   or take amounts as **supplied** params (literal or binding) — the headless-commerce pattern.
6. **Repeat-scope two-way is unreliable.** `{ $bindItem: "Qty" }` reads but the write often
   doesn't land → editable-in-list numeric controls don't work declaratively; ship read-only +
   actions, or use a component. (The **remove** action works because it uses `$template` capture.)
7. **Bind whole arrays, not object keys.** To drive a grid's sort, bind the entire
   `[{field:dir}]` array (`Sort: { $state }`); you can't bind a value as an object *key*.
8. **Components only; no emoji.** Use only catalog components (`bun run gen:docs` lists them).
   Primitives need `className` passthrough to hit a quality bar. Several inputs (`Input`,
   `Textarea`) take no `name` prop — label/type/placeholder/value only.

## Quality bar (product-grade, not "works")
- **Money** for every price/number (currency/decimal/percent + `maximumFractionDigits` — never
  `"$" + raw number`, and round floats so they don't overflow a card).
- **Image** with `aspectRatio` + `fit:"cover"` for uniform media (the biggest single lift).
- Real **empty** (gate on `…/page/total` eq 0) and loading states; hover lift via
  `transform`/`shadow` only; icon-in-tinted-badge; muted eyebrow + prominent value.
- **Variants via params, not forks** — one fragment, a `layout`/`mode`/feature-flag param
  switches looks. A *fundamentally different* block (faceted rail vs compact card) = its OWN fragment.
- Flags default OFF and degrade gracefully (a control bound to an absent field renders empty —
  no per-field guards needed).

## Adding a primitive vs composing
Compose from the catalog by default. Add a **component** only when the interaction needs internal
cross-element state the spec can't express (synced carousels, measured layout) or a control the
catalog lacks (e.g. a multi-select checkbox list → array). Enhance an existing component before
building a new one. After any component change: `bun run gen:docs`.

## New entity? Register in BOTH places
1. `lib/server/standard-entities.ts` (`STANDARD_ENTITIES` + `STANDARD_SEEDS`) — what
   `fragment:test` validates `bdo` names against.
2. `showcase/blocks/blockMeta.ts` (records + `SEED`) — the gallery preview data.
Also add it to `mastra/instructions.ts` ENTITY CONTRACTS. (Showcase seed alone passes the
gallery but FAILS `fragment:test`.) Cross-entity links must match: e.g. `Review.ProductId` ==
`Product._id`, or scoped queries return nothing.

## previewParams pitfalls
- Use an id that matches the seed: the mock assigns `"<Entity>-<i>"` → use e.g. `"Product-0"`.
- Keep **navigate-to-page** params (a `detailPath`/`successTarget` page NAME) OUT of previewParams —
  `fragment:test` checks `ui.navigate` targets against real pages and fails in isolation.

## Consumption lessons (from inspecting generated apps)
- A page should be ~1 fragment ref + a thin hand-built header. If the agent hand-builds a block we
  have, the block's `whenToUse` isn't winning retrieval — sharpen it.
- Edits can degrade a `$fragment` ref back into inlined primitives — when editing, preserve the ref
  if the change is param-expressible.
- The agent invents out-of-contract enum values — default canonical sets (e.g. order statuses) in params.
