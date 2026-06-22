"use client";

import { Check, ChevronDown, Loader2, Shuffle, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { FONT_OPTIONS, RADIUS_MAX, RADIUS_MIN, RADIUS_STEP, TOKEN_GROUPS } from "@/lib/jr/theme-options";
import { cn } from "@/lib/utils";
import type { ThemeInfo } from "./design-review";
import { THEME_PRESETS } from "@/lib/jr/theme-presets";
import { shufflePalette } from "./theme-shuffle";

type Mode = "light" | "dark";

// Collapsible token groups for the Customize section — shared with the design
// page's read-only Theme artifact so the two representations match.
const GROUPS = TOKEN_GROUPS;

// Preset style families, in library order — groups the picker grid.
const PRESET_CATEGORIES = [...new Set(THEME_PRESETS.map((p) => p.category))];

// Reused 1×1 canvas — the browser parses ANY CSS color (incl. oklch) into the
// fillStyle and getImageData hands it back as sRGB bytes. (getComputedStyle's
// `.color` now preserves oklch in modern browsers, which broke the old parser.)
let _swatchCtx: CanvasRenderingContext2D | null | undefined;

/** Resolve any CSS color (incl. oklch) to #rrggbb for the native color input. */
function cssToHex(value: string | undefined): string {
  if (!value || typeof document === "undefined") return "#000000";
  if (_swatchCtx === undefined) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    _swatchCtx = c.getContext("2d");
  }
  if (!_swatchCtx) return "#000000";
  _swatchCtx.fillStyle = "#000000"; // fallback if `value` is not a valid color
  _swatchCtx.fillStyle = value;
  _swatchCtx.fillRect(0, 0, 1, 1);
  const [r, g, b] = _swatchCtx.getImageData(0, 0, 1, 1).data;
  return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
}

