# Generic Fragment Kit + Build-Time Benchmark — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A repeatable benchmark that measures agent app-build time/tokens/retries with fragments on vs off, plus a 16-fragment generic widget kit (modeled on the rapp widget library) and one new `Chart` catalog component.

**Architecture:** Phase A extracts the chat route's agent call into a shared `runBuilderTurn()` and builds a headless CLI (`npx tsx scripts/benchmark.ts`) that times every tool step via the Mastra `fullStream`. Phase B adds a recharts-backed `Chart` component, a `fragments/generic/` bundle (entity-agnostic fragments parameterized by entity + field ids), and a kitchen-sink expansion test. Baseline benchmark runs happen between the phases.

**Tech Stack:** Next.js 16 / Bun (dev), Node 22 + tsx (benchmark runner — Bun 1.2.4 lacks `node:sqlite`), Mastra agent streaming, Zod 4, recharts, json-render.

**Verified facts the plan relies on (do not re-derive):**
- `agent.stream()` returns a Mastra stream: `fullStream` is a `ReadableStream` (async-iterable in Node 22) of chunks; `tool-call` chunks carry `payload.toolCallId/toolName/args`; `tool-result` chunks carry `payload.toolCallId/toolName/result`; `stream.totalUsage` resolves `{inputTokens, outputTokens, totalTokens}` after consumption.
- `savePage`/`saveAppIndex` tool results carry `issues: string[]` on validation failure, and savePage returns `pageId` on success (see `mastra/tools.ts`).
- `npx tsx <script>` from the repo root resolves `@/` tsconfig aliases AND `node:sqlite` (verified on Node v22.14.0). `bun` does NOT (`node:sqlite` missing in Bun 1.2.4). Node does not auto-load `.env.local` — the benchmark calls `process.loadEnvFile()`.
- `bdo.metric` with GroupBy + ONE Metric entry returns `{ series: [{ <groupField>: "label", value: <n> }] }` (key is literally `value`, see `lib/server/entity-store.ts:234` `metricKey`).
- The shadcn `Table` component takes STATIC `columns: string[]`, `rows: string[][]` — it cannot repeat datasource rows. The DataTable fragment therefore builds rows with the repeat-Stack pattern (like `CartSummary`).
- `Combobox` (custom kit, we own it) accepts `options: Array<string|{label,value}>`; Task 7 extends it with `labelKey`/`valueKey` so options can bind raw record arrays from a datasource.
- Repeat-scope trap: in ACTION params `{$item}` resolves to the item's state PATH; copying values uses `$template` bare names: `{"$template": "${FieldId}"}` (values arrive as strings).
- The catalog component pattern: `lib/jr/components/custom/ui/<Name>.tsx` exports `definition` (`{props: z.object, events?, description, example}`) and `component`; both are registered in `lib/jr/components/custom/ui/index.ts` (definition map ~line 71 area, component map ~line 103 area). After catalog changes run `bun scripts/gen-component-docs.ts`.
- Fragment authoring contract: `build(params, ns)` output must pass `assertNsInvariants` — root === ns, every element/datasource key is `ns` or `ns-`-prefixed; state seeds nest the ns. See `fragments/ecommerce/CartSummary.ts` for the canonical small example.
- Spec validators reject: `$state` reads of `/queries/*` (EXCEPT inside `visible` conditions), backend ops as actions, undeclared datasource refs, seeded `/queries/*` state. WRITE datasources never auto-fire; READ datasources auto-refire on `$state` dep change.
- `bdo.save` with `_id: null` CREATES (executor falls through to id generation); `_id: "<id>"` UPDATES. Seed edit-id state as `null`, never `""` — Task 15 verifies this against `app/api/apps/[appId]/datasource/route.ts` before relying on it.

**Working branch:** `fragments-benchmark` (already exists, spec committed). All commits go there.

**Prerequisite (user/operational):** `.env.local` must exist with a working `OPENROUTER_API_KEY` before Tasks 6 and 20 (the paid benchmark runs). `cp .env.local.example .env.local` — and rotate/scrub the keys in the example file.

---

## Phase A — Benchmark harness

### Task 1: `buildInstructions({ fragments })`

**Files:**
- Modify: `mastra/instructions.ts`

The file currently exports a single template literal `AGENT_INSTRUCTIONS` (lines 23–187) with the FRAGMENTS section inline (lines 152–182). Make the fragments block conditional.

- [ ] **Step 1: Refactor the export into a builder function**

In `mastra/instructions.ts`, replace:

```ts
export const AGENT_INSTRUCTIONS = `You are "App Builder", ...
```

with (keeping the entire existing template content — only the wrapping changes):

```ts
const FRAGMENTS_SECTION = `## FRAGMENTS — prebuilt blocks (STRONGLY PREFERRED when one fits)

A fragment is a prebuilt, tested block (grid + datasources + state + wiring) you reference with ONE element instead of hand-building dozens. At save time it expands to primitives automatically. Emission shape — the element KEY becomes the instance id (its namespace):

\`\`\`json
"products-grid": { "$fragment": "ProductGrid", "params": { "columns": 3, "cartRefresh": ["cart-panel-items"] } }
\`\`\`

Rules:
- The ref element has NO type/props/children — just \`$fragment\` and \`params\`. Reference it from a parent's \`children\` like any element.
- Instance ids: short kebab-case, unique per page (e.g. "products-grid", "cart-panel").
- Params are validated against the fragment's schema; omitted params take their defaults. Unknown fragment names and bad params come back as savePage issues.
- Cross-fragment wiring is by instance id: ProductFilters/CategoryNav take \`targetGridNs: "<grid instance id>"\`; ProductGrid's \`cartRefresh\` takes a same-page CartSummary's datasource names \`["<cartNs>-items", "<cartNs>-total"]\`; CheckoutForm takes \`cartSummaryNs\`.
- Fragments handle their own init/datasources — do NOT add datasource.refresh for a fragment's datasources.
- You can freely mix fragments with hand-built primitive elements on the same page.

ENTITY CONTRACTS — e-commerce fragments expect entities with EXACTLY these field ids (define + seed them first):
- Product: Name(text), Description(text), Price(number), Category(select), ImageUrl(text), Rating(number), Stock(number)
- CartItem: ProductId(text), Name(text), Price(number), Quantity(number), LineTotal(number)  — seed it EMPTY (no records)
- Order: CustomerName(text), Email(text), Address(text), City(text), Zip(text), Status(select: Placed|Shipped|Delivered|Cancelled), Total(number), PlacedAt(date)
For ImageUrl seeds use https://picsum.photos/seed/<something-unique>/400/300.

Canonical e-commerce app from fragments (4 pages):
1. Shop (home): HeroBanner + CategoryNav(targetGridNs) + Stack[ ProductFilters(targetGridNs) | ProductGrid ]
2. Cart: CartSummary(checkoutTarget: "Checkout") + ProductGrid(small, recommendations)
3. Checkout: CartSummary instance + CheckoutForm(cartSummaryNs, successTarget: "Orders")
4. Orders: OrderHistoryList — and an admin Dashboard page can use SalesStats.

### Fragment registry

${buildFragmentReference()}
`;

export function buildInstructions({ fragments }: { fragments: boolean }): string {
  return `You are "App Builder", ... <UNCHANGED BODY UP TO THE REMINDERS SECTION> ...

${fragments ? FRAGMENTS_SECTION : ""}
## Component reference

${COMPONENT_REFERENCE}
`;
}

export const AGENT_INSTRUCTIONS = buildInstructions({ fragments: true });
```

Mechanics: cut everything from `## FRAGMENTS` (line 152) through the line containing `${buildFragmentReference()}` (line 182) out of the main template and into the `FRAGMENTS_SECTION` constant (it stays a template literal so `${buildFragmentReference()}` still interpolates). The main template keeps everything before it and the trailing `## Component reference` block. **Do not edit any prose.**

- [ ] **Step 2: Verify both modes**

Run:
```bash
bun -e "import('./mastra/instructions').then(m => { const on = m.buildInstructions({fragments:true}); const off = m.buildInstructions({fragments:false}); console.log('on has FRAGMENTS:', on.includes('## FRAGMENTS')); console.log('off has FRAGMENTS:', off.includes('## FRAGMENTS')); console.log('off has components:', off.includes('## Component reference')); console.log('on === AGENT_INSTRUCTIONS:', on === m.AGENT_INSTRUCTIONS); })"
```
Expected: `true / false / true / true`.

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit` — expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mastra/instructions.ts
git commit -m "feat: buildInstructions({fragments}) — fragment section is now switchable"
```

### Task 2: `makeAppBuilderAgent({ fragments })`

**Files:**
- Modify: `mastra/index.ts`

- [ ] **Step 1: Add the factory**

Replace the `appBuilderAgent` block in `mastra/index.ts`:

```ts
import { buildInstructions } from "./instructions";

const AGENT_TOOLS = { defineEntity, seedRecords, savePage, deletePage, saveAppIndex };

export function makeAppBuilderAgent({ fragments }: { fragments: boolean }): Agent {
  return new Agent({
    id: fragments ? "app-builder" : "app-builder-nofrag",
    name: fragments ? "App Builder" : "App Builder (no fragments)",
    instructions: buildInstructions({ fragments }),
    // Mastra model-router string: routes through OpenRouter using OPENROUTER_API_KEY.
    model: `openrouter/${OPENROUTER_MODEL}`,
    tools: AGENT_TOOLS,
  });
}

export const appBuilderAgent = makeAppBuilderAgent({ fragments: true });
```

Remove the now-unused `AGENT_INSTRUCTIONS` import. The `mastra` instance below stays exactly as is (it registers `appBuilderAgent`).

- [ ] **Step 2: Typecheck** — `bunx tsc --noEmit`, expected clean.

- [ ] **Step 3: Commit**

```bash
git add mastra/index.ts
git commit -m "feat: makeAppBuilderAgent factory with fragments switch"
```

### Task 3: Extract `runBuilderTurn` shared runner

**Files:**
- Create: `lib/server/builder-run.ts`
- Modify: `app/api/apps/[appId]/chat/route.ts`

- [ ] **Step 1: Create `lib/server/builder-run.ts`**

Move `buildAppContext` verbatim from the route (lines 73–102) into this file and add the runner:

```ts
import { RequestContext } from "@mastra/core/request-context";
import type { UIMessage } from "ai";
import { readAllPages, readAppIndex } from "@/lib/server/apps";
import { listEntities } from "@/lib/server/entity-store";
import { appBuilderAgent, makeAppBuilderAgent } from "@/mastra";

/** Snapshot of what exists so edit requests modify instead of recreate. */
export function buildAppContext(appId: string, appName: string): string {
  // ... moved VERBATIM from app/api/apps/[appId]/chat/route.ts lines 73-102 ...
}

export interface RunBuilderTurnOptions {
  appId: string;
  appName: string;
  messages: UIMessage[];
  fragments?: boolean; // default true
  maxSteps?: number;   // default 40
}

/**
 * The ONE code path that invokes the builder agent — used by the chat route
 * and the benchmark CLI so measurements match real usage.
 */
export async function runBuilderTurn({
  appId,
  appName,
  messages,
  fragments = true,
  maxSteps = 40,
}: RunBuilderTurnOptions) {
  const agent = fragments ? appBuilderAgent : makeAppBuilderAgent({ fragments: false });
  return agent.stream(
    messages as unknown as Parameters<typeof agent.stream>[0],
    {
      maxSteps,
      requestContext: new RequestContext([["appId", appId]]),
      // Tag Langfuse traces so runs are filterable per app.
      tracingOptions: { metadata: { appId, appName } },
      context: [{ role: "system", content: buildAppContext(appId, appName) }],
    },
  );
}
```

- [ ] **Step 2: Rewire the chat route**

In `app/api/apps/[appId]/chat/route.ts`: delete the local `buildAppContext`, the `RequestContext`/`listEntities`/`readAllPages`/`readAppIndex`/`mastra` imports, and replace the agent block (lines 39–49) with:

```ts
import { runBuilderTurn } from "@/lib/server/builder-run";
// ...
const agentStream = await runBuilderTurn({ appId, appName: app.name, messages });
```

Everything else in the route (UI message stream, onFinish persistence, formatStreamError) is untouched.

- [ ] **Step 3: Verify the app still works**

```bash
bunx tsc --noEmit
(bun run dev > /tmp/dev.log 2>&1 &) && sleep 5
curl -s http://localhost:3000/api/apps | head -c 200          # expect {"apps":[...]}
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000 # expect 200
```
Then kill the dev server (the log prints the PID line `Run kill <pid> to stop it`). The POST path is exercised for real in Task 6.

- [ ] **Step 4: Commit**

```bash
git add lib/server/builder-run.ts app/api/apps/[appId]/chat/route.ts
git commit -m "refactor: extract runBuilderTurn shared agent runner"
```

### Task 4: `scripts/benchmark.ts`

**Files:**
- Create: `scripts/benchmark.ts`
- Modify: `.gitignore` (add `benchmarks/results/`)

Runner: `npx tsx scripts/benchmark.ts` from the repo root (NOT bun — `node:sqlite`).

- [ ] **Step 1: Write the script**

