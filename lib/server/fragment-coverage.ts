import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fragmentRegistry } from "@/fragments";
import { readSitemap, type Sitemap } from "./design-artifacts";
import { searchFragments } from "./fragment-index";

/**
 * Fragment identification, preponed. Runs the SAME semantic search the frontend
 * agent uses (fragment-index, embeddings) over each sitemap section — once,
 * cached by sitemap hash — to produce:
 *   - a per-section best-match + gap flag (the developer gap-signal), and
 *   - a deduped set of suggested fragments (id · name · doc) fed to the
 *     frontend agent as a head start (a hint, not a constraint — it still
 *     searches to refine and builds gaps from primitives).
 *
 * Computed LAZILY (on demand: the Analyzer view, or the build turn) and cached
 * to data/<id>/design/coverage.json, because each section costs an embedding
 * call — never run it in the frequently-polled /model path.
 */

const appDir = (appId: string) => path.join(process.cwd(), "data", appId);
const cacheFile = (appId: string) => path.join(appDir(appId), "design", "coverage.json");

export interface SectionMatch {
  page: string;
  section: string;
  fragmentId: string | null;
  fragmentName: string | null;
  score: number;
  gap: boolean;
}

export interface SuggestedFragment {
  id: string;
  name: string;
  doc: string;
}

export interface FragmentCoverage {
  sections: SectionMatch[];
  gaps: SectionMatch[];
  coveragePct: number;
  suggestions: SuggestedFragment[];
  computedAt: string;
}

interface CoverageCache {
  sitemapHash: string;
  coverage: FragmentCoverage;
}

/** Hash only the bits that affect matching (sections + purposes). */
function sitemapHash(sitemap: Sitemap): string {
  const basis = sitemap.pages.map((p) => ({ purpose: p.purpose, sections: p.sections }));
  return createHash("sha256").update(JSON.stringify(basis)).digest("hex");
}

function readCache(appId: string): CoverageCache | null {
  const file = cacheFile(appId);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as CoverageCache;
  } catch {
    return null;
  }
}

function writeCache(appId: string, cache: CoverageCache): void {
  mkdirSync(path.join(appDir(appId), "design"), { recursive: true });
  writeFileSync(cacheFile(appId), JSON.stringify(cache, null, 2));
}

/** Wipe the cached coverage.json so the next computeFragmentCoverage call
 *  re-runs the embedding searches (the "Rerun analyzer" button). */
export function clearFragmentCoverage(appId: string): void {
  const file = cacheFile(appId);
  if (existsSync(file)) rmSync(file);
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Coverage for the app's sitemap — cached by sitemap hash. Returns null when
 * there is no sitemap (no design stage run).
 */
export async function computeFragmentCoverage(appId: string): Promise<FragmentCoverage | null> {
  const sitemap = readSitemap(appId);
  if (!sitemap) return null;

  const hash = sitemapHash(sitemap);
  const cached = readCache(appId);
  if (cached?.sitemapHash === hash) return cached.coverage;

  const sections: SectionMatch[] = [];
  const suggestions = new Map<string, SuggestedFragment>();

  for (const page of sitemap.pages) {
    for (const section of page.sections) {
      const query = `${page.name}: ${section}. ${page.purpose}`;
      const matches = await searchFragments(fragmentRegistry, query);
      const top = matches[0];
      const gap = !top || top.belowThreshold === true;
      sections.push({
        page: page.name,
        section,
        fragmentId: gap ? null : top.id,
        fragmentName: gap ? null : top.name,
        score: top ? round(top.similarity) : 0,
        gap,
      });
      if (!gap && top) suggestions.set(top.id, { id: top.id, name: top.name, doc: top.doc });
    }
  }

  const gaps = sections.filter((s) => s.gap);
  const coverage: FragmentCoverage = {
    sections,
    gaps,
    coveragePct: sections.length
      ? Math.round((100 * (sections.length - gaps.length)) / sections.length)
      : 0,
    suggestions: [...suggestions.values()],
    computedAt: new Date().toISOString(),
  };
  writeCache(appId, { sitemapHash: hash, coverage });
  return coverage;
}

/** A concise "suggested fragments" block to prepend into the frontend agent's
 *  context — the preponed fragment identification it can build from or refine. */
export function coverageToPrompt(coverage: FragmentCoverage): string {
  const perSection = coverage.sections
    .map((s) =>
      s.gap
        ? `- ${s.page} › ${s.section}: no close fragment — build from primitives`
        : `- ${s.page} › ${s.section}: ${s.fragmentId} (${s.fragmentName}, ~${s.score})`,
    )
    .join("\n");
  const docs = coverage.suggestions.map((s) => s.doc).join("\n\n");
  return [
    "SUGGESTED FRAGMENTS (preponed from the approved sitemap — a head start, NOT a constraint; prefer these where they fit, call searchFragments to refine or find others, and build gap sections from primitives):",
    perSection,
    docs ? `\nFragment docs for the suggestions above:\n${docs}` : "",
  ].join("\n");
}
