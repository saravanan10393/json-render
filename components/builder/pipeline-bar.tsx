"use client";

import { Check, Cpu, Hammer, RotateCcw } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type Stage = "backend" | "design" | "frontend" | "done";

export type ModelRole = "backend" | "design" | "frontend" | "imageGen";

export interface ModelOption {
  id: string;
  label: string;
  description: string;
  family: string;
  /** True iff this option produces images (text→image). The picker filters
   *  the imageGen slot down to options where this is set; text-only models
   *  are filtered out, and vice versa for the text roles. */
  imageGen?: boolean;
}

export interface ModelCatalog {
  options: ModelOption[];
  roles: ModelRole[];
  defaults: Record<ModelRole, string>;
}

export interface RunState {
  appId: string;
  stage: Stage;
  config: {
    designer: boolean;
    fragments: boolean;
    models?: Partial<Record<ModelRole, string>>;
  };
  updatedAt: string;
}

// Views shown in the right panel. "analyzer" is a view-only, non-approval step
// (a side-view), never a run stage — it sits between Design and Build.
export type ViewKey = "backend" | "design" | "analyzer" | "frontend";

const VIEW_STEPS: { key: ViewKey; label: string }[] = [
  { key: "backend", label: "Data model" },
  { key: "design", label: "Design" },
  { key: "analyzer", label: "Analyzer" },
  { key: "frontend", label: "Build" },
];

const VIEW_INDEX: Record<ViewKey, number> = { backend: 0, design: 1, analyzer: 2, frontend: 3 };

/** The view index the live run sits on (Analyzer is never a run stage). */
function activeViewIndex(stage: Stage): number {
  if (stage === "backend") return 0;
  if (stage === "design") return 1;
  return 3; // frontend / done → Build
}

function Toggle({
  label,
  checked,
  disabled,
  hint,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  hint?: string;
  onChange?: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={hint}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
        disabled
          ? "cursor-not-allowed border-border text-muted-foreground/50"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          checked && !disabled ? "bg-emerald-500" : "bg-muted-foreground/40",
        )}
      />
      {label}
      {disabled && <span className="text-[8px] text-amber-500/70">soon</span>}
    </button>
  );
}

export function PipelineBar({
  run,
  busy,
  shownView,
  hasSitemap,
  canRebuild,
  onApprove,
  onRebuild,
  onReset,
  onToggle,
  onSelectStep,
  onModelChange,
}: {
  run: RunState | null;
  busy: boolean;
  /** The view whose panel is shown (a past stage, the active stage, or the analyzer). */
  shownView: ViewKey;
  /** Whether a sitemap exists — enables the Analyzer view. */
  hasSitemap: boolean;
  /** Whether the built app can be rebuilt (at the build stage with pages on disk). */
  canRebuild: boolean;
  onApprove: () => void;
  onRebuild: () => void;
  onReset: () => void;
  onToggle: (key: "designer" | "fragments", value: boolean) => void;
  onSelectStep: (view: ViewKey) => void;
  /** Save the per-app model map. Empty/undefined value clears the role override. */
  onModelChange: (role: ModelRole, modelId: string | undefined) => void;
}) {
  if (!run) return null;
  const cur = activeViewIndex(run.stage);
  const viewed = VIEW_INDEX[shownView];
  const atGate = run.stage === "backend" || run.stage === "design";

  return (
    <div className="dark flex shrink-0 items-center gap-4 border-b border-border bg-background px-4 py-2 text-foreground">
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {VIEW_STEPS.map((step, i) => {
          const skipped =
            (step.key === "design" && !run.config.designer) ||
            (step.key === "analyzer" && !hasSitemap);
          const state = skipped
            ? "skipped"
            : i < cur
              ? "done"
              : i === cur
                ? "active"
                : "todo";
          // Analyzer is a side-view: clickable whenever a sitemap exists.
          const clickable = step.key === "analyzer" ? hasSitemap : !skipped && i <= cur;
          const isViewed = i === viewed;
          return (
            <Fragment key={step.key}>
              {i > 0 && <span className="h-px w-4 bg-border" />}
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onSelectStep(step.key)}
                title={clickable ? `View ${step.label}` : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide transition-colors",
                  state === "active" && "text-amber-400",
                  state === "done" && "text-emerald-500",
                  (state === "todo" || state === "skipped") && "text-muted-foreground/50",
                  clickable && "cursor-pointer hover:bg-muted",
                  isViewed && i !== cur && "bg-muted ring-1 ring-amber-400/50",
                )}
              >
                <span
                  className={cn(
                    "flex size-4 items-center justify-center rounded-full border text-[9px]",
                    state === "active" && "border-amber-400",
                    state === "done" && "border-emerald-500",
                    (state === "todo" || state === "skipped") && "border-border",
                  )}
                >
                  {state === "done" ? <Check className="size-2.5" /> : i + 1}
                </span>
                {step.label}
                {step.key === "design" && skipped && <span className="text-[8px]">(off)</span>}
              </button>
            </Fragment>
          );
        })}
      </div>

      {/* Gate action */}
      {atGate && (
        <button
          type="button"
          onClick={onApprove}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
        >
          {run.stage === "backend" ? "Approve data model" : "Approve design"} →
        </button>
      )}

      {/* Rebuild — re-run the build from the current design (always available at
          the build stage; doesn't rely on the design-changed heuristic). */}
      {!atGate && canRebuild && (
        <button
          type="button"
          onClick={onRebuild}
          disabled={busy}
          title="Rebuild the app's pages and navigation from the current design"
          className="flex items-center gap-1.5 rounded-md border border-amber-500/60 px-3 py-1 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
        >
          <Hammer className={cn("size-3.5", busy && "animate-pulse")} />
          {busy ? "Rebuilding…" : "Rebuild"}
        </button>
      )}

      {/* Toggles + models + reset */}
      <div className="ml-auto flex items-center gap-2">
        <Toggle
          label="Designer"
          checked={run.config.designer}
          hint="Run the design stage (theme · sitemap · layout mockup) before building"
          onChange={(v) => onToggle("designer", v)}
        />
        <Toggle
          label="Fragments"
          checked={run.config.fragments}
          hint="Let the builder reuse prebuilt fragments"
          onChange={(v) => onToggle("fragments", v)}
        />
        <ModelsButton models={run.config.models ?? {}} onChange={onModelChange} />
        <button
          type="button"
          onClick={onReset}
          title="Reset run to the data-model stage"
          className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <RotateCcw className="size-3" />
          Reset
        </button>
      </div>
    </div>
  );
}

