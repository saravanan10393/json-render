# Generic Fragment Kit + Build-Time Benchmark — Design

Date: 2026-06-11
Status: approved (brainstorm complete)

## Goal

Quantify how much fragments speed up agent app-building, then expand the
fragment library so the speedup applies to many app domains, and measure again.

Two sub-projects, built in this order:

1. **Benchmark harness** — measures app/page build time, token usage, and
   validation retries, with fragments enabled or disabled. Run the baseline
   (fragments OFF) first.
2. **Generic widget kit** — ~10 entity-agnostic fragments covering common
   widgets (tables, forms, KPIs, kanban, timeline…). Then re-run the benchmark
   with fragments ON and produce the comparison report.

## Decisions made

| Question | Decision |
|---|---|
| Metrics | Wall-clock (per app + per page) + LLM tokens + validation repair retries |
| Harness style | Headless CLI (`bun scripts/benchmark.ts`), real OpenRouter calls |
| Agent invocation | In-process via a shared runner extracted from the chat route |
| Fragment library shape | Generic widget kit (entity + field ids as params), not domain bundles |
| Suite size | 3 prompts × 2 modes × 2 reps = 12 runs |

## Part 1 — Benchmark harness

### Shared runner (`lib/server/builder-run.ts`)

Extract the agent-call logic currently inlined in
`app/api/apps/[appId]/chat/route.ts` into:

```ts
runBuilderTurn({
  app,                  // { id, name }
  messages,             // UIMessage[]
  fragments,            // boolean — selects the agent variant
  onStep?,              // (step: ToolStepEvent) => void  — timing capture
})
```

It builds the system app-context (entities/pages/index snapshot), constructs
the `RequestContext` with `appId`, and calls `agent.stream()` with
`maxSteps: 40`. The chat route keeps its UI-message-stream behavior on top of
this; the benchmark consumes `onStep` events and the finish usage stats. One
code path → no drift between measured and real behavior.

### Fragment on/off switch

- `mastra/instructions.ts` → `buildInstructions({ fragments: boolean })`.
  When `false`, the entire FRAGMENTS section (registry enumeration + usage
  rules + pairing guide) is omitted; the agent hand-builds all pages from
  primitives.
- `mastra/index.ts` → `makeAppBuilderAgent({ fragments })` factory.
  The app's default agent stays fragments-on. The benchmark instantiates the
  variant it needs per mode.

### CLI (`scripts/benchmark.ts`)

```
bun scripts/benchmark.ts --mode baseline|fragments [--reps 2] [--prompts task,crm,inventory] [--keep]
```

Three fixed prompts (constants in the script), each ~3 pages and exercising
different widget types:

- **task** — task tracker: KPI dashboard, filterable task list, add/edit dialog.
- **crm** — CRM: contacts table, deals kanban, dashboard with metrics.
- **inventory** — inventory: stock dashboard, product table, stock-adjustment form.

Per run:

1. `createApp()` a fresh app (name encodes mode/prompt/rep).
2. `runBuilderTurn()` with the prompt; record per tool step:
   `{ tool, durationMs, pageId?, issueCount, ok }`.
3. On finish: token usage (prompt/completion), total wall-clock, step count.
4. Verify: expected pages exist on disk and validators are clean; record
   page count and entity/record counts.
5. Delete the app unless `--keep`.
6. Write `benchmarks/results/<ISO-timestamp>-<mode>-<prompt>-r<rep>.json`
   containing raw step events + the derived summary.

### Metric definitions

- **App time** — wall-clock from turn start to stream finish.
- **Page time** — elapsed between consecutive *clean* `savePage` results
  (first page: from turn start). Includes the LLM time composing that page.
- **Retries** — count of `savePage`/`saveAppIndex` calls whose result carried
  `issues[]` (the validator repair loop).
- **Tokens** — prompt + completion tokens for the whole run.
- Failed or timed-out runs (per-run timeout 10 min) are recorded with an
  `error` field and excluded from aggregates but listed in the report.

