"use client";

import { ArrowLeft, Loader2, Pencil, Plus, Puzzle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface SessionRow {
  id: string;
  fragmentName: string | null;
  category: string | null;
  status: "draft" | "promoted";
  origin: "new" | "edit";
  updatedAt: string;
}

interface StudioHomeProps {
  sessions: SessionRow[];
  library: Array<{ name: string; category: string }>;
}

export function StudioHome({ sessions: initialSessions, library }: StudioHomeProps) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initialSessions);
  const [busy, setBusy] = useState<string | null>(null);

  const createSession = async (fromFragment?: string) => {
    setBusy(fromFragment ?? "new");
    try {
      const res = await fetch("/api/studio/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fromFragment ? { fromFragment } : {}),
      });
      const body = (await res.json()) as { session?: { id: string }; error?: string };
      if (body.session) router.push(`/studio/${body.session.id}`);
    } finally {
      setBusy(null);
    }
  };

  const removeSession = async (id: string) => {
    await fetch(`/api/studio/sessions/${id}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="dark min-h-dvh bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border px-6 py-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          apps
        </Link>
        <span className="text-border">/</span>
        <h1 className="flex items-center gap-2 font-heading text-lg font-bold tracking-tight">
          <Puzzle className="size-4 text-amber-500" />
          fragment studio
        </h1>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <section className="mb-12">
          <div className="mb-5 space-y-1">
            <h2 className="font-heading text-2xl font-semibold">Fragment sessions</h2>
            <p className="text-sm text-muted-foreground">
              One session = one fragment. Chat to build it, preview it live,
              promote it to the library — and keep iterating in the same thread.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <button
              type="button"
              onClick={() => void createSession()}
              disabled={busy !== null}
              className="group flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-amber-500/60 hover:text-foreground disabled:opacity-50"
            >
              {busy === "new" ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <span className="flex size-10 items-center justify-center rounded-full border border-border transition-colors group-hover:border-amber-500/60 group-hover:text-amber-500">
                  <Plus className="size-5" />
                </span>
              )}
              <span className="font-mono text-xs uppercase tracking-widest">new fragment</span>
            </button>

            {sessions.map((session) => (
              <div
                key={session.id}
                className="group relative flex min-h-32 flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-amber-500/50"
              >
                <Link href={`/studio/${session.id}`} className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <Puzzle className="size-4 text-amber-500" />
                    <span className="truncate font-heading text-base font-semibold">
                      {session.fragmentName ?? "untitled"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                    <span
                      className={cn(
                        "rounded border px-1.5 py-0.5 uppercase",
                        session.status === "promoted"
                          ? "border-emerald-700 text-emerald-500"
                          : "border-border",
                      )}
                    >
                      {session.status}
                    </span>
                    {session.origin === "edit" && (
                      <span className="rounded border border-border px-1.5 py-0.5 uppercase">edit</span>
                    )}
                    <span>
                      {/* fixed locale: server/client must hydrate identically */}
                      {new Date(session.updatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => void removeSession(session.id)}
                  title="Delete session"
                  className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-5 space-y-1">
            <h2 className="font-heading text-xl font-semibold">Library</h2>
            <p className="text-sm text-muted-foreground">
              Published fragments. Edit opens a session forked from the current source.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {library.map((fragment) => (
              <div
                key={fragment.name}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
              >
                <span className="truncate font-mono text-sm">{fragment.name}</span>
                <span className="font-mono text-[10px] uppercase text-muted-foreground">
                  {fragment.category}
                </span>
                <button
                  type="button"
                  onClick={() => void createSession(fragment.name)}
                  disabled={busy !== null}
                  className="ml-auto flex items-center gap-1 rounded-md border border-border px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-amber-500/50 hover:text-foreground disabled:opacity-50"
                >
                  {busy === fragment.name ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Pencil className="size-3" />
                  )}
                  edit
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
