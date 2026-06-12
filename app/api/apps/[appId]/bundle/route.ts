import { NextResponse } from "next/server";
import { getApp, readAllPages, readAppIndex } from "@/lib/server/apps";
import { getAppTheme } from "@/lib/server/design-md";

/** Full app bundle for the runtime: index + every page file + theme. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params;
  const app = getApp(appId);
  if (!app) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    app,
    index: readAppIndex(appId),
    pages: readAllPages(appId),
    theme: getAppTheme(appId),
  });
}
