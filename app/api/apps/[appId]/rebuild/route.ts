import { NextResponse } from "next/server";
import { getApp, touchApp } from "@/lib/server/apps";
import { runRebuild } from "@/lib/server/builder-run";
import { snapshotBuild } from "@/lib/server/builds";
import { readMockups } from "@/lib/server/design-artifacts";
import { resolveModel } from "@/lib/server/models";
import { ensureRun } from "@/lib/server/runs";

// Long-running rebuild — give it room (60 tool steps × LLM latency).
export const maxDuration = 600;

/**
 * System action: rebuild every page of the app from the approved design
 * artifacts (theme + sitemap + mockups). Runs the frontend agent server-side
 * with a `fresh: true` context — the previous page specs are excluded so the
 * agent rebuilds instead of refactoring its own output. Snapshots the result
 * into `data/<appId>/builds/<model-slug>/` for later A/B comparison.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params;
  const app = getApp(appId);
  if (!app) return NextResponse.json({ error: "not found" }, { status: 404 });

  const run = ensureRun(appId);
  const result = await runRebuild(appId, app.name, run.config);

  // Auto-snapshot under whichever model just produced this build, so a later
  // Rebuild on a different model preserves this one for comparison.
  const usedModel = resolveModel("frontend", run.config.models?.frontend);
  // Stamp the mockup mode the agent was handed for this build, so the Build
  // view can show "Built from <mode>" without having to diff specs later.
  const usedMode = readMockups(appId)?.selected;
  snapshotBuild(appId, usedModel, usedMode);
  touchApp(appId);

  return NextResponse.json({ pageIds: result.pageIds, modelSlug: usedModel });
}
