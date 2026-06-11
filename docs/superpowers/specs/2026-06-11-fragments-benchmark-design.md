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
| Fragment library shape | Generic widget kit (entity + field ids as params), not domain bundles; roster mapped from the rapp widget library (`rapp-page-templates-web/src/widgets`) |
| Charts | Add one recharts-based `Chart` catalog component (bar/line/area/donut/pie) |
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

The kit is modeled on the rapp widget library
(`rapp/frontend/rapp-page-templates-web/src/widgets`, ~92 widgets). Mapping
rule: rapp's data-bound, section-level widgets become fragments; its field
inputs, field displays, and filter inputs become *param kinds* of those
fragments (`input:`, `display:`, `kind:` enums); pure layout widgets stay
hand-built by the LLM from catalog primitives.

All fragments are entity-agnostic: entity name and field ids arrive as params.
Same authoring contract as the ecommerce bundle: ns-prefix invariant
(`assertNsInvariants`), state seeds under the instance ns, descriptions carry
the pairing rules (they are auto-enumerated into the agent prompt).

### New catalog component: `Chart`

One new custom-kit component built on **recharts** (new dependency):
`kind: bar | line | area | donut | pie`, props for series data
(label/value pairs from a `bdo.metric` GroupBy result), title-less (fragments
wrap it in Cards). Registered in `lib/jr/components/custom`, catalog entry +
`bun run gen:docs` regeneration. Covers rapp's ChartLine/Bar/Area/Donut/Pie.

### Fragment roster (16)

**Dashboard (5)** — covers KpiTile, the 5 chart widgets, Leaderboard,
ProgressTracker, RecentList/ActivityFeed:

| Fragment | rapp equivalent | Stamps out | Datasources |
|---|---|---|---|
| StatsRow | KpiTile(s) | Grid of KPI tiles from `stats[]{label, type, field?, format: plain\|currency\|percent, filter?}` | one `bdo.metric` per stat |
| ChartCard | Chart* ×5 | Card + Chart; `entity, kind, metricType, field?, groupBy, filter?` | `<ns>-metric` (GroupBy) |
| Leaderboard | Leaderboard | Ranked top-N rows (rank badge + label + value) from a grouped metric | `<ns>-metric` (GroupBy) |
| ProgressTracker | ProgressTracker | Metric vs `target`: Progress bar + value/target text | `<ns>-metric` |
| RecentList | RecentList | Top-N records by date field DESC; `titleField, sublabelField`, optional navigate | `<ns>-list` |

**Data views (5)** — covers Table, Cards, Gallery, Kanban, Timeline,
RelatedList (Tree/Pivot/Gantt fall back to Table in rapp itself — DataTable
covers them):

| Fragment | rapp equivalent | Stamps out | Datasources |
|---|---|---|---|
| DataTable | Table | Table; `columns[]{field, label, display: text\|money\|date\|badge\|boolean\|rating\|progress}`, search, paging, `rowActions` view/edit/delete (confirm), `baseFilter?`, `formDialogNs?` | `<ns>-list`, `<ns>-delete` |
| CardGrid | Cards, Gallery | Card grid; `titleField, subtitleFields[], imageField?, badgeField?`, click → navigate or detail select | `<ns>-list` |
| KanbanBoard | Kanban | One column per `statusOptions[]`, ←/→ move buttons via status save | per-column `bdo.list` + `<ns>-move` |
| ActivityTimeline | ActivityFeed | Timeline of recent records by date field | `<ns>-list` (DESC, limited) |
| RelatedList | RelatedList | DataTable scoped by `parentField EQ` an id read from state (`parentIdPath`) — for detail pages | `<ns>-list` |

**Detail (2)** — covers DetailHeader, RecordView + the 12 display widgets as
`display` kinds:

| Fragment | Stamps out | Datasources |
|---|---|---|
| DetailHeader | Title/subtitle from record fields, status badge, facts row, action buttons; record id from `idPath` | `<ns>-get` |
| RecordView | Field/value body; `fields[]{field, label, display}` | `<ns>-get` |

**Forms (2)** — covers Form + the 13 field-input widgets as `input` kinds:

| Fragment | Stamps out | Datasources |
|---|---|---|
| RecordFormDialog | Create/edit Dialog; `fields[]{field, label, input: text\|textarea\|number\|date\|boolean\|select\|reference, options?, lookupEntity?, lookupDisplayField?}`; opens via `/ui/<ns>/open`, edit prefill via `/ui/<ns>/editId` | `<ns>-save`, `<ns>-prefill` (oneShot), per-reference-field lookup `bdo.list` |
| FormCard | Page-level Card form, same field model + cancel/submit, `successTarget?` | same as RecordFormDialog |

`reference` inputs render a Combobox fed by a lookup-entity `bdo.list`.

**Filters & shell (2)**:

| Fragment | Stamps out |
|---|---|
| FilterBar | `layout: toolbar\|sidebar` (sidebar covers FacetedSidebar); `filters[]{field, label, kind: search\|select\|boolean\|numberRange\|dateRange\|reference, options?, lookupEntity?}` writing `/filters/<targetNs>/*` |
| PageHeader | Title + subtitle + action buttons (navigate / open dialog ns) |

### Excluded (and why)

- **Workflow widgets** (TaskInbox, WorkflowList, workflow-mode Form,
  WorkflowActionButton…): this repo's datasource executor stubs
  `activity.list/get` (empty) and 501s `activity.submit`/`workflow.start` —
  they would render dead locally.
- **File/geo/richtext/phone inputs**: no upload backend or map/RTF components;
  they degrade to `text` inputs.
- **StatComparison**: needs relative-date-window computation at runtime;
  deferred.
- **Heatmap**: needs 2D aggregation the metric engine lacks (deprecated in
  rapp too).

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
- Extend `scripts/test-fragment-expansion.ts` with kitchen-sink pages using
  all 16 generic fragments against sample entities: expansion, ns invariants,
  and spec validators must all pass.
- `bunx tsc --noEmit` clean; manual run of one generated app in the browser.

## Execution order

1. Build harness (shared runner, switch, CLI, report).
2. Run baseline: `--mode baseline` (6 runs).
3. Build the Chart catalog component, then the generic kit + instructions
   update + tests.
4. Run `--mode fragments` (6 runs).
5. Generate `benchmarks/REPORT.md` comparison.

## Out of scope

- Domain bundles beyond the existing ecommerce one.
- Workflow/activity support in the local runtime (see kit exclusions).
- Statistical machinery beyond median/mean over 2 reps.
- Benchmarking the edit flow (only fresh app builds are measured).
