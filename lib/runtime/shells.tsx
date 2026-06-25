"use client";

import { BadgeCheck, Bell, ChevronDown, ChevronRight, ChevronsUpDown, CreditCard, LogOut, Sparkles, icons, Circle, Moon, Sun, type LucideIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/lib/jr/components/shadcn/ui/dropdown-menu";
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

/** Optional ingredients sidebar-family shells render when supplied — mirror
 *  shadcn's `SidebarHeader` / `SidebarFooter` slot conventions:
 *   - `subtitle`: workspace/version label below the brand name (e.g. "Enterprise", "v1.0.1")
 *   - `user`: bottom user menu (avatar + name + email)
 *  Shells that don't have room for these slots (icon-rail / compact-rail /
 *  minimal / topnav) ignore them. */
export interface ShellUser {
  name: string;
  email?: string;
  /** 1-2 char fallback when no avatar URL — defaults to first char of `name`. */
  initial?: string;
  avatarUrl?: string;
}

export interface ShellProps {
  appName: string;
  entries: ShellNavEntry[];
  dark: boolean;
  onToggleDark: () => void;
  children: ReactNode;
  subtitle?: string;
  user?: ShellUser;
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

function Brand({ name, subtitle, compact }: { name: string; subtitle?: string; compact?: boolean }) {
  const initial = (name.trim()[0] ?? "A").toUpperCase();
  return (
    <div className="flex min-w-0 items-center gap-2.5 overflow-hidden">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary font-heading text-sm font-bold text-primary-foreground">
        {initial}
      </span>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <div className="truncate font-heading text-sm font-bold text-foreground">{name}</div>
          {subtitle && <div className="truncate text-[10px] text-muted-foreground">{subtitle}</div>}
        </div>
      )}
    </div>
  );
}

/** Bottom-aligned user menu (avatar + name + email) — opt-in slot for the
 *  sidebar-family shells. Mirrors shadcn's NavUser block from sidebar-07:
 *  the row itself is a DropdownMenu trigger that opens an Upgrade/Account/
 *  Billing/Notifications/Log out menu. Menu items are placeholders in the
 *  preview; production apps wire them to real handlers. */
function UserMenu({ user }: { user: ShellUser }) {
  const initial = (user.initial ?? user.name.trim()[0] ?? "U").toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full min-w-0 items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium text-foreground">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- runtime preview, no Next/Image
              <img src={user.avatarUrl} alt={user.name} className="size-full object-cover" />
            ) : (
              initial
            )}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-xs font-medium text-foreground">{user.name}</span>
            {user.email && (
              <span className="block truncate text-[10px] text-muted-foreground">{user.email}</span>
            )}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="end"
        className="min-w-[14rem]"
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium text-foreground">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- runtime preview, no Next/Image
                <img src={user.avatarUrl} alt={user.name} className="size-full object-cover" />
              ) : (
                initial
              )}
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-xs font-semibold">{user.name}</div>
              {user.email && (
                <div className="truncate text-[10px] text-muted-foreground">{user.email}</div>
              )}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <Sparkles className="size-4" />
            Upgrade to Pro
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <BadgeCheck className="size-4" />
            Account
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CreditCard className="size-4" />
            Billing
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Bell className="size-4" />
            Notifications
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <LogOut className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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