### Report (`scripts/benchmark-report.ts`)

Reads every file in `benchmarks/results/`, groups by prompt × mode, and writes
`benchmarks/REPORT.md`: median app time, mean page time, mean tokens, total
retries, and the baseline/fragments speedup ratio per prompt and overall.

### Cost note

12 runs at roughly 60–150k tokens each — order of a few dollars to ~$20 of
OpenRouter usage at Sonnet-class pricing. Baseline (6 runs) executes before
the kit is built; fragments mode (6 runs) after.

## Part 2 — Generic widget kit (`fragments/generic/`)

All fragments are entity-agnostic: entity name and field ids arrive as params.
Same authoring contract as the ecommerce bundle: ns-prefix invariant
(`assertNsInvariants`), state seeds under the instance ns, descriptions carry
the pairing rules (they are auto-enumerated into the agent prompt).

| Fragment | Category | Stamps out | Datasources |
|---|---|---|---|
| StatsRow | display | Grid of KPI cards from `stats[]{label,type,field?,filter?}` | one `bdo.metric` per stat |
| DataTable | display | Table w/ columns from params, search, paging, edit/delete row actions (delete w/ confirm) | `<ns>-list`, `<ns>-delete` |
| RecordFormDialog | form | Create/edit dialog; `fields[]{field,label,inputType,options?}`; opens via `/ui/<ns>/open`; edit prefill via `/ui/<ns>/editId` | `<ns>-save`, `<ns>-prefill` (`bdo.get`, oneShot) |
| FilterBar | browse | Search + Select filters writing `/filters/<targetNs>/*` | none |
| CardList | display | Repeat cards (title/subtitle/badge/meta fields) | `<ns>-list` |
| DetailPanel | display | Field/value view of one record from an id in state | `<ns>-get` |
| KanbanBoard | display | One column per `statusOptions[]`, ←/→ move buttons via status save | per-column `bdo.list` + `<ns>-move` |
| MetricBreakdown | display | Grouped metric as label + Progress rows (catalog has no chart component) | `<ns>-metric` (GroupBy) |
| ActivityTimeline | display | Timeline of recent records by date field | `<ns>-list` (DESC, limited) |
| PageHeader | layout | Title + subtitle + action buttons (navigate / open dialog ns) | none |

### Wiring conventions

- `FilterBar` takes `targetNs` and owns the `/filters/<targetNs>/*` seeds
  (paired list fragments seed no filter state — collision-free, same rule the
  ecommerce bundle uses).
- `DataTable` and `PageHeader` take `formDialogNs` to open a sibling
  `RecordFormDialog`.
- Every write path takes `refresh: string[]` of same-page datasource names.
- Repeat-scope writes use the established two-step pattern
  (`setState` a `$template` snapshot, then `datasource.fire`).

### Instructions update

Replace the hardcoded e-commerce-only wiring prose in
`mastra/instructions.ts` with a short generic pairing guide; keep the
e-commerce entity contracts; fragment-specific rules live in each fragment's
`description` (already auto-enumerated from the registry).

### Registration & testing

- Export from `fragments/generic/index.ts`, merge into `fragmentRegistry`.
- Extend `scripts/test-fragment-expansion.ts` with a kitchen-sink page using
  all 10 generic fragments against a sample entity: expansion, ns invariants,
  and spec validators must all pass.
- `bunx tsc --noEmit` clean; manual run of one generated app in the browser.

## Execution order

1. Build harness (shared runner, switch, CLI, report).
2. Run baseline: `--mode baseline` (6 runs).
3. Build the generic kit + instructions update + tests.
4. Run `--mode fragments` (6 runs).
5. Generate `benchmarks/REPORT.md` comparison.

## Out of scope

- Real chart components (would require adding a charting library to the catalog).
- Domain bundles beyond the existing ecommerce one.
- Statistical machinery beyond median/mean over 2 reps.
- Benchmarking the edit flow (only fresh app builds are measured).
