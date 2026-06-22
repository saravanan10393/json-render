import { NextResponse } from "next/server";
import { DEFAULT_MODELS, MODEL_OPTIONS, MODEL_ROLES } from "@/lib/server/models";

/** Curated model catalog + per-role defaults — drives the model picker UI.
 *  Read-only; per-app overrides are written through POST /api/apps/[id]/run. */
export function GET() {
  return NextResponse.json({
    options: MODEL_OPTIONS,
    roles: MODEL_ROLES,
    defaults: DEFAULT_MODELS,
  });
}