```ts
/**
 * Headless app-build benchmark. Usage (from repo root, requires .env.local):
 *
 *   npx tsx scripts/benchmark.ts --mode baseline|fragments [--reps 2] [--prompts task,crm,inventory] [--keep]
 *
 * Per run: fresh app -> one builder turn -> per-tool-step timings + token
 * usage + validation-retry counts -> benchmarks/results/<runId>.json.
 * Apps are deleted afterwards unless --keep.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { UIMessage } from "ai";
import { createApp, deleteApp, readAllPages, readAppIndex } from "@/lib/server/apps";
import { runBuilderTurn } from "@/lib/server/builder-run";

try { process.loadEnvFile(".env.local"); } catch { /* fall back to existing env */ }
if (!process.env.OPENROUTER_API_KEY) {
  console.error("OPENROUTER_API_KEY missing — create .env.local first.");
  process.exit(1);
}

const PROMPTS: Record<string, string> = {
  task:
    "Build a task tracker: a dashboard page with KPI stats (total tasks, open tasks, completed tasks) " +
    "and a chart of tasks by status; a task list page with search and a status filter and a table of tasks; " +
    "and the ability to add and edit tasks via a dialog form. Task fields: Title (text), Description (text), " +
    "Status (select: Open|In Progress|Done), Priority (select: Low|Medium|High), DueDate (date).",
  crm:
    "Build a small CRM: a contacts page listing contacts with search and an add/edit contact dialog form; " +
    "a deals kanban board grouped by stage (Lead|Qualified|Won|Lost) where deals can move between stages; " +
    "and a dashboard with KPIs (total deals, won deals, total deal value) and a chart of deals by stage. " +
    "Contact fields: Name, Email, Company, Phone (all text). Deal fields: Name (text), Company (text), " +
    "Value (number), Stage (select: Lead|Qualified|Won|Lost).",
  inventory:
    "Build an inventory manager: a stock dashboard with KPIs (total products, total stock units, low-stock count) " +
    "and a chart of stock by category; a products page with a searchable product table and an add/edit product " +
    "dialog; and a recent activity section showing the latest updated products. Product fields: Name (text), " +
    "SKU (text), Category (select: Electronics|Apparel|Food), Stock (number), ReorderLevel (number), UpdatedAt (date).",
};

interface StepEvent {
  tool: string;
  tStartMs: number;
  tEndMs: number;
  ms: number;
  pageId?: string;
  issues?: number;
}

interface RunResult {
  runId: string;
  mode: string;
  prompt: string;
  rep: number;
  startedAt: string;
  appSeconds: number | null;
  tokens: { input: number; output: number; total: number } | null;
  steps: StepEvent[];
  pages: Array<{ pageId: string; cleanAtMs: number; sincePrevCleanMs: number; attempts: number }>;
  retries: number;
  toolCalls: number;
  verify: { pages: number; hasIndex: boolean } | null;
  error: string | null;
}

const TIMEOUT_MS = 10 * 60 * 1000;

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const mode = get("--mode");
  if (mode !== "baseline" && mode !== "fragments") {
    console.error("--mode baseline|fragments is required");
    process.exit(1);
  }
  const reps = Number(get("--reps") ?? "2");
  const prompts = (get("--prompts") ?? Object.keys(PROMPTS).join(","))
    .split(",")
    .filter((p) => p in PROMPTS);
  return { mode, reps, prompts, keep: args.includes("--keep") };
}

async function benchOne(mode: string, promptKey: string, rep: number): Promise<RunResult> {
  const startedAt = new Date();
  const runId = `${startedAt.toISOString().replace(/[:.]/g, "-")}-${mode}-${promptKey}-r${rep}`;
  const result: RunResult = {
    runId, mode, prompt: promptKey, rep, startedAt: startedAt.toISOString(),
    appSeconds: null, tokens: null, steps: [], pages: [], retries: 0,
    toolCalls: 0, verify: null, error: null,
  };
  const app = createApp(`bench ${mode} ${promptKey} r${rep}`, PROMPTS[promptKey].slice(0, 100));
  const messages: UIMessage[] = [
    { id: "bench-u1", role: "user", parts: [{ type: "text", text: PROMPTS[promptKey] }] } as UIMessage,
  ];

  const t0 = performance.now();
  const open = new Map<string, { tool: string; tStartMs: number }>();
  try {
    const stream = await runBuilderTurn({
      appId: app.id, appName: app.name, messages, fragments: mode === "fragments",
    });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS).unref(),
    );
    const consume = (async () => {
      for await (const chunk of stream.fullStream as unknown as AsyncIterable<{
        type: string;
        payload?: { toolCallId?: string; toolName?: string; result?: unknown };
      }>) {
        const now = performance.now() - t0;
        if (chunk.type === "tool-call" && chunk.payload?.toolCallId) {
          open.set(chunk.payload.toolCallId, { tool: chunk.payload.toolName ?? "?", tStartMs: now });
        } else if (chunk.type === "tool-result" && chunk.payload?.toolCallId) {
          const start = open.get(chunk.payload.toolCallId);
          const res = chunk.payload.result as { pageId?: string; issues?: string[] } | undefined;
          result.steps.push({
            tool: chunk.payload.toolName ?? start?.tool ?? "?",
            tStartMs: Math.round(start?.tStartMs ?? now),
            tEndMs: Math.round(now),
            ms: Math.round(now - (start?.tStartMs ?? now)),
            ...(res?.pageId ? { pageId: res.pageId } : {}),
            ...(res?.issues?.length ? { issues: res.issues.length } : {}),
          });
          open.delete(chunk.payload.toolCallId);
        }
      }
    })();
    await Promise.race([consume, timeout]);
    result.appSeconds = (performance.now() - t0) / 1000;

    const usage = await stream.totalUsage;
    result.tokens = {
      input: usage.inputTokens ?? 0,
      output: usage.outputTokens ?? 0,
      total: usage.totalTokens ?? 0,
    };
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
    result.appSeconds = (performance.now() - t0) / 1000;
  }

  // Derived metrics.
  result.toolCalls = result.steps.length;
  result.retries = result.steps.filter(
    (s) => (s.tool === "savePage" || s.tool === "saveAppIndex") && (s.issues ?? 0) > 0,
  ).length;
  const attempts = new Map<string, number>();
  let prevClean = 0;
  for (const s of result.steps) {
    if (s.tool !== "savePage") continue;
    const pid = s.pageId ?? "(unknown)";
    attempts.set(pid, (attempts.get(pid) ?? 0) + 1);
    if (!s.issues) {
      result.pages.push({
        pageId: pid,
        cleanAtMs: s.tEndMs,
        sincePrevCleanMs: s.tEndMs - prevClean,
        attempts: attempts.get(pid) ?? 1,
      });
      prevClean = s.tEndMs;
      attempts.delete(pid);
    }
  }
  result.verify = {
    pages: readAllPages(app.id).length,
    hasIndex: readAppIndex(app.id) !== null,
  };

  const { keep } = parseArgs();
  if (!keep) deleteApp(app.id);
  return result;
}

async function main() {
  const { mode, reps, prompts } = parseArgs();
  const outDir = path.join(process.cwd(), "benchmarks", "results");
  mkdirSync(outDir, { recursive: true });

  for (const promptKey of prompts) {
    for (let rep = 1; rep <= reps; rep++) {
      console.log(`\n▶ ${mode} / ${promptKey} / rep ${rep} ...`);
      const res = await benchOne(mode, promptKey, rep);
      const file = path.join(outDir, `${res.runId}.json`);
      writeFileSync(file, JSON.stringify(res, null, 2));
      console.log(
        res.error
          ? `  ✗ ERROR after ${res.appSeconds?.toFixed(1)}s: ${res.error}`
          : `  ✓ ${res.appSeconds?.toFixed(1)}s, ${res.pages.length} pages, ` +
            `${res.retries} retries, ${res.tokens?.total ?? "?"} tokens → ${path.basename(file)}`,
      );
    }
  }
}

main();
```

- [ ] **Step 2: Add `benchmarks/results/` to `.gitignore`** (new line at the end).

- [ ] **Step 3: Dry-run the plumbing without spending tokens**

Run with a bogus key to confirm arg parsing, app creation, error capture, JSON writing, and cleanup all work:

```bash
OPENROUTER_API_KEY=sk-or-bogus npx tsx scripts/benchmark.ts --mode baseline --reps 1 --prompts task
```
Expected: one `✗ ERROR` line (auth failure from OpenRouter), a JSON file in `benchmarks/results/` with `error` set and `steps: []`, and no leftover `bench…` app in `data/builder.db` (check: `curl`-less — `npx tsx -e "import {listApps} from '@/lib/server/apps'; console.log(listApps().map(a=>a.name))"`).
Delete the error JSON afterwards: `rm benchmarks/results/*.json`.

- [ ] **Step 4: Typecheck + commit**

```bash
bunx tsc --noEmit
git add scripts/benchmark.ts .gitignore
git commit -m "feat: headless build benchmark CLI (per-step timing, tokens, retries)"
```

### Task 5: `scripts/benchmark-report.ts`

**Files:**
- Create: `scripts/benchmark-report.ts`

- [ ] **Step 1: Write the aggregator**

```ts
/**
 * Aggregates benchmarks/results/*.json into benchmarks/REPORT.md.
 * Usage: npx tsx scripts/benchmark-report.ts
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

interface RunResult {
  mode: string; prompt: string; rep: number; appSeconds: number | null;
  tokens: { total: number } | null; retries: number; error: string | null;
  pages: Array<{ sincePrevCleanMs: number }>;
  verify: { pages: number; hasIndex: boolean } | null;
}

const dir = path.join(process.cwd(), "benchmarks", "results");
if (!existsSync(dir)) { console.error("no benchmarks/results dir"); process.exit(1); }
const runs: RunResult[] = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")));

const ok = runs.filter((r) => !r.error);
const failed = runs.filter((r) => r.error);

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

const prompts = [...new Set(ok.map((r) => r.prompt))].sort();
const lines: string[] = [
  "# Benchmark report — fragments vs baseline",
  "",
  `Generated from ${runs.length} runs (${failed.length} failed/excluded).`,
  "",
  "| Prompt | Mode | Runs | Median app s | Mean page s | Mean tokens | Total retries |",
  "|---|---|---|---|---|---|---|",
];
for (const p of prompts) {
  for (const mode of ["baseline", "fragments"]) {
    const rs = ok.filter((r) => r.prompt === p && r.mode === mode);
    if (!rs.length) continue;
    const pageSecs = rs.flatMap((r) => r.pages.map((pg) => pg.sincePrevCleanMs / 1000));
    lines.push(
      `| ${p} | ${mode} | ${rs.length} | ${median(rs.map((r) => r.appSeconds ?? 0)).toFixed(1)} | ` +
      `${mean(pageSecs).toFixed(1)} | ${Math.round(mean(rs.map((r) => r.tokens?.total ?? 0)))} | ` +
      `${rs.reduce((a, r) => a + r.retries, 0)} |`,
    );
  }
}
const speedup = (metric: (r: RunResult) => number) => {
  const base = ok.filter((r) => r.mode === "baseline").map(metric);
  const frag = ok.filter((r) => r.mode === "fragments").map(metric);
  return base.length && frag.length ? (median(base) / median(frag)).toFixed(2) : "n/a";
};
lines.push(
  "",
  `**Overall speedup (median baseline / median fragments):** time ×${speedup((r) => r.appSeconds ?? 0)}, ` +
  `tokens ×${speedup((r) => r.tokens?.total ?? 0)}`,
  "",
);
if (failed.length) {
  lines.push("## Failed runs", "");
  for (const r of failed) lines.push(`- ${r.mode}/${r.prompt}/r${r.rep}: ${r.error}`);
}
writeFileSync(path.join(process.cwd(), "benchmarks", "REPORT.md"), lines.join("\n"));
console.log("wrote benchmarks/REPORT.md");
console.log(lines.join("\n"));
```

- [ ] **Step 2: Smoke it on a fabricated result**

```bash
mkdir -p benchmarks/results
cat > benchmarks/results/fake.json <<'EOF'
{"mode":"baseline","prompt":"task","rep":1,"appSeconds":120.5,"tokens":{"total":90000},"retries":2,"error":null,"pages":[{"sincePrevCleanMs":40000},{"sincePrevCleanMs":50000}],"verify":{"pages":2,"hasIndex":true}}
EOF
npx tsx scripts/benchmark-report.ts
rm benchmarks/results/fake.json benchmarks/REPORT.md
```
Expected: a markdown table with one `task | baseline` row, median 120.5, mean page 45.0.

- [ ] **Step 3: Typecheck + commit**

```bash
bunx tsc --noEmit
git add scripts/benchmark-report.ts
git commit -m "feat: benchmark report aggregator"
```

### Task 6: OPERATIONAL — run the baseline (REAL COST: ~6 agent runs)

