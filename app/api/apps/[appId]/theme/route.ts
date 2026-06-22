import { NextResponse } from "next/server";
import { touchApp } from "@/lib/server/apps";
import { applyThemeEdit, getAppThemeOrDefault, pickThemePreset } from "@/lib/server/design-md";

/**
 * Live theme changes from the builder's theme tweaker (never touches DESIGN.md):
 *  - { preset } → PICK: replace the whole theme from that preset (identity too).
 *  - otherwise  → EDIT: overlay token / font / radius tweaks onto the current theme.
 * Rewrites theme.json; the preview re-themes on the next bundle refresh.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params;
  // Tweaks apply on top of the app's theme, or the default-preset baseline if it
  // hasn't been themed yet — so the tweaker works even with the design stage off.
  const current = getAppThemeOrDefault(appId);

  const body = (await req.json()) as {
    preset?: string;
    colorTweaks?: Record<string, string>;
    headingFont?: string;
    bodyFont?: string;
    radius?: string;
  };

  const result = body.preset
    ? pickThemePreset(appId, body.preset)
    : applyThemeEdit({
        appId,
        base: current,
        colorTweaks: body.colorTweaks,
        headingFont: body.headingFont,
        bodyFont: body.bodyFont,
        radius: body.radius,
      });
  if (!result.ok) {
    return NextResponse.json({ error: result.issues.join("; ") }, { status: 400 });
  }
  touchApp(appId);
  return NextResponse.json({ theme: result.theme });
}
