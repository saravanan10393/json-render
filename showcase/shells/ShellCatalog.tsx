"use client";

/**
 * The Shells gallery — same chrome as the Components catalog: a left sidebar
 * lists every shell the design agent can pick, the main panel renders the
 * selected one live with sample nav + content. Mirrors ComponentCatalog so the
 * two showcases feel identical to navigate.
 *
 * Each preview mounts a real shell from lib/runtime/shells.tsx wrapped in a
 * MemoryRouter (shells use react-router's useLocation to highlight the active
 * entry). A per-detail dark toggle scopes light/dark to the preview frame.
 */
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { type ShellNavEntry, SHELL_COMPONENTS } from "@/lib/runtime/shells";
import { cn } from "@/lib/utils";
import { SHELL_META, type ShellMeta } from "./shellMeta";

/** Realistic nav entries grouped two-deep — same set across every preview so
 *  visual comparison is apples-to-apples. The `group` field is what grouped /
 *  nested / split-rail shells use to render section headers; flat shells just
 *  ignore it. Icons are kebab-case lucide names. */
const SAMPLE_NAV: ShellNavEntry[] = [
  { label: "Dashboard", icon: "layout-dashboard", path: "/dashboard", group: "Platform" },
  { label: "Orders", icon: "receipt", path: "/orders", group: "Platform" },
  { label: "Products", icon: "package", path: "/products", group: "Platform" },
  { label: "Customers", icon: "users", path: "/customers", group: "Platform" },
  { label: "Reports", icon: "bar-chart-2", path: "/reports", group: "Insights" },
  { label: "Settings", icon: "settings", path: "/settings", group: "Insights" },
];

/** Sample workspace subtitle + user — drives the brand subtitle slot and the
 *  bottom UserMenu, so the shadcn-style "Acme Inc / Enterprise" + bottom-user
 *  pattern is visible in every sidebar-family shell. */
const SAMPLE_SUBTITLE = "Enterprise";
const SAMPLE_USER = { name: "Alex Reyes", email: "alex@demoshop.app" };

/** Placeholder page body used by every preview so the shell isn't framed by a
 *  blank canvas — a thin "what a real page looks like" stand-in. */
function SamplePageBody() {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div>
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <p className="text-xs text-muted-foreground">Sample page content — every shell renders the same body.</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["Active orders", "Pending", "Revenue"].map((label) => (
          <div key={label} className="rounded-md border border-border bg-card px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-1 text-base font-semibold tabular-nums">128</div>
          </div>
        ))}
      </div>
      <div className="flex-1 rounded-md border border-dashed border-border" />
    </div>
  );
}

/** A boxed labelled cell inside the picking-signal grid. `tone` colours the
 *  label so the positive/negative signals scan at a glance. */
function MetaCell({
  title,
  tone = "neutral",
  children,
}: {
  title: string;
  tone?: "neutral" | "positive" | "negative";
  children: React.ReactNode;
}) {
  const labelTone =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground";
  return (
    <div className="rounded-lg border border-border p-3">
      <div className={cn("mb-1.5 text-[10px] font-semibold uppercase tracking-wide", labelTone)}>
        {title}
      </div>
      {children}
    </div>
  );
}

function ShellDetail({ meta }: { meta: ShellMeta }) {
  const ShellComponent = SHELL_COMPONENTS[meta.id];
  const [dark, setDark] = useState(false);
  if (!ShellComponent) {
    return (
      <div className="mx-auto max-w-4xl px-8 py-8">
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          Unknown shell <code className="font-mono">{meta.id}</code>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <header className="flex items-baseline gap-3">
        <h2 className="text-xl font-semibold">{meta.label}</h2>
        <code className="font-mono text-xs text-muted-foreground">{meta.id}</code>
        <button
          type="button"
          onClick={() => setDark((d) => !d)}
          className="ml-auto rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Toggle preview light/dark"
        >
          {dark ? "Light preview" : "Dark preview"}
        </button>
      </header>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{meta.description}</p>

      {/* Picking signal — what makes this shell the right pick (or wrong one).
          Same prose feeds the design agent's NAV_SHELL_SECTION prompt, so the
          human and the agent are evaluating each shell against the same brief. */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <MetaCell title="Traits">
          <ul className="flex flex-wrap gap-1.5">
            {meta.traits.map((t) => (
              <li key={t} className="rounded border border-border bg-muted/30 px-2 py-0.5 text-[11px] text-foreground/80">
                {t}
              </li>
            ))}
          </ul>
        </MetaCell>
        <MetaCell title="Examples">
          <ul className="space-y-0.5 text-[12px] text-foreground/80">
            {meta.examples.map((e) => (
              <li key={e}>· {e}</li>
            ))}
          </ul>
        </MetaCell>
        <MetaCell title="Use when" tone="positive">
          <p className="text-[12px] leading-relaxed text-foreground/80">{meta.useWhen}</p>
        </MetaCell>
        {meta.avoidWhen && (
          <MetaCell title="Avoid when" tone="negative">
            <p className="text-[12px] leading-relaxed text-foreground/80">{meta.avoidWhen}</p>
          </MetaCell>
        )}
      </div>

      <div className={cn("mt-6 overflow-hidden rounded-xl border border-border", dark && "dark")}>
        <div className="relative h-[560px] bg-background text-foreground">
          <MemoryRouter initialEntries={["/dashboard"]}>
            <ShellComponent
              appName="Demo Shop"
              entries={SAMPLE_NAV}
              dark={dark}
              onToggleDark={() => setDark((d) => !d)}
              subtitle={SAMPLE_SUBTITLE}
              user={SAMPLE_USER}
            >
              <SamplePageBody />
            </ShellComponent>
          </MemoryRouter>
        </div>
      </div>
    </div>
  );
}

export function ShellCatalog() {
  const [selectedId, setSelectedId] = useState<string>(SHELL_META[0]?.id ?? "");
  const selected = SHELL_META.find((s) => s.id === selectedId) ?? SHELL_META[0];

  return (
    <>
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-border">
        <div className="shrink-0 border-b border-border p-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Shells <span className="font-normal text-muted-foreground/70">· {SHELL_META.length}</span>
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Every <code className="font-mono text-foreground/80">shellLayout</code> the design agent can pick.
          </p>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto p-2">
          <ul className="space-y-0.5">
            {SHELL_META.map((meta) => {
              const active = meta.id === selectedId;
              return (
                <li key={meta.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(meta.id)}
                    className={`flex w-full items-baseline justify-between gap-2 rounded-md px-2.5 py-2 text-left transition-colors ${
                      active ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-muted"
                    }`}
                  >
                    <span className="text-sm font-medium">{meta.label}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{meta.id}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* ── Main panel ──────────────────────────────────────────────────── */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        {selected && <ShellDetail key={selected.id} meta={selected} />}
      </main>
    </>
  );
}
