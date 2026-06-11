# patchwork\*

A v0.dev-style app builder: describe an app in chat, an AI agent designs the
data model, seeds it, and assembles multi-page [json-render](https://json-render.dev)
specs — rendered live by a react-router runtime with real datasources.

## Architecture (phase 2)

```
/                    home — app list (SQLite) + create app
/apps/<id>           builder — chat (Mastra agent) + live runtime preview

agent tools          defineEntity / seedRecords → SQLite entity store
                     savePage / saveAppIndex   → data/<appId>/*.json (validated)

data/<appId>/        app.json  (roles, navigation, home, shell layout)
                     <pageId>.json  (PageFile: { id, role, businessEntity, name, spec })

runtime              lib/runtime/* — MemoryRouter with a route per page,
                     sidebar/topnav shell from app.json, per-page state store,
                     datasource engine, $datasource directive, 5 local actions
```

### The page contract (`lib/jr/schema/`)

Pages follow the rapp spec: json-render `{ root, elements, state }` plus
`datasources` (every backend op), `init` (mount-time action chain), `watch`.
Actions are exactly 5 local types — `setState`, `ui.toast`, `ui.navigate`,
`datasource.refresh`, `datasource.fire`; backend operations are datasources
(`bdo.list/get/metric/save/delete` locally). READ datasources auto-refire when
any `$state` ref in their params changes (debounced); results land in a
`/queries/<name>` envelope `{ data, isLoading, error, lastFetchedAt }` read via
`{"$datasource": "name/path"}` bindings.

- **Datasource executor** (`app/api/apps/[appId]/datasource`): runs queries
  against the per-app entity store in SQLite — filters, sort, paging,
  aggregations (COUNT/SUM/AVG/…, GroupBy series).
- **Validators** (`lib/server/spec-validators.ts`): structural Zod pass plus
  data-flow checks (undeclared datasource refs, `$state` into `/queries/*`,
  backend ops as actions, orphan seeds, unknown entities/fields, broken
  `ui.navigate` targets) — every message written as a repair instruction; the
  agent fixes and re-saves.
- **Component catalog**: all `@json-render/shadcn` components + the custom kit
  ported from rapp-render-kit (`lib/jr/components/custom` — 63 components
  total). The LLM-facing reference is generated from the Zod definitions:
  `bun run gen:docs` after catalog changes.

## Setup

```bash
bun install
cp .env.local.example .env.local   # then add your OpenRouter key (https://openrouter.ai/keys)
bun run dev
```

`OPENROUTER_MODEL` picks the model (default `anthropic/claude-sonnet-4.5`).
Requires Node 22+ (`node:sqlite`). Apps live in `data/` (gitignored): SQLite
registry/entities/records in `builder.db`, generated JSON per app id.

## Try it

Create an app on the home page, then prompt e.g. *"a task tracker: dashboard
with KPIs, filterable task list, add/edit tasks"*. The agent defines a Task
entity, seeds ~10 records, builds dashboard + list pages with live metrics,
reactive filters, and a working add/edit dialog, then wires navigation.
Chat history is per-app and survives reloads.
