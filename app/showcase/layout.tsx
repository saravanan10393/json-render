"use client";

/**
 * Showcase chrome shared by the Components and Blocks tabs: a top bar with the
 * title, the tab switcher, the live catalog counts, and a link back to the app
 * list. The body below is a full-height flex row that each route fills (the
 * Components route renders a sidebar + detail; Blocks renders a placeholder).
 *
 * A light/dark toggle lives in the top bar. The `dark` class is applied to the
 * document element (not a wrapper div) so Radix portals — popovers, dialogs,
 * dropdowns — which mount onto document.body, outside any wrapper, still
 * inherit the theme. Defaults to dark, matching the home + builder surfaces.
 */
import { Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { buildShowcaseEntries } from "@/showcase/components/catalogMeta";

const TABS = [
  { href: "/showcase/components", label: "Components" },
  { href: "/showcase/blocks", label: "Blocks" },
  { href: "/showcase/shells", label: "Shells" },
] as const;

const THEME_KEY = "patchwork-showcase-theme";
type Theme = "light" | "dark";

export default function ShowcaseLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const counts = useMemo(() => {
    const entries = buildShowcaseEntries();
    const shadcn = entries.filter((e) => e.source === "shadcn").length;
    return { total: entries.length, shadcn, ours: entries.length - shadcn };
  }, []);

  // Default to dark (matches the rest of the app); reconcile from localStorage
  // after mount so a stored preference survives reloads without a hydration
  // mismatch.
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);
  // Apply `dark` to the document element so portaled overlays (which escape
  // this subtree to document.body) inherit it too; clean it off on unmount so
  // the preference doesn't leak to other routes.
  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    return () => root.classList.remove("dark");
  }, [theme]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">Component Catalog</h1>
          <div className="flex gap-1 rounded-md border border-border p-0.5">
            {TABS.map((t) => {
              const active = pathname.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
          <span className="text-xs text-muted-foreground">
            {counts.total} · {counts.shadcn} shadcn · {counts.ours} ours
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          </button>
          <Link href="/" className="text-xs text-primary underline-offset-4 hover:underline">
            ← Back to apps
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">{children}</div>
    </div>
  );
}
