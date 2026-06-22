"use client";

import { Boxes, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDuration } from "./design-review";
import { cn } from "@/lib/utils";

interface Coverage {
  sections: { page: string; section: string; fragmentName: string | null; score: number; gap: boolean }[];
  gaps: { page: string; section: string }[];
  coveragePct: number;
  suggestions: { id: string; name: string }[];
}

export function FragmentAnalyzer({ appId }: { appId: string }) {
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [rerunning, setRerunning] = useState(false);
  // Wall-clock time from the most recent forced rerun (POST). The default GET
  // path is cached + near-instant, so we don't time it.
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    // setState lands after the awaited fetch (a microtask later), not as a
    // synchronous cascading render.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    fetch(`/api/apps/${appId}/analyzer`)
      .then((r) => r.json())
      .then((b: { coverage: Coverage | null }) => {
        if (alive) {
          setCoverage(b.coverage);
          setLoading(false);
        }
      })
      .catch(() => alive && setLoading(false));
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      alive = false;
    };
  }, [appId]);

  const rerun = () => {
    if (rerunning) return;
    setRerunning(true);
    void fetch(`/api/apps/${appId}/analyzer`, { method: "POST" })
      .then((r) => r.json())
      .then((b: { coverage: Coverage | null; durationMs?: number }) => {
        setCoverage(b.coverage);
        if (typeof b.durationMs === "number") setLastDurationMs(b.durationMs);
      })
      .finally(() => setRerunning(false));
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
              Fragment analyzer
              {lastDurationMs !== null && (
                <span
                  className="rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[10px] font-normal tabular-nums opacity-80"
                  title="Most recent rerun duration"
                >
                  {formatDuration(lastDurationMs)}
                </span>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">
              Closely-matching fragments for each section (semantic search) — preponed and handed to
              the builder as a head start. Not an approval step.
            </p>
          </div>
          {coverage && coverage.sections.length > 0 && (
            <button
              type="button"
              onClick={rerun}
              disabled={rerunning}
              title="Wipe the cache and re-run the semantic search for every section (one embedding call per section — has a small cost)"
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={cn("size-3.5", rerunning && "animate-spin")} />
              {rerunning ? "Re-analyzing…" : "Rerun"}
            </button>
          )}
        </header>

        {loading ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border py-16 text-center">
            <Loader2 className="size-6 animate-spin text-amber-600" />
            <p className="text-sm text-muted-foreground">Matching sections against the fragment library…</p>
          </div>
        ) : !coverage || coverage.sections.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border py-16 text-center">
            <Boxes className="size-6 text-muted-foreground" />
            <p className="max-w-xs text-sm text-muted-foreground">
              No sitemap to analyze yet — run the design stage first.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold tabular-nums">{coverage.coveragePct}%</div>
              <div className="text-sm text-muted-foreground">
                of sections have a close fragment · {coverage.suggestions.length} fragment
                {coverage.suggestions.length === 1 ? "" : "s"} suggested to the builder
              </div>
            </div>

            {coverage.gaps.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                {coverage.gaps.length} section{coverage.gaps.length === 1 ? " has" : "s have"} no close
                fragment — built from primitives, and candidates for new fragments:
                <ul className="mt-1 list-disc pl-4">
                  {coverage.gaps.map((g, i) => (
                    <li key={i}>
                      <span className="font-medium">{g.page}</span>: {g.section}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Section</th>
                    <th className="px-3 py-2 font-medium">Matched fragment</th>
                    <th className="px-3 py-2 font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.sections.map((s, i) => (
                    <tr key={i} className="border-t border-border align-top">
                      <td className="px-3 py-2">
                        <div>{s.section}</div>
                        <div className="text-[11px] text-muted-foreground">{s.page}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-[12px] text-muted-foreground">
                        {s.gap ? "— build from primitives" : s.fragmentName}
                      </td>
                      <td
                        className={
                          s.gap
                            ? "px-3 py-2 text-amber-600 dark:text-amber-400"
                            : "px-3 py-2 text-muted-foreground"
                        }
                      >
                        {s.gap ? "gap" : s.score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
