import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { lint as lintDesign } from "@google/design.md/linter";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { findThemePreset } from "../jr/theme-catalog";
import { THEME_PRESETS, type ThemePreset } from "../jr/theme-presets";

// NOTE: no import from ./apps — that chain reaches node:sqlite, which bun
// scripts can't load. The app dir layout is recomputed here.
const appDir = (appId: string) => path.join(process.cwd(), "data", appId);

/**
 * Theme pipeline. Three modes feed one runtime artifact (theme.json):
 *
 *  - PICK    → build theme.json straight from a THEME_PRESETS entry. No DESIGN.md.
 *  - EDIT    → overlay token/font/radius tweaks onto a base theme (the human
 *              tweaker, or any in-place change). No DESIGN.md.
 *  - CREATE  → the design agent authors a full palette from scratch; THIS is the
 *              only path that writes a DESIGN.md (github.com/google-labs-code/design.md)
 *              spec artifact, lints it, then parses it to theme.json.
 *
 * DESIGN.md conventions layered on the spec so themes drive our shadcn runtime:
 *  - `colors` keys are shadcn semantic tokens (background, primary, …) plus
 *    `dark-<token>` for the dark palette.
 *  - `typography.heading` / `typography.body` carry Google Font families.
 *  - `rounded.md` becomes the base --radius.
 *
 * theme.json (per app) is applied by the preview as scoped CSS variables.
 */

/** shadcn tokens a theme must define (light; dark via `dark-` prefix). */
export const REQUIRED_TOKENS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
] as const;

/**
 * Optional tokens a theme MAY define for richer control — applied if present,
 * otherwise the globals.css defaults stand.
 */
export const EXTENDED_TOKENS = [
  "chart-1", "chart-2", "chart-3", "chart-4", "chart-5",
  "sidebar", "sidebar-foreground", "sidebar-primary", "sidebar-primary-foreground",
  "sidebar-accent", "sidebar-accent-foreground", "sidebar-border", "sidebar-ring",
  "success", "success-foreground", "warning", "warning-foreground", "info", "info-foreground",
] as const;

/**
 * Elevation scale — box-shadow strings (NOT colors), keyed by Tailwind shadow
 * utility. They ride in the light/dark token maps and are emitted as `--shadow-*`
 * CSS vars by the runtime; globals.css maps the utilities to them. This is the
 * token category that makes neumorphism / claymorphism / brutalism expressible.
 */
export const SHADOW_TOKENS = [
  "shadow-2xs", "shadow-xs", "shadow-sm", "shadow",
  "shadow-md", "shadow-lg", "shadow-xl", "shadow-2xl",
] as const;

export interface AppTheme {
  name: string;
  preset: string;
  light: Record<string, string>;
  dark: Record<string, string>;
  fonts: { heading: string; body: string; mono?: string };
  radius: string;
  /** Wall-clock time the design agent took to produce this theme (set by
   *  setThemeDuration after a "Rerun theme" system action). Surfaced as a
   *  small chip in the design-review Theme header. */
  durationMs?: number;
}

/** Patch durationMs onto the persisted theme.json without touching the rest. */
export function setThemeDuration(appId: string, durationMs: number): void {
  const theme = getAppTheme(appId);
  if (!theme) return;
  theme.durationMs = durationMs;
  const dir = appDir(appId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "theme.json"), JSON.stringify(theme, null, 2));
}

interface Frontmatter {
  name?: string;
  colors?: Record<string, string>;
  typography?: Record<string, { fontFamily?: string; fontSize?: string }>;
  rounded?: Record<string, string>;
  [k: string]: unknown;
}

function splitFrontmatter(source: string): { frontmatter: Frontmatter; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(source);
  if (!match) throw new Error("DESIGN.md has no YAML frontmatter");
  return { frontmatter: parseYaml(match[1]) as Frontmatter, body: match[2] };
}

