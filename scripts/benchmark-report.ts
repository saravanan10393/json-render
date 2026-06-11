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
