import { NextResponse } from "next/server";
import { getApp, touchApp } from "@/lib/server/apps";
import { listBuilds, restoreBuild, snapshotBuild } from "@/lib/server/builds";

/**
 * Per-model build snapshots — read the list, switch the active build, or take
 * an ad-hoc snapshot. The chat route auto-snapshots after every frontend turn,
 * so POST {snapshot} here is just for manual stashing.
 *
 *   GET                                  → { builds: BuildSnapshot[] }
 *   POST { action:"restore", dirSlug }   → switch the live build (destructive
 *                                          copy from builds/<dirSlug>/ to root)
 *   POST { action:"snapshot", modelSlug }→ stash current live build
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params;
  if (!getApp(appId)) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ builds: listBuilds(appId) });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params;
  if (!getApp(appId)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json()) as {
    action?: "restore" | "snapshot";
    dirSlug?: string;
    modelSlug?: string;
  };

  if (body.action === "restore" && body.dirSlug) {
    const ok = restoreBuild(appId, body.dirSlug);
    if (!ok) return NextResponse.json({ error: "snapshot not found" }, { status: 404 });
    touchApp(appId);
    return NextResponse.json({ ok: true, builds: listBuilds(appId) });
  }

  if (body.action === "snapshot" && body.modelSlug) {
    const snap = snapshotBuild(appId, body.modelSlug);
    return NextResponse.json({ ok: !!snap, snapshot: snap, builds: listBuilds(appId) });
  }

  return NextResponse.json({ error: "invalid request" }, { status: 400 });
}
