import { NextResponse } from "next/server";
import { clearFragmentCoverage, computeFragmentCoverage } from "@/lib/server/fragment-coverage";

/**
 * Fragment analyzer — the preponed, semantic fragment identification for the
 * app's sitemap. Cached by sitemap hash (each section costs an embedding call),
 * so the GET is fast on re-opens. POST forces a recompute by wiping the cache,
 * exposed as the "Rerun" button in the analyzer view.
 *  GET  → (cached) coverage for the current sitemap; null if no sitemap yet.
 *  POST → wipe cache + recompute; returns { coverage, durationMs }.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params;
  const coverage = await computeFragmentCoverage(appId);
  return NextResponse.json({ coverage });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params;
  clearFragmentCoverage(appId);
  const startMs = performance.now();
  const coverage = await computeFragmentCoverage(appId);
  const durationMs = Math.round(performance.now() - startMs);
  return NextResponse.json({ coverage, durationMs });
}
