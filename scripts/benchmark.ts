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
  if (Number.isNaN(reps) || reps < 1) {
    console.error("--reps must be a positive integer");
    process.exit(1);
  }
  const prompts = (get("--prompts") ?? Object.keys(PROMPTS).join(","))
    .split(",")
    .filter((p) => p in PROMPTS);
  if (prompts.length === 0) {
    console.error(`No valid prompts; valid keys: ${Object.keys(PROMPTS).join(", ")}`);
    process.exit(1);
  }
  return { mode, reps, prompts, keep: args.includes("--keep") };
}

async function benchOne(mode: string, promptKey: string, rep: number, keep: boolean): Promise<RunResult> {
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
      appId: app.id, appName: app.name, messages, fragments: mode === "fragments", traced: false,
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
    // TODO: cancel the stream on timeout — a timed-out run leaves a detached
    // reader consuming in the background until the process exits.
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

  // Mastra swallows upstream LLM errors (stream ends cleanly with no steps) —
  // mark degenerate runs so the report excludes them from aggregates.
  if (!result.error && result.steps.length === 0) {
    result.error = "run produced no tool steps (likely upstream LLM error — check stderr)";
  } else if (!result.error && result.pages.length === 0) {
    result.error = "run produced no clean page saves — build failed";
  }

  if (!keep) deleteApp(app.id);
  return result;
}

async function main() {
  const { mode, reps, prompts, keep } = parseArgs();
  const outDir = path.join(process.cwd(), "benchmarks", "results");
  mkdirSync(outDir, { recursive: true });

  for (const promptKey of prompts) {
    for (let rep = 1; rep <= reps; rep++) {
      console.log(`\n▶ ${mode} / ${promptKey} / rep ${rep} ...`);
      const res = await benchOne(mode, promptKey, rep, keep);
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
