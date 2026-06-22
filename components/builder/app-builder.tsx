"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowLeft, Hammer, Palette, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppBundle } from "@/lib/runtime/app-shell";
import { cn } from "@/lib/utils";
import { ChatPanel } from "./chat-panel";
import { DataModelViewer, type EntityModel } from "./data-model-viewer";
import {
  type DesignMode,
  DesignReview,
  type DesignScope,
  type GenKey,
  type MockupsInfo,
  type SitemapInfo,
  type ThemeInfo,
} from "./design-review";
import { FragmentAnalyzer } from "./fragment-analyzer";
import {
  activeView,
  PipelineBar,
  type RunState,
  type Stage,
  VIEW_LABEL,
  type ViewKey,
} from "./pipeline-bar";
import { ThemeTweaker } from "./theme-tweaker";

interface AppModel {
  entities: EntityModel[];
  theme: ThemeInfo | null;
  sitemap: SitemapInfo | null;
  mockups: MockupsInfo | null;
  /** Design artifacts are newer than the built pages → offer a rebuild. */
  pagesStale?: boolean;
}

/** Confirm-dialog wording per design-rerun scope — module-scope to avoid
 *  rebuilding the map on every render. */
const RERUN_LABEL: Record<DesignScope, string> = {
  all: "the whole design (theme, sitemap, and all mockups)",
  theme: "the theme",
  sitemap: "the sitemap",
  mockups: "all page mockups",
};

const AppRuntime = dynamic(
  () => import("@/lib/runtime/app-shell").then((m) => m.AppRuntime),
  {
    ssr: false,
    loading: () => (
      <div className="canvas-grid flex h-full items-center justify-center font-mono text-xs text-muted-foreground">
        loading runtime…
      </div>
    ),
  },
);

interface AppBuilderProps {
  app: { id: string; name: string; description: string };
  initialMessages: UIMessage[];
}

