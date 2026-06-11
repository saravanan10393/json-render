import { NextResponse } from "next/server";
import { promoteSession } from "@/lib/server/fragment-studio";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const { category } = (await req.json()) as { category?: string };
  if (!category) {
    return NextResponse.json({ error: "category is required" }, { status: 400 });
  }
  const result = await promoteSession(sessionId, category);
  return NextResponse.json({ result }, { status: result.ok ? 200 : 422 });
}