**Prerequisite:** `.env.local` with valid `OPENROUTER_API_KEY` (`cp .env.local.example .env.local` if the user hasn't).

- [ ] **Step 1:** `npx tsx scripts/benchmark.ts --mode baseline --reps 2`
  Expected: 6 runs (task/crm/inventory × 2), each printing `✓ …s, N pages, …`. ~5–15 min total. If a run errors (timeout/API), note it — the report excludes it; re-run that prompt/rep manually if more than one fails.
- [ ] **Step 2:** Sanity-check one result JSON: it should have `steps` with `savePage` entries carrying `pageId`, `pages[]` non-empty, `verify.pages >= 2`, `verify.hasIndex: true`.
- [ ] **Step 3:** Results stay LOCAL (gitignored). Nothing to commit. Note the run count for the final report.

---

## Phase B — Chart component + generic widget kit

### Task 7: `Chart` catalog component + Combobox `labelKey`

**Files:**
- Create: `lib/jr/components/custom/ui/Chart.tsx`
- Modify: `lib/jr/components/custom/ui/index.ts` (two map entries)
- Modify: `lib/jr/components/custom/ui/Combobox.tsx` (add `labelKey`)
- Regenerate: `mastra/component-reference.generated.ts`

- [ ] **Step 1: Install recharts**

Run: `bun add recharts` — expect package.json + bun.lock updated.

- [ ] **Step 2: Create `lib/jr/components/custom/ui/Chart.tsx`**

```tsx
/**
 * Chart — json-render catalog component for bdo.metric GroupBy series.
 * Binds `data` to {$datasource: "<metricDs>/data/series"} — each point is
 * { <groupByField>: "label", value: <number> } (see entity-store metricKey).
 * kind "leaderboard" renders ranked rows (no SVG) — sorted/limited like charts.
 */
import { type BaseComponentProps } from "@json-render/react"
import { useMemo } from "react"
import {
	Area, AreaChart, Bar, BarChart, Cell, Line, LineChart,
	Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { z } from "zod"

const PALETTE = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#84cc16", "#f97316"]

interface ChartProps {
	kind: "bar" | "line" | "area" | "donut" | "pie" | "leaderboard"
	data?: Array<Record<string, unknown>> | null
	labelKey?: string | null
	valueKey?: string | null
	sort?: "asc" | "desc" | null
	limit?: number | null
	height?: number | null
	valueFormat?: "plain" | "currency" | "percent" | null
}

function fmt(n: number, format?: string | null): string {
	if (format === "currency") return `$${n.toLocaleString()}`
	if (format === "percent") return `${n}%`
	return n.toLocaleString()
}

function Chart({ props }: BaseComponentProps<ChartProps>) {
	const labelKey = props.labelKey ?? "label"
	const valueKey = props.valueKey ?? "value"
	const rows = useMemo(() => {
		let r = (Array.isArray(props.data) ? props.data : [])
			.filter((d) => d && typeof d === "object")
			.map((d) => ({
				label: String((d as Record<string, unknown>)[labelKey] ?? ""),
				value: Number((d as Record<string, unknown>)[valueKey] ?? 0),
			}))
		if (props.sort === "asc") r = [...r].sort((a, b) => a.value - b.value)
		if (props.sort === "desc") r = [...r].sort((a, b) => b.value - a.value)
		if (props.limit && props.limit > 0) r = r.slice(0, props.limit)
		return r
	}, [props.data, labelKey, valueKey, props.sort, props.limit])
	const height = props.height ?? 240

	if (rows.length === 0) {
		return <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>No data</div>
	}

	if (props.kind === "leaderboard") {
		const max = Math.max(...rows.map((r) => r.value), 1)
		return (
			<div className="flex flex-col gap-2">
				{rows.map((r, i) => (
					<div key={r.label + i} className="flex items-center gap-3">
						<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{i + 1}</span>
						<span className="w-32 truncate text-sm">{r.label}</span>
						<div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
							<div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
						</div>
						<span className="w-20 shrink-0 text-right text-sm tabular-nums">{fmt(r.value, props.valueFormat)}</span>
					</div>
				))}
			</div>
		)
	}

	const pielike = props.kind === "donut" || props.kind === "pie"
	return (
		<ResponsiveContainer width="100%" height={height}>
			{pielike ? (
				<PieChart>
					<Tooltip formatter={(v) => fmt(Number(v), props.valueFormat)} />
					<Pie data={rows} dataKey="value" nameKey="label" innerRadius={props.kind === "donut" ? "55%" : 0} outerRadius="90%" label={(e) => e.label}>
						{rows.map((r, i) => <Cell key={r.label + i} fill={PALETTE[i % PALETTE.length]} />)}
					</Pie>
				</PieChart>
			) : props.kind === "line" ? (
				<LineChart data={rows}>
					<XAxis dataKey="label" fontSize={12} /><YAxis fontSize={12} width={40} />
					<Tooltip formatter={(v) => fmt(Number(v), props.valueFormat)} />
					<Line type="monotone" dataKey="value" stroke={PALETTE[0]} strokeWidth={2} dot={false} />
				</LineChart>
			) : props.kind === "area" ? (
				<AreaChart data={rows}>
					<XAxis dataKey="label" fontSize={12} /><YAxis fontSize={12} width={40} />
					<Tooltip formatter={(v) => fmt(Number(v), props.valueFormat)} />
					<Area type="monotone" dataKey="value" stroke={PALETTE[0]} fill={PALETTE[0]} fillOpacity={0.25} />
				</AreaChart>
			) : (
				<BarChart data={rows}>
					<XAxis dataKey="label" fontSize={12} /><YAxis fontSize={12} width={40} />
					<Tooltip formatter={(v) => fmt(Number(v), props.valueFormat)} />
					<Bar dataKey="value" radius={[4, 4, 0, 0]}>
						{rows.map((r, i) => <Cell key={r.label + i} fill={PALETTE[i % PALETTE.length]} />)}
					</Bar>
				</BarChart>
			)}
		</ResponsiveContainer>
	)
}

export const definition = {
	props: z.object({
		kind: z.enum(["bar", "line", "area", "donut", "pie", "leaderboard"]),
		data: z
			.array(z.record(z.string(), z.unknown()))
			.nullable()
			.describe('Series points. Bind {$datasource: "<metricDs>/data/series"} — points look like {<groupField>: "label", value: n}.'),
		labelKey: z.string().nullable().describe("Point key holding the label — set to the GroupBy field id. Default 'label'."),
		valueKey: z.string().nullable().describe("Point key holding the number. bdo.metric with ONE Metric entry emits 'value' (the default)."),
		sort: z.enum(["asc", "desc"]).nullable().describe("Sort points by value before rendering."),
		limit: z.number().nullable().describe("Keep only the first N points (after sort)."),
		height: z.number().nullable().describe("Pixel height (default 240). Ignored by 'leaderboard'."),
		valueFormat: z.enum(["plain", "currency", "percent"]).nullable(),
	}),
	description:
		"Chart over a bdo.metric GroupBy series: bar | line | area | donut | pie, plus 'leaderboard' " +
		"(ranked rows with bars — use for top-N). Bind data to {$datasource: \"<metricDs>/data/series\"} " +
		"and set labelKey to the GroupBy field id; valueKey defaults to 'value'.",
	example: { kind: "bar", labelKey: "Status", valueKey: "value", height: 240 },
}

export const component = Chart
```

- [ ] **Step 3: Register it in `lib/jr/components/custom/ui/index.ts`**

Add (alphabetical, near the Calendar import): `import * as Chart from "./Chart"` — then `Chart: Chart.definition,` in the definitions map (the one containing `Rating: Rating.definition`) and `Chart: Chart.component,` in the components map.

- [ ] **Step 4: Extend Combobox with `labelKey`**

In `lib/jr/components/custom/ui/Combobox.tsx`:
1. `interface ComboboxProps` — add `labelKey?: string | null`.
2. Change `normalize(opt: unknown)` to `normalize(opt: unknown, labelKey?: string | null)` and, in the raw-record branch (after the `id == null` check), replace `return { label: id, value: id }` with:
```ts
		const label = labelKey && typeof rec[labelKey] === "string" ? (rec[labelKey] as string) : id
		return { label, value: id }
```
3. In the `options` useMemo, pass it through: `.map((o) => normalize(o as ComboboxOption, props.labelKey))` and add `props.labelKey` to the dependency array.
4. In `definition.props` add: `labelKey: z.string().nullable().describe("When options are raw BDO records (bound from a bdo.list datasource), the field id to show as the label; the stored value is the record _id.")` and append to the description: `" Bind options straight to {$datasource: \"<listDs>/data\"} and set labelKey for an entity-reference picker."`

- [ ] **Step 5: Regenerate docs, typecheck, commit**

```bash
bun scripts/gen-component-docs.ts
bunx tsc --noEmit
grep -c "### Chart" mastra/component-reference.generated.ts   # expect 1
git add package.json bun.lock lib/jr/components/custom/ui/Chart.tsx lib/jr/components/custom/ui/Combobox.tsx lib/jr/components/custom/ui/index.ts mastra/component-reference.generated.ts
git commit -m "feat: Chart catalog component (recharts) + Combobox labelKey for record options"
```

### Task 8: `fragments/generic/` scaffolding + shared helpers + test scaffold

**Files:**
- Create: `fragments/generic/_shared.ts`
- Create: `fragments/generic/index.ts`
- Modify: `fragments/index.ts`
- Create: `scripts/test-generic-fragments.ts`

- [ ] **Step 1: Create `fragments/generic/_shared.ts`**

```ts
/**
 * Shared param schemas + spec-JSON builders for the generic widget kit.
 * Everything here emits PLAIN spec JSON (elements/datasources) — no React.
 * All element keys passed in MUST already be ns-prefixed by the caller.
 */
import { z } from "zod";

// ── Param shapes ──────────────────────────────────────────────────────── //

export const FilterPair = z.object({
  field: z.string().describe("Entity field id (LHS)."),
  operator: z
    .enum(["EQ", "NEQ", "GT", "GTE", "LT", "LTE", "CONTAINS"])
    .default("EQ"),
  value: z.union([z.string(), z.number(), z.boolean()]).describe("Literal RHS value."),
});
export type FilterPairT = z.infer<typeof FilterPair>;

export const FilterBinding = z.object({
  field: z.string().describe("Entity field id (LHS)."),
  operator: z.enum(["EQ", "NEQ", "GT", "GTE", "LT", "LTE", "CONTAINS"]).default("EQ"),
  stateKey: z
    .string()
    .optional()
    .describe("Key under /filters/<ns>/ the RHS binds to — defaults to the field id. A FilterBar with targetNs=<ns> writes these keys."),
});
export type FilterBindingT = z.infer<typeof FilterBinding>;

export const DisplayKind = z
  .enum(["text", "muted", "money", "date", "badge", "boolean", "rating", "progress"])
  .describe("How the value renders.");
export type DisplayKindT = z.infer<typeof DisplayKind>;

export const FormFieldDef = z.object({
  field: z.string().describe("Entity field id."),
  label: z.string(),
  input: z
    .enum(["text", "textarea", "number", "date", "boolean", "select", "reference"])
    .default("text")
    .describe("date renders a text input expecting YYYY-MM-DD. reference renders a Combobox over another entity."),
  options: z.array(z.string()).optional().describe("select only — fixed options."),
  lookupEntity: z.string().optional().describe("reference only — the entity to list."),
  lookupLabelField: z.string().optional().describe("reference only — field shown as the option label (stored value is the record _id)."),
});
export type FormFieldDefT = z.infer<typeof FormFieldDef>;

// ── Datasource builders ───────────────────────────────────────────────── //

export function andFilter(conditions: Array<Record<string, unknown>>): Record<string, unknown> | undefined {
  return conditions.length ? { Operator: "AND", Condition: conditions } : undefined;
}

export function literalConditions(pairs: FilterPairT[] = []): Array<Record<string, unknown>> {
  return pairs.map((p) => ({ LHSField: p.field, Operator: p.operator, RHSValue: p.value }));
}

/** Conditions whose RHS binds /filters/<ns>/<stateKey> — null/""/"All" prune at runtime. */
export function boundConditions(ns: string, bindings: FilterBindingT[] = []): Array<Record<string, unknown>> {
  return bindings.map((b) => ({
    LHSField: b.field,
    Operator: b.operator,
    RHSValue: { $state: `/filters/${ns}/${b.stateKey ?? b.field}` },
  }));
}

export function metricDs(
  entity: string,
  metric: { Type: string; Field?: string },
  opts: { groupBy?: string[]; filter?: Record<string, unknown> } = {},
): Record<string, unknown> {
  return {
    type: "bdo.metric",
    params: {
      bdo: entity,
      Metric: [metric],
      ...(opts.groupBy?.length ? { GroupBy: opts.groupBy } : {}),
      ...(opts.filter ? { Filter: opts.filter } : {}),
    },
  };
}

// ── Element builders ──────────────────────────────────────────────────── //

type El = Record<string, unknown>;

export function textEl(text: unknown, variant = "body"): El {
  return { type: "Text", props: { text, variant } };
}

/**
 * Elements for one display-kind value. Returns the root key plus all elements
 * (money needs a 2-child Stack). `keyBase` must be ns-prefixed.
 * `ref` is the value expression: {$item}, {$state} or {$datasource}.
 * boolean: with an {$item} ref renders a Yes/No badge via $cond; with any
 * other ref it falls back to showing the raw value in a Badge.
 */
export function displayElements(
  keyBase: string,
  display: DisplayKindT,
  ref: Record<string, unknown>,
): { rootKey: string; elements: Record<string, El> } {
  switch (display) {
    case "money":
      return {
        rootKey: keyBase,
        elements: {
          [keyBase]: { type: "Stack", props: { direction: "horizontal", gap: "none", align: "center" }, children: [`${keyBase}-sym`, `${keyBase}-val`] },
          [`${keyBase}-sym`]: textEl("$", "muted"),
          [`${keyBase}-val`]: textEl(ref, "body"),
        },
      };
    case "badge":
      return { rootKey: keyBase, elements: { [keyBase]: { type: "Badge", props: { text: ref, variant: "secondary" } } } };
    case "boolean": {
      const text =
        "$item" in ref
          ? { $cond: { $item: ref.$item as string, eq: true }, $then: "Yes", $else: "No" }
          : ref;
      return { rootKey: keyBase, elements: { [keyBase]: { type: "Badge", props: { text, variant: "outline" } } } };
    }
    case "rating":
      return { rootKey: keyBase, elements: { [keyBase]: { type: "Rating", props: { value: ref, max: 5, symbol: null, icons: null, readOnly: true, name: null } } } };
    case "progress":
      return { rootKey: keyBase, elements: { [keyBase]: { type: "Progress", props: { value: ref, max: 100, label: null } } } };
    case "date":
    case "muted":
      return { rootKey: keyBase, elements: { [keyBase]: textEl(ref, "muted") } };
    default:
      return { rootKey: keyBase, elements: { [keyBase]: textEl(ref, "body") } };
  }
}

/** KPI value: currency gets a "$" prefix Stack, else a bare Heading. */
export function kpiValueElements(
  keyBase: string,
  format: "plain" | "currency" | "percent",
  valueRef: Record<string, unknown>,
): { rootKey: string; elements: Record<string, El> } {
  if (format === "currency") {
    return {
      rootKey: keyBase,
      elements: {
        [keyBase]: { type: "Stack", props: { direction: "horizontal", gap: "none", align: "center" }, children: [`${keyBase}-sym`, `${keyBase}-val`] },
        [`${keyBase}-sym`]: { type: "Heading", props: { text: "$", level: "h2" } },
        [`${keyBase}-val`]: { type: "Heading", props: { text: valueRef, level: "h2" } },
      },
    };
  }
  return {
    rootKey: keyBase,
    elements:
      format === "percent"
        ? {
            [keyBase]: { type: "Stack", props: { direction: "horizontal", gap: "none", align: "center" }, children: [`${keyBase}-val`, `${keyBase}-sym`] },
            [`${keyBase}-val`]: { type: "Heading", props: { text: valueRef, level: "h2" } },
            [`${keyBase}-sym`]: { type: "Heading", props: { text: "%", level: "h2" } },
          }
        : { [keyBase]: { type: "Heading", props: { text: valueRef, level: "h2" } } },
  };
}

/**
 * One form field bound at `<formPath>/<field>`. Returns the field's root
 * element key, its elements, and any lookup datasources (reference inputs).
 * Lookup datasource names land in the fragment's init refresh list.
 */
export function formFieldOutput(
  ns: string,
  f: FormFieldDefT,
  formPath: string,
): { rootKey: string; elements: Record<string, El>; datasources: Record<string, Record<string, unknown>> } {
  const key = `${ns}-field-${f.field.toLowerCase()}`;
  const bind = { $bindState: `${formPath}/${f.field}` };
  switch (f.input) {
    case "textarea":
      return { rootKey: key, elements: { [key]: { type: "Textarea", props: { label: f.label, name: f.field, value: bind, placeholder: null } } }, datasources: {} };
    case "number":
      return { rootKey: key, elements: { [key]: { type: "Input", props: { label: f.label, name: f.field, type: "number", value: bind, placeholder: null } } }, datasources: {} };
    case "date":
      return { rootKey: key, elements: { [key]: { type: "Input", props: { label: f.label, name: f.field, type: "text", value: bind, placeholder: "YYYY-MM-DD" } } }, datasources: {} };
    case "boolean":
      return { rootKey: key, elements: { [key]: { type: "Checkbox", props: { label: f.label, name: f.field, checked: bind } } }, datasources: {} };
    case "select":
      return { rootKey: key, elements: { [key]: { type: "Select", props: { label: f.label, name: f.field, options: f.options ?? [], value: bind, placeholder: f.label } } }, datasources: {} };
    case "reference": {
      const ds = `${ns}-lookup-${f.field.toLowerCase()}`;
      return {
        rootKey: key,
        elements: {
          [key]: { type: "Stack", props: { direction: "vertical", gap: "sm" }, children: [`${key}-label`, `${key}-input`] },
          [`${key}-label`]: textEl(f.label, "muted"),
          [`${key}-input`]: { type: "Combobox", props: { value: bind, options: { $datasource: `${ds}/data` }, labelKey: f.lookupLabelField ?? null, placeholder: f.label, name: f.field } },
        },
        datasources: { [ds]: { type: "bdo.list", params: { bdo: f.lookupEntity ?? "", Page: { number: 1, size: 100 } } } },
      };
    }
    default:
      return { rootKey: key, elements: { [key]: { type: "Input", props: { label: f.label, name: f.field, type: "text", value: bind, placeholder: null } } }, datasources: {} };
  }
}
```

- [ ] **Step 2: Create `fragments/generic/index.ts`** (grows one line per fragment task)

```ts
/** Generic widget kit — entity-agnostic fragments modeled on the rapp widget set. */
import type { FragmentRegistry } from "@/lib/jr/schema";

export const genericFragments: FragmentRegistry = {
  // fragments register here as they are implemented (Tasks 9-17)
};
```

- [ ] **Step 3: Register in `fragments/index.ts`**

```ts
import { ecommerceFragments } from "./ecommerce";
import { genericFragments } from "./generic";

export const fragmentRegistry: FragmentRegistry = {
  ...ecommerceFragments,
  ...genericFragments,
};
```

- [ ] **Step 4: Create `scripts/test-generic-fragments.ts`** (kitchen-sink; pages grow per task)

```ts
/**
 * Expansion + validation smoke test for the GENERIC kit. Three pages exercise
 * all 16 fragments against a Task/Customer model. Run: bun scripts/test-generic-fragments.ts
 */
import { fragmentRegistry } from "../fragments";
import { expandFragments } from "../lib/server/fragment-expander";
import { validatePageSpec } from "../lib/server/spec-validators";
import type { EntityDefinition } from "../lib/server/entity-store";

const entities: EntityDefinition[] = [
  {
    name: "Task",
    label: "Tasks",
    fields: [
      { id: "Title", name: "Title", type: "text" },
      { id: "Description", name: "Description", type: "text" },
      { id: "Status", name: "Status", type: "select", options: ["Open", "In Progress", "Done"] },
      { id: "Priority", name: "Priority", type: "select", options: ["Low", "Medium", "High"] },
      { id: "DueDate", name: "Due date", type: "date" },
      { id: "Estimate", name: "Estimate", type: "number" },
      { id: "Done", name: "Done", type: "boolean" },
      { id: "CustomerId", name: "Customer", type: "text" },
    ],
  },
  {
    name: "Customer",
    label: "Customers",
    fields: [
      { id: "Name", name: "Name", type: "text" },
      { id: "Email", name: "Email", type: "text" },
    ],
  },
];

// Pages reference fragments; each kit task adds its refs + parent children.
// `state` is optional — detail pages seed the idPath keys the validator checks.
const PAGES: Record<string, { root: string; elements: Record<string, unknown>; state?: Record<string, unknown> }> = {
  Dashboard: {
    root: "page",
    elements: {
      page: { type: "Stack", props: { direction: "vertical", gap: "lg", className: "p-8" }, children: [] },
    },
  },
  Tasks: {
    root: "page",
    elements: {
      page: { type: "Stack", props: { direction: "vertical", gap: "lg", className: "p-8" }, children: [] },
    },
  },
  "Task Detail": {
    root: "page",
    elements: {
      page: { type: "Stack", props: { direction: "vertical", gap: "lg", className: "p-8" }, children: [] },
    },
  },
};

let failed = false;
for (const [name, page] of Object.entries(PAGES)) {
  const { spec, issues, expanded } = expandFragments(
    page as unknown as Record<string, unknown>,
    fragmentRegistry,
  );
  if (issues.length) {
    failed = true;
    console.error(`${name}: EXPANSION ISSUES`);
    for (const i of issues) console.error("  -", i);
    continue;
  }
  const v = validatePageSpec({
    spec,
    validPageNames: Object.keys(PAGES),
    entities,
  });
  if (v.length) {
    failed = true;
    console.error(`${name}: VALIDATION ISSUES`);
    for (const i of v) console.error("  -", i);
    continue;
  }
  console.log(
    `${name}: ${expanded.length} fragments → ${Object.keys(spec.elements as object).length} elements, ` +
    `${Object.keys((spec.datasources as object) ?? {}).length} datasources — clean ✓`,
  );
}
process.exit(failed ? 1 : 0);
```

- [ ] **Step 5: Run everything, commit**

```bash
bun scripts/test-generic-fragments.ts     # expect 3 "clean ✓" lines (0 fragments yet)
bun scripts/test-fragment-expansion.ts    # ecommerce still clean
bunx tsc --noEmit
git add fragments/generic fragments/index.ts scripts/test-generic-fragments.ts
git commit -m "feat: generic fragment kit scaffolding + kitchen-sink test"
```

### Task 9: `PageHeader` + `StatsRow`

**Files:**
- Create: `fragments/generic/PageHeader.ts`, `fragments/generic/StatsRow.ts`
- Modify: `fragments/generic/index.ts`, `scripts/test-generic-fragments.ts`

- [ ] **Step 1 (red): Add the refs to the test, run, expect "unknown fragment" issues**

In `scripts/test-generic-fragments.ts`, Dashboard page: set `page.children: ["header", "stats"]` and add:

```ts
      header: {
        $fragment: "PageHeader",
        params: {
          title: "Task Dashboard",
          subtitle: "Live overview of all tasks",
          actions: [{ label: "View tasks", kind: "navigate", target: "Tasks" }],
        },
      },
      stats: {
        $fragment: "StatsRow",
        params: {
          entity: "Task",
          stats: [
            { label: "Total tasks", type: "COUNT" },
            { label: "Open", type: "COUNT", filter: [{ field: "Status", operator: "EQ", value: "Open" }] },
            { label: "Total estimate", type: "SUM", field: "Estimate", format: "currency" },
          ],
        },
      },
```

Run `bun scripts/test-generic-fragments.ts` — expected: Dashboard fails with unknown-fragment issues for PageHeader/StatsRow.

- [ ] **Step 2 (green): Create `fragments/generic/PageHeader.ts`**

```ts
/**
 * PageHeader — title + subtitle + action buttons. Actions either navigate to a
 * page (kind "navigate", target = page NAME) or open a sibling dialog fragment
 * (kind "openDialog", target = the dialog instance ns → sets /ui/<target>/open).
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { textEl } from "./_shared";

const Params = z.object({
  title: z.string(),
  subtitle: z.string().nullable().default(null),
  actions: z
    .array(
      z.object({
        label: z.string(),
        kind: z.enum(["navigate", "openDialog"]).default("navigate"),
        target: z.string().describe('navigate: a page NAME. openDialog: a same-page RecordFormDialog instance id (its ns).'),
        variant: z.enum(["primary", "secondary"]).default("primary"),
      }),
    )
    .default([]),
});
type P = z.infer<typeof Params>;

export const PageHeader: Fragment<P> = {
  name: "PageHeader",
  version: "1.0.0",
  description:
    "Page title + subtitle + action buttons. Actions: kind 'navigate' (target = page name) or " +
    "'openDialog' (target = a same-page RecordFormDialog/FormCard instance id — opens /ui/<target>/open " +
    "and clears its edit id so the dialog is in create mode). Use at the top of every page.",
  category: "layout",
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "horizontal", justify: "between", align: "center" },
        children: [`${ns}-text`, ...(params.actions.length ? [`${ns}-actions`] : [])],
      },
      [`${ns}-text`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none" },
        children: [`${ns}-title`, ...(params.subtitle ? [`${ns}-subtitle`] : [])],
      },
      [`${ns}-title`]: { type: "Heading", props: { text: params.title, level: "h1" } },
      ...(params.subtitle ? { [`${ns}-subtitle`]: textEl(params.subtitle, "muted") } : {}),
    };
    if (params.actions.length) {
      elements[`${ns}-actions`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm" },
        children: params.actions.map((_, i) => `${ns}-action-${i}`),
      };
      params.actions.forEach((a, i) => {
        elements[`${ns}-action-${i}`] = {
          type: "Button",
          props: { label: a.label, variant: a.variant, disabled: null },
          on: {
            press:
              a.kind === "navigate"
                ? { action: "ui.navigate", params: { to: a.target } }
                : [
                    { action: "setState", params: { statePath: `/ui/${a.target}/editId`, value: null } },
                    { action: "setState", params: { statePath: `/form/${a.target}`, value: {} } },
                    { action: "setState", params: { statePath: `/ui/${a.target}/open`, value: true } },
                  ],
          },
        };
      });
    }
    return { root: ns, elements };
  },
};
```

- [ ] **Step 3 (green): Create `fragments/generic/StatsRow.ts`**

```ts
/**
 * StatsRow — a Grid of KPI tiles, one bdo.metric per stat. Filters are literal
 * value pairs (e.g. Status EQ "Open"); currency/percent formats add the symbol.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { FilterPair, andFilter, kpiValueElements, literalConditions, metricDs, textEl } from "./_shared";

const Params = z.object({
  entity: z.string().describe("Entity to aggregate."),
  stats: z
    .array(
      z.object({
        label: z.string(),
        type: z.enum(["COUNT", "SUM", "AVG", "MIN", "MAX", "DISTINCT_COUNT"]).default("COUNT"),
        field: z.string().optional().describe("Required for everything except COUNT."),
        format: z.enum(["plain", "currency", "percent"]).default("plain"),
        filter: z.array(FilterPair).optional().describe("Literal AND conditions, e.g. Status EQ 'Open'."),
      }),
    )
    .min(1)
    .max(6),
  columns: z.number().int().min(2).max(6).default(3),
});
type P = z.infer<typeof Params>;

export const StatsRow: Fragment<P> = {
  name: "StatsRow",
  version: "1.0.0",
  description:
    "Row of KPI stat cards (Grid), one bdo.metric per stat: { label, type: COUNT|SUM|AVG|MIN|MAX|DISTINCT_COUNT, " +
    "field?, format: plain|currency|percent, filter?: [{field, operator, value}] }. Use ONLY on dashboards. " +
    "Datasource names are '<ns>-stat-<i>' if you need to refresh them after a write.",
  category: "display",
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: { type: "Grid", props: { columns: params.columns, gap: "md" }, children: params.stats.map((_, i) => `${ns}-stat-${i}`) },
    };
    const datasources: Record<string, Record<string, unknown>> = {};
    params.stats.forEach((s, i) => {
      const ds = `${ns}-stat-${i}`;
      datasources[ds] = metricDs(params.entity, { Type: s.type, ...(s.field ? { Field: s.field } : {}) }, { filter: andFilter(literalConditions(s.filter)) });
      const value = kpiValueElements(`${ns}-stat-${i}-value`, s.format, { $datasource: `${ds}/data/value` });
      elements[`${ns}-stat-${i}`] = { type: "Card", props: { title: null, description: null, maxWidth: null, centered: null, className: null }, children: [`${ns}-stat-${i}-body`] };
      elements[`${ns}-stat-${i}-body`] = { type: "Stack", props: { direction: "vertical", gap: "sm" }, children: [`${ns}-stat-${i}-label`, value.rootKey] };
      elements[`${ns}-stat-${i}-label`] = textEl(s.label, "muted");
      Object.assign(elements, value.elements);
    });
    return {
      root: ns,
      elements,
      datasources,
      init: [{ action: "datasource.refresh", params: { names: Object.keys(datasources) } }],
    };
  },
};
```

- [ ] **Step 4: Register both in `fragments/generic/index.ts`**

```ts
import { PageHeader } from "./PageHeader";
import { StatsRow } from "./StatsRow";

export const genericFragments: FragmentRegistry = {
  PageHeader,
  StatsRow,
};
```

- [ ] **Step 5: Run, expect clean; commit**

```bash
bun scripts/test-generic-fragments.ts   # Dashboard: 2 fragments → … clean ✓
bunx tsc --noEmit
git add fragments/generic scripts/test-generic-fragments.ts
git commit -m "feat: PageHeader + StatsRow generic fragments"
```

### Task 10: `ChartCard` + `Leaderboard` + `ProgressTracker`

**Files:**
- Create: `fragments/generic/ChartCard.ts`, `fragments/generic/Leaderboard.ts`, `fragments/generic/ProgressTracker.ts`
- Modify: `fragments/generic/index.ts`, `scripts/test-generic-fragments.ts`

Note: the custom `Timeline` and shadcn `Table` components take STATIC item/row arrays — only `Chart` (Task 7) accepts datasource-bound data. These three fragments all ride on `Chart`/`Progress`.

- [ ] **Step 1 (red): Add refs to the Dashboard test page**

Append to Dashboard `page.children`: `"status-chart", "top-priorities", "done-progress"`. Add elements:

```ts
      "status-chart": {
        $fragment: "ChartCard",
        params: { entity: "Task", title: "Tasks by status", kind: "donut", groupBy: "Status" },
      },
      "top-priorities": {
        $fragment: "Leaderboard",
        params: { entity: "Task", title: "Estimate by priority", metricType: "SUM", field: "Estimate", groupBy: "Priority", limit: 5 },
      },
      "done-progress": {
        $fragment: "ProgressTracker",
        params: { entity: "Task", title: "Done tasks vs target", target: 20, filter: [{ field: "Status", operator: "EQ", value: "Done" }] },
      },
```

Run `bun scripts/test-generic-fragments.ts` — expect unknown-fragment issues.

- [ ] **Step 2 (green): Create `fragments/generic/ChartCard.ts`**

```ts
/** ChartCard — Card + Chart over one bdo.metric GroupBy series. */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { FilterPair, andFilter, literalConditions, metricDs } from "./_shared";

const Params = z.object({
  entity: z.string(),
  title: z.string(),
  kind: z.enum(["bar", "line", "area", "donut", "pie"]).default("bar"),
  metricType: z.enum(["COUNT", "SUM", "AVG"]).default("COUNT"),
  field: z.string().optional().describe("Required for SUM/AVG."),
  groupBy: z.string().describe("Field id to group by (chart categories)."),
  filter: z.array(FilterPair).optional(),
  valueFormat: z.enum(["plain", "currency", "percent"]).default("plain"),
  height: z.number().int().min(120).max(480).default(240),
});
type P = z.infer<typeof Params>;

export const ChartCard: Fragment<P> = {
  name: "ChartCard",
  version: "1.0.0",
  description:
    "Dashboard chart card: bar | line | area | donut | pie over ONE aggregation grouped by a field " +
    "(e.g. COUNT of tasks by Status, SUM of Value by Stage). Datasource name is '<ns>-metric'.",
  category: "display",
  params: Params as z.ZodType<P>,
  build: (params, ns) => ({
    root: ns,
    elements: {
      [ns]: { type: "Card", props: { title: params.title, description: null, maxWidth: null, centered: null, className: null }, children: [`${ns}-chart`] },
      [`${ns}-chart`]: {
        type: "Chart",
        props: {
          kind: params.kind,
          data: { $datasource: `${ns}-metric/data/series` },
          labelKey: params.groupBy,
          valueKey: "value",
          sort: null,
          limit: null,
          height: params.height,
          valueFormat: params.valueFormat,
        },
      },
    },
    datasources: {
      [`${ns}-metric`]: metricDs(
        params.entity,
        { Type: params.metricType, ...(params.field ? { Field: params.field } : {}) },
        { groupBy: [params.groupBy], filter: andFilter(literalConditions(params.filter)) },
      ),
    },
    init: [{ action: "datasource.refresh", params: { names: [`${ns}-metric`] } }],
  }),
};
```

- [ ] **Step 3 (green): Create `fragments/generic/Leaderboard.ts`**

Identical structure to ChartCard with these differences (full file, same imports/Params base):
- Params: same as ChartCard MINUS `kind`/`height`, PLUS `limit: z.number().int().min(3).max(20).default(5)`.
- The Chart element props: `kind: "leaderboard"`, `sort: "desc"`, `limit: params.limit`, `height: null`.
- name: "Leaderboard"; description: "Ranked top-N card (rank, label, bar, value) from ONE grouped aggregation — e.g. SUM of Value by Owner. Datasource name '<ns>-metric'."; category: "display".

- [ ] **Step 4 (green): Create `fragments/generic/ProgressTracker.ts`**

```ts
/** ProgressTracker — one ungrouped metric rendered as value-vs-target Progress. */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { FilterPair, andFilter, literalConditions, metricDs, textEl } from "./_shared";

const Params = z.object({
  entity: z.string(),
  title: z.string(),
  metricType: z.enum(["COUNT", "SUM", "AVG"]).default("COUNT"),
  field: z.string().optional(),
  target: z.number().describe("The goal — Progress maxes out here."),
  filter: z.array(FilterPair).optional(),
});
type P = z.infer<typeof Params>;

export const ProgressTracker: Fragment<P> = {
  name: "ProgressTracker",
  version: "1.0.0",
  description:
    "Metric-vs-target progress card (e.g. 'Done tasks vs target 20'). ONE ungrouped aggregation; " +
    "Progress fills value/target. Datasource name '<ns>-metric'.",
  category: "display",
  params: Params as z.ZodType<P>,
  build: (params, ns) => ({
    root: ns,
    elements: {
      [ns]: { type: "Card", props: { title: params.title, description: null, maxWidth: null, centered: null, className: null }, children: [`${ns}-body`] },
      [`${ns}-body`]: { type: "Stack", props: { direction: "vertical", gap: "sm" }, children: [`${ns}-bar`, `${ns}-caption`] },
      [`${ns}-bar`]: { type: "Progress", props: { value: { $datasource: `${ns}-metric/data/value` }, max: params.target, label: null } },
      [`${ns}-caption`]: { type: "Stack", props: { direction: "horizontal", justify: "between", align: "center" }, children: [`${ns}-current`, `${ns}-target`] },
      [`${ns}-current`]: textEl({ $datasource: `${ns}-metric/data/value` }, "lead"),
      [`${ns}-target`]: textEl(`of ${params.target}`, "muted"),
    },
    datasources: {
      [`${ns}-metric`]: metricDs(
        params.entity,
        { Type: params.metricType, ...(params.field ? { Field: params.field } : {}) },
        { filter: andFilter(literalConditions(params.filter)) },
      ),
    },
    init: [{ action: "datasource.refresh", params: { names: [`${ns}-metric`] } }],
  }),
};
```

- [ ] **Step 5: Register all three, run, commit**

Add `ChartCard, Leaderboard, ProgressTracker` to `fragments/generic/index.ts` (imports + registry entries). Then:

```bash
bun scripts/test-generic-fragments.ts && bunx tsc --noEmit
git add fragments/generic scripts/test-generic-fragments.ts
git commit -m "feat: ChartCard + Leaderboard + ProgressTracker fragments"
```

### Task 11: `RecentList` + `ActivityTimeline`

**Files:**
- Create: `fragments/generic/RecentList.ts`, `fragments/generic/ActivityTimeline.ts`
- Modify: `fragments/generic/index.ts`, `scripts/test-generic-fragments.ts`

- [ ] **Step 1 (red): Add refs to the Dashboard test page**

Append `"recent", "timeline"` to Dashboard children, add:

```ts
      recent: {
        $fragment: "RecentList",
        params: { entity: "Task", title: "Recently due", titleField: "Title", sublabelField: "Priority", dateField: "DueDate", limit: 5, pressTarget: "Tasks" },
      },
      timeline: {
        $fragment: "ActivityTimeline",
        params: { entity: "Task", title: "Task timeline", titleField: "Title", dateField: "DueDate", descriptionField: "Status", limit: 8 },
      },
```

Run the test — expect unknown-fragment issues.

- [ ] **Step 2 (green): Create `fragments/generic/RecentList.ts`**

```ts
/** RecentList — top-N records by a date field, newest first. */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { textEl } from "./_shared";

const Params = z.object({
  entity: z.string(),
  title: z.string(),
  titleField: z.string().describe("Field shown as the row title."),
  sublabelField: z.string().optional(),
  dateField: z.string().describe("Date field — sorts DESC and shows right-aligned."),
  limit: z.number().int().min(3).max(20).default(5),
  pressTarget: z.string().nullable().default(null).describe("Page NAME a row click navigates to (null = not clickable)."),
});
type P = z.infer<typeof Params>;

export const RecentList: Fragment<P> = {
  name: "RecentList",
  version: "1.0.0",
  description:
    "Card of the N most recent records by a date field (title + optional sublabel + date per row, " +
    "optional row-click navigation). Datasource name '<ns>-list'.",
  category: "display",
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const ds = `${ns}-list`;
    return {
      root: ns,
      elements: {
        [ns]: { type: "Card", props: { title: params.title, description: null, maxWidth: null, centered: null, className: null }, children: [`${ns}-rows`, `${ns}-empty`] },
        [`${ns}-rows`]: {
          type: "Stack",
          props: { direction: "vertical", gap: "sm" },
          repeat: { statePath: `/queries/${ds}/data`, key: "_id" },
          children: [`${ns}-row`],
        },
        [`${ns}-row`]: {
          type: "Stack",
          props: { direction: "horizontal", justify: "between", align: "center", className: "rounded-lg border border-border px-3 py-2" },
          children: [`${ns}-row-main`, `${ns}-row-date`],
          ...(params.pressTarget
            ? { on: { press: { action: "ui.navigate", params: { to: params.pressTarget } } } }
            : {}),
        },
        [`${ns}-row-main`]: {
          type: "Stack",
          props: { direction: "vertical", gap: "none" },
          children: [`${ns}-row-title`, ...(params.sublabelField ? [`${ns}-row-sub`] : [])],
        },
        [`${ns}-row-title`]: textEl({ $item: params.titleField }, "body"),
        ...(params.sublabelField ? { [`${ns}-row-sub`]: textEl({ $item: params.sublabelField }, "muted") } : {}),
        [`${ns}-row-date`]: textEl({ $item: params.dateField }, "muted"),
        [`${ns}-empty`]: {
          type: "Empty",
          props: { title: "Nothing yet", description: "Records appear here as they are added." },
          visible: { $state: `/queries/${ds}/page/total`, eq: 0 },
        },
      },
      datasources: {
        [ds]: {
          type: "bdo.list",
          params: { bdo: params.entity, Sort: [{ [params.dateField]: "DESC" }], Page: { number: 1, size: params.limit } },
        },
      },
      init: [{ action: "datasource.refresh", params: { names: [ds] } }],
    };
  },
};
```

- [ ] **Step 3 (green): Create `fragments/generic/ActivityTimeline.ts`**

Same shape as RecentList with these differences (full file, same imports). NOTE: the catalog `Timeline` component takes STATIC items, so this fragment renders its own dot-rail rows via repeat:

```ts
/** ActivityTimeline — recent records as a vertical dot-rail timeline. */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { textEl } from "./_shared";

const Params = z.object({
  entity: z.string(),
  title: z.string(),
  titleField: z.string(),
  dateField: z.string(),
  descriptionField: z.string().optional(),
  limit: z.number().int().min(3).max(20).default(8),
});
type P = z.infer<typeof Params>;

export const ActivityTimeline: Fragment<P> = {
  name: "ActivityTimeline",
  version: "1.0.0",
  description:
    "Vertical timeline card of the N most recent records (dot + title + date + optional description). " +
    "Datasource name '<ns>-list'.",
  category: "display",
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const ds = `${ns}-list`;
    return {
      root: ns,
      elements: {
        [ns]: { type: "Card", props: { title: params.title, description: null, maxWidth: null, centered: null, className: null }, children: [`${ns}-rows`, `${ns}-empty`] },
        [`${ns}-rows`]: {
          type: "Stack",
          props: { direction: "vertical", gap: "none" },
          repeat: { statePath: `/queries/${ds}/data`, key: "_id" },
          children: [`${ns}-row`],
        },
        [`${ns}-row`]: {
          type: "Stack",
          props: { direction: "horizontal", gap: "md", align: "start", className: "border-l-2 border-border pl-4 pb-4 relative" },
          children: [`${ns}-row-body`],
        },
        [`${ns}-row-body`]: { type: "Stack", props: { direction: "vertical", gap: "none" }, children: [`${ns}-row-head`, ...(params.descriptionField ? [`${ns}-row-desc`] : [])] },
        [`${ns}-row-head`]: { type: "Stack", props: { direction: "horizontal", justify: "between", align: "center" }, children: [`${ns}-row-title`, `${ns}-row-date`] },
        [`${ns}-row-title`]: textEl({ $item: params.titleField }, "body"),
        [`${ns}-row-date`]: textEl({ $item: params.dateField }, "muted"),
        ...(params.descriptionField ? { [`${ns}-row-desc`]: textEl({ $item: params.descriptionField }, "muted") } : {}),
        [`${ns}-empty`]: {
          type: "Empty",
          props: { title: "No activity", description: "Recent records appear here." },
          visible: { $state: `/queries/${ds}/page/total`, eq: 0 },
        },
      },
      datasources: {
        [ds]: { type: "bdo.list", params: { bdo: params.entity, Sort: [{ [params.dateField]: "DESC" }], Page: { number: 1, size: params.limit } } },
      },
      init: [{ action: "datasource.refresh", params: { names: [ds] } }],
    };
  },
};
```

- [ ] **Step 4: Register, run, commit**

```bash
bun scripts/test-generic-fragments.ts && bunx tsc --noEmit
git add fragments/generic scripts/test-generic-fragments.ts
git commit -m "feat: RecentList + ActivityTimeline fragments"
```

### Task 12: `DataTable`

**Files:**
- Create: `fragments/generic/DataTable.ts`
- Modify: `fragments/generic/index.ts`, `scripts/test-generic-fragments.ts`

The shadcn `Table` takes static rows, so DataTable builds a header Stack + repeat row Stacks (CartSummary pattern) with display-kind cells, optional search input, pagination, and row actions. Edit/delete pair with a sibling `RecordFormDialog` by ns.

- [ ] **Step 1 (red): Add the ref to the Tasks test page**

Tasks page: `page.children: ["table"]` (the dialog joins in Task 15) plus:

```ts
      table: {
        $fragment: "DataTable",
        params: {
          entity: "Task",
          columns: [
            { field: "Title", label: "Title", display: "text" },
            { field: "Status", label: "Status", display: "badge" },
            { field: "Estimate", label: "Estimate", display: "money" },
            { field: "Done", label: "Done", display: "boolean" },
            { field: "DueDate", label: "Due", display: "date" },
          ],
          searchable: true,
          pageSize: 10,
          filterBindings: [{ field: "Status", operator: "EQ" }],
          rowActions: ["edit", "delete"],
          formDialogNs: "task-form",
        },
      },
```

Run — expect unknown fragment. (Validation of `formDialogNs` wiring completes in Task 15; the `/ui/task-form/*` setState writes are legal without the dialog present.)

- [ ] **Step 2 (green): Create `fragments/generic/DataTable.ts`**

```ts
/**
 * DataTable — searchable, paged record list with display-kind columns and
 * row actions. Built from repeat Stacks (the catalog Table takes static rows).
 *
 * Filters: `searchable` adds its own search input writing /filters/<ns>/search;
 * `filterBindings` adds Filter conditions reading /filters/<ns>/<stateKey> —
 * pair with a FilterBar(targetNs=<this ns>) that writes those keys (do NOT
 * also set searchable=true if the FilterBar has a search kind).
 * Row actions: "edit" needs `formDialogNs` (a sibling RecordFormDialog
 * instance id); "delete" fires '<ns>-delete' with a confirm dialog.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { DisplayKind, FilterBinding, andFilter, boundConditions, displayElements } from "./_shared";

const Params = z.object({
  entity: z.string(),
  columns: z
    .array(z.object({ field: z.string(), label: z.string(), display: DisplayKind.default("text") }))
    .min(1)
    .max(7),
  searchable: z.boolean().default(true),
  pageSize: z.number().int().min(5).max(50).default(10),
  filterBindings: z
    .array(FilterBinding)
    .default([])
    .describe("Filter conditions bound to /filters/<ns>/<stateKey> — written by a paired FilterBar."),
  baseFilter: z
    .array(z.object({ field: z.string(), operator: z.enum(["EQ", "NEQ"]).default("EQ"), value: z.union([z.string(), z.number(), z.boolean()]) }))
    .default([])
    .describe("Permanent literal conditions (e.g. scope to Status EQ 'Active')."),
  rowActions: z.array(z.enum(["edit", "delete"])).default([]),
  formDialogNs: z.string().nullable().default(null).describe("Sibling RecordFormDialog instance id — required when rowActions includes 'edit'."),
  refreshOnWrite: z.array(z.string()).default([]).describe("EXTRA same-page datasource names to re-fire after a delete (this table's list auto-refreshes)."),
});
type P = z.infer<typeof Params>;

export const DataTable: Fragment<P> = {
  name: "DataTable",
  version: "1.0.0",
  description:
    "Searchable, paged data table with typed columns (text|muted|money|date|badge|boolean|rating|progress) " +
    "and row actions: 'edit' opens a sibling RecordFormDialog (set formDialogNs), 'delete' soft-deletes with " +
    "confirm. List datasource is '<ns>-list' — pass it to form dialogs' refresh. Pair with FilterBar via " +
    "filterBindings (FilterBar targetNs = this instance id).",
  category: "display",
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const ds = `${ns}-list`;
    const cols = params.columns;
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "vertical", gap: "sm" },
        children: [...(params.searchable ? [`${ns}-toolbar`] : []), `${ns}-head`, `${ns}-rows`, `${ns}-empty`],
      },
      [`${ns}-head`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "md", align: "center", className: "border-b border-border pb-2 px-3" },
        children: [...cols.map((_, i) => `${ns}-head-${i}`), ...(params.rowActions.length ? [`${ns}-head-actions`] : [])],
      },
      [`${ns}-rows`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none" },
        repeat: { statePath: `/queries/${ds}/data`, key: "_id" },
        children: [`${ns}-row`],
      },
      [`${ns}-row`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "md", align: "center", className: "border-b border-border py-2 px-3" },
        children: [...cols.map((_, i) => `${ns}-cell-${i}`), ...(params.rowActions.length ? [`${ns}-row-actions`] : [])],
      },
      [`${ns}-empty`]: {
        type: "Empty",
        props: { title: "No records", description: "Adjust filters or add a record." },
        visible: { $state: `/queries/${ds}/page/total`, eq: 0 },
      },
    };
    cols.forEach((c, i) => {
      elements[`${ns}-head-${i}`] = { type: "Text", props: { text: c.label, variant: "muted", className: "flex-1 font-medium" } };
      const cell = displayElements(`${ns}-cell-${i}`, c.display, { $item: c.field });
      // each cell shares the row width evenly
      const root = cell.elements[cell.rootKey] as { props?: Record<string, unknown> };
      root.props = { ...root.props, className: "flex-1" };
      Object.assign(elements, cell.elements);
    });
    if (params.searchable) {
      elements[`${ns}-toolbar`] = { type: "Stack", props: { direction: "horizontal", gap: "md", align: "center" }, children: [`${ns}-search`] };
      elements[`${ns}-search`] = { type: "Input", props: { label: "", name: "search", type: "text", placeholder: "Search…", value: { $bindState: `/filters/${ns}/search` } } };
    }
    const datasources: Record<string, Record<string, unknown>> = {
      [ds]: {
        type: "bdo.list",
        params: {
          bdo: params.entity,
          ...(params.searchable || params.filterBindings.length ? { Search: { $state: `/filters/${ns}/search` } } : {}),
          ...(params.filterBindings.length || params.baseFilter.length
            ? {
                Filter: andFilter([
                  ...params.baseFilter.map((b) => ({ LHSField: b.field, Operator: b.operator, RHSValue: b.value })),
                  ...boundConditions(ns, params.filterBindings),
                ]),
              }
            : {}),
          Page: { number: 1, size: params.pageSize },
        },
        debounceMs: 300,
      },
    };
    if (params.rowActions.length) {
      elements[`${ns}-head-actions`] = { type: "Text", props: { text: "", variant: "muted", className: "w-36" } };
      elements[`${ns}-row-actions`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", className: "w-36 justify-end" },
        children: params.rowActions.map((a) => `${ns}-act-${a}`),
      };
      if (params.rowActions.includes("edit") && params.formDialogNs) {
        const dlg = params.formDialogNs;
        elements[`${ns}-act-edit`] = {
          type: "Button",
          props: { label: "Edit", variant: "secondary", disabled: null },
          on: {
            press: [
              // repeat-scope: $template bare names copy the row's values
              { action: "setState", params: { statePath: `/ui/${dlg}/editId`, value: { $template: "${_id}" } } },
              { action: "setState", params: { statePath: `/ui/${dlg}/open`, value: true } },
            ],
          },
        };
      }
      if (params.rowActions.includes("delete")) {
        elements[`${ns}-act-delete`] = {
          type: "Button",
          props: { label: "Delete", variant: "secondary", disabled: null },
          on: {
            press: [
              { action: "setState", params: { statePath: `/ui/${ns}/deleteId`, value: { $template: "${_id}" } } },
              {
                action: "datasource.fire",
                params: { name: `${ns}-delete` },
                confirm: { title: "Delete record", message: "This cannot be undone.", variant: "danger" },
              },
            ],
          },
        };
        datasources[`${ns}-delete`] = {
          type: "bdo.delete",
          params: { bdo: params.entity, _id: { $state: `/ui/${ns}/deleteId` } },
          refresh: [ds, ...params.refreshOnWrite],
          on: { success: [{ action: "ui.toast", params: { message: "Record deleted", kind: "default" } }] },
        };
      }
    }
    return {
      root: ns,
      elements,
      state: {
        ...(params.searchable || params.filterBindings.length ? { filters: { [ns]: { search: "" } } } : {}),
        ...(params.rowActions.includes("delete") ? { ui: { [ns]: { deleteId: null } } } : {}),
      },
      datasources,
      init: [{ action: "datasource.refresh", params: { names: [ds] } }],
    };
  },
};
```

NOTE for the implementer: `filterBindings` deliberately seeds NO `/filters/<ns>/<key>` state — the paired FilterBar owns those seeds (same rule as the ecommerce ProductGrid/ProductFilters split). Unseeded bindings resolve undefined and the condition prunes.

- [ ] **Step 3: Register, run, commit**

```bash
bun scripts/test-generic-fragments.ts && bunx tsc --noEmit
git add fragments/generic scripts/test-generic-fragments.ts
git commit -m "feat: DataTable fragment"
```

### Task 13: `CardGrid` + `RelatedList`

**Files:**
- Create: `fragments/generic/CardGrid.ts`, `fragments/generic/RelatedList.ts`
- Modify: `fragments/generic/index.ts`, `scripts/test-generic-fragments.ts`

- [ ] **Step 1 (red): Add refs**

Tasks page children += `"cards"`; Task Detail page children += `"related"`. Elements:

```ts
      cards: {
        $fragment: "CardGrid",
        params: { entity: "Task", titleField: "Title", subtitleFields: ["Priority", "DueDate"], badgeField: "Status", columns: 3, pageSize: 9, filterBindings: [{ field: "Status" }] },
      },
```
```ts
      related: {
        $fragment: "RelatedList",
        params: {
          entity: "Task",
          title: "Tasks for this customer",
          parentField: "CustomerId",
          parentIdPath: "/ui/selectedCustomerId",
          columns: [
            { field: "Title", label: "Title", display: "text" },
            { field: "Status", label: "Status", display: "badge" },
          ],
        },
      },
```
Also seed Task Detail page state for the validator: the Task Detail PAGES entry gets `state: { ui: { selectedCustomerId: "" } }` — add a `state` key to the page object and pass it through expandFragments (the expander tolerates extra spec keys).

Run — expect unknown fragments.

- [ ] **Step 2 (green): Create `fragments/generic/CardGrid.ts`**

```ts
/** CardGrid — responsive card grid over bdo.list (title/subtitles/badge/image). */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { FilterBinding, andFilter, boundConditions, textEl } from "./_shared";

const Params = z.object({
  entity: z.string(),
  titleField: z.string(),
  subtitleFields: z.array(z.string()).default([]),
  badgeField: z.string().optional(),
  imageField: z.string().optional().describe("Field holding an image URL — adds a thumbnail."),
  columns: z.number().int().min(2).max(4).default(3),
  pageSize: z.number().int().min(4).max(48).default(9),
  filterBindings: z.array(FilterBinding).default([]),
  pressTarget: z.string().nullable().default(null).describe("Page NAME a card click navigates to."),
});
type P = z.infer<typeof Params>;

export const CardGrid: Fragment<P> = {
  name: "CardGrid",
  version: "1.0.0",
  description:
    "Card grid over records: title, subtitle fields, optional status badge + image thumbnail, optional " +
    "card-click navigation. List datasource '<ns>-list'; pair with FilterBar via filterBindings.",
  category: "display",
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const ds = `${ns}-list`;
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: { type: "Stack", props: { direction: "vertical", gap: "sm" }, children: [`${ns}-grid`, `${ns}-empty`] },
      [`${ns}-grid`]: {
        type: "Grid",
        props: { columns: params.columns, gap: "md" },
        repeat: { statePath: `/queries/${ds}/data`, key: "_id" },
        children: [`${ns}-card`],
      },
      [`${ns}-card`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "sm", className: "rounded-xl border border-border bg-card p-4" },
        children: [
          ...(params.imageField ? [`${ns}-card-img`] : []),
          `${ns}-card-head`,
          ...params.subtitleFields.map((_, i) => `${ns}-card-sub-${i}`),
        ],
        ...(params.pressTarget ? { on: { press: { action: "ui.navigate", params: { to: params.pressTarget } } } } : {}),
      },
      ...(params.imageField
        ? { [`${ns}-card-img`]: { type: "Image", props: { src: { $item: params.imageField }, alt: { $item: params.titleField }, width: 280, height: 160 } } }
        : {}),
      [`${ns}-card-head`]: {
        type: "Stack",
        props: { direction: "horizontal", justify: "between", align: "center" },
        children: [`${ns}-card-title`, ...(params.badgeField ? [`${ns}-card-badge`] : [])],
      },
      [`${ns}-card-title`]: { type: "Heading", props: { text: { $item: params.titleField }, level: "h4" } },
      ...(params.badgeField ? { [`${ns}-card-badge`]: { type: "Badge", props: { text: { $item: params.badgeField }, variant: "secondary" } } } : {}),
      [`${ns}-empty`]: {
        type: "Empty",
        props: { title: "No records", description: "Adjust filters or add a record." },
        visible: { $state: `/queries/${ds}/page/total`, eq: 0 },
      },
    };
    params.subtitleFields.forEach((f, i) => {
      elements[`${ns}-card-sub-${i}`] = textEl({ $item: f }, "muted");
    });
    return {
      root: ns,
      elements,
      datasources: {
        [ds]: {
          type: "bdo.list",
          params: {
            bdo: params.entity,
            ...(params.filterBindings.length
              ? { Search: { $state: `/filters/${ns}/search` }, Filter: andFilter(boundConditions(ns, params.filterBindings)) }
              : {}),
            Page: { number: 1, size: params.pageSize },
          },
          debounceMs: 300,
        },
      },
      init: [{ action: "datasource.refresh", params: { names: [ds] } }],
    };
  },
};
```

- [ ] **Step 3 (green): Create `fragments/generic/RelatedList.ts`**

```ts
/** RelatedList — compact table of child records scoped to a parent id in state. */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { DisplayKind, displayElements } from "./_shared";

const Params = z.object({
  entity: z.string().describe("CHILD entity to list."),
  title: z.string(),
  parentField: z.string().describe("Child field holding the parent record id."),
  parentIdPath: z.string().describe("State path holding the parent id (e.g. /ui/selectedCustomerId)."),
  columns: z.array(z.object({ field: z.string(), label: z.string(), display: DisplayKind.default("text") })).min(1).max(5),
  pageSize: z.number().int().min(5).max(50).default(10),
});
type P = z.infer<typeof Params>;

export const RelatedList: Fragment<P> = {
  name: "RelatedList",
  version: "1.0.0",
  description:
    "Child-record table scoped by <parentField> EQ the id at <parentIdPath> — for master-detail pages " +
    "(pairs with DetailHeader/RecordView reading the same id path). Auto-refires when the id changes; " +
    "waits until the id is set. Datasource '<ns>-list'.",
  category: "display",
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const ds = `${ns}-list`;
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: { type: "Card", props: { title: params.title, description: null, maxWidth: null, centered: null, className: null }, children: [`${ns}-head`, `${ns}-rows`, `${ns}-empty`] },
      [`${ns}-head`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "md", align: "center", className: "border-b border-border pb-2" },
        children: params.columns.map((_, i) => `${ns}-head-${i}`),
      },
      [`${ns}-rows`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none" },
        repeat: { statePath: `/queries/${ds}/data`, key: "_id" },
        children: [`${ns}-row`],
      },
      [`${ns}-row`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "md", align: "center", className: "border-b border-border py-2" },
        children: params.columns.map((_, i) => `${ns}-cell-${i}`),
      },
      [`${ns}-empty`]: {
        type: "Empty",
        props: { title: "No related records", description: "" },
        visible: { $state: `/queries/${ds}/page/total`, eq: 0 },
      },
    };
    params.columns.forEach((c, i) => {
      elements[`${ns}-head-${i}`] = { type: "Text", props: { text: c.label, variant: "muted", className: "flex-1 font-medium" } };
      const cell = displayElements(`${ns}-cell-${i}`, c.display, { $item: c.field });
      const root = cell.elements[cell.rootKey] as { props?: Record<string, unknown> };
      root.props = { ...root.props, className: "flex-1" };
      Object.assign(elements, cell.elements);
    });
    return {
      root: ns,
      elements,
      datasources: {
        [ds]: {
          type: "bdo.list",
          params: {
            bdo: params.entity,
            Filter: { Operator: "AND", Condition: [{ LHSField: params.parentField, Operator: "EQ", RHSValue: { $state: params.parentIdPath } }] },
            Page: { number: 1, size: params.pageSize },
          },
          skipUntilReady: true,
        },
      },
      init: [{ action: "datasource.refresh", params: { names: [ds] } }],
    };
  },
};
```

- [ ] **Step 4: Register both, run, commit**

```bash
bun scripts/test-generic-fragments.ts && bunx tsc --noEmit
git add fragments/generic scripts/test-generic-fragments.ts
git commit -m "feat: CardGrid + RelatedList fragments"
```

### Task 14: `KanbanBoard`

**Files:**
- Create: `fragments/generic/KanbanBoard.ts`
- Modify: `fragments/generic/index.ts`, `scripts/test-generic-fragments.ts`

- [ ] **Step 1 (red): Add the ref to the Tasks test page**

Tasks children += `"board"`:

```ts
      board: {
        $fragment: "KanbanBoard",
        params: { entity: "Task", statusField: "Status", statusOptions: ["Open", "In Progress", "Done"], titleField: "Title", metaFields: ["Priority"] },
      },
```

Run — expect unknown fragment.

- [ ] **Step 2 (green): Create `fragments/generic/KanbanBoard.ts`**

Move buttons carry LITERAL target statuses (each column is generated at build time), written through the two-step pattern: set `/ui/<ns>/moveId` from the row, set `/ui/<ns>/moveTo` to the literal neighbour status, fire `<ns>-move`.

```ts
/** KanbanBoard — one filtered list per status option; ←/→ buttons move cards. */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { textEl } from "./_shared";

const Params = z.object({
  entity: z.string(),
  statusField: z.string().describe("select field that defines the columns."),
  statusOptions: z.array(z.string()).min(2).max(5).describe("Column values, in board order — must match the field's options."),
  titleField: z.string(),
  metaFields: z.array(z.string()).max(2).default([]),
  pageSize: z.number().int().min(5).max(50).default(20),
  refreshOnMove: z.array(z.string()).default([]).describe("EXTRA same-page datasources to re-fire after a move (column lists auto-refresh)."),
});
type P = z.infer<typeof Params>;

export const KanbanBoard: Fragment<P> = {
  name: "KanbanBoard",
  version: "1.0.0",
  description:
    "Kanban board grouped by a select field: one column per statusOptions entry, cards with title + meta " +
    "fields and left/right move buttons that update the record's status. Column datasources are " +
    "'<ns>-col-<i>'. statusOptions MUST equal the entity field's options.",
  category: "display",
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const ui = `/ui/${ns}`;
    const colDs = params.statusOptions.map((_, i) => `${ns}-col-${i}`);
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: { type: "Grid", props: { columns: params.statusOptions.length, gap: "md" }, children: params.statusOptions.map((_, i) => `${ns}-col-${i}-wrap`) },
    };
    const datasources: Record<string, Record<string, unknown>> = {
      [`${ns}-move`]: {
        type: "bdo.save",
        params: {
          bdo: params.entity,
          values: { [params.statusField]: { $state: `${ui}/moveTo` } },
          _id: { $state: `${ui}/moveId` },
        },
        refresh: [...colDs, ...params.refreshOnMove],
        on: { success: [{ action: "ui.toast", params: { message: "Moved", kind: "default" } }] },
      },
    };
    params.statusOptions.forEach((status, i) => {
      const ds = colDs[i];
      datasources[ds] = {
        type: "bdo.list",
        params: {
          bdo: params.entity,
          Filter: { Operator: "AND", Condition: [{ LHSField: params.statusField, Operator: "EQ", RHSValue: status }] },
          Page: { number: 1, size: params.pageSize },
        },
      };
      const moveActions = (target: string) => [
        { action: "setState", params: { statePath: `${ui}/moveId`, value: { $template: "${_id}" } } },
        { action: "setState", params: { statePath: `${ui}/moveTo`, value: target } },
        { action: "datasource.fire", params: { name: `${ns}-move` } },
      ];
      elements[`${ns}-col-${i}-wrap`] = {
        type: "Stack",
        props: { direction: "vertical", gap: "sm", className: "rounded-xl bg-muted/40 p-3" },
        children: [`${ns}-col-${i}-head`, `${ns}-col-${i}-cards`],
      };
      elements[`${ns}-col-${i}-head`] = {
        type: "Stack",
        props: { direction: "horizontal", justify: "between", align: "center" },
        children: [`${ns}-col-${i}-title`, `${ns}-col-${i}-count`],
      };
      elements[`${ns}-col-${i}-title`] = { type: "Heading", props: { text: status, level: "h4" } };
      elements[`${ns}-col-${i}-count`] = textEl({ $datasource: `${ds}/page/total` }, "muted");
      elements[`${ns}-col-${i}-cards`] = {
        type: "Stack",
        props: { direction: "vertical", gap: "sm" },
        repeat: { statePath: `/queries/${ds}/data`, key: "_id" },
        children: [`${ns}-col-${i}-card`],
      };
      elements[`${ns}-col-${i}-card`] = {
        type: "Stack",
        props: { direction: "vertical", gap: "sm", className: "rounded-lg border border-border bg-card p-3" },
        children: [`${ns}-col-${i}-card-title`, ...params.metaFields.map((_, m) => `${ns}-col-${i}-card-meta-${m}`), `${ns}-col-${i}-card-actions`],
      };
      elements[`${ns}-col-${i}-card-title`] = textEl({ $item: params.titleField }, "body");
      params.metaFields.forEach((f, m) => {
        elements[`${ns}-col-${i}-card-meta-${m}`] = textEl({ $item: f }, "muted");
      });
      elements[`${ns}-col-${i}-card-actions`] = {
        type: "Stack",
        props: { direction: "horizontal", justify: "between", align: "center" },
        children: [
          ...(i > 0 ? [`${ns}-col-${i}-card-left`] : []),
          ...(i < params.statusOptions.length - 1 ? [`${ns}-col-${i}-card-right`] : []),
        ],
      };
      if (i > 0) {
        elements[`${ns}-col-${i}-card-left`] = {
          type: "Button",
          props: { label: "←", variant: "secondary", disabled: null },
          on: { press: moveActions(params.statusOptions[i - 1]) },
        };
      }
      if (i < params.statusOptions.length - 1) {
        elements[`${ns}-col-${i}-card-right`] = {
          type: "Button",
          props: { label: "→", variant: "secondary", disabled: null },
          on: { press: moveActions(params.statusOptions[i + 1]) },
        };
      }
    });
    return {
      root: ns,
      elements,
      state: { ui: { [ns]: { moveId: null, moveTo: null } } },
      datasources,
      init: [{ action: "datasource.refresh", params: { names: colDs } }],
    };
  },
};
```

- [ ] **Step 3: Register, run, commit**

```bash
bun scripts/test-generic-fragments.ts && bunx tsc --noEmit
git add fragments/generic scripts/test-generic-fragments.ts
git commit -m "feat: KanbanBoard fragment"
```

### Task 15: `RecordFormDialog` + `FormCard`

**Files:**
- Create: `fragments/generic/RecordFormDialog.ts`, `fragments/generic/FormCard.ts`
- Modify: `fragments/generic/index.ts`, `scripts/test-generic-fragments.ts`

- [ ] **Step 0: Verify the `_id: null` → create assumption**

Read `app/api/apps/[appId]/datasource/route.ts` (bdo.save branch) and `lib/server/entity-store.ts:saveRecord`. Confirm a `null`/`undefined` `_id` generates a new id and a string `_id` updates. If `null` is NOT coerced (e.g. `_id ?? undefined` missing), fix the executor to treat `null` as undefined — one-line change, include it in this task's commit.

- [ ] **Step 1 (red): Add refs**

Tasks children += `"task-form"`; Task Detail children += `"new-task"`:

```ts
      "task-form": {
        $fragment: "RecordFormDialog",
        params: {
          entity: "Task",
          title: "Task",
          fields: [
            { field: "Title", label: "Title", input: "text" },
            { field: "Description", label: "Description", input: "textarea" },
            { field: "Status", label: "Status", input: "select", options: ["Open", "In Progress", "Done"] },
            { field: "Estimate", label: "Estimate", input: "number" },
            { field: "DueDate", label: "Due date", input: "date" },
            { field: "Done", label: "Done", input: "boolean" },
            { field: "CustomerId", label: "Customer", input: "reference", lookupEntity: "Customer", lookupLabelField: "Name" },
          ],
          refresh: ["table-list", "cards-list", "board-col-0", "board-col-1", "board-col-2"],
        },
      },
```
```ts
      "new-task": {
        $fragment: "FormCard",
        params: {
          entity: "Task",
          title: "New task",
          fields: [
            { field: "Title", label: "Title", input: "text" },
            { field: "Status", label: "Status", input: "select", options: ["Open", "In Progress", "Done"] },
          ],
          refresh: ["related-list"],
          successTarget: "Tasks",
        },
      },
```

Run — expect unknown fragments.

- [ ] **Step 2 (green): Create `fragments/generic/RecordFormDialog.ts`**

```ts
/**
 * RecordFormDialog — create/edit dialog over /form/<ns>.
 * Open contract (what siblings write):
 *   create: /ui/<ns>/editId = null, /form/<ns> = {}, /ui/<ns>/open = true
 *   edit:   /ui/<ns>/editId = "<recordId>",          /ui/<ns>/open = true
 * The '<ns>-prefill' bdo.get auto-fires when editId changes and copies the
 * record into the form draft ($cond guards the create case).
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { FormFieldDef, formFieldOutput } from "./_shared";

const Params = z.object({
  entity: z.string(),
  title: z.string(),
  fields: z.array(FormFieldDef).min(1).max(10),
  refresh: z.array(z.string()).default([]).describe("Same-page datasource names to re-fire after save (e.g. the DataTable's '<tableNs>-list')."),
  successMessage: z.string().default("Saved"),
});
type P = z.infer<typeof Params>;

export const RecordFormDialog: Fragment<P> = {
  name: "RecordFormDialog",
  version: "1.0.0",
  description:
    "Create/edit dialog form. Field inputs: text|textarea|number|date|boolean|select|reference " +
    "(reference = Combobox over lookupEntity, stores _id). OPEN it from siblings: create → set " +
    "/ui/<ns>/editId null, /form/<ns> {}, /ui/<ns>/open true; edit → set /ui/<ns>/editId then open " +
    "(DataTable rowActions and PageHeader openDialog do this when given this instance id). Pass the " +
    "page's list datasource names in `refresh`.",
  category: "form",
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const ui = `/ui/${ns}`;
    const formPath = `/form/${ns}`;
    const fieldOuts = params.fields.map((f) => formFieldOutput(ns, f, formPath));
    const lookupDs = fieldOuts.flatMap((o) => Object.keys(o.datasources));
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: { type: "Dialog", props: { title: params.title, description: null, openPath: `${ui}/open` }, children: [`${ns}-body`] },
      [`${ns}-body`]: { type: "Stack", props: { direction: "vertical", gap: "md" }, children: [...fieldOuts.map((o) => o.rootKey), `${ns}-footer`] },
      [`${ns}-footer`]: { type: "Stack", props: { direction: "horizontal", justify: "end", gap: "sm" }, children: [`${ns}-cancel`, `${ns}-submit`] },
      [`${ns}-cancel`]: {
        type: "Button",
        props: { label: "Cancel", variant: "secondary", disabled: null },
        on: { press: { action: "setState", params: { statePath: `${ui}/open`, value: false } } },
      },
      [`${ns}-submit`]: {
        type: "Button",
        props: { label: "Save", variant: "primary", disabled: null },
        on: { press: { action: "datasource.fire", params: { name: `${ns}-save` } } },
      },
    };
    for (const o of fieldOuts) Object.assign(elements, o.elements);
    const datasources: Record<string, Record<string, unknown>> = {
      [`${ns}-save`]: {
        type: "bdo.save",
        params: { bdo: params.entity, valuesPath: formPath, _id: { $state: `${ui}/editId` }, closePath: `${ui}/open` },
        refresh: params.refresh,
        on: {
          success: [
            { action: "ui.toast", params: { message: params.successMessage, kind: "success" } },
            { action: "setState", params: { statePath: formPath, value: {} } },
            { action: "setState", params: { statePath: `${ui}/editId`, value: null } },
          ],
        },
      },
      [`${ns}-prefill`]: {
        type: "bdo.get",
        params: { bdo: params.entity, _id: { $state: `${ui}/editId` } },
        skipUntilReady: true,
        on: {
          success: [
            {
              action: "setState",
              params: {
                statePath: formPath,
                // editId null (create) → keep an empty draft; set → copy the record in.
                value: { $cond: { $state: `${ui}/editId` }, $then: { $datasource: `${ns}-prefill/data` }, $else: {} },
              },
            },
          ],
        },
      },
    };
    for (const o of fieldOuts) Object.assign(datasources, o.datasources);
    return {
      root: ns,
      elements,
      state: { ui: { [ns]: { open: false, editId: null } }, form: { [ns]: {} } },
      datasources,
      ...(lookupDs.length ? { init: [{ action: "datasource.refresh", params: { names: lookupDs } }] } : {}),
    };
  },
};
```

- [ ] **Step 3 (green): Create `fragments/generic/FormCard.ts`**

Page-level CREATE form (no dialog, no edit/prefill). Full file — same imports and Params as RecordFormDialog except: drop `successMessage`, add `successTarget: z.string().nullable().default(null).describe("Page NAME to navigate to after save.")`.

build(): a `Card` (props `{ title: params.title, description: null, maxWidth: "md", centered: null, className: null }`) wrapping the same field stack + a single submit Button firing `${ns}-save`. Datasources: only `${ns}-save` (same shape, `_id` omitted entirely — always creates, no `closePath`) with `on.success`: toast "Saved", reset `formPath` to `{}`, plus `...(params.successTarget ? [{ action: "ui.navigate", params: { to: params.successTarget } }] : [])`. State: `{ form: { [ns]: {} } }`. Same lookup-datasource init handling. name: "FormCard"; category: "form"; description: "Page-level CREATE form (Card). Same field model as RecordFormDialog; navigates to successTarget after save. For edit flows use RecordFormDialog instead."

- [ ] **Step 4: Register both, run, commit**

```bash
bun scripts/test-generic-fragments.ts && bunx tsc --noEmit
git add fragments/generic scripts/test-generic-fragments.ts app/api/apps  # include executor fix if Step 0 needed one
git commit -m "feat: RecordFormDialog + FormCard fragments"
```

### Task 16: `DetailHeader` + `RecordView`

**Files:**
- Create: `fragments/generic/DetailHeader.ts`, `fragments/generic/RecordView.ts`
- Modify: `fragments/generic/index.ts`, `scripts/test-generic-fragments.ts`

- [ ] **Step 1 (red): Add refs to the Task Detail test page**

Task Detail children += `"detail-head", "record"`. Page state gains `ui: { selectedCustomerId: "", selectedTaskId: "" }` (merge with the existing seed). Elements:

```ts
      "detail-head": {
        $fragment: "DetailHeader",
        params: {
          entity: "Task", idPath: "/ui/selectedTaskId", titleField: "Title", badgeField: "Status",
          facts: [
            { field: "Priority", label: "Priority", display: "badge" },
            { field: "DueDate", label: "Due", display: "date" },
          ],
          actions: [{ label: "All tasks", kind: "navigate", target: "Tasks" }],
        },
      },
      record: {
        $fragment: "RecordView",
        params: {
          entity: "Task", idPath: "/ui/selectedTaskId", title: "Details",
          fields: [
            { field: "Title", label: "Title", display: "text" },
            { field: "Description", label: "Description", display: "muted" },
            { field: "Status", label: "Status", display: "badge" },
            { field: "Estimate", label: "Estimate", display: "money" },
          ],
        },
      },
```

Run — expect unknown fragments.

- [ ] **Step 2 (green): Create `fragments/generic/DetailHeader.ts`**

```ts
/** DetailHeader — title band for a selected record: title/badge/facts/actions. */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { DisplayKind, displayElements, textEl } from "./_shared";

const Params = z.object({
  entity: z.string(),
  idPath: z.string().describe("State path holding the selected record id (e.g. /ui/selectedTaskId)."),
  titleField: z.string(),
  subtitleField: z.string().optional(),
  badgeField: z.string().optional(),
  facts: z.array(z.object({ field: z.string(), label: z.string(), display: DisplayKind.default("text") })).max(4).default([]),
  actions: z
    .array(z.object({ label: z.string(), kind: z.enum(["navigate", "openDialog"]).default("navigate"), target: z.string(), variant: z.enum(["primary", "secondary"]).default("secondary") }))
    .default([]),
});
type P = z.infer<typeof Params>;

export const DetailHeader: Fragment<P> = {
  name: "DetailHeader",
  version: "1.0.0",
  description:
    "Detail-page header for ONE record (id read from idPath): big title, optional subtitle/status badge, " +
    "a facts row, and action buttons (navigate or openDialog like PageHeader). Datasource '<ns>-get' " +
    "auto-refires when the id changes. Pair with RecordView/RelatedList on the same idPath.",
  category: "display",
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const ds = `${ns}-get`;
    const get = (field: string) => ({ $datasource: `${ds}/data/${field}` });
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: { type: "Stack", props: { direction: "vertical", gap: "sm", className: "border-b border-border pb-4" }, children: [`${ns}-top`, ...(params.facts.length ? [`${ns}-facts`] : [])] },
      [`${ns}-top`]: { type: "Stack", props: { direction: "horizontal", justify: "between", align: "center" }, children: [`${ns}-titles`, `${ns}-right`] },
      [`${ns}-titles`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none" },
        children: [`${ns}-title`, ...(params.subtitleField ? [`${ns}-subtitle`] : [])],
      },
      [`${ns}-title`]: { type: "Heading", props: { text: get(params.titleField), level: "h1" } },
      ...(params.subtitleField ? { [`${ns}-subtitle`]: textEl(get(params.subtitleField), "muted") } : {}),
      [`${ns}-right`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center" },
        children: [...(params.badgeField ? [`${ns}-badge`] : []), ...params.actions.map((_, i) => `${ns}-action-${i}`)],
      },
      ...(params.badgeField ? { [`${ns}-badge`]: { type: "Badge", props: { text: get(params.badgeField), variant: "secondary" } } } : {}),
    };
    params.actions.forEach((a, i) => {
      elements[`${ns}-action-${i}`] = {
        type: "Button",
        props: { label: a.label, variant: a.variant, disabled: null },
        on: {
          press:
            a.kind === "navigate"
              ? { action: "ui.navigate", params: { to: a.target } }
              : [
                  { action: "setState", params: { statePath: `/ui/${a.target}/editId`, value: null } },
                  { action: "setState", params: { statePath: `/form/${a.target}`, value: {} } },
                  { action: "setState", params: { statePath: `/ui/${a.target}/open`, value: true } },
                ],
        },
      };
    });
    if (params.facts.length) {
      elements[`${ns}-facts`] = { type: "Stack", props: { direction: "horizontal", gap: "lg", align: "center" }, children: params.facts.map((_, i) => `${ns}-fact-${i}`) };
      params.facts.forEach((f, i) => {
        const val = displayElements(`${ns}-fact-${i}-value`, f.display, get(f.field));
        elements[`${ns}-fact-${i}`] = { type: "Stack", props: { direction: "vertical", gap: "none" }, children: [`${ns}-fact-${i}-label`, val.rootKey] };
        elements[`${ns}-fact-${i}-label`] = textEl(f.label, "muted");
        Object.assign(elements, val.elements);
      });
    }
    return {
      root: ns,
      elements,
      datasources: { [ds]: { type: "bdo.get", params: { bdo: params.entity, _id: { $state: params.idPath } }, skipUntilReady: true } },
      init: [{ action: "datasource.refresh", params: { names: [ds] } }],
    };
  },
};
```

- [ ] **Step 3 (green): Create `fragments/generic/RecordView.ts`**

Same imports/idPath pattern as DetailHeader. Full file:

```ts
/** RecordView — label/value grid of one record's fields. */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { DisplayKind, displayElements, textEl } from "./_shared";

const Params = z.object({
  entity: z.string(),
  idPath: z.string(),
  title: z.string().default("Details"),
  fields: z.array(z.object({ field: z.string(), label: z.string(), display: DisplayKind.default("text") })).min(1).max(12),
  columns: z.number().int().min(1).max(3).default(2),
});
type P = z.infer<typeof Params>;

export const RecordView: Fragment<P> = {
  name: "RecordView",
  version: "1.0.0",
  description:
    "Detail body: a Card with a label/value grid of ONE record's fields (display kinds like DataTable " +
    "columns). Reads the id from idPath; datasource '<ns>-get'. Pair with DetailHeader on the same idPath.",
  category: "display",
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const ds = `${ns}-get`;
    const elements: Record<string, Record<string, unknown>> = {
      [ns]: { type: "Card", props: { title: params.title, description: null, maxWidth: null, centered: null, className: null }, children: [`${ns}-grid`] },
      [`${ns}-grid`]: { type: "Grid", props: { columns: params.columns, gap: "md" }, children: params.fields.map((_, i) => `${ns}-f-${i}`) },
    };
    params.fields.forEach((f, i) => {
      const val = displayElements(`${ns}-f-${i}-value`, f.display, { $datasource: `${ds}/data/${f.field}` });
      elements[`${ns}-f-${i}`] = { type: "Stack", props: { direction: "vertical", gap: "none" }, children: [`${ns}-f-${i}-label`, val.rootKey] };
      elements[`${ns}-f-${i}-label`] = textEl(f.label, "muted");
      Object.assign(elements, val.elements);
    });
    return {
      root: ns,
      elements,
      datasources: { [ds]: { type: "bdo.get", params: { bdo: params.entity, _id: { $state: params.idPath } }, skipUntilReady: true } },
      init: [{ action: "datasource.refresh", params: { names: [ds] } }],
    };
  },
};
```

- [ ] **Step 4: Register both, run, commit**

```bash
bun scripts/test-generic-fragments.ts && bunx tsc --noEmit
git add fragments/generic scripts/test-generic-fragments.ts
git commit -m "feat: DetailHeader + RecordView fragments"
```

### Task 17: `FilterBar`

**Files:**
- Create: `fragments/generic/FilterBar.ts`
- Modify: `fragments/generic/index.ts`, `scripts/test-generic-fragments.ts`

- [ ] **Step 1 (red): Add the ref to the Tasks test page**

Tasks children: PREPEND `"filters"` before `"table"`:

```ts
      filters: {
        $fragment: "FilterBar",
        params: {
          targetNs: "table",
          layout: "toolbar",
          filters: [
            { field: "Status", label: "Status", kind: "select", options: ["Open", "In Progress", "Done"] },
            { field: "Estimate", label: "Estimate", kind: "numberRange" },
            { field: "CustomerId", label: "Customer", kind: "reference", lookupEntity: "Customer", lookupLabelField: "Name" },
          ],
        },
      },
```

ALSO update the `table` DataTable params so both sides of the pairing exist: `searchable: false` (FilterBar owns no search here, but the table seeded `/filters/table/search` — with `searchable: false` and filterBindings present the Search binding stays, unseeded, which prunes) and
`filterBindings: [{ field: "Status" }, { field: "Estimate", operator: "GTE", stateKey: "EstimateMin" }, { field: "Estimate", operator: "LTE", stateKey: "EstimateMax" }, { field: "CustomerId" }]`.

Run — expect unknown fragment.

- [ ] **Step 2 (green): Create `fragments/generic/FilterBar.ts`**

```ts
/**
 * FilterBar — filter inputs that write /filters/<targetNs>/* for a sibling
 * DataTable/CardGrid (whose filterBindings read the same keys). State-key
 * contract per kind:
 *   search       → search                 (target binds Search)
 *   select       → <field>                (EQ; "All" = no filter)
 *   boolean      → <field>                (EQ "true"/"false"; "All" = none)
 *   numberRange  → <field>Min, <field>Max (GTE/LTE bindings)
 *   dateRange    → <field>From, <field>To (GTE/LTE bindings)
 *   reference    → <field>                (EQ the picked record's _id)
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";
import { textEl } from "./_shared";

const Params = z.object({
  targetNs: z.string().describe("Instance id of the DataTable/CardGrid this bar filters."),
  layout: z.enum(["toolbar", "sidebar"]).default("toolbar"),
  filters: z
    .array(
      z.object({
        field: z.string(),
        label: z.string(),
        kind: z.enum(["search", "select", "boolean", "numberRange", "dateRange", "reference"]),
        options: z.array(z.string()).optional().describe("select only."),
        lookupEntity: z.string().optional().describe("reference only."),
        lookupLabelField: z.string().optional().describe("reference only."),
      }),
    )
    .min(1)
    .max(6),
});
type P = z.infer<typeof Params>;

export const FilterBar: Fragment<P> = {
  name: "FilterBar",
  version: "1.0.0",
  description:
    "Filter inputs writing /filters/<targetNs>/* — the paired DataTable/CardGrid declares matching " +
    "filterBindings: select/boolean/reference → {field}, numberRange → {field, GTE, stateKey '<field>Min'} + " +
    "{field, LTE, '<field>Max'}, dateRange → '<field>From'/'<field>To', search → the target's Search param. " +
    "layout 'sidebar' renders a vertical Card (put it beside the list in a horizontal Stack). " +
    "If this bar has a search kind, set the target's searchable=false.",
  category: "browse",
  params: Params as z.ZodType<P>,
  build: (params, ns) => {
    const base = `/filters/${params.targetNs}`;
    const horizontal = params.layout === "toolbar";
    const elements: Record<string, Record<string, unknown>> = {};
    const datasources: Record<string, Record<string, unknown>> = {};
    const seeds: Record<string, unknown> = {};
    const children: string[] = [];

    params.filters.forEach((f, i) => {
      const key = `${ns}-f-${i}`;
      children.push(key);
      if (f.kind === "search") {
        seeds.search = "";
        elements[key] = { type: "Input", props: { label: horizontal ? "" : f.label, name: "search", type: "text", placeholder: `Search ${f.label}…`, value: { $bindState: `${base}/search` } } };
      } else if (f.kind === "select") {
        seeds[f.field] = "All";
        elements[key] = { type: "Select", props: { label: f.label, name: f.field, options: ["All", ...(f.options ?? [])], value: { $bindState: `${base}/${f.field}` }, placeholder: f.label } };
      } else if (f.kind === "boolean") {
        seeds[f.field] = "All";
        elements[key] = { type: "Select", props: { label: f.label, name: f.field, options: ["All", "true", "false"], value: { $bindState: `${base}/${f.field}` }, placeholder: f.label } };
      } else if (f.kind === "numberRange" || f.kind === "dateRange") {
        const [a, b] = f.kind === "numberRange" ? ["Min", "Max"] : ["From", "To"];
        seeds[`${f.field}${a}`] = "";
        seeds[`${f.field}${b}`] = "";
        const inputType = f.kind === "numberRange" ? "number" : "text";
        const ph = f.kind === "dateRange" ? "YYYY-MM-DD" : "";
        elements[key] = { type: "Stack", props: { direction: "horizontal", gap: "sm", align: "end" }, children: [`${key}-a`, `${key}-b`] };
        elements[`${key}-a`] = { type: "Input", props: { label: `${f.label} ${a.toLowerCase()}`, name: `${f.field}${a}`, type: inputType, placeholder: ph, value: { $bindState: `${base}/${f.field}${a}` } } };
        elements[`${key}-b`] = { type: "Input", props: { label: `${f.label} ${b.toLowerCase()}`, name: `${f.field}${b}`, type: inputType, placeholder: ph, value: { $bindState: `${base}/${f.field}${b}` } } };
      } else {
        // reference
        const ds = `${ns}-lookup-${i}`;
        seeds[f.field] = "";
        datasources[ds] = { type: "bdo.list", params: { bdo: f.lookupEntity ?? "", Page: { number: 1, size: 100 } } };
        elements[key] = { type: "Stack", props: { direction: "vertical", gap: "sm" }, children: [`${key}-label`, `${key}-input`] };
        elements[`${key}-label`] = textEl(f.label, "muted");
        elements[`${key}-input`] = { type: "Combobox", props: { value: { $bindState: `${base}/${f.field}` }, options: { $datasource: `${ds}/data` }, labelKey: f.lookupLabelField ?? null, placeholder: f.label, name: f.field } };
      }
    });

    elements[ns] = horizontal
      ? { type: "Stack", props: { direction: "horizontal", gap: "md", align: "end", className: "flex-wrap" }, children }
      : { type: "Card", props: { title: "Filters", description: null, maxWidth: null, centered: null, className: "w-64 shrink-0" }, children: [`${ns}-body`] };
    if (!horizontal) {
      elements[`${ns}-body`] = { type: "Stack", props: { direction: "vertical", gap: "md" }, children };
    }

    const lookupNames = Object.keys(datasources);
    return {
      root: ns,
      elements,
      state: { filters: { [params.targetNs]: seeds } },
      ...(lookupNames.length ? { datasources, init: [{ action: "datasource.refresh", params: { names: lookupNames } }] } : {}),
    };
  },
};
```

- [ ] **Step 3: Register, run all tests, commit**

```bash
bun scripts/test-generic-fragments.ts    # 3 pages clean — ALL 16 fragments expanding
bun scripts/test-fragment-expansion.ts   # ecommerce unaffected
bunx tsc --noEmit
git add fragments/generic scripts/test-generic-fragments.ts
git commit -m "feat: FilterBar fragment — generic kit complete (16 fragments)"
```

### Task 18: Generic pairing guide in the agent instructions

**Files:**
- Modify: `mastra/instructions.ts` (the `FRAGMENTS_SECTION` constant from Task 1)

- [ ] **Step 1: Replace the ecommerce-only wiring bullet**

In `FRAGMENTS_SECTION`, replace the single bullet starting `- Cross-fragment wiring is by instance id: ProductFilters/CategoryNav take…` with:

```
- Cross-fragment wiring is by instance id (ns). GENERIC KIT pairing rules:
  - Lists: DataTable (typed columns + rowActions) or CardGrid. Filters: add a FilterBar with targetNs = the list's instance id AND matching filterBindings on the list (numberRange → GTE '<Field>Min' + LTE '<Field>Max'; dateRange → '<Field>From'/'<Field>To'; select/boolean/reference → the field id). If the FilterBar has a search kind, set the list's searchable=false.
  - Forms: RecordFormDialog opens from DataTable rowActions 'edit' (set formDialogNs) or PageHeader/DetailHeader actions kind 'openDialog' (target = the dialog's instance id). ALWAYS pass the page's list/stat/chart datasource names in the dialog's refresh (e.g. ["<tableNs>-list", "<statsNs>-stat-0"]) so the page updates after save. FormCard = full-page create form.
  - Dashboards: StatsRow + ChartCard / Leaderboard / ProgressTracker + RecentList / ActivityTimeline.
  - Detail (master-detail on ONE page): DetailHeader / RecordView / RelatedList all read a record id from an idPath state path (e.g. /ui/selectedId). Seed it in page state and write it from a hand-built row press (setState with {"$template": "${_id}"}) — list fragments do not write it for you.
  - e-commerce wiring: ProductFilters/CategoryNav take targetGridNs; ProductGrid's cartRefresh takes a CartSummary's datasource names ["<cartNs>-items", "<cartNs>-total"]; CheckoutForm takes cartSummaryNs.
```

Leave the ENTITY CONTRACTS block (it is ecommerce-specific and still correct — generic fragments take entity/field params instead of contracts).

- [ ] **Step 2: Verify prompt size + content**

```bash
bun -e "import('./mastra/instructions').then(m => { const s = m.buildInstructions({fragments:true}); console.log('chars:', s.length); console.log('has DataTable:', s.includes('### DataTable')); console.log('has pairing:', s.includes('GENERIC KIT pairing rules')); const off = m.buildInstructions({fragments:false}); console.log('off clean:', !off.includes('DataTable (typed columns')); })"
```
Expected: `has DataTable: true`, `has pairing: true`, `off clean: true`. (chars will grow — that token cost is part of what the benchmark measures.)

- [ ] **Step 3: Commit**

```bash
git add mastra/instructions.ts
git commit -m "docs(agent): generic kit pairing guide in fragment instructions"
```

### Task 19: Full verification sweep

- [ ] **Step 1: Everything green**

```bash
bun scripts/test-generic-fragments.ts     # 3 pages, all 16 fragments, clean ✓
bun scripts/test-fragment-expansion.ts    # ecommerce bundle clean ✓
bunx tsc --noEmit                          # clean
bun run lint                               # no NEW errors (pre-existing ones are not yours to fix)
```

- [ ] **Step 2: Live render check of the new component path**

Start `bun run dev`, open `http://localhost:3000`, and confirm the home page renders (the registry — now including Chart — loads client-side without import errors; a recharts SSR break would show here). Stop the server. Full app-level verification happens with the kept benchmark app in Task 20.

- [ ] **Step 3: Commit any stragglers** (there should be none — if `git status` shows changes, something was missed in Tasks 7–18).

### Task 20: OPERATIONAL — fragments benchmark + comparison report (REAL COST: ~6 agent runs)

- [ ] **Step 1:** `npx tsx scripts/benchmark.ts --mode fragments --reps 2 --keep`
  Expected: 6 runs. `--keep` retains the generated apps for inspection.
- [ ] **Step 2: Manual inspection of one kept app** — `bun run dev`, open the home page, open one `bench fragments …` app's builder page, and click through the preview: dashboard charts render (Chart component with real series), table rows appear, the add/edit dialog saves and the table refreshes, kanban move buttons work. This is the spec's "manual run of one generated app".
- [ ] **Step 3:** Delete the bench apps (home page context/delete, or `curl -X DELETE http://localhost:3000/api/apps/<id>`).
- [ ] **Step 4:** `npx tsx scripts/benchmark-report.ts` — writes `benchmarks/REPORT.md` comparing baseline (Task 6) vs fragments runs.
- [ ] **Step 5: Commit the report**

```bash
git add benchmarks/REPORT.md
git commit -m "bench: baseline vs fragments comparison report"
```

- [ ] **Step 6:** Read the report. If fragment-mode runs show low fragment adoption (check a kept app's `data/<id>/temp/*.json` for `$fragment` refs — the audit copies show what the agent emitted), the instructions guide (Task 18) likely needs strengthening before trusting the numbers. Report findings to the user either way.

---

## Completion

After Task 20, use the superpowers:finishing-a-development-branch skill to decide merge/PR for `fragments-benchmark`.

**Execution-order constraint repeated:** Task 6 (baseline runs) MUST happen before Task 18 changes the fragment instructions? No — baseline mode strips the ENTIRE fragments section, so Tasks 7–18 do not affect baseline runs. Task 6 may run any time after Task 5, including in parallel with Phase B work. Task 20 must run after Task 18.




