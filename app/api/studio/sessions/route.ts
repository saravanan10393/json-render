import { NextResponse } from "next/server";
import {
  createSession,
  ensureStudioSandbox,
  listCategories,
  listLibraryFragments,
  listSessions,
} from "@/lib/server/fragment-studio";

export async function GET() {
  ensureStudioSandbox();
  return NextResponse.json({
    sessions: listSessions(),
    library: listLibraryFragments(),
    categories: listCategories(),
  });
}

/** Create a session — body { fromFragment? } forks a library fragment (edit). */
export async function POST(req: Request) {
  const { fromFragment } = (await req.json().catch(() => ({}))) as {
    fromFragment?: string;
  };
  try {
    const session = createSession(fromFragment);
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
