import { NextResponse } from "next/server";
import { getApp } from "@/lib/server/apps";
import {
  ensureRun,
  nextStage,
  resetRun,
  setConfig,
  setStage,
  STAGES,
  type RunConfig,
  type Stage,
} from "@/lib/server/runs";

/**
 * Run-state control for the staged build pipeline. The orchestrator (chat
 * route) routes by `stage`; this endpoint is how the human advances it:
 *  - GET                       → the current run (stage + config)
 *  - POST { action:"approve" } → advance to the next stage (honours toggles)
 *  - POST { action:"reset" }   → back to the backend stage (keeps config)
 *  - POST { action:"reopen", stage } → jump the live stage to an earlier one
 *                                (re-run that agent — e.g. re-open Design)
 *  - POST { config:{...} }     → update the toggles (designer / fragments)
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params;
  return NextResponse.json({ run: ensureRun(appId) });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params;
  if (!getApp(appId)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json()) as {
    action?: "approve" | "reset" | "reopen";
    stage?: Stage;
    config?: Partial<RunConfig>;
  };

  let run = ensureRun(appId);
  if (body.config) run = setConfig(appId, body.config);
  if (body.action === "approve") run = setStage(appId, nextStage(run.stage, run.config));
  else if (body.action === "reset") run = resetRun(appId);
  else if (body.action === "reopen" && body.stage && (STAGES as readonly string[]).includes(body.stage))
    run = setStage(appId, body.stage);

  return NextResponse.json({ run });
}