function ColorRow({
  token,
  value,
  onChange,
}: {
  token: string;
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={cssToHex(value)}
        onChange={(e) => onChange(e.target.value)}
        className="size-6 shrink-0 cursor-pointer rounded border border-border bg-transparent"
        title={`Pick ${token}`}
      />
      <span className="w-28 shrink-0 truncate font-mono text-[10px] text-muted-foreground">{token}</span>
      <input
        type="text"
        value={value ?? ""}
        placeholder="default"
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}

function Group({
  title,
  tokens,
  palette,
  defaultOpen,
  onColor,
}: {
  title: string;
  tokens: string[];
  palette: Record<string, string>;
  defaultOpen?: boolean;
  onColor: (token: string, v: string) => void;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-accent"
      >
        {title}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-border px-2.5 py-2">
          {tokens.map((t) => (
            <ColorRow key={t} token={t} value={palette[t]} onChange={(v) => onColor(t, v)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ThemeTweaker({
  appId,
  theme,
  onPreview,
  onApplied,
  onClose,
}: {
  appId: string;
  theme: ThemeInfo;
  /** Fires synchronously on every edit — paint the preview instantly. */
  onPreview: (theme: ThemeInfo) => void;
  /** Fires after the change is persisted — commit it as the canonical theme. */
  onApplied: (theme: ThemeInfo) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>("light");
  const [light, setLight] = useState<Record<string, string>>(() => ({ ...theme.light }));
  const [dark, setDark] = useState<Record<string, string>>(() => ({ ...theme.dark }));
  const [headingFont, setHeadingFont] = useState(theme.fonts.heading);
  const [bodyFont, setBodyFont] = useState(theme.fonts.body);
  const [radius, setRadius] = useState(theme.radius);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = useCallback(
    (over: {
      light?: Record<string, string>;
      dark?: Record<string, string>;
      radius?: string;
      headingFont?: string;
      bodyFont?: string;
      // When set, this is a PRESET PICK: the server replaces the whole theme
      // (incl. identity) from the preset, and `name`/`preset` carry that identity
      // into the optimistic preview. Otherwise it's an in-place token edit.
      presetId?: string;
      name?: string;
      preset?: string;
    } = {}) => {
      const L = over.light ?? light;
      const D = over.dark ?? dark;
      const hf = over.headingFont ?? headingFont;
      const bf = over.bodyFont ?? bodyFont;
      const r = over.radius ?? radius;
      // The composed theme — same shape as AppTheme — for instant preview + commit.
      const next: ThemeInfo = {
        ...theme,
        ...(over.name ? { name: over.name } : {}),
        ...(over.preset ? { preset: over.preset } : {}),
        light: L,
        dark: D,
        radius: r,
        fonts: { ...theme.fonts, heading: hf, body: bf },
      };
      onPreview(next); // paint the live preview NOW, before any network round-trip

      const colorTweaks: Record<string, string> = { ...L };
      for (const [k, v] of Object.entries(D)) colorTweaks[`dark-${k}`] = v;
      const body = over.presetId
        ? { preset: over.presetId }
        : { colorTweaks, headingFont: hf, bodyFont: bf, radius: r };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        setSaving(true);
        try {
          await fetch(`/api/apps/${appId}/theme`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          onApplied(next); // persisted — commit as canonical (clears the override)
        } finally {
          setSaving(false);
        }
      }, 450);
    },
    [appId, light, dark, radius, headingFont, bodyFont, theme, onPreview, onApplied],
  );

  const setColor = (token: string, value: string) => {
    if (mode === "light") {
      const next = { ...light, [token]: value };
      setLight(next);
      apply({ light: next });
    } else {
      const next = { ...dark, [token]: value };
      setDark(next);
      apply({ dark: next });
    }
  };

  const applyPreset = (presetId: string) => {
    const p = THEME_PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    // A pick replaces the whole theme: set local state to the preset's exact
    // palettes (dark inherits light where unset, mirroring the server), fonts,
    // radius, and identity.
    const nl = { ...p.light };
    const nd = { ...p.dark };
    for (const t of Object.keys(nl)) nd[t] ??= nl[t];
    setLight(nl);
    setDark(nd);
    setRadius(p.radius);
    setHeadingFont(p.fonts.heading);
    setBodyFont(p.fonts.body);
    apply({
      light: nl,
      dark: nd,
      radius: p.radius,
      headingFont: p.fonts.heading,
      bodyFont: p.fonts.body,
      presetId,
      name: p.label,
      preset: p.id,
    });
  };

  const doShuffle = () => {
    const s = shufflePalette();
    const nl = { ...light, ...s.light };
    const nd = { ...dark, ...s.dark };
    setLight(nl);
    setDark(nd);
    setRadius(s.radius);
    apply({ light: nl, dark: nd, radius: s.radius });
  };

  const palette = mode === "light" ? light : dark;

  // A preset is "active" when the live palette still matches its signature
  // (primary + background). Manual edits / shuffle break the match → none active.
  const activePresetId =
    THEME_PRESETS.find(
      (p) => p.light.primary === light.primary && p.light.background === light.background,
    )?.id ?? null;

  return (
    <aside className="dark fixed right-0 top-0 z-30 flex h-full w-80 flex-col border-l border-border bg-background text-foreground shadow-2xl">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-heading text-sm font-semibold">Theme</span>
          {saving && <Loader2 className="size-3 animate-spin text-amber-400" />}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {/* Mode toggle */}
        <div className="flex gap-1 rounded-md border border-border p-0.5">
          {(["light", "dark"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 rounded px-2 py-1 text-xs font-medium capitalize transition-colors",
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Presets */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Presets
            </div>
            <button
              type="button"
              onClick={doShuffle}
              className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Shuffle className="size-3" />
              Shuffle
            </button>
          </div>
          {PRESET_CATEGORIES.map((cat) => (
            <div key={cat} className="space-y-1">
              <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground/70">{cat}</div>
              <div className="grid grid-cols-3 gap-1.5">
                {THEME_PRESETS.filter((p) => p.category === cat).map((p) => {
                  const active = p.id === activePresetId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p.id)}
                      title={`${p.label} — ${p.description}`}
                      aria-pressed={active}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-left transition-colors",
                        active
                          ? "border-amber-400 bg-amber-400/10 ring-1 ring-amber-400"
                          : "border-border hover:bg-accent",
                      )}
                    >
                      <span
                        className="size-3 shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: (mode === "dark" ? p.dark.primary : p.light.primary) ?? p.swatch }}
                      />
                      <span className="truncate text-[10px]">{p.label}</span>
                      {active && <Check className="ml-auto size-3 shrink-0 text-amber-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Customize (active mode) */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Customize · {mode}
          </div>
          {GROUPS.map((g) => (
            <Group
              key={g.title}
              title={g.title}
              tokens={g.tokens}
              palette={palette}
              defaultOpen={g.defaultOpen}
              onColor={setColor}
            />
          ))}
        </div>

        {/* Typography + radius (shared across modes) */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Typography &amp; shape
          </div>
          {(
            [
              ["Heading", headingFont, setHeadingFont, "headingFont"],
              ["Body", bodyFont, setBodyFont, "bodyFont"],
            ] as const
          ).map(([label, value, set, key]) => {
            // Always include the current value so a non-listed preset font still shows.
            const opts = FONT_OPTIONS.includes(value) ? FONT_OPTIONS : [value, ...FONT_OPTIONS];
            return (
              <label key={label} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[10px] text-muted-foreground">{label}</span>
                <select
                  value={value}
                  onChange={(e) => {
                    set(e.target.value);
                    apply({ [key]: e.target.value });
                  }}
                  style={{ fontFamily: `"${value}", sans-serif` }}
                  className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-ring"
                >
                  {opts.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
          <label className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[10px] text-muted-foreground">Radius</span>
            <input
              type="range"
              min={RADIUS_MIN}
              max={RADIUS_MAX}
              step={RADIUS_STEP}
              value={Number.parseFloat(radius) || 0}
              onChange={(e) => {
                const v = `${e.target.value}rem`;
                setRadius(v);
                apply({ radius: v });
              }}
              className="min-w-0 flex-1 accent-amber-400"
            />
            <span className="w-12 shrink-0 text-right font-mono text-[10px] text-muted-foreground">{radius}</span>
          </label>
        </div>

        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Presets &amp; Shuffle set the full light + dark palette. Edits apply live to the {mode} palette;
          colors accept any CSS value (hex or oklch).
        </p>
      </div>
    </aside>
  );
}
