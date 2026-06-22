import { NextResponse } from "next/server";
import { DESIGN_MODES, type DesignMode, setSelectedMockup } from "@/lib/server/design-artifacts";

/** Choose which mockup representation (text/html/image) is handed to the build. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params;
  const { mode } = (await req.json()) as { mode?: string };
  if (!mode || !(DESIGN_MODES as readonly string[]).includes(mode)) {
    return NextResponse.json({ error: "invalid mode" }, { status: 400 });
  }
  return NextResponse.json({ mockups: setSelectedMockup(appId, mode as DesignMode) });
}