export function parseDesignMd(source: string, preset: string): AppTheme {
  const { frontmatter } = splitFrontmatter(source);
  const colors = frontmatter.colors ?? {};

  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};
  for (const [key, value] of Object.entries(colors)) {
    if (key.startsWith("dark-")) dark[key.slice(5)] = value;
    else light[key] = value;
  }
  const missing = REQUIRED_TOKENS.filter((t) => !light[t]);
  if (missing.length > 0) {
    throw new Error(`DESIGN.md colors missing required tokens: ${missing.join(", ")}`);
  }
  // Every token defined in light falls back into dark unless overridden — so
  // extended tokens (chart/sidebar/state) themed in light also apply in dark.
  for (const token of Object.keys(light)) dark[token] ??= light[token];

  const typography = frontmatter.typography ?? {};
  const fonts = {
    heading: typography.heading?.fontFamily ?? typography.h1?.fontFamily ?? "Inter",
    body: typography.body?.fontFamily ?? typography["body-md"]?.fontFamily ?? "Inter",
    mono: typography.mono?.fontFamily,
  };

  return {
    name: frontmatter.name ?? preset,
    preset,
    light,
    dark,
    fonts,
    radius: frontmatter.rounded?.md ?? "0.625rem",
  };
}

/** Convert a theme preset (the unified library) into a runtime AppTheme. */
export function themePresetToAppTheme(preset: ThemePreset): AppTheme {
  const light = { ...preset.light };
  const dark = { ...preset.dark };
  for (const token of Object.keys(light)) dark[token] ??= light[token];
  return {
    name: preset.label,
    preset: preset.id,
    light,
    dark,
    fonts: { heading: preset.fonts.heading, body: preset.fonts.body },
    radius: preset.radius,
  };
}

// ── design.md lint gate (official @google/design.md, in-process) ──────────

/**
 * Validate DESIGN.md source with Google's official linter — run IN-PROCESS
 * (no `npx` subprocess), so it's fast and never flaky. Returns blocking errors;
 * a tooling failure is surfaced as a warning and does not block theming.
 * Note: we use the official lib only as the validation gate — token extraction
 * stays in parseDesignMd, which preserves our oklch values verbatim (the
 * official parser resolves every color to hex).
 */
export function lintDesignMd(source: string): { ok: boolean; errors: string[] } {
  try {
    const report = lintDesign(source);
    const errors = report.findings
      .filter((f) => f.severity === "error")
      .map((f) => `${f.path ? f.path + ": " : ""}${f.message}`);
    return { ok: report.summary.errors === 0, errors };
  } catch (error) {
    // Lint tooling failure should not block theming — surface as warning.
    console.warn("[design.md] lint unavailable:", error instanceof Error ? error.message.split("\n")[0] : error);
    return { ok: true, errors: [] };
  }
}

// ── theme.json read ───────────────────────────────────────────────────────

export function getAppTheme(appId: string): AppTheme | null {
  const file = path.join(appDir(appId), "theme.json");
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as AppTheme;
}

/** The id of the neutral baseline preset every un-themed app falls back to. */
export const DEFAULT_PRESET = "default";

let defaultThemeCache: AppTheme | null = null;

/** The default theme — the neutral `default` preset, built in-memory (no file
 *  written). Baseline for apps that haven't been themed yet. */
export function getDefaultTheme(): AppTheme {
  if (defaultThemeCache) return defaultThemeCache;
  const preset = findThemePreset(DEFAULT_PRESET);
  if (!preset) throw new Error(`missing baseline preset "${DEFAULT_PRESET}"`);
  defaultThemeCache = themePresetToAppTheme(preset);
  return defaultThemeCache;
}

/**
 * The app's theme, or the default-preset theme when none has been written yet.
 * Use this for the runtime + tweaker (every app is themeable, even with the
 * design stage off); use the null-returning getAppTheme where "not themed yet"
 * is the meaningful state (e.g. the design agent's context).
 */
export function getAppThemeOrDefault(appId: string): AppTheme {
  return getAppTheme(appId) ?? getDefaultTheme();
}

// ── writes ────────────────────────────────────────────────────────────────

function writeTheme(appId: string, theme: AppTheme): void {
  const dir = appDir(appId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "theme.json"), JSON.stringify(theme, null, 2));
}

