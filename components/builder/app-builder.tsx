"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowLeft, Hammer, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppBundle } from "@/lib/runtime/app-shell";
import { cn } from "@/lib/utils";
import { ChatPanel } from "./chat-panel";

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

  const { messages, sendMessage, status, stop, error } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: `/api/apps/${app.id}/chat` }),
  });

  const building = status === "submitted" || status === "streaming";

  const refreshBundle = useCallback(async () => {
    const res = await fetch(`/api/apps/${app.id}/bundle`);
    if (!res.ok) return;
    const body = (await res.json()) as AppBundle;
    setBundle(body);
  }, [app.id]);

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
    void refreshBundle();
  }, [refreshBundle, completedToolCalls]);

  const hasPages = (bundle?.pages.length ?? 0) > 0;

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
        <main className="min-w-0 flex-1 bg-muted/30">
          {hasPages && bundle ? (
            <div className="canvas-grid h-full p-4 lg:p-6">
              <div className="mx-auto h-full max-w-6xl overflow-hidden rounded-xl border border-border bg-background shadow-[0_24px_60px_-24px_rgb(0_0_0/0.35)]">
                <AppRuntime key={bundleKey} appId={app.id} bundle={bundle} />
              </div>
            </div>
          ) : (
            <EmptyCanvas building={building} />
          )}
        </main>
      </div>
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
