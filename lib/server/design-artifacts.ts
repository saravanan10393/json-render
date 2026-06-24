import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

// Local app-dir — no import from ./apps, whose chain reaches node:sqlite (which
// bun scripts can't load). Mirrors design-md.ts's deliberate decoupling.
const appDir = (appId: string) => path.join(process.cwd(), "data", appId);

/**
 * Design-stage artifacts (the Design agent's structured outputs), persisted
 * under data/<appId>/design/:
 *   - sitemap.json   — the information architecture (structural contract the
 *                      Frontend agent builds against).
 *   - artifact.json  — the throwaway layout mockup ({ mode, content }).
 * The durable theme lives separately as theme.json (see design-md.ts).
 */

export const SitemapPageSchema = z.object({
  id: z.string().describe("kebab-case page id, matches the frontend's pageId slug."),
  name: z.string(),
  role: z.string().default("user"),
  purpose: z.string().describe("One line: what this page is for."),
  primaryEntity: z.string().nullable().default(null),
  sections: z.array(z.string()).default([]).describe("Ordered section intents, top to bottom."),
});

export const SitemapNavSchema = z.object({
  label: z.string(),
  icon: z.string().nullable().default(null),
  page: z.string().describe("Target page id."),
});

/** Sitemap = the design agent's information-architecture spec for the app:
 *  every page, navigation rail, home, shell layout, and key flows.
 *  `durationMs` is stamped by setSitemapDuration after a scoped "Rerun
 *  sitemap" system action (chip in the design-review Sitemap header). */
export const SitemapSchema = z.object({
  pages: z.array(SitemapPageSchema).min(1),
  navigation: z.array(SitemapNavSchema).default([]),
  home: z.string().describe("Landing page id."),
  shellLayout: z.string().nullable().default(null),
  flows: z.array(z.string()).default([]).describe("Key user flows as short step sequences."),
  /** Wall-clock generation time (set server-side after a scoped rerun, not by
   *  the agent). Hidden from the agent's view; just round-tripped to the UI. */
  durationMs: z.number().nullable().default(null),
});
export type Sitemap = z.infer<typeof SitemapSchema>;

/** Patch durationMs onto the persisted sitemap.json without touching the rest. */
export function setSitemapDuration(appId: string, durationMs: number): void {
  const sitemap = readSitemap(appId);
  if (!sitemap) return;
  sitemap.durationMs = durationMs;
  mkdirSync(designDir(appId), { recursive: true });
  writeFileSync(path.join(designDir(appId), "sitemap.json"), JSON.stringify(sitemap, null, 2));
}

// text  = markdown layout description (agent writes)
// html  = static HTML/CSS mockup (agent writes)
// image = a generated PNG from the text→image model (default Gemini 3.1 Flash
//         Image). Bypasses the design agent for the per-page work — see
//         lib/server/image-gen.ts. Stored as a `data:image/...;base64,...`
//         URL so the build handoff can attach it directly as a vision input.
export const DESIGN_MODES = ["text", "html", "image"] as const;
export type DesignMode = (typeof DESIGN_MODES)[number];

export interface MockupSlot {
  content: string;
  savedAt: string;
  /** Wall-clock time the design agent's per-page turn took to generate this
   *  representation (set by setMockupDuration after agent.generate returns).
   *  Surfaced in the design-review tab as a small chip — useful for tuning
   *  per-mode prompts and spotting slow pages without opening logs. */
  durationMs?: number;
}

/** Per-page representations — each page can carry any subset of the three
 *  coexisting representations (text/html/image). */
export interface PageMockups {
  text?: MockupSlot;
  html?: MockupSlot;
  image?: MockupSlot;
}

/** Mockups for an app — one entry per sitemap page, plus a GLOBAL `selected`
 *  representation (the mode handed to the build, applied across all pages).
 *  Per-page mockups enable focused review, per-page regenerate, and parallel
 *  generation. The synthetic pageId `_app` holds legacy "whole-app" mockups
 *  from before the split. */
export interface Mockups {
  selected: DesignMode;
  pages: Record<string, PageMockups>;
}

/** Synthetic page id holding legacy "whole-app" mockups from the pre-split era. */
export const LEGACY_APP_PAGE_ID = "_app";

function designDir(appId: string): string {
  return path.join(appDir(appId), "design");
}

/** Remove every page mockup (incl. legacy blobs) — for a "rerun mockups" pass. */
export function clearMockups(appId: string): void {
  for (const f of ["mockups.json", "artifact.json"]) {
    rmSync(path.join(designDir(appId), f), { force: true });
  }
}

/**
 * Wipe the structural design artifacts (sitemap + every page mockup, incl.
 * legacy blobs) so a "rerun design from scratch" starts clean — the agent then
 * re-derives the sitemap and mockups, and re-applies the theme. theme.json /
 * DESIGN.md are left in place (applyDesignSystem overwrites them) so there is
 * never a window where the preview has no theme.
 */
export function clearDesignArtifacts(appId: string): void {
  rmSync(path.join(designDir(appId), "sitemap.json"), { force: true });
  clearMockups(appId);
}

export function writeSitemap(appId: string, sitemap: unknown): Sitemap {
  const parsed = SitemapSchema.parse(sitemap);
  mkdirSync(designDir(appId), { recursive: true });
  writeFileSync(path.join(designDir(appId), "sitemap.json"), JSON.stringify(parsed, null, 2));
  return parsed;
}