const ROLE_LABEL: Record<ModelRole, string> = {
  backend: "Backend (data model)",
  design: "Design (theme + sitemap)",
  frontend: "Frontend (pages)",
  imageGen: "Image gen (image mockup)",
};

/** Models popover — picks an OpenRouter model per agent role. Persists into
 *  RunConfig.models; empty selection falls back to the role default. */
function ModelsButton({
  models,
  onChange,
}: {
  models: Partial<Record<ModelRole, string>>;
  onChange: (role: ModelRole, modelId: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (catalog || !open) return;
    void fetch("/api/models")
      .then((r) => r.json())
      .then((data: ModelCatalog) => setCatalog(data));
  }, [open, catalog]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const overrideCount = Object.values(models).filter(Boolean).length;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Pick the model used by each agent role"
        className={cn(
          "flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          overrideCount > 0 && "text-emerald-400",
        )}
      >
        <Cpu className="size-3" />
        Models{overrideCount > 0 ? ` · ${overrideCount}` : ""}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-72 rounded-md border border-border bg-background p-2 shadow-2xl">
          {!catalog ? (
            <div className="px-2 py-2 text-[11px] text-muted-foreground">Loading…</div>
          ) : (
            <div className="space-y-2">
              {catalog.roles.map((role) => {
                // Filter options by role capability — imageGen only shows
                // text→image models; text roles only show non-imageGen ones.
                const options = catalog.options.filter((o) =>
                  role === "imageGen" ? !!o.imageGen : !o.imageGen,
                );
                const def = catalog.defaults[role];
                // The picker shows ONE row per real model. Selecting the
                // role's default model clears the per-app override (so future
                // default changes propagate); selecting anything else persists.
                const activeId = models[role] ?? def;
                const selected = options.find((o) => o.id === activeId);
                return (
                  <label key={role} className="block">
                    <div className="mb-0.5 text-[10px] font-medium text-foreground">{ROLE_LABEL[role]}</div>
                    <select
                      value={activeId}
                      onChange={(e) => onChange(role, e.target.value === def ? undefined : e.target.value)}
                      className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-ring"
                    >
                      {options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label} ({o.family}){o.id === def ? " · default" : ""}
                        </option>
                      ))}
                    </select>
                    {selected && (
                      <div className="mt-0.5 truncate text-[9px] text-muted-foreground" title={selected.description}>
                        {selected.description}
                      </div>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
