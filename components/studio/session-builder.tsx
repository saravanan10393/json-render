"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowLeft, Check, Loader2, Puzzle, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { Toaster } from "sonner";
import { ChatPanel } from "@/components/builder/chat-panel";
import { cn } from "@/lib/utils";

/** Reserved sandbox app id — previews execute datasources against it. */
const STUDIO_APP_ID = "studio-sandbox";

const ScreenRenderer = dynamic(
  () => import("@/lib/runtime/screen-renderer").then((m) => m.ScreenRenderer),
  { ssr: false },
);

interface EvalResult {
  ok: boolean;
  issues: string[];
  meta?: {
    name: string;
    category: string;
    description: string;
    whenToUse: string | null;
    paramsResolved: unknown;
    paramsSchema: unknown;
  };
  spec?: Record<string, unknown>;
}

interface SessionInfo {
  id: string;
  fragmentName: string | null;
  category: string | null;
  status: "draft" | "promoted";
  origin: "new" | "edit";
}

interface SessionBuilderProps {
  session: SessionInfo;
  initialMessages: UIMessage[];
  categories: string[];
}

type Tab = "preview" | "params" | "source";

export function SessionBuilder({
  session: initialSession,
  initialMessages,
  categories,
}: SessionBuilderProps) {
  const [session, setSession] = useState(initialSession);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [source, setSource] = useState("");
  const [paramsText, setParamsText] = useState("{}");
  const [tab, setTab] = useState<Tab>("preview");
  const [busy, setBusy] = useState(false);
  const [promoteCategory, setPromoteCategory] = useState(
    initialSession.category ?? categories[0] ?? "ecommerce",
  );
  const [banner, setBanner] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const { messages, sendMessage, status, stop, error } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: `/api/studio/sessions/${initialSession.id}/chat`,
    }),
  });
  const building = status === "submitted" || status === "streaming";

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/studio/sessions/${initialSession.id}`);
      if (!res.ok) return;
      const body = (await res.json()) as {
        session: SessionInfo;
        draft: { name: string; source: string } | null;
        result: EvalResult | null;
      };
      setSession(body.session);
      setSource(body.draft?.source ?? "");
      setEvalResult(body.result);
      if (body.result?.meta) {
        setParamsText(JSON.stringify(body.result.meta.paramsResolved ?? {}, null, 2));
      }
    } finally {
      setBusy(false);
    }
  }, [initialSession.id]);

  // initial load + reload after every completed agent saveDraft
  const draftSaveCount = useMemo(
    () =>
      messages
        .flatMap((m) => m.parts)
        .filter(
          (p) =>
            p.type === "tool-saveDraft" &&
            (p as { state?: string }).state === "output-available",
        ).length,
    [messages],
  );

  useEffect(() => {
    void refresh();
    if (draftSaveCount > 0) setBanner(null);
  }, [refresh, draftSaveCount]);

  const applyParams = async () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(paramsText);
    } catch {
      setBanner({ kind: "error", text: "Params is not valid JSON" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/studio/sessions/${initialSession.id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params: parsed }),
      });
      const body = (await res.json()) as { result: EvalResult };
      setEvalResult(body.result);
      setTab("preview");
      setBanner(null);
    } finally {
      setBusy(false);
    }
  };

  const applySource = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/studio/sessions/${initialSession.id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const body = (await res.json()) as { result?: EvalResult; error?: string };
      if (body.error) {
        setBanner({ kind: "error", text: body.error });
        return;
      }
      setEvalResult(body.result ?? null);
      setTab(body.result?.ok ? "preview" : "source");
      setBanner(body.result?.ok ? { kind: "ok", text: "Source applied" } : null);
    } finally {
      setBusy(false);
    }
  };

  const promote = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/studio/sessions/${initialSession.id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: promoteCategory }),
      });
      const body = (await res.json()) as {
        result: { ok: boolean; issues: string[] };
      };
      if (body.result.ok) {
        setBanner({
          kind: "ok",
          text: `${session.fragmentName ?? "Fragment"} ${session.status === "promoted" ? "updated in" : "promoted to"} fragments/${promoteCategory}/ and indexed. Keep chatting here to iterate on it.`,
        });
        await refresh();
      } else {
        setBanner({ kind: "error", text: body.result.issues.join(" · ") });
      }
    } finally {
      setBusy(false);
    }
  };

  const hasDraft = source.length > 0;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="dark flex shrink-0 items-center gap-3 border-b border-border bg-background px-4 py-2.5 text-foreground">
        <Link
          href="/studio"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          studio
        </Link>
        <span className="text-border">/</span>
        <h1 className="flex items-center gap-2 font-heading text-base font-bold tracking-tight">
          <Puzzle className="size-4 text-amber-500" />
          {session.fragmentName ?? "untitled fragment"}
        </h1>
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase",
            session.status === "promoted"
              ? "border-emerald-700 text-emerald-500"
              : "border-border text-muted-foreground",
          )}
        >
          {session.status}
        </span>
        {session.origin === "edit" && (
          <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
            edit
          </span>
        )}
        <span
          className={cn(
            "ml-auto flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest",
            building ? "text-amber-400" : "text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              building ? "animate-pulse bg-amber-400" : "bg-emerald-500",
            )}
          />
          {building ? "drafting" : "ready"}
        </span>
      </header>

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
          {hasDraft && evalResult ? (
            <>
              <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-2">
                {(["preview", "params", "source"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-mono text-xs transition-colors",
                      tab === t
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {t}
                  </button>
                ))}
                {busy && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                <span
                  className={cn(
                    "ml-auto font-mono text-xs",
                    evalResult.ok ? "text-emerald-600" : "text-destructive",
                  )}
                >
                  {evalResult.ok ? "✓ valid" : `${evalResult.issues.length} issue(s)`}
                </span>
              </div>

              {banner && (
                <div
                  className={cn(
                    "border-b px-4 py-2 text-sm",
                    banner.kind === "ok"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-destructive/30 bg-destructive/10 text-destructive",
                  )}
                >
                  {banner.text}
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-hidden">
                {tab === "preview" &&
                  (evalResult.ok && evalResult.spec ? (
                    <div className="canvas-grid h-full overflow-y-auto p-4 lg:p-6">
                      <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-border bg-background shadow-[0_24px_60px_-24px_rgb(0_0_0/0.35)]">
                        <MemoryRouter
                          key={JSON.stringify(evalResult.meta?.paramsResolved) + session.id}
                          initialEntries={["/"]}
                        >
                          <Routes>
                            <Route
                              path="*"
                              element={
                                <ScreenRenderer
                                  appId={STUDIO_APP_ID}
                                  spec={evalResult.spec as never}
                                />
                              }
                            />
                          </Routes>
                          <Toaster position="bottom-right" richColors />
                        </MemoryRouter>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full overflow-y-auto p-6">
                      <p className="mb-3 font-mono text-sm text-destructive">
                        Draft has validation issues — fix via chat or the source tab:
                      </p>
                      <ul className="space-y-2">
                        {evalResult.issues.map((issue, i) => (
                          <li
                            key={i}
                            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 font-mono text-xs text-destructive"
                          >
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}

                {tab === "params" && (
                  <div className="flex h-full flex-col gap-3 p-4">
                    <p className="text-sm text-muted-foreground">
                      Preview params (defaults shown). Edit and apply to re-render —
                      promotion always re-checks with defaults.
                    </p>
                    <textarea
                      value={paramsText}
                      onChange={(e) => setParamsText(e.target.value)}
                      spellCheck={false}
                      className="min-h-0 flex-1 resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs outline-none focus:border-amber-500/60"
                    />
                    <button
                      type="button"
                      onClick={() => void applyParams()}
                      disabled={busy}
                      className="self-start rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
                    >
                      Apply & preview
                    </button>
                  </div>
                )}

                {tab === "source" && (
                  <div className="flex h-full flex-col gap-3 p-4">
                    <textarea
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      spellCheck={false}
                      className="min-h-0 flex-1 resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs leading-relaxed outline-none focus:border-amber-500/60"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void applySource()}
                        disabled={busy}
                        className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
                      >
                        Apply & re-preview
                      </button>
                      <span className="text-xs text-muted-foreground">
                        Quick edits welcome — the agent sees the latest source on its next turn.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 border-t border-border bg-background px-4 py-3">
                <label className="font-mono text-xs text-muted-foreground">category</label>
                <input
                  list="studio-categories"
                  value={promoteCategory}
                  onChange={(e) => setPromoteCategory(e.target.value)}
                  className="w-40 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs outline-none focus:border-amber-500/60"
                />
                <datalist id="studio-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <button
                  type="button"
                  onClick={() => void promote()}
                  disabled={!evalResult.ok || busy}
                  className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  <Check className="size-3.5" />
                  {session.status === "promoted" || session.origin === "edit"
                    ? "Promote update"
                    : "Promote to library"}
                </button>
              </div>
            </>
          ) : (
            <EmptySession session={session} banner={banner} />
          )}
        </main>
      </div>
    </div>
  );
}

function EmptySession({
  session,
  banner,
}: {
  session: SessionInfo;
  banner: { kind: "ok" | "error"; text: string } | null;
}) {
  return (
    <div className="canvas-grid flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
      {banner && (
        <div
          className={cn(
            "max-w-lg rounded-lg border px-4 py-2 text-sm",
            banner.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-destructive/30 bg-destructive/10 text-destructive",
          )}
        >
          {banner.text}
        </div>
      )}
      <div className="flex size-20 items-center justify-center rounded-2xl border-2 border-dashed border-border">
        <Puzzle className="size-8 text-muted-foreground" />
      </div>
      <div className="max-w-sm space-y-2">
        <p className="font-heading text-lg font-semibold text-foreground">
          {session.status === "promoted"
            ? `${session.fragmentName} is published`
            : "No draft yet"}
        </p>
        <p className="text-sm text-muted-foreground">
          {session.status === "promoted"
            ? "Ask for changes in the chat — the agent forks the published source, you preview, and promote the update."
            : "Describe the fragment you want — the agent drafts real TypeScript and it renders here live against sandbox data."}
        </p>
      </div>
    </div>
  );
}