export function readSitemap(appId: string): Sitemap | null {
  const file = path.join(designDir(appId), "sitemap.json");
  if (!existsSync(file)) return null;
  try {
    return SitemapSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    return null;
  }
}

const mockupsFile = (appId: string) => path.join(designDir(appId), "mockups.json");

/**
 * Migrate older shapes into the per-page model:
 *   - `artifact.json` — earliest single-blob layout    → _app / {mode}
 *   - `mockups.json` v1 — flat {text?,html?,image?,selected}  → _app / {…}
 * Always lands legacy whole-app content under the synthetic LEGACY_APP_PAGE_ID;
 * the user can regenerate per-page when ready.
 */
function migrateLegacy(appId: string): Mockups | null {
  const v1File = mockupsFile(appId);
  if (existsSync(v1File)) {
    try {
      const v1 = JSON.parse(readFileSync(v1File, "utf8")) as Record<string, unknown>;
      if (v1.pages && typeof v1.pages === "object") {
        return v1 as unknown as Mockups; // already the per-page shape
      }
      const slots: PageMockups = {};
      for (const m of DESIGN_MODES) if (v1[m]) slots[m] = v1[m] as MockupSlot;
      if (Object.keys(slots).length > 0) {
        return {
          selected: (v1.selected as DesignMode) ?? DESIGN_MODES[0],
          pages: { [LEGACY_APP_PAGE_ID]: slots },
        };
      }
    } catch {
      /* fall through */
    }
  }
  const artifact = path.join(designDir(appId), "artifact.json");
  if (existsSync(artifact)) {
    try {
      const a = JSON.parse(readFileSync(artifact, "utf8")) as {
        mode: DesignMode;
        content: string;
        savedAt?: string;
      };
      return {
        selected: a.mode,
        pages: { [LEGACY_APP_PAGE_ID]: { [a.mode]: { content: a.content, savedAt: a.savedAt ?? "" } } },
      };
    } catch {
      /* fall through */
    }
  }
  return null;
}

export function readMockups(appId: string): Mockups | null {
  const file = mockupsFile(appId);
  if (!existsSync(file)) return migrateLegacy(appId);
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    if (raw.pages && typeof raw.pages === "object") return raw as unknown as Mockups;
    return migrateLegacy(appId); // legacy v1 lying in mockups.json
  } catch {
    return null;
  }
}

function persist(appId: string, mockups: Mockups): Mockups {
  mkdirSync(designDir(appId), { recursive: true });
  writeFileSync(mockupsFile(appId), JSON.stringify(mockups, null, 2));
  return mockups;
}

/** Upsert one (pageId, mode) slot without clobbering the others. */
export function writeMockup(
  appId: string,
  pageId: string,
  mode: DesignMode,
  content: string,
): Mockups {
  const mockups: Mockups = readMockups(appId) ?? { selected: mode, pages: {} };
  const page = mockups.pages[pageId] ?? {};
  page[mode] = { content, savedAt: new Date().toISOString() };
  mockups.pages[pageId] = page;
  // Keep `selected` valid: if no page has the currently-selected mode yet,
  // fall back to this mode.
  const anyHasSelected = Object.values(mockups.pages).some((p) => p[mockups.selected]);
  if (!anyHasSelected) mockups.selected = mode;
  return persist(appId, mockups);
}

/** Patch the `durationMs` on an existing slot without touching `content`. The
 *  agent writes content via `saveDesignArtifact`; we wrap the whole turn in
 *  `generateMockupRepresentation` to time it, then stamp the duration here. */
export function setMockupDuration(
  appId: string,
  pageId: string,
  mode: DesignMode,
  durationMs: number,
): void {
  const mockups = readMockups(appId);
  const slot = mockups?.pages[pageId]?.[mode];
  if (!mockups || !slot) return;
  slot.durationMs = durationMs;
  persist(appId, mockups);
}

export function setSelectedMockup(appId: string, mode: DesignMode): Mockups | null {
  const mockups = readMockups(appId);
  if (!mockups) return null;
  mockups.selected = mode;
  return persist(appId, mockups);
}

/** Per-page selected content for the build handoff. Skips pages missing the
 *  selected representation; if NO page has it, returns null. */
export function selectedMockups(
  appId: string,
): { mode: DesignMode; pages: Array<{ pageId: string; content: string }> } | null {
  const mockups = readMockups(appId);
  if (!mockups) return null;
  const pages = Object.entries(mockups.pages)
    .map(([pageId, page]) => {
      const slot = page[mockups.selected];
      return slot ? { pageId, content: slot.content } : null;
    })
    .filter((x): x is { pageId: string; content: string } => x !== null);
  return pages.length > 0 ? { mode: mockups.selected, pages } : null;
}

/** Which (pageId, mode) slots exist — used to summarise state in agent context. */
export function listMockupSlots(appId: string): Array<{ pageId: string; mode: DesignMode }> {
  const mockups = readMockups(appId);
  if (!mockups) return [];
  const out: Array<{ pageId: string; mode: DesignMode }> = [];
  for (const [pageId, page] of Object.entries(mockups.pages)) {
    for (const mode of DESIGN_MODES) if (page[mode]) out.push({ pageId, mode });
  }
  return out;
}
