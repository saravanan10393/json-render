import { NextResponse } from "next/server";
import {
  deleteDraft,
  evalDraft,
  getSession,
  saveDraftSource,
} from "@/lib/server/fragment-studio";

/**
 * POST — two modes:
 *   { source, name? }  apply edited source (source panel) then evaluate
 *   { params }         re-evaluate the existing draft with preview params
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  if (!getSession(sessionId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = (await req.json()) as {
    source?: string;
    name?: string;
    params?: Record<string, unknown>;
  };

  if (body.source) {
    const name = body.name ?? /export const ([A-Z][A-Za-z0-9]*)\s*:/.exec(body.source)?.[1];
    if (!name) {
      return NextResponse.json(
        { error: "could not infer the fragment name — pass `name`" },
        { status: 400 },
      );
    }
    try {
      saveDraftSource(sessionId, name, body.source);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 400 },
      );
    }
  }

  const result = await evalDraft(sessionId, body.params);
  return NextResponse.json({ result });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  deleteDraft(sessionId);
  return NextResponse.json({ ok: true });
}
