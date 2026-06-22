import { NextResponse } from "next/server";
import { getApp } from "@/lib/server/apps";
import { generateMockupRepresentation } from "@/lib/server/builder-run";
import { DESIGN_MODES, type DesignMode } from "@/lib/server/design-artifacts";
import { ensureRun } from "@/lib/server/runs";

// Runs the design agent — give it room.
export const maxDuration = 300;

/**
 * System action: generate (or regenerate) ONE mockup representation for ONE
 * page (or every page when pageId is omitted) by running the design agent
 * server-side — no chat turn. Returns the updated mockups.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params;
  const app = getApp(appId);
  if (!app) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { mode, pageId } = (await req.json()) as { mode?: string; pageId?: string };
  if (!mode || !(DESIGN_MODES as readonly string[]).includes(mode)) {
    return NextResponse.json({ error: "invalid mode" }, { status: 400 });
  }

  const run = ensureRun(appId);
  const mockups = await generateMockupRepresentation(
    appId,
    app.name,
    mode as DesignMode,
    typeof pageId === "string" && pageId.length > 0 ? pageId : undefined,
    run.config.models?.design,
    run.config.models?.imageGen,
  );
  return NextResponse.json({ mockups });
}
