import { NextResponse } from "next/server";
import { getApp } from "@/lib/server/apps";
import { type DesignScope, rerunDesign, runDesignParallel } from "@/lib/server/builder-run";
import { ensureRun } from "@/lib/server/runs";

// Runs the design agent autonomously — give it room.
export const maxDuration = 300;

const SCOPES: readonly DesignScope[] = ["all", "theme", "sitemap", "mockups"];

/**
 * System action: rerun a slice of the design phase from scratch (no chat turn).
 * Body `scope` selects what to regenerate: "all" | "theme" | "sitemap" |
 * "mockups" (defaults to "all"). For "all", uses runDesignParallel — fires
 * theme + sitemap concurrently, then per-page mockups — and returns a per-
 * stage timing breakdown the UI can render.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params;
  const app = getApp(appId);
  if (!app) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { scope } = (await req.json().catch(() => ({}))) as { scope?: string };
  const resolved: DesignScope = SCOPES.includes(scope as DesignScope) ? (scope as DesignScope) : "all";

  const run = ensureRun(appId);

  if (resolved === "all") {
    const { mockups, timings } = await runDesignParallel(
      appId,
      app.name,
      run.config.models?.design,
      run.config.models?.imageGen,
    );
    return NextResponse.json({ mockups, timings });
  }

  const mockups = await rerunDesign(
    appId,
    app.name,
    resolved,
    run.config.models?.design,
    run.config.models?.imageGen,
  );
  return NextResponse.json({ mockups });
}