export interface ApplyResult {
  ok: boolean;
  issues: string[];
  theme?: AppTheme;
}

/** PICK: apply a theme preset from the unified library straight to theme.json. */
export function pickThemePreset(appId: string, presetId: string): ApplyResult {
  const preset = findThemePreset(presetId);
  if (!preset) {
    return {
      ok: false,
      issues: [`unknown theme preset "${presetId}". Available: ${THEME_PRESETS.map((p) => p.id).join(", ")}`],
    };
  }
  const theme = themePresetToAppTheme(preset);
  writeTheme(appId, theme);
  return { ok: true, issues: [], theme };
}

export interface ThemeEditOptions {
  appId: string;
  /** The theme to overlay onto (e.g. the app's current theme). */
  base: AppTheme;
  /** shadcn token → color overrides; `dark-<token>` adjusts the dark palette. */
  colorTweaks?: Record<string, string>;
  headingFont?: string;
  bodyFont?: string;
  radius?: string;
}

/** EDIT: overlay token/font/radius tweaks onto a base theme → theme.json.
 *  In-place change (the human tweaker); never touches DESIGN.md. */
export function applyThemeEdit(options: ThemeEditOptions): ApplyResult {
  const light = { ...options.base.light };
  const dark = { ...options.base.dark };
  for (const [key, value] of Object.entries(options.colorTweaks ?? {})) {
    if (key.startsWith("dark-")) dark[key.slice(5)] = value;
    else light[key] = value;
  }
  for (const token of Object.keys(light)) dark[token] ??= light[token];

  const theme: AppTheme = {
    name: options.base.name,
    preset: options.base.preset,
    light,
    dark,
    fonts: {
      ...options.base.fonts,
      ...(options.headingFont ? { heading: options.headingFont } : {}),
      ...(options.bodyFont ? { body: options.bodyFont } : {}),
    },
    radius: options.radius ?? options.base.radius,
  };
  writeTheme(options.appId, theme);
  return { ok: true, issues: [], theme };
}

export interface AuthorThemeOptions {
  appId: string;
  /** Full shadcn token set the agent authored (light; `dark-` prefix for dark). */
  colors: Record<string, string>;
  headingFont?: string;
  bodyFont?: string;
  radius?: string;
}

/**
 * CREATE FROM SCRATCH: the design agent authors a bespoke palette. Builds a
 * DESIGN.md spec artifact (on top of the neutral baseline so any omitted
 * required token is still present), lints it, and parses it to theme.json.
 * The ONLY path that writes DESIGN.md.
 */
export async function authorThemeFromScratch(options: AuthorThemeOptions): Promise<ApplyResult> {
  const base = getDefaultTheme();
  const colors: Record<string, string> = {};
  for (const [token, value] of Object.entries(base.light)) colors[token] = value;
  for (const [token, value] of Object.entries(base.dark)) colors[`dark-${token}`] = value;
  for (const [key, value] of Object.entries(options.colors ?? {})) colors[key] = value; // agent wins

  const frontmatter: Frontmatter = {
    name: "Custom",
    colors,
    typography: {
      heading: { fontFamily: options.headingFont ?? "Inter" },
      body: { fontFamily: options.bodyFont ?? "Inter" },
    },
    rounded: { md: options.radius ?? "0.625rem" },
  };
  const source = `---\n${stringifyYaml(frontmatter).trimEnd()}\n---\n\n## Overview\nCustom theme authored for this app.\n`;

  let theme: AppTheme;
  try {
    theme = parseDesignMd(source, "custom");
  } catch (error) {
    return { ok: false, issues: [error instanceof Error ? error.message : String(error)] };
  }

  // Validate BEFORE writing anything, so a failed lint never leaves a bad
  // DESIGN.md on disk.
  const lintResult = lintDesignMd(source);
  if (!lintResult.ok) {
    return { ok: false, issues: ["DESIGN.md failed lint:", ...lintResult.errors] };
  }

  const dir = appDir(options.appId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "DESIGN.md"), source);
  writeTheme(options.appId, theme);
  return { ok: true, issues: [], theme };
}