function SidebarShell({ appName, entries, dark, onToggleDark, children, subtitle, user }: ShellProps) {
  return (
    <div className="flex h-full min-h-0">
      <nav className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex items-center justify-between px-4 py-4">
          <Brand name={appName} subtitle={subtitle} />
        </div>
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {entries.map((entry) => (
            <NavButton key={entry.path} entry={entry} variant="row" />
          ))}
        </div>
        {user && (
          <div className="border-t border-border px-3 py-2">
            <UserMenu user={user} />
          </div>
        )}
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

/** Group `entries` by their `group` field; entries without a group land in
 *  "General". Preserves insertion order within each group. */
function groupEntries(entries: ShellNavEntry[]): Array<[string, ShellNavEntry[]]> {
  const groups = new Map<string, ShellNavEntry[]>();
  for (const entry of entries) {
    const group = entry.group ?? "General";
    groups.set(group, [...(groups.get(group) ?? []), entry]);
  }
  return [...groups.entries()];
}

/** Left rail with section-label headers above each group of entries. Same
 *  density as `sidebar` but adds IA structure — pick this when the app has
 *  many top-level pages that benefit from being grouped. */
function GroupedSidebarShell({ appName, entries, dark, onToggleDark, children, subtitle, user }: ShellProps) {
  const groups = groupEntries(entries);
  return (
    <div className="flex h-full min-h-0">
      <nav className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex items-center justify-between px-4 py-4">
          <Brand name={appName} subtitle={subtitle} />
        </div>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 pb-2">
          {groups.map(([group, members]) => (
            <div key={group}>
              <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {group}
              </div>
              <div className="flex flex-col gap-0.5">
                {members.map((entry) => (
                  <NavButton key={entry.path} entry={entry} variant="row" />
                ))}
              </div>
            </div>
          ))}
        </div>
        {user && (
          <div className="border-t border-border px-3 py-2">
            <UserMenu user={user} />
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">theme</span>
          <ThemeToggle dark={dark} onToggle={onToggleDark} />
        </div>
      </nav>
      <main className="min-w-0 flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  );
}

/** Collapsible groups — each section is a header you can fold open/closed.
 *  shadcn sidebar-02/05 inspired. Pick this when a flat sidebar would be too
 *  long (10+ items) and grouping isn't enough — the user wants to hide whole
 *  sections to focus. */
function NestedSidebarShell({ appName, entries, dark, onToggleDark, children, subtitle, user }: ShellProps) {
  const groups = groupEntries(entries);
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map(([g]) => [g, true])),
  );
  return (
    <div className="flex h-full min-h-0">
      <nav className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex items-center justify-between px-4 py-4">
          <Brand name={appName} subtitle={subtitle} />
        </div>
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-2">
          {groups.map(([group, members]) => {
            const isOpen = open[group] !== false;
            return (
              <div key={group}>
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [group]: !isOpen }))}
                  className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:bg-muted"
                >
                  {isOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                  <span className="flex-1">{group}</span>
                  <span className="text-[10px] font-normal opacity-70">{members.length}</span>
                </button>
                {isOpen && (
                  <div className="ml-2 mt-0.5 flex flex-col gap-0.5 border-l border-border pl-2">
                    {members.map((entry) => (
                      <NavButton key={entry.path} entry={entry} variant="row" />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {user && (
          <div className="border-t border-border px-3 py-2">
            <UserMenu user={user} />
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">theme</span>
          <ThemeToggle dark={dark} onToggle={onToggleDark} />
        </div>
      </nav>
      <main className="min-w-0 flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  );
}

/** Flush left rail; main content sits in a rounded card with margin around it.
 *  shadcn `variant=inset` look — softer, modern SaaS feel. */
function InsetSidebarShell({ appName, entries, dark, onToggleDark, children, subtitle, user }: ShellProps) {
  return (
    <div className="flex h-full min-h-0 bg-muted/30">
      <nav className="flex w-56 shrink-0 flex-col px-3 py-4">
        <div className="px-2 pb-3">
          <Brand name={appName} subtitle={subtitle} />
        </div>
        <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {entries.map((entry) => (
            <NavButton key={entry.path} entry={entry} variant="row" />
          ))}
        </div>
        {user && (
          <div className="px-1 pt-3">
            <UserMenu user={user} />
          </div>
        )}
        <div className="flex items-center justify-between px-2 pt-3">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">theme</span>
          <ThemeToggle dark={dark} onToggle={onToggleDark} />
        </div>
      </nav>
      <main className="my-3 mr-3 flex-1 overflow-y-auto rounded-xl border border-border bg-background shadow-sm">
        {children}
      </main>
    </div>
  );
}

/** Both the rail AND the main canvas float as rounded cards with a gap from
 *  the window edges. shadcn `variant=floating` look — most polished, consumer
 *  / marketing feel. */
function FloatingSidebarShell({ appName, entries, dark, onToggleDark, children, subtitle, user }: ShellProps) {
  return (
    <div className="flex h-full min-h-0 gap-3 bg-muted/30 p-3">
      <nav className="flex w-52 shrink-0 flex-col rounded-xl border border-border bg-card px-3 py-4 shadow-sm">
        <div className="px-1 pb-3">
          <Brand name={appName} subtitle={subtitle} />
        </div>
        <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {entries.map((entry) => (
            <NavButton key={entry.path} entry={entry} variant="row" />
          ))}
        </div>
        {user && (
          <div className="px-0 pt-3">
            <UserMenu user={user} />
          </div>
        )}
        <div className="flex items-center justify-between px-1 pt-3">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">theme</span>
          <ThemeToggle dark={dark} onToggle={onToggleDark} />
        </div>
      </nav>
      <main className="flex-1 overflow-y-auto rounded-xl border border-border bg-background shadow-sm">
        {children}
      </main>
    </div>
  );
}

/** Mirror of `sidebar` — nav on the right. shadcn sidebar-14 inspired.
 *  Pick this for tools-panel apps (the main canvas reads naturally left-to-
 *  right, controls live on the right where the dominant hand reaches). */
function RightSidebarShell({ appName, entries, dark, onToggleDark, children, subtitle, user }: ShellProps) {
  return (
    <div className="flex h-full min-h-0">
      <main className="min-w-0 flex-1 overflow-y-auto bg-background">{children}</main>
      <nav className="flex w-56 shrink-0 flex-col border-l border-border bg-card">
        <div className="flex items-center justify-between px-4 py-4">
          <Brand name={appName} subtitle={subtitle} />
        </div>
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {entries.map((entry) => (
            <NavButton key={entry.path} entry={entry} variant="row" />
          ))}
        </div>
        {user && (
          <div className="border-t border-border px-3 py-2">
            <UserMenu user={user} />
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">theme</span>
          <ThemeToggle dark={dark} onToggle={onToggleDark} />
        </div>
      </nav>
    </div>
  );
}

/** Primary nav on the left + context/properties panel on the right. shadcn
 *  sidebar-15 inspired. Pick this for editor-style apps where the main canvas
 *  needs persistent context (page outline, properties, comments). */
function DualSidebarShell({ appName, entries, dark, onToggleDark, children, subtitle, user }: ShellProps) {
  return (
    <div className="flex h-full min-h-0">
      <nav className="flex w-52 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex items-center justify-between px-4 py-4">
          <Brand name={appName} subtitle={subtitle} />
        </div>
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {entries.map((entry) => (
            <NavButton key={entry.path} entry={entry} variant="row" />
          ))}
        </div>
        {user && (
          <div className="border-t border-border px-3 py-2">
            <UserMenu user={user} />
          </div>
        )}
      </nav>
      <main className="min-w-0 flex-1 overflow-y-auto bg-background">{children}</main>
      <aside className="flex w-60 shrink-0 flex-col border-l border-border bg-card/50">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-xs font-semibold text-foreground">Context</span>
          <ThemeToggle dark={dark} onToggle={onToggleDark} />
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4 text-xs text-muted-foreground">
          <div className="rounded-md border border-dashed border-border p-3">
            <div className="font-medium text-foreground">Page outline</div>
            <p className="mt-1">App-specific context lives here — outline, properties, comments, AI assist.</p>
          </div>
          <div className="rounded-md border border-dashed border-border p-3">
            <div className="font-medium text-foreground">Details</div>
            <p className="mt-1">Pick this shell for editor-style apps where the canvas needs persistent context.</p>
          </div>
        </div>
      </aside>
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
  "grouped-sidebar": GroupedSidebarShell,
  "nested-sidebar": NestedSidebarShell,
  "inset-sidebar": InsetSidebarShell,
  "floating-sidebar": FloatingSidebarShell,
  "right-sidebar": RightSidebarShell,
  "dual-sidebar": DualSidebarShell,
};
