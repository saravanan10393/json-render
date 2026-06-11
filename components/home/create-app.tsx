"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateApp() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const body = (await res.json()) as { app?: { id: string }; error?: string };
      if (!res.ok || !body.app) throw new Error(body.error ?? "failed to create app");
      router.push(`/apps/${body.app.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex min-h-44 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-transparent p-6 text-muted-foreground transition-colors hover:border-amber-500/60 hover:text-foreground"
      >
        <span className="flex size-10 items-center justify-center rounded-full border border-border transition-colors group-hover:border-amber-500/60 group-hover:text-amber-500">
          <Plus className="size-5" />
        </span>
        <span className="font-mono text-xs uppercase tracking-widest">new app</span>
      </button>
    );
  }

  return (
    <div className="flex min-h-44 flex-col gap-3 rounded-xl border border-amber-500/40 bg-card p-4">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && create()}
        placeholder="App name"
        className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-amber-500/60"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What is this app for? (optional)"
        rows={2}
        className="resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-amber-500/60"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="mt-auto flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={create}
          disabled={!name.trim() || busy}
          className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          Create
        </button>
      </div>
    </div>
  );
}
