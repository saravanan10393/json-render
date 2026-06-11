import { Hammer, Layers } from "lucide-react";
import Link from "next/link";
import { CreateApp } from "@/components/home/create-app";
import { listApps } from "@/lib/server/apps";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const apps = listApps();

  return (
    <div className="dark min-h-dvh bg-background text-foreground">
      <header className="flex items-center gap-4 border-b border-border px-6 py-3">
        <h1 className="font-heading text-lg font-bold tracking-tight">
          patchwork<span className="text-amber-500">*</span>
        </h1>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          chat → json → app
        </span>
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {apps.length} app{apps.length === 1 ? "" : "s"}
        </span>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 space-y-1">
          <h2 className="font-heading text-2xl font-semibold">Your apps</h2>
          <p className="text-sm text-muted-foreground">
            Pick an app to keep building, or start a new one from a prompt.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CreateApp />
          {apps.map((app) => (
            <Link
              key={app.id}
              href={`/apps/${app.id}`}
              className="group flex min-h-44 flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-amber-500/50"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                  <Hammer className="size-4" />
                </span>
                <h3 className="truncate font-heading text-base font-semibold">
                  {app.name}
                </h3>
              </div>
              {app.description && (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {app.description}
                </p>
              )}
              <div className="mt-auto flex items-center gap-3 pt-4 font-mono text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Layers className="size-3" />
                  {app.pageCount} page{app.pageCount === 1 ? "" : "s"}
                </span>
                <span>·</span>
                <span>
                  {new Date(app.updatedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="ml-auto rounded border border-border px-1.5 py-0.5 uppercase">
                  {app.status}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {apps.length === 0 && (
          <p className="mt-10 text-center font-mono text-xs text-muted-foreground">
            no apps yet — create your first one above
          </p>
        )}
      </main>
    </div>
  );
}
