import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

/**
 * Per-model build snapshots.
 *
 * Lets the user A/B different frontend models on the same prompt + design
 * artifacts (theme, sitemap, mockups stay shared in the app root) and switch
 * between them in place. Layout:
 *
 *   data/<appId>/
 *     theme.json · design/ · DESIGN.md                ← shared (never copied)
 *     user-*.json · app.json                          ← live (current build)
 *     builds/
 *       <slugSafe>/                                   ← model = z-ai/glm-5.2 → "z-ai--glm-5.2"
 *         user-*.json · app.json · meta.json
 *
 * Switching a snapshot to "live" is destructive (cpSync over the root); the
 * previous live build should already be snapshotted under its own slug.
 */

const appDir = (appId: string) => path.join(process.cwd(), "data", appId);

/** OpenRouter slugs contain "/" and ".", neither directory-safe on every FS. */
function safeSlug(modelSlug: string): string {
  return modelSlug.replace(/\//g, "--").replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** A page/index file at the app root (excludes shared design artifacts). */
function isBuildFile(name: string): boolean {
  if (name === "theme.json" || name === "DESIGN.md") return false;
  if (!name.endsWith(".json")) return false;
  return name === "app.json" || name.startsWith("user-");
}

export interface BuildSnapshot {
  /** Original model slug, e.g. "z-ai/glm-5.2" (unmangled). */
  modelSlug: string;
  /** Directory name on disk, e.g. "z-ai--glm-5.2". */
  dirSlug: string;
  savedAt: string;
  pages: string[];
  /** Mockup mode the agent was handed during this build (text/html/image).
   *  Surfaced as an app-level "Built from <mode>" badge above the runtime. */
  mockupMode?: string;
}

/**
 * Copy the current live build into builds/<safeSlug>/. Idempotent — overwrites
 * any prior snapshot for the same model. Returns null when there's nothing to
 * snapshot (no build files at root yet).
 */
export function snapshotBuild(
  appId: string,
  modelSlug: string,
  mockupMode?: string,
): BuildSnapshot | null {
  const root = appDir(appId);
  if (!existsSync(root)) return null;
  const files = readdirSync(root).filter(isBuildFile);
  if (files.length === 0) return null;

  const dirSlug = safeSlug(modelSlug);
  const dst = path.join(root, "builds", dirSlug);
  rmSync(dst, { recursive: true, force: true });
  mkdirSync(dst, { recursive: true });
  for (const f of files) cpSync(path.join(root, f), path.join(dst, f));

  const meta = { modelSlug, savedAt: new Date().toISOString(), pages: files, mockupMode };
  // Persist meta separately from the page JSONs (it's not a page file).
  writeFileSync(path.join(dst, "meta.json"), JSON.stringify(meta, null, 2));
  return { modelSlug, dirSlug, savedAt: meta.savedAt, pages: files, mockupMode };
}

/** The freshest snapshot's meta, or null when no builds have run yet — drives
 *  the "Built from <mode> · <model> · <time>" badge in the Build view. */
export function readLatestBuildMeta(appId: string): BuildSnapshot | null {
  return listBuilds(appId)[0] ?? null;
}

/** Every snapshot under builds/, newest first. */
export function listBuilds(appId: string): BuildSnapshot[] {
  const buildsRoot = path.join(appDir(appId), "builds");
  if (!existsSync(buildsRoot)) return [];
  const out: BuildSnapshot[] = [];
  for (const entry of readdirSync(buildsRoot)) {
    const dir = path.join(buildsRoot, entry);
    if (!statSync(dir).isDirectory()) continue;
    const metaPath = path.join(dir, "meta.json");
    let meta: { modelSlug?: string; savedAt?: string; pages?: string[]; mockupMode?: string } = {};
    if (existsSync(metaPath)) {
      try {
        meta = JSON.parse(readFileSync(metaPath, "utf8")) as typeof meta;
      } catch {
        /* fall through to fs stat fallback */
      }
    }
    const pages = readdirSync(dir).filter(isBuildFile);
    out.push({
      modelSlug: meta.modelSlug ?? entry.replace(/--/g, "/"),
      dirSlug: entry,
      savedAt: meta.savedAt ?? statSync(dir).mtime.toISOString(),
      pages,
      mockupMode: meta.mockupMode,
    });
  }
  return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/**
 * Make a snapshot the live build: wipe existing build files at the root, then
 * copy from the snapshot. Shared artifacts (theme.json, design/) are untouched.
 * Returns true on success, false if the snapshot dir doesn't exist.
 */
export function restoreBuild(appId: string, dirSlug: string): boolean {
  const root = appDir(appId);
  const src = path.join(root, "builds", safeSlug(dirSlug));
  if (!existsSync(src)) return false;
  for (const f of readdirSync(root).filter(isBuildFile)) {
    rmSync(path.join(root, f), { force: true });
  }
  for (const f of readdirSync(src).filter(isBuildFile)) {
    cpSync(path.join(src, f), path.join(root, f));
  }
  return true;
}
