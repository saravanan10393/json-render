"use client";

import { Loader2, Maximize2, Palette, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { TOKEN_GROUPS } from "@/lib/jr/theme-options";
import { cn } from "@/lib/utils";

export interface ThemeInfo {
  name: string;
  preset: string;
  light: Record<string, string>;
  dark: Record<string, string>;
  fonts: { heading: string; body: string; mono?: string };
  radius: string;
  /** Set by a "Rerun theme" system action — rendered as a header chip. */
  durationMs?: number;
}

export interface SitemapInfo {
  pages: {
    id: string;
    name: string;
    role: string;
    purpose: string;
    primaryEntity: string | null;
    sections: string[];
    states: string[];
  }[];
  navigation: { label: string; icon: string | null; page: string }[];
  home: string;
  shellLayout: string | null;
  flows: string[];
  /** Set by a "Rerun sitemap" system action — rendered as a header chip. */
  durationMs?: number;
}

export type DesignMode = "text" | "html" | "image";

export interface MockupSlotInfo {
  content: string;
  /** Wall-clock generation time, stamped by the server after agent.generate
   *  returns; rendered as a small chip on the mode tab. */
  durationMs?: number;
}

export interface MockupsInfo {
  selected: DesignMode;
  pages: Record<
    string,
    {
      text?: MockupSlotInfo;
      html?: MockupSlotInfo;
      image?: MockupSlotInfo;
    }
  >;
}

/** Compact duration label — sub-second in ms, otherwise seconds with one decimal. */
export function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)}s`;
}

const MOCKUP_MODES: DesignMode[] = ["text", "html", "image"];
const LEGACY_PAGE_ID = "_app";

/** Which slice of the design phase a rerun regenerates. */
export type DesignScope = "all" | "theme" | "sitemap" | "mockups";

function Section({
  title,
  durationMs,
  action,
  children,
}: {
  title: string;
  /** Wall-clock generation time, rendered as a small chip beside the title. */
  durationMs?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
          {typeof durationMs === "number" && (
            <span
              className="rounded bg-foreground/10 px-1 py-px font-mono text-[9px] normal-case tabular-nums opacity-80"
              title="Generation time"
            >
              {formatDuration(durationMs)}
            </span>
          )}
        </span>
        {action}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

/** Small "regenerate this artifact" button shown in a Section header. */
function RegenButton({
  label,
  onClick,
  busy,
  disabled,
}: {
  label: string;
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      title={`Regenerate the ${label.toLowerCase()} from scratch (system action)`}
      className="flex shrink-0 items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
    >
      <RefreshCw className={cn("size-3", busy && "animate-spin")} />
      {busy ? "Regenerating…" : `Rerun ${label}`}
    </button>
  );
}

function Chips({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((s, i) => (
        <span
          key={`${s}-${i}`}
          className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[11px]"
        >
          {s}
        </span>
      ))}
    </div>
  );
}

/** Read-only mirror of the theme tweaker: meta row + light/dark toggle + the
 *  same grouped token swatches (Brand / Surfaces / … / Charts). */
function ThemeCard({ theme, action }: { theme: ThemeInfo; action?: React.ReactNode }) {
  const [mode, setMode] = useState<"light" | "dark">("light");
  const palette = mode === "light" ? theme.light : theme.dark;
  return (
    <Section title="Theme" durationMs={theme.durationMs} action={action}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <span className="font-medium">{theme.name}</span>
        <span className="text-muted-foreground">preset {theme.preset}</span>
        <span className="text-muted-foreground">
          {theme.fonts.heading} / {theme.fonts.body}
        </span>
        <span className="text-muted-foreground">radius {theme.radius}</span>
        <div className="ml-auto flex gap-0.5 rounded-md border border-border p-0.5">
          {(["light", "dark"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-medium capitalize transition-colors",
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {TOKEN_GROUPS.map((group) => {
          const tokens = group.tokens.filter((t) => palette[t]);
          if (tokens.length === 0) return null;
          return (
            <div key={group.title}>
              <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                {tokens.map((token) => (
                  <div key={token} className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="size-5 shrink-0 rounded border border-border"
                      style={{ backgroundColor: palette[token] }}
                    />
                    <div className="min-w-0 leading-tight">
                      <div className="truncate font-mono text-[10px] text-foreground">{token}</div>
                      <div className="truncate font-mono text-[9px] text-muted-foreground">{palette[token]}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function SitemapCard({ sitemap, action }: { sitemap: SitemapInfo; action?: React.ReactNode }) {
  return (
    <Section title="Sitemap / information architecture" durationMs={sitemap.durationMs} action={action}>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          home: <span className="font-mono text-foreground">{sitemap.home}</span>
        </span>
        {sitemap.shellLayout && (
          <span>
            shell: <span className="font-mono text-foreground">{sitemap.shellLayout}</span>
          </span>
        )}
        <span>
          nav:{" "}
          <span className="font-mono text-foreground">
            {sitemap.navigation.map((n) => n.page).join(" · ") || "—"}
          </span>
        </span>
      </div>

      <div className="space-y-2.5">
        {sitemap.pages.map((p) => (
          <div key={p.id} className="rounded-lg border border-border px-3 py-2">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium">{p.name}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{p.id}</span>
              {p.primaryEntity && (
                <span className="ml-auto rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {p.primaryEntity}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{p.purpose}</p>
            {p.sections.length > 0 && (
              <div className="mt-1.5">
                <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Sections
                </div>
                <Chips items={p.sections} />
              </div>
            )}
            {p.states.length > 0 && (
              <div className="mt-1.5">
                <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  States
                </div>
                <Chips items={p.states} />
              </div>
            )}
          </div>
        ))}
      </div>

      {sitemap.flows.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            Key flows
          </div>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
            {sitemap.flows.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

/** Replace `[icon:<lucide-name>]` literals with inline `<img>` tags pointing
 *  at the lucide-static CDN. Storage stays in the literal `[icon:...]` form
 *  (frontend agent reads it raw); this is display-only post-processing. */
function renderIcons(html: string): string {
  return html.replace(
    /\[icon:([a-z0-9-]+)\]/g,
    `<img src="https://unpkg.com/lucide-static@latest/icons/$1.svg" alt="$1" style="display:inline-block;width:1em;height:1em;vertical-align:-0.15em;margin:0 0.15em;opacity:0.85" />`,
  );
}

function MockupContent({
  mode,
  content,
  fullscreen = false,
}: {
  mode: DesignMode;
  content: string;
  /** Sized to fill its container when true (used by the fullscreen overlay);
   *  otherwise uses the compact in-panel height. */
  fullscreen?: boolean;
}) {
  if (mode === "html")
    return (
      <iframe
        title="Design mockup"
        srcDoc={renderIcons(content)}
        className={cn(
          "w-full rounded-lg border border-border bg-white",
          fullscreen ? "h-full" : "h-96",
        )}
      />
    );
  if (mode === "image") {
    // The image-gen path stores content as a `data:image/...;base64,...` URL
    // — render it directly as an <img>. (Legacy SVG content was removed; any
    // pre-existing image slots from before the prompt clean-up still work.)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- data URL, not a hosted asset; Image/Next can't optimise it
      <img
        alt="Design mockup"
        src={content}
        className={cn(
          "block w-full rounded-lg border border-border bg-white",
          fullscreen ? "h-full object-contain" : "max-h-96 object-contain",
        )}
      />
    );
  }
  return (
    <pre
      className={cn(
        "w-full overflow-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-3 font-mono text-[11px] leading-relaxed",
        fullscreen ? "h-full" : "max-h-96",
      )}
    >
      {content}
    </pre>
  );
}

/** Full-viewport overlay for the mockup — Escape or backdrop click to close. */
function FullscreenMockup({
  mode,
  content,
  onClose,
}: {
  mode: DesignMode;
  content: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background/95 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-mono uppercase tracking-wide">Mockup · {mode}</span>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 hover:bg-accent hover:text-foreground"
        >
          <X className="size-3" /> Close (esc)
        </button>
      </div>
      <div className="min-h-0 flex-1" onClick={(e) => e.stopPropagation()}>
        <MockupContent mode={mode} content={content} fullscreen />
      </div>
    </div>
  );
}

/** Key for tracking which (pageId, mode) is currently generating. */
export type GenKey = string; // `${pageId}:${mode}` (or `*:${mode}` for "all pages")
const genKey = (mode: DesignMode, pageId?: string): GenKey => `${pageId ?? "*"}:${mode}`;

function MockupTabs({
  sitemap,
  mockups,
  editable,
  generating,
  onGenerate,
  onSelect,
  action,
}: {
  sitemap: SitemapInfo | null;
  mockups: MockupsInfo;
  editable: boolean;
  generating: Set<GenKey>;
  onGenerate: (mode: DesignMode, pageId: string) => void;
  onSelect: (mode: DesignMode) => void;
  action?: React.ReactNode;
}) {
  // Order pages by sitemap; tack any extras (e.g. legacy `_app`) at the end.
  const sitemapIds = sitemap?.pages.map((p) => p.id) ?? [];
  const extras = Object.keys(mockups.pages).filter((id) => !sitemapIds.includes(id));
  const pageIds = [...sitemapIds, ...extras];
  const pageName = (id: string) =>
    sitemap?.pages.find((p) => p.id === id)?.name ?? (id === LEGACY_PAGE_ID ? "Whole app (legacy)" : id);

  const [activePage, setActivePage] = useState<string>(pageIds[0] ?? "");
  const currentPage = pageIds.includes(activePage) ? activePage : pageIds[0];
  const slots = currentPage ? (mockups.pages[currentPage] ?? {}) : {};

  // Mode tab: prefer the global selected mode if present on THIS page, else
  // the first representation present, else the global selected (for + buttons).
  const [tab, setTab] = useState<DesignMode>(mockups.selected);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const presentModes = MOCKUP_MODES.filter((m) => slots[m]);
  const activeMode: DesignMode = slots[tab]
    ? tab
    : slots[mockups.selected]
      ? mockups.selected
      : (presentModes[0] ?? mockups.selected);
  const rep = slots[activeMode];

  // Per-page totals so a glance shows coverage across pages.
  const pageCount = (id: string) => MOCKUP_MODES.filter((m) => mockups.pages[id]?.[m]).length;

  const isGen = (mode: DesignMode, pageId: string) =>
    generating.has(genKey(mode, pageId)) || generating.has(genKey(mode));

  return (
    <Section title="Layout mockup" action={action}>
      {/* Page selector */}
      {pageIds.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-1">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Page
          </span>
          {pageIds.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setActivePage(id)}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors",
                currentPage === id
                  ? "bg-muted text-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {pageName(id)}
              <span className="text-[9px] text-muted-foreground/80">{pageCount(id)}/3</span>
            </button>
          ))}
        </div>
      )}

      {/* Mode tabs for the active page */}
      <div className="mb-3 flex flex-wrap items-center gap-1">
        {MOCKUP_MODES.map((mode) => {
          const exists = !!slots[mode];
          if (!exists) {
            return editable && currentPage ? (
              <button
                key={mode}
                type="button"
                disabled={isGen(mode, currentPage)}
                onClick={() => onGenerate(mode, currentPage)}
                className="flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-[11px] capitalize text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                {isGen(mode, currentPage) ? <Loader2 className="size-3 animate-spin" /> : "+"} {mode}
              </button>
            ) : null;
          }
          const slot = slots[mode];
          return (
            <button
              key={mode}
              type="button"
              onClick={() => setTab(mode)}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] capitalize transition-colors",
                activeMode === mode
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {mode}
              {typeof slot?.durationMs === "number" && (
                <span
                  className="rounded bg-foreground/10 px-1 py-px font-mono text-[9px] tabular-nums opacity-80"
                  title="Generation time"
                >
                  {formatDuration(slot.durationMs)}
                </span>
              )}
              {mockups.selected === mode && <span className="text-[8px] uppercase opacity-80">used</span>}
            </button>
          );
        })}
      </div>

      {rep ? (
        <div className="relative">
          <MockupContent mode={activeMode} content={rep.content} />
          <button
            type="button"
            onClick={() => setFullscreenOpen(true)}
            title="Open mockup fullscreen"
            className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-border bg-background/80 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur transition-colors hover:bg-background hover:text-foreground"
          >
            <Maximize2 className="size-3" />
            Fullscreen
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No representation yet for this page.</p>
      )}

      {editable && rep && currentPage && (
        <div className="mt-2 flex items-center gap-3 text-xs">
          <button
            type="button"
            disabled={isGen(activeMode, currentPage)}
            onClick={() => onGenerate(activeMode, currentPage)}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 capitalize text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            {isGen(activeMode, currentPage) && <Loader2 className="size-3 animate-spin" />}
            {isGen(activeMode, currentPage) ? "Regenerating" : "Regenerate"} {activeMode}
          </button>
          <label className="flex items-center gap-1.5 text-muted-foreground" title="Use this representation for the build (across all pages)">
            <input type="radio" checked={mockups.selected === activeMode} onChange={() => onSelect(activeMode)} />
            use {activeMode} for build
          </label>
        </div>
      )}
      {fullscreenOpen && rep && (
        <FullscreenMockup
          mode={activeMode}
          content={rep.content}
          onClose={() => setFullscreenOpen(false)}
        />
      )}
    </Section>
  );
}

export interface DesignTimingsInfo {
  theme: number;
  sitemap: number;
  mockups: number;
  total: number;
}

export function DesignReview({
  theme,
  sitemap,
  mockups,
  editable,
  generating,
  onGenerate,
  onSelect,
  onRerun,
  rerunningScope,
  lastTimings,
  onDismissTimings,
  building,
}: {
  theme: ThemeInfo | null;
  sitemap: SitemapInfo | null;
  mockups: MockupsInfo | null;
  editable: boolean;
  generating: Set<GenKey>;
  onGenerate: (mode: DesignMode, pageId: string) => void;
  onSelect: (mode: DesignMode) => void;
  /** System action: rerun a slice (or all) of the design phase from scratch. */
  onRerun: (scope: DesignScope) => void;
  /** Which scope is currently regenerating (null = idle). */
  rerunningScope: DesignScope | null;
  /** Per-stage timings from the most recent "Rerun all" — surfaced as a banner. */
  lastTimings?: DesignTimingsInfo | null;
  onDismissTimings?: () => void;
  building: boolean;
}) {
  const empty = !theme && !sitemap && !mockups;
  // Only one rerun runs at a time; everything is disabled while any is busy.
  const anyBusy = rerunningScope !== null || building;
  const regen = (scope: DesignScope, label: string) =>
    editable ? (
      <RegenButton
        label={label}
        onClick={() => onRerun(scope)}
        busy={rerunningScope === scope}
        disabled={anyBusy}
      />
    ) : undefined;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="font-heading text-lg font-semibold">Design</h2>
            <p className="text-sm text-muted-foreground">
              Review the theme, sitemap, and layout, then <b>Approve design</b> to build.
            </p>
          </div>
          {editable && !empty && (
            <button
              type="button"
              onClick={() => onRerun("all")}
              disabled={anyBusy}
              title="Discard the current design and run the design agent again from scratch"
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={cn("size-3.5", rerunningScope === "all" && "animate-spin")} />
              {rerunningScope === "all" ? "Redesigning…" : "Rerun all"}
            </button>
          )}
        </header>

        {lastTimings && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-medium text-emerald-700 dark:text-emerald-400">Last rerun</span>
              <span className="text-muted-foreground">
                Theme <span className="font-mono tabular-nums text-foreground">{formatDuration(lastTimings.theme)}</span>
                <span className="mx-1 opacity-50">║</span>
                Sitemap <span className="font-mono tabular-nums text-foreground">{formatDuration(lastTimings.sitemap)}</span>
                <span className="mx-1 text-muted-foreground/60" title="theme + sitemap ran in parallel — wall-clock is the slower of the two">
                  (parallel)
                </span>
                <span className="mx-1 opacity-50">→</span>
                Mockups <span className="font-mono tabular-nums text-foreground">{formatDuration(lastTimings.mockups)}</span>
                <span className="mx-1 opacity-50">·</span>
                Total <span className="font-mono tabular-nums text-foreground">{formatDuration(lastTimings.total)}</span>
              </span>
            </div>
            {onDismissTimings && (
              <button
                type="button"
                onClick={onDismissTimings}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Dismiss"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        )}

        {empty ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border py-16 text-center">
            <Palette
              className={building ? "size-6 animate-pulse text-amber-600" : "size-6 text-muted-foreground"}
            />
            <p className="max-w-xs text-sm text-muted-foreground">
              {building
                ? "Designing the theme, sitemap, and layout…"
                : "The design agent will produce the theme, sitemap, and layout mockup here."}
            </p>
          </div>
        ) : (
          <>
            {theme && <ThemeCard theme={theme} action={regen("theme", "theme")} />}
            {sitemap && <SitemapCard sitemap={sitemap} action={regen("sitemap", "sitemap")} />}
            {mockups && (
              <MockupTabs
                sitemap={sitemap}
                mockups={mockups}
                editable={editable}
                generating={generating}
                onGenerate={onGenerate}
                onSelect={onSelect}
                action={regen("mockups", "mockups")}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
