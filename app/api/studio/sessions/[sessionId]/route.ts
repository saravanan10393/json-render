import { NextResponse } from "next/server";
import {
  deleteSession,
  evalDraft,
  getDraft,
  getSession,
} from "@/lib/server/fragment-studio";

/** Session detail: metadata + current draft source + evaluation/preview. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const session = getSession(sessionId);
  if (!session) return NextResponse.json({ error: "not found" }, { status: 404 });
  const draft = getDraft(sessionId);
  const result = draft ? await evalDraft(sessionId) : null;
  return NextResponse.json({ session, draft, result });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  deleteSession(sessionId);
  return NextResponse.json({ ok: true });
}
