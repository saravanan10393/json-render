"use client";

import { icons, Circle, Moon, Sun, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { cn } from "@/lib/utils";

/**
 * The six navigation shells the page schema's `shellLayout` enum names.
 * All are driven by app.json navigation entries (label + lucide icon + page)
 * and themed entirely through the shadcn CSS variables, so each app's
 * DESIGN.md restyles them automatically.
 */

export interface ShellNavEntry {
  label: string;
  icon?: string;
  path: string;
  group?: string;
}

export interface ShellProps {
  appName: string;
  entries: ShellNavEntry[];
  dark: boolean;
  onToggleDark: () => void;
  children: ReactNode;
}

/** kebab-case lucide name → component, with a safe fallback. */
function iconFor(name: string | undefined): LucideIcon {
  if (!name) return Circle;
  const pascal = name
    .split(/[-_\s]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return (icons as Record<string, LucideIcon>)[pascal] ?? Circle;
}

function useActive(path: string): boolean {
  return useLocation().pathname === path;
}

function ThemeToggle({ dark, onToggle, className }: { dark: boolean; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={dark ? "Switch to light" : "Switch to dark"}
      className={cn(
        "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        className,
      )}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

function Brand({ name, compact }: { name: string; compact?: boolean }) {
  const initial = (name.trim()[0] ?? "A").toUpperCase();
  return (
    <div className="flex items-center gap-2.5 overflow-hidden">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary font-heading text-sm font-bold text-primary-foreground">
        {initial}
      </span>
      {!compact && (
        <span className="truncate font-heading text-sm font-bold text-foreground">{name}</span>
      )}
    </div>
  );
}

function NavButton({
  entry,
  variant,
}: {
  entry: ShellNavEntry;
  variant: "row" | "icon" | "stacked" | "pill";
}) {
  const navigate = useNavigate();
  const active = useActive(entry.path);
  const Icon = iconFor(entry.icon);

  if (variant === "icon") {
    return (
      <button
        type="button"
        title={entry.label}
        onClick={() => navigate(entry.path)}
        className={cn(
          "flex size-10 items-center justify-center rounded-lg transition-colors",
          active
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <Icon className="size-4.5" />
      </button>
    );
  }
  if (variant === "stacked") {
    return (
      <button
        type="button"
        onClick={() => navigate(entry.path)}
        className={cn(
          "flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2 transition-colors",
          active
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <Icon className="size-4.5" />
        <span className="max-w-full truncate text-[10px] font-medium leading-none">{entry.label}</span>
      </button>
    );
  }
  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={() => navigate(entry.path)}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
          active
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <Icon className="size-3.5" />
        {entry.label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => navigate(entry.path)}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{entry.label}</span>
    </button>
  );
}

// ── Layouts ───────────────────────────────────────────────────────────────

function SidebarShell({ appName, entries, dark, onToggleDark, children }: ShellProps) {
  return (
    <div className="flex h-full min-h-0">
      <nav className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex items-center justify-between px-4 py-4">
          <Brand name={appName} />
        </div>
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {entries.map((entry) => (
            <NavButton key={entry.path} entry={entry} variant="row" />
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">theme</span>
          <ThemeToggle dark={dark} onToggle={onToggleDark} />
        </div>
      </nav>
      <main className="min-w-0 flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  );
}

function TopnavShell({ appName, entries, dark, onToggleDark, children }: ShellProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-6 border-b border-border bg-card px-5 py-3">
        <Brand name={appName} />
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {entries.map((entry) => (
            <NavButton key={entry.path} entry={entry} variant="pill" />
          ))}
        </nav>
        <ThemeToggle dark={dark} onToggle={onToggleDark} />
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  );
}

function IconRailShell({ appName, entries, dark, onToggleDark, children }: ShellProps) {
  return (
    <div className="flex h-full min-h-0">
      <nav className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-border bg-card py-3">
        <Brand name={appName} compact />
        <div className="mt-2 flex flex-1 flex-col items-center gap-1.5 overflow-y-auto">
          {entries.map((entry) => (
            <NavButton key={entry.path} entry={entry} variant="icon" />
          ))}
        </div>
        <ThemeToggle dark={dark} onToggle={onToggleDark} />
      </nav>
      <main className="min-w-0 flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  );
}

function CompactRailShell({ appName, entries, dark, onToggleDark, children }: ShellProps) {
  return (
    <div className="flex h-full min-h-0">
      <nav className="flex w-[88px] shrink-0 flex-col border-r border-border bg-card py-3">
        <div className="flex justify-center pb-2">
          <Brand name={appName} compact />
        </div>
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-2">
          {entries.map((entry) => (
            <NavButton key={entry.path} entry={entry} variant="stacked" />
          ))}
        </div>
        <div className="flex justify-center border-t border-border pt-2">
          <ThemeToggle dark={dark} onToggle={onToggleDark} />
        </div>
      </nav>
      <main className="min-w-0 flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  );
}

function MinimalShell({ entries, dark, onToggleDark, children }: ShellProps) {
  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto bg-background pb-16">{children}</main>
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card/95 px-2 py-1.5 shadow-lg backdrop-blur">
          {entries.map((entry) => (
            <NavButton key={entry.path} entry={entry} variant="pill" />
          ))}
          <ThemeToggle dark={dark} onToggle={onToggleDark} />
        </div>
      </div>
    </div>
  );
}

function SplitRailShell({ appName, entries, dark, onToggleDark, children }: ShellProps) {
  const groups = new Map<string, ShellNavEntry[]>();
  for (const entry of entries) {
    const group = entry.group ?? "General";
    groups.set(group, [...(groups.get(group) ?? []), entry]);
  }
  return (
    <div className="flex h-full min-h-0">
      <nav className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-border bg-card py-3">
        <Brand name={appName} compact />
        <div className="mt-2 flex flex-1 flex-col items-center gap-1.5">
          {entries.map((entry) => (
            <NavButton key={entry.path} entry={entry} variant="icon" />
          ))}
        </div>
        <ThemeToggle dark={dark} onToggle={onToggleDark} />
      </nav>
      <nav className="w-44 shrink-0 overflow-y-auto border-r border-border bg-card/50 px-3 py-4">
        <div className="mb-3 truncate font-heading text-xs font-bold text-foreground">{appName}</div>
        {[...groups.entries()].map(([group, members]) => (
          <div key={group} className="mb-4">
            {groups.size > 1 && (
              <div className="mb-1 px-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                {group}
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {members.map((entry) => (
                <NavButton key={entry.path} entry={entry} variant="row" />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <main className="min-w-0 flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  );
}

export const SHELL_COMPONENTS: Record<string, (props: ShellProps) => ReactNode> = {
  sidebar: SidebarShell,
  topnav: TopnavShell,
  "icon-rail": IconRailShell,
  "compact-rail": CompactRailShell,
  minimal: MinimalShell,
  "split-rail": SplitRailShell,
};