export function AppBuilder({ app, initialMessages }: AppBuilderProps) {
  const [bundle, setBundle] = useState<AppBundle | null>(null);
  const [bundleKey, setBundleKey] = useState(0);

  const [run, setRun] = useState<RunState | null>(null);
  const [model, setModel] = useState<AppModel | null>(null);
  const [showTweaker, setShowTweaker] = useState(false);
  // Live theme from the tweaker — overrides bundle.theme for an instant preview
  // while the persist + reconcile happens in the background.
  const [themeOverride, setThemeOverride] = useState<ThemeInfo | null>(null);
  // Which view's panel is shown. null = follow the live stage; a value = the
  // user clicked a step (incl. the read-only Analyzer) to view it.
  const [viewStage, setViewStage] = useState<ViewKey | null>(null);
  const [generatingMockup, setGeneratingMockup] = useState<Set<GenKey>>(
    () => new Set(),
  );
  const [rebuilding, setRebuilding] = useState(false);
  const [rerunningScope, setRerunningScope] = useState<DesignScope | null>(
    null,
  );
  // Per-stage timings from the last "Rerun all" (parallel design). Surfaced in
  // the design panel header so the user can compare theme/sitemap/mockup costs.
  const [lastDesignTimings, setLastDesignTimings] = useState<{
    theme: number;
    sitemap: number;
    mockups: number;
    total: number;
  } | null>(null);

  const { messages, sendMessage, status, stop, error } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: `/api/apps/${app.id}/chat` }),
  });

  const building = status === "submitted" || status === "streaming";

  const refreshRun = useCallback(async () => {
    const res = await fetch(`/api/apps/${app.id}/run`);
    if (!res.ok) return;
    const body = (await res.json()) as { run: RunState };
    setRun(body.run);
  }, [app.id]);

  const refreshModel = useCallback(async () => {
    const res = await fetch(`/api/apps/${app.id}/model`);
    if (!res.ok) return;
    setModel((await res.json()) as AppModel);
  }, [app.id]);

  const postRun = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await fetch(`/api/apps/${app.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { run: RunState };
      setRun(body.run);
      return body.run;
    },
    [app.id],
  );

  const approveStage = useCallback(async () => {
    const next = await postRun({ action: "approve" });
    // Auto-kick the next stage's agent so approving immediately starts work.
    if (next?.stage === "design") {
      sendMessage({
        text: "The data model is approved — design the app now (theme, sitemap, and layout mockup).",
      });
    } else if (next?.stage === "frontend") {
      sendMessage({
        text: "The design is approved — build the app's pages and navigation now.",
      });
    }
  }, [postRun, sendMessage]);

  // Generate/regenerate a mockup representation for ONE page — a SYSTEM action
  // that runs the design agent server-side (no chat message); shows a per-tab
  // spinner. Concurrent (pageId, mode) calls are allowed → parallel generation.
  const generateMockup = useCallback(
    (mode: DesignMode, pageId: string) => {
      const key: GenKey = `${pageId}:${mode}`;
      setGeneratingMockup((s) => new Set(s).add(key));
      void fetch(`/api/apps/${app.id}/mockup/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, pageId }),
      })
        .then(() => refreshModel())
        .finally(() =>
          setGeneratingMockup((s) => {
            const next = new Set(s);
            next.delete(key);
            return next;
          }),
        );
    },
    [app.id, refreshModel],
  );

  const selectMockup = useCallback(
    (mode: DesignMode) => {
      void fetch(`/api/apps/${app.id}/mockup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      }).then(() => refreshModel());
    },
    [app.id, refreshModel],
  );

  // Re-enter an earlier stage as the LIVE stage (re-run that agent) — e.g.
  // re-open Design on an already-built app to add/regenerate a mockup.
  const reopenStage = useCallback(
    (stage: Stage) => {
      void postRun({ action: "reopen", stage }).then(
        (r) => r && setViewStage(null),
      );
    },
    [postRun],
  );

  const refreshBundle = useCallback(async () => {
    const res = await fetch(`/api/apps/${app.id}/bundle`);
    if (!res.ok) return;
    const body = (await res.json()) as AppBundle;
    setBundle(body);
  }, [app.id]);

  // System action (NOT a chat turn): run the frontend agent server-side against
  // the approved design artifacts. Wipes existing pages first so the agent
  // rebuilds from scratch instead of refactoring its previous output, and
  // auto-snapshots the result under the active model slug for later A/B.
  const rebuild = useCallback(async () => {
    if (rebuilding) return;
    setRebuilding(true);
    try {
      const res = await fetch(`/api/apps/${app.id}/rebuild`, { method: "POST" });
      if (!res.ok) {
        const err = (await res.json().catch(() => null))?.error ?? res.statusText;
        window.alert(`Rebuild failed: ${err}`);
        return;
      }
      await refreshBundle();
      await refreshModel();
      setBundleKey((k) => k + 1);
    } finally {
      setRebuilding(false);
    }
  }, [app.id, rebuilding, refreshBundle, refreshModel]);

  // System action: rerun a slice (or all) of the design phase from scratch —
  // runs the design agent server-side, no chat turn. Guarded by a confirm since
  // it discards the current artifact(s).
  const rerunDesign = useCallback(
    (scope: DesignScope) => {
      if (
        !window.confirm(
          `Regenerate ${RERUN_LABEL[scope]} from scratch? This discards the current ${scope === "all" ? "design" : scope}.`,
        )
      ) {
        return;
      }
      setRerunningScope(scope);
      void fetch(`/api/apps/${app.id}/design/rerun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      })
        .then(async (res) => {
          // For "all" the server returns a per-stage timing breakdown — surface
          // it so the user sees which step took how many seconds at a glance.
          const body = (await res.json().catch(() => null)) as {
            timings?: { theme: number; sitemap: number; mockups: number; total: number };
          } | null;
          if (body?.timings) setLastDesignTimings(body.timings);
          void refreshModel();
          void refreshBundle();
        })
        .finally(() => setRerunningScope(null));
    },
    [app.id, refreshModel, refreshBundle],
  );

  // Reload the bundle whenever the agent completes tool work (new files on
  // disk) and once on mount.
  const completedToolCalls = useMemo(
    () =>
      messages
        .flatMap((m) => m.parts)
        .filter(
          (p) =>
            p.type.startsWith("tool-") &&
            (p as { state?: string }).state === "output-available",
        ).length,
    [messages],
  );

  useEffect(() => {
    // Refetch the rendered bundle + run state on mount and whenever the agent
    // finishes tool work. Both setState only after an awaited fetch resolves
    // (a microtask later), so this isn't a synchronous cascading render.
    /* eslint-disable react-hooks/set-state-in-effect */
    void refreshBundle();
    void refreshRun();
    void refreshModel();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [refreshBundle, refreshRun, refreshModel, completedToolCalls]);

  // When the live stage advances, snap the viewed panel forward to follow it.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViewStage(null);
  }, [run?.stage]);

  const hasPages = (bundle?.pages.length ?? 0) > 0;
  const shownView: ViewKey =
    viewStage ?? (run ? activeView(run.stage) : "backend");

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="dark flex shrink-0 items-center gap-3 border-b border-border bg-background px-4 py-2.5 text-foreground">
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          apps
        </Link>
        <span className="text-border">/</span>
        <h1 className="truncate font-heading text-base font-bold tracking-tight">
          {app.name}
        </h1>
        <div className="ml-auto flex items-center gap-3">
          {model?.theme && (
            <button
              type="button"
              onClick={() => setShowTweaker((s) => !s)}
              title="Tweak theme"
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors",
                showTweaker
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Palette className="size-3.5" />
              theme
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              void refreshBundle();
              setBundleKey((k) => k + 1);
            }}
            title="Reload preview"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <RefreshCw className="size-3.5" />
          </button>
          <span
            className={cn(
              "flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest",
              building ? "text-amber-400" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                building ? "animate-pulse bg-amber-400" : "bg-emerald-500",
              )}
            />
            {building ? "building" : "ready"}
          </span>
        </div>
      </header>

      <PipelineBar
        run={run}
        busy={building || rebuilding}
        shownView={shownView}
        hasSitemap={!!model?.sitemap}
        canRebuild={hasPages && (run?.stage === "frontend" || run?.stage === "done")}
        onApprove={approveStage}
        onRebuild={rebuild}
        onReset={() => void postRun({ action: "reset" })}
        onToggle={(key, value) => void postRun({ config: { [key]: value } })}
        onSelectStep={setViewStage}
        onModelChange={(role, modelId) => {
          const next = { ...(run?.config.models ?? {}) } as Record<string, string | undefined>;
          if (modelId) next[role] = modelId;
          else delete next[role];
          void postRun({ config: { models: next as Record<string, string> } });
        }}
      />

      <div className="flex min-h-0 flex-1">
        <aside className="dark flex w-[400px] shrink-0 flex-col border-r border-border bg-background text-foreground">
          <ChatPanel
            messages={messages}
            status={status}
            error={error}
            onSend={(text) => sendMessage({ text })}
            onStop={stop}
          />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col bg-muted/30">
          {run && shownView !== activeView(run.stage) && (
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-700 dark:text-amber-400">
              <span>
                Viewing <b>{VIEW_LABEL[shownView]}</b> — read-only · live stage
                is {VIEW_LABEL[activeView(run.stage)]}
              </span>
              <div className="flex items-center gap-2">
                {shownView !== "analyzer" && (
                  <button
                    type="button"
                    onClick={() => reopenStage(shownView)}
                    className="rounded bg-amber-500 px-2 py-0.5 font-semibold text-amber-950 transition-colors hover:bg-amber-400"
                  >
                    Re-open {VIEW_LABEL[shownView]}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewStage(null)}
                  className="rounded px-2 py-0.5 font-medium hover:bg-amber-500/20"
                >
                  Return to current →
                </button>
              </div>
            </div>
          )}
          <div className="min-h-0 flex-1">
            {shownView === "backend" ? (
              <DataModelViewer
                entities={model?.entities ?? []}
                building={building}
              />
            ) : shownView === "design" ? (
              <DesignReview
                theme={model?.theme ?? null}
                sitemap={model?.sitemap ?? null}
                mockups={model?.mockups ?? null}
                editable={run?.stage === "design"}
                generating={generatingMockup}
                onGenerate={generateMockup}
                onSelect={selectMockup}
                onRerun={rerunDesign}
                rerunningScope={rerunningScope}
                lastTimings={lastDesignTimings}
                onDismissTimings={() => setLastDesignTimings(null)}
                building={building}
              />
            ) : shownView === "analyzer" ? (
              <FragmentAnalyzer appId={app.id} />
            ) : hasPages && bundle ? (
              <div className="flex h-full flex-col">
                {model?.pagesStale && (
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <span>The design changed since this app was built.</span>
                    <button
                      type="button"
                      onClick={rebuild}
                      disabled={building}
                      className="rounded bg-amber-500 px-2 py-0.5 font-semibold text-amber-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
                    >
                      Rebuild to apply →
                    </button>
                  </div>
                )}
                <div className="canvas-grid min-h-0 flex-1">
                  <div className="mx-auto h-full overflow-hidden bg-background shadow-[0_24px_60px_-24px_rgb(0_0_0/0.35)]">
                    <AppRuntime
                      key={bundleKey}
                      appId={app.id}
                      bundle={
                        themeOverride
                          ? { ...bundle, theme: themeOverride }
                          : bundle
                      }
                    />
                  </div>
                </div>
              </div>
            ) : (
              <EmptyCanvas building={building} />
            )}
          </div>
        </main>
      </div>

      {showTweaker && model?.theme && (
        <ThemeTweaker
          key={model.theme.preset}
          appId={app.id}
          theme={model.theme}
          onPreview={setThemeOverride}
          onApplied={(theme) => {
            // Commit the persisted theme straight into the in-memory bundle — no
            // heavy bundle refetch needed (pages didn't change), then drop the
            // override so future agent re-themes aren't masked.
            setBundle((b) => (b ? { ...b, theme } : b));
            setThemeOverride(null);
            void refreshModel();
          }}
          onClose={() => setShowTweaker(false)}
        />
      )}
    </div>
  );
}

function EmptyCanvas({ building }: { building: boolean }) {
  return (
    <div className="canvas-grid flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
      <div
        className={cn(
          "flex size-20 items-center justify-center rounded-2xl border-2 border-dashed border-border",
          building && "animate-pulse border-amber-500/60",
        )}
      >
        <Hammer
          className={cn(
            "size-8 text-muted-foreground",
            building && "animate-bounce text-amber-600",
          )}
        />
      </div>
      <div className="max-w-sm space-y-2">
        <p className="font-heading text-lg font-semibold text-foreground">
          {building ? "Assembling your app…" : "Nothing on the bench yet"}
        </p>
        <p className="text-sm text-muted-foreground">
          {building
            ? "Entities, data, and pages appear here as the agent saves them."
            : "Describe the app you want in the chat — the agent designs the data model, seeds it, and builds the pages live."}
        </p>
      </div>
    </div>
  );
}
