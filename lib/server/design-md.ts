import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

// NOTE: no import from ./apps — that chain reaches node:sqlite, which bun
// scripts can't load. The app dir layout is recomputed here.
const appDir = (appId: string) => path.join(process.cwd(), "data", appId);

/**
 * DESIGN.md (github.com/google-labs-code/design.md) integration.
 *
 * Conventions layered on the spec so themes drive our shadcn-token runtime:
 *  - `colors` keys are the shadcn semantic tokens (background, foreground,
 *    card, primary, …) plus `dark-<token>` for the dark palette.
 *  - `typography.heading` / `typography.body` (+ optional `typography.mono`)
 *    carry Google Font families.
 *  - `rounded.md` becomes the base --radius.
 *
 * Source of truth per app: data/<appId>/DESIGN.md (preset + agent tweaks),
 * linted with the official `@google/design.md` CLI; the parsed runtime
 * artifact is data/<appId>/theme.json which the preview applies as scoped
 * CSS variables.
 */

const execFileAsync = promisify(execFile);

export const PRESETS_DIR = path.join(process.cwd(), "design", "presets");

/** shadcn tokens a preset must define (light; dark via `dark-` prefix). */
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

export interface AppTheme {
  name: string;
  preset: string;
  light: Record<string, string>;
  dark: Record<string, string>;
  fonts: { heading: string; body: string; mono?: string };
  radius: string;
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
  // dark palette falls back per-token to light (partial dark sets allowed)
  for (const token of REQUIRED_TOKENS) dark[token] ??= light[token];

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

// ── Presets ───────────────────────────────────────────────────────────────

export interface PresetInfo {
  id: string;
  name: string;
  mood: string;
}

export function listPresets(): PresetInfo[] {
  if (!existsSync(PRESETS_DIR)) return [];
  return readdirSync(PRESETS_DIR)
    .filter((f) => f.endsWith(".DESIGN.md"))
    .map((file) => {
      const id = file.replace(/\.DESIGN\.md$/, "");
      const source = readFileSync(path.join(PRESETS_DIR, file), "utf8");
      const { frontmatter } = splitFrontmatter(source);
      const mood = /## Overview\n+([^\n]+)/.exec(source)?.[1] ?? "";
      return { id, name: frontmatter.name ?? id, mood };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function readPreset(id: string): string | null {
  const file = path.join(PRESETS_DIR, `${id}.DESIGN.md`);
  return existsSync(file) ? readFileSync(file, "utf8") : null;
}

// ── Lint gate (official CLI) ──────────────────────────────────────────────

export async function lintDesignMd(file: string): Promise<{ ok: boolean; errors: string[] }> {
  try {
    const { stdout } = await execFileAsync(
      "npx",
      ["--yes", "@google/design.md", "lint", file],
      { cwd: process.cwd(), timeout: 60_000 },
    );
    const report = JSON.parse(stdout.slice(stdout.indexOf("{"))) as {
      findings: Array<{ severity: string; message: string; path?: string }>;
      summary: { errors: number };
    };
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

// ── Per-app apply / read ──────────────────────────────────────────────────

export interface ApplyDesignOptions {
  appId: string;
  preset: string;
  /** shadcn token → color overrides; `dark-<token>` adjusts the dark palette. */
  colorTweaks?: Record<string, string>;
  headingFont?: string;
  bodyFont?: string;
  radius?: string;
}

export async function applyDesignSystem(
  options: ApplyDesignOptions,
): Promise<{ ok: boolean; issues: string[]; theme?: AppTheme }> {
  const presetSource = readPreset(options.preset);
  if (!presetSource) {
    return {
      ok: false,
      issues: [
        `unknown design preset "${options.preset}". Available: ${listPresets()
          .map((p) => p.id)
          .join(", ")}`,
      ],
    };
  }

  const { frontmatter, body } = splitFrontmatter(presetSource);
  frontmatter.colors = { ...(frontmatter.colors ?? {}), ...(options.colorTweaks ?? {}) };
  frontmatter.typography = { ...(frontmatter.typography ?? {}) };
  if (options.headingFont) {
    frontmatter.typography.heading = {
      ...(frontmatter.typography.heading ?? {}),
      fontFamily: options.headingFont,
    };
  }
  if (options.bodyFont) {
    frontmatter.typography.body = {
      ...(frontmatter.typography.body ?? {}),
      fontFamily: options.bodyFont,
    };
  }
  if (options.radius) {
    frontmatter.rounded = { ...(frontmatter.rounded ?? {}), md: options.radius };
  }

  const source = `---\n${stringifyYaml(frontmatter).trimEnd()}\n---\n${body}`;

  let theme: AppTheme;
  try {
    theme = parseDesignMd(source, options.preset);
  } catch (error) {
    return { ok: false, issues: [error instanceof Error ? error.message : String(error)] };
  }

  const dir = appDir(options.appId);
  mkdirSync(dir, { recursive: true });
  const designFile = path.join(dir, "DESIGN.md");
  writeFileSync(designFile, source);

  const lint = await lintDesignMd(designFile);
  if (!lint.ok) {
    return { ok: false, issues: ["DESIGN.md failed lint:", ...lint.errors] };
  }

  writeFileSync(path.join(dir, "theme.json"), JSON.stringify(theme, null, 2));
  return { ok: true, issues: [], theme };
}

export function getAppTheme(appId: string): AppTheme | null {
  const file = path.join(appDir(appId), "theme.json");
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as AppTheme;
}
